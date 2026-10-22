import {
  rpc as SorobanRpc,
  Keypair,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  scValToNative,
  nativeToScVal,
  Address,
} from "@stellar/stellar-sdk";
import { createRpcServer } from "@fund-my-cause/rpc-client";
import type { CampaignStatus } from "../types.js";
import type {
  AuthenticatedUser,
  Campaign,
  CampaignFilter,
  Contribution,
  User,
  GetCampaignsParams,
  CreateCampaignInput,
  UpdateCampaignInput,
  RecordContributionInput,
  Statistics,
  RawCampaignInfo,
  RawCampaignStats,
} from "../types.js";
import { mapCampaignStatus, nowUtcIso } from "@fund-my-cause/shared-utils";
import { logger } from "../logger.js";

/**
 * Run a contract call, logging (with structured fields, not console.*) and
 * swallowing any failure behind `fallback` instead of propagating it.
 *
 * Every read method below tolerates individual on-chain/RPC failures the
 * same way — this is the shared wrapper that replaces the repeated
 * try/catch + console.error block that used to appear in each of them.
 */
async function withErrorLogging<T>(
  operation: string,
  fallback: T,
  fn: () => Promise<T>,
): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    logger.error(
      { err: error, operation },
      `Contract call failed: ${operation}`,
    );
    return fallback;
  }
}

// ── Configuration ──────────────────────────────────────────────────────────────

export interface ContractServiceConfig {
  rpcUrl: string;
  networkPassphrase: string;
  /** Optional registry contract address for listing/searching campaigns. */
  registryContractId?: string;
}

function stroopsToIsoString(stroops: bigint): string {
  return new Date(Number(stroops) * 1000).toISOString();
}

const SOROBAN_DUMMY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";

// ── Service ────────────────────────────────────────────────────────────────────

export class ContractService {
  private readonly server: SorobanRpc.Server;
  readonly networkPassphrase: string;
  readonly registryContractId?: string;

  constructor(config: ContractServiceConfig) {
    // Use the shared factory so both graphql-api and indexer construct
    // rpc.Server with identical options (allowHttp derived from URL scheme).
    this.server = createRpcServer({ url: config.rpcUrl });
    this.networkPassphrase = config.networkPassphrase;
    this.registryContractId = config.registryContractId;
  }

  // ── Internal: Soroban view call ────────────────────────────────────────────

  /**
   * Execute a read-only contract view function via simulateTransaction.
   * `contractId` is the Soroban contract address to call.
   */
  private async view<T>(
    contractId: string,
    method: string,
    args: ReturnType<typeof nativeToScVal>[] = [],
  ): Promise<T> {
    const contract = new Contract(contractId);

    const account = {
      accountId: () => SOROBAN_DUMMY,
      sequenceNumber: () => "0",
      incrementSequenceNumber: () => {},
    } as unknown as ConstructorParameters<typeof TransactionBuilder>[0];

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const result = await this.server.simulateTransaction(tx);
    if (SorobanRpc.Api.isSimulationError(result)) {
      throw new Error(
        `Contract call failed [${contractId}.${method}]: ${result.error}`,
      );
    }
    return scValToNative(
      (result as SorobanRpc.Api.SimulateTransactionSuccessResponse).result!
        .retval,
    ) as T;
  }

  // ── Internal: fetch single campaign from its contract ──────────────────────

  private async fetchCampaign(id: string): Promise<Campaign | null> {
    return withErrorLogging(`fetchCampaign(${id})`, null, async () => {
      const [info, stats] = await Promise.all([
        this.view<RawCampaignInfo>(id, "get_campaign_info"),
        this.view<RawCampaignStats>(id, "get_stats"),
      ]);

      return {
        id,
        contractId: id,
        title: info.title,
        description: info.description,
        creator: info.creator,
        goal: stats.goal,
        raised: stats.total_raised,
        deadline: stroopsToIsoString(info.deadline),
        status: mapCampaignStatus(info.status),
        category: info.category,
        minContribution: info.min_contribution,
        maxContribution: info.max_contribution,
        totalContributors: stats.contributor_count,
        token: info.token,
        platformFeeBps: info.has_platform_config
          ? info.platform_fee_bps
          : undefined,
        hasRBACEnabled: info.has_platform_config,
        createdAt: nowUtcIso(),
        updatedAt: nowUtcIso(),
      };
    });
  }

  /**
   * List every campaign ID known to the registry.
   *
   * The registry's `list` view is offset/limit paginated with no "give me
   * everything" mode, so callers that need the full set (stats, trending,
   * search, per-user aggregation) page through it with an upper bound well
   * beyond any realistic campaign count. Centralized here so that workaround
   * exists in exactly one place instead of being copy-pasted per call site.
   */
  private async listAllCampaignIds(): Promise<string[]> {
    if (!this.registryContractId) return [];
    return this.view<string[]>(this.registryContractId, "list", [
      nativeToScVal(0, { type: "u32" }),
      nativeToScVal(1_000_000, { type: "u32" }),
    ]);
  }

  // ── Public read methods ────────────────────────────────────────────────────

  /**
   * Get a single campaign by its Soroban contract address.
   */
  async getCampaign(id: string): Promise<Campaign | null> {
    return this.fetchCampaign(id);
  }

  /**
   * List campaigns via the registry contract.
   * Requires `registryContractId` to be configured in the constructor.
   */
  async getCampaigns(params: GetCampaignsParams): Promise<Campaign[]> {
    if (!this.registryContractId) {
      logger.warn("getCampaigns called without registryContractId configured");
      return [];
    }

    return withErrorLogging("getCampaigns", [], async () => {
      const { pagination } = params;
      const ids = await this.view<string[]>(this.registryContractId!, "list", [
        nativeToScVal(pagination.offset, { type: "u32" }),
        nativeToScVal(pagination.limit, { type: "u32" }),
      ]);

      const campaigns = (
        await Promise.all(ids.map((id) => this.fetchCampaign(id)))
      ).filter(Boolean) as Campaign[];

      if (params.filter?.status?.length) {
        const allowed = new Set(params.filter.status);
        return campaigns.filter((c) => allowed.has(c.status));
      }

      return campaigns;
    });
  }

  /**
   * Get total campaign count from the registry.
   */
  async getCampaignCount(_filter?: CampaignFilter): Promise<number> {
    if (!this.registryContractId) return 0;
    return withErrorLogging("getCampaignCount", 0, async () => {
      const all = await this.listAllCampaignIds();
      return all.length;
    });
  }

  /**
   * Get trending campaigns (fetches all active campaigns and sorts by contribution velocity).
   * Requires `registryContractId` to be configured.
   */
  async getTrendingCampaigns(limit: number): Promise<Campaign[]> {
    if (!this.registryContractId) return [];
    return withErrorLogging("getTrendingCampaigns", [], async () => {
      const ids = await this.listAllCampaignIds();

      const withMetrics = (
        await Promise.all(
          ids.map(async (id) => {
            const campaign = await this.fetchCampaign(id);
            if (!campaign || campaign.status !== "Active") return null;
            return campaign;
          }),
        )
      ).filter(Boolean) as Campaign[];

      return withMetrics.slice(0, limit);
    });
  }

  /**
   * Search campaigns by title/description (client-side filter).
   * Requires `registryContractId` to be configured.
   */
  async searchCampaigns(query: string, limit: number): Promise<Campaign[]> {
    if (!this.registryContractId) return [];
    return withErrorLogging("searchCampaigns", [], async () => {
      const ids = await this.listAllCampaignIds();

      const q = query.toLowerCase();
      const matches = (
        await Promise.all(
          ids.map(async (id) => {
            const c = await this.fetchCampaign(id);
            if (!c) return null;
            if (
              c.title.toLowerCase().includes(q) ||
              c.description.toLowerCase().includes(q)
            ) {
              return c;
            }
            return null;
          }),
        )
      ).filter(Boolean) as Campaign[];

      return matches.slice(0, limit);
    });
  }

  /**
   * Get user profile by aggregating on-chain data across all known campaigns.
   */
  async getUser(address: string): Promise<User | null> {
    return withErrorLogging(`getUser(${address})`, null, async () => {
      let totalContributed = BigInt(0);
      let contributionCount = 0;

      if (this.registryContractId) {
        const ids = await this.listAllCampaignIds();

        for (const campaignId of ids) {
          try {
            const contribAmount = await this.view<bigint>(
              campaignId,
              "contribution",
              [new Address(address).toScVal()],
            );
            if (contribAmount > 0) {
              totalContributed += contribAmount;
              contributionCount++;
            }
          } catch {
            // Campaign may not exist or be inaccessible; skip
          }
        }
      }

      return {
        address,
        totalContributed,
        contributionCount,
        campaigns: [],
        contributions: [],
        joinedAt: nowUtcIso(),
      };
    });
  }

  /**
   * Get platform statistics by aggregating all registered campaigns.
   */
  async getStats(): Promise<Statistics> {
    const emptyStats: Statistics = {
      totalCampaigns: 0,
      activeCampaigns: 0,
      totalRaised: BigInt(0),
      totalContributors: 0,
      averageContribution: BigInt(0),
      successRate: 0,
    };

    if (!this.registryContractId) {
      return emptyStats;
    }

    return withErrorLogging("getStats", emptyStats, async () => {
      const ids = await this.listAllCampaignIds();

      // Fetch each campaign's info+stats in parallel rather than sequentially
      // awaiting two on-chain calls per campaign in a loop — matches the
      // Promise.all pattern already used by getCampaigns/getTrendingCampaigns.
      const perCampaign = await Promise.all(
        ids.map(async (id) => {
          try {
            const [info, stats] = await Promise.all([
              this.view<RawCampaignInfo>(id, "get_campaign_info"),
              this.view<RawCampaignStats>(id, "get_stats"),
            ]);
            return { info, stats };
          } catch {
            return null;
          }
        }),
      );

      let totalRaised = BigInt(0);
      let totalContributors = 0;
      let totalCampaigns = 0;
      let activeCampaigns = 0;
      let successfulCount = 0;

      for (const entry of perCampaign) {
        if (!entry) continue;
        const { info, stats } = entry;

        totalCampaigns++;
        totalRaised += stats.total_raised;
        totalContributors += stats.contributor_count;

        if (info.status === "Active") activeCampaigns++;
        if (info.status === "Successful") successfulCount++;
      }

      const avgContrib =
        totalContributors > 0
          ? totalRaised / BigInt(totalContributors)
          : BigInt(0);
      const successRate =
        totalCampaigns > 0 ? (successfulCount / totalCampaigns) * 100 : 0;

      return {
        totalCampaigns,
        activeCampaigns,
        totalRaised,
        totalContributors,
        averageContribution: avgContrib,
        successRate,
      };
    });
  }

  // ── Write methods ─────────────────────────────────────────────────────────

  /**
   * Verify that a Stellar account signed a given message.
   *
   * This is an off-chain utility — it does not call a Soroban contract.
   * Uses Keypair to verify the Ed25519 signature.
   */
  async verifySignature(
    address: string,
    message: string,
    signature: string,
  ): Promise<boolean> {
    return withErrorLogging("verifySignature", false, async () => {
      const keypair = Keypair.fromPublicKey(address);
      return keypair.verify(
        Buffer.from(message, "utf-8"),
        Buffer.from(signature, "hex"),
      );
    });
  }

  /**
   * Submit a pre-signed `initialize` transaction to deploy a new campaign.
   *
   * The caller must construct, sign, and pass the full XDR of the
   * `initialize` call on a **newly deployed** Soroban contract instance.
   *
   * Returns a `Campaign` object representing the newly created campaign.
   */
  async createCampaign(
    creator: AuthenticatedUser,
    input: CreateCampaignInput,
  ): Promise<Campaign> {
    throw new Error(
      "createCampaign requires a pre-signed deploy+initialize transaction. " +
        "Provide the signed XDR via a separate mutation field instead.",
    );
  }

  /**
   * Submit a pre-signed `update_metadata` transaction for an existing campaign.
   */
  async updateCampaign(
    id: string,
    user: AuthenticatedUser,
    input: UpdateCampaignInput,
  ): Promise<Campaign> {
    throw new Error(
      "updateCampaign requires a pre-signed update_metadata transaction. " +
        "Provide the signed XDR via a separate mutation field instead.",
    );
  }

  /**
   * Record a contribution that was already submitted to the chain.
   *
   * This reads the on-chain state to confirm the contribution exists
   * and returns a `Contribution` object derived from chain data.
   */
  async recordContribution(
    input: RecordContributionInput,
  ): Promise<Contribution> {
    // Verify contribution exists on-chain by checking the contributor's balance.
    // Unlike the read methods above this rethrows rather than falling back —
    // a caller that thinks it recorded a contribution needs to know when it
    // didn't — so it keeps its own try/catch instead of withErrorLogging.
    try {
      const contribAmount = await this.view<bigint>(
        input.campaignId,
        "contribution",
        [new Address(input.contributor).toScVal()],
      );

      if (contribAmount <= 0) {
        throw new Error(
          `No contribution found for ${input.contributor} in campaign ${input.campaignId}`,
        );
      }

      return {
        id: input.transactionHash,
        campaignId: input.campaignId,
        contributor: input.contributor,
        amount: contribAmount,
        timestamp: nowUtcIso(),
        transactionHash: input.transactionHash,
      };
    } catch (error) {
      logger.error(
        {
          err: error,
          campaignId: input.campaignId,
          contributor: input.contributor,
        },
        "Error recording contribution",
      );
      throw error;
    }
  }
}
