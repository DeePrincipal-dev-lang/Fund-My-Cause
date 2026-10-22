import {
  rpc,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  scValToNative,
  nativeToScVal,
  Address,
  Horizon,
} from "@stellar/stellar-sdk";

import type {
  FmcClientConfig,
  CampaignStats,
  CampaignInfo,
  PerformanceMetrics,
  ContributionRecord,
  MatchingConfig,
  ContributeOptions,
  WithdrawOptions,
  RefundOptions,
  SetupMatchingOptions,
  RefundMatchingSponsorOptions,
  CancelOptions,
  ListContributorsOptions,
} from "./types";
import { parseAndThrow } from "./errors";

function xlmToStroops(xlm: number): bigint {
  return BigInt(Math.round(xlm * 1e7));
}

function stroopsToXlm(stroops: bigint): number {
  return Number(stroops) / 1e7;
}

/**
 * Typed client for a **single** Fund-My-Cause crowdfund campaign contract.
 *
 * One instance is bound to one campaign, fixed by {@link FmcClientConfig.contractId}
 * at construction. To read across campaigns, discover their contract IDs with
 * {@link FmcRegistryClient} and construct one `FmcClient` per campaign.
 *
 * Methods fall into two groups:
 *
 * - **View methods** simulate the call and never submit a transaction, so they
 *   need no wallet, cost no fees, and change no state.
 * - **Write methods** build, sign (via the caller-supplied `signTx` callback),
 *   submit, and then poll for confirmation. Each resolves only once the
 *   transaction has succeeded on-chain.
 *
 * Amounts are exposed in XLM as `number` for convenience; the raw stroop values
 * are also returned where precision matters (`raisedStroops`, `goalStroops`, …).
 * Conversion helpers are exported separately as `xlmToStroops` / `stroopsToXlm`.
 *
 * @example
 * ```ts
 * const client = new FmcClient({
 *   contractId:        "C...",
 *   rpcUrl:            "https://soroban-testnet.stellar.org",
 *   networkPassphrase: "Test SDF Network ; September 2015",
 *   horizonUrl:        "https://horizon-testnet.stellar.org",
 * });
 *
 * const stats = await client.getStats();
 * console.log(`${stats.raisedXlm} / ${stats.goalXlm} XLM`);
 * ```
 *
 * @see {@link FmcRegistryClient} for discovering campaign contract IDs.
 */
export class FmcClient {
  private readonly rpc: rpc.Server;
  private readonly horizon: Horizon.Server;
  private readonly contract: Contract;
  private readonly config: FmcClientConfig;

  /**
   * Creates a client bound to one campaign contract.
   *
   * The constructor performs no network I/O and does not validate that
   * `contractId` exists — an invalid or non-campaign contract ID surfaces as an
   * error on the first method call, not here.
   *
   * @param config - Campaign contract ID plus the RPC, Horizon, and network
   * passphrase to reach it. The passphrase must match the network the RPC and
   * Horizon URLs point at, or signatures will be rejected on submission.
   */
  constructor(config: FmcClientConfig) {
    this.config   = config;
    this.rpc      = new rpc.Server(config.rpcUrl);
    this.horizon  = new Horizon.Server(config.horizonUrl);
    this.contract = new Contract(config.contractId);
  }

  // ── Internal helpers ───────────────────────────────────────────────────────

  /** Execute a view (read-only) call via simulateTransaction. */
  private async view<T>(method: string, args: Parameters<typeof nativeToScVal>[0][] = []): Promise<T> {
    // Use a well-known funded account for simulation — never submitted
    const DUMMY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
    const account = { accountId: () => DUMMY, sequenceNumber: () => "0", incrementSequenceNumber: () => {} } as unknown as ConstructorParameters<typeof TransactionBuilder>[0];

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const result = await this.rpc.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(result)) {
      parseAndThrow(result.error);
    }
    return scValToNative((result as rpc.Api.SimulateTransactionSuccessResponse).result!.retval) as T;
  }

  /** Build, prepare, sign, submit, and poll a state-changing transaction. */
  private async invoke(
    caller: string,
    method: string,
    args: Parameters<typeof nativeToScVal>[0][],
    signTx: (xdr: string) => Promise<string>,
  ): Promise<string> {
    const account  = await this.horizon.loadAccount(caller);
    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.config.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const prepared   = await this.rpc.prepareTransaction(tx);
    const signedXdr  = await signTx(prepared.toXDR());
    const signedTx   = TransactionBuilder.fromXDR(signedXdr, this.config.networkPassphrase);
    const sendResult = await this.rpc.sendTransaction(signedTx);

    if (sendResult.status === "ERROR") {
      parseAndThrow(JSON.stringify(sendResult.errorResult));
    }

    return this.poll(sendResult.hash);
  }

  private async poll(hash: string): Promise<string> {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const res = await this.rpc.getTransaction(hash);
      if (res.status === rpc.Api.GetTransactionStatus.SUCCESS)  return hash;
      if (res.status === rpc.Api.GetTransactionStatus.FAILED) {
        throw new Error(`Transaction failed on-chain: ${hash}`);
      }
    }
    throw new Error(`Transaction not confirmed after polling: ${hash}`);
  }

  // ── View methods ───────────────────────────────────────────────────────────

  /**
   * Fetches live funding metrics for the campaign.
   *
   * Calls the contract's `get_stats`. Amounts are returned both in XLM
   * (`raisedXlm`, `goalXlm`) and in raw stroops (`raisedStroops`,
   * `goalStroops`); the contract's `progress_bps` is converted from basis
   * points to a percentage.
   *
   * `progressPercent` can exceed 100 when a matching pool has contributed
   * beyond the goal — do not assume it is capped when driving a progress bar.
   *
   * @returns The campaign's current funding statistics.
   * @throws {FmcContractError} If the contract rejects the call.
   */
  async getStats(): Promise<CampaignStats> {
    const raw = await this.view<{
      total_raised: bigint; goal: bigint; progress_bps: number;
      contributor_count: number; average_contribution: bigint; largest_contribution: bigint;
    }>("get_stats");
    return {
      raisedXlm:              stroopsToXlm(raw.total_raised),
      goalXlm:                stroopsToXlm(raw.goal),
      progressPercent:        raw.progress_bps / 100,
      contributorCount:       raw.contributor_count,
      avgContributionXlm:     stroopsToXlm(raw.average_contribution),
      largestContributionXlm: stroopsToXlm(raw.largest_contribution),
      raisedStroops:          raw.total_raised,
      goalStroops:            raw.goal,
    };
  }

  /**
   * Fetches the campaign's full metadata snapshot.
   *
   * Calls the contract's `get_campaign_info`. This is the configuration set at
   * initialization — creator, token, goal, deadline, contribution bounds,
   * title, description, status, category, and platform fee — rather than live
   * funding progress, which is {@link FmcClient.getStats}'s job.
   *
   * `deadline` is converted from the contract's Unix seconds to a `Date`.
   *
   * @returns The campaign's metadata and configuration.
   * @throws {FmcContractError} If the contract rejects the call.
   */
  async getCampaignInfo(): Promise<CampaignInfo> {
    const raw = await this.view<Record<string, unknown>>("get_campaign_info");
    return {
      creator:                raw.creator as string,
      token:                  raw.token as string,
      goalXlm:                stroopsToXlm(raw.goal as bigint),
      goalStroops:            raw.goal as bigint,
      deadline:               new Date(Number(raw.deadline as bigint) * 1000),
      minContributionXlm:     stroopsToXlm(raw.min_contribution as bigint),
      minContributionStroops: raw.min_contribution as bigint,
      maxContributionXlm:     stroopsToXlm(raw.max_contribution as bigint),
      maxContributionStroops: raw.max_contribution as bigint,
      title:                  raw.title as string,
      description:            raw.description as string,
      status:                 raw.status as CampaignInfo["status"],
      category:               raw.category as CampaignInfo["category"],
      hasPlatformConfig:      raw.has_platform_config as boolean,
      platformFeeBps:         raw.platform_fee_bps as number,
    };
  }

  /**
   * Fetches derived performance and velocity metrics for the campaign.
   *
   * Calls the contract's `get_performance_metrics`. These are computed on-chain
   * from contribution history: success rate, contribution velocity, a trend
   * indicator (positive means accelerating), milestone progress, and elapsed
   * and projected times.
   *
   * `estimatedSecondsToGoal` is a projection from current velocity, not a
   * commitment — treat it as a hint, and expect large values when velocity is
   * near zero.
   *
   * @returns The campaign's performance metrics, with durations in seconds and
   * amounts converted to XLM.
   * @throws {FmcContractError} If the contract rejects the call.
   */
  async getPerformanceMetrics(): Promise<PerformanceMetrics> {
    const raw = await this.view<Record<string, unknown>>("get_performance_metrics");
    return {
      successRateBps:           raw.success_rate_bps as number,
      contributionVelocityXlm:  stroopsToXlm(raw.contribution_velocity as bigint),
      trending:                 raw.trending as number,
      milestonesReached:        raw.milestones_reached as number,
      totalMilestones:          raw.total_milestones as number,
      timeElapsedSeconds:       Number(raw.time_elapsed as bigint),
      estimatedSecondsToGoal:   Number(raw.estimated_time_to_goal as bigint),
      avgDailyContributionXlm:  stroopsToXlm(raw.average_daily_contribution as bigint),
    };
  }

  /**
   * Returns the total amount one address has contributed to this campaign.
   *
   * Calls the contract's `contribution`. The result is the address's running
   * total across all its contributions, not its most recent one.
   *
   * @param address - Stellar account address (`G...`) to look up.
   * @returns The address's total contribution in XLM. Returns `0` for an
   * address that has never contributed — this is not an error, so use
   * {@link FmcClient.isContributor} to distinguish "never contributed" from
   * "contributed zero".
   * @throws {FmcContractError} If the contract rejects the call.
   * @throws {Error} If `address` is not a valid Stellar address.
   */
  async getContribution(address: string): Promise<number> {
    const stroops = await this.view<bigint>("contribution", [new Address(address).toScVal()]);
    return stroopsToXlm(stroops);
  }

  /**
   * Returns one address's itemised contribution history.
   *
   * Calls the contract's `get_contribution_history`. Each record carries the
   * individual amount, its timestamp, and the running total after that
   * contribution — so the last record's `runningTotalXlm` matches what
   * {@link FmcClient.getContribution} returns.
   *
   * This method is not paginated: the contract returns the full history in one
   * call, which grows with the number of contributions the address has made.
   *
   * @param address - Stellar account address (`G...`) to look up.
   * @returns The address's contributions in contract order, with amounts in XLM
   * and timestamps as `Date`s. Empty for an address that has never contributed.
   * @throws {FmcContractError} If the contract rejects the call.
   * @throws {Error} If `address` is not a valid Stellar address.
   */
  async getContributionHistory(address: string): Promise<ContributionRecord[]> {
    const raw = await this.view<Array<{ amount: bigint; timestamp: bigint; running_total: bigint }>>(
      "get_contribution_history",
      [new Address(address).toScVal()],
    );
    return raw.map((r) => ({
      amountXlm:        stroopsToXlm(r.amount),
      timestamp:        new Date(Number(r.timestamp) * 1000),
      runningTotalXlm:  stroopsToXlm(r.running_total),
    }));
  }

  /**
   * Reports whether an address has contributed to this campaign.
   *
   * Calls the contract's `is_contributor`. Cheaper than
   * {@link FmcClient.getContribution} when you only need membership — for
   * example to decide whether to offer a refund action.
   *
   * @param address - Stellar account address (`G...`) to check.
   * @returns `true` if the address has contributed at least once.
   * @throws {FmcContractError} If the contract rejects the call.
   * @throws {Error} If `address` is not a valid Stellar address.
   */
  async isContributor(address: string): Promise<boolean> {
    return this.view<boolean>("is_contributor", [new Address(address).toScVal()]);
  }

  /**
   * Lists contributor addresses, one page at a time.
   *
   * Calls the contract's `contributor_list`. Pagination is mandatory — there is
   * no unpaginated variant, because the full list is unbounded. Advance by
   * increasing `offset` until a page comes back shorter than `limit`.
   *
   * @param opts - `offset` (0-based index to start from) and `limit` (maximum
   * addresses to return). Both are sent as `u32`, so both must be non-negative
   * integers.
   * @returns Up to `limit` contributor addresses. A short or empty page means
   * the end of the list has been reached.
   * @throws {FmcContractError} If the contract rejects the call — including
   * when `limit` exceeds the contract's per-page maximum.
   */
  async listContributors(opts: ListContributorsOptions): Promise<string[]> {
    return this.view<string[]>("contributor_list", [
      nativeToScVal(opts.offset, { type: "u32" }),
      nativeToScVal(opts.limit,  { type: "u32" }),
    ]);
  }

  /**
   * Fetches the campaign's matching-pool configuration, if one is set up.
   *
   * Calls the contract's `get_matching_config`. A matching pool lets a sponsor
   * commit to matching contributions at `matchRatioBps` basis points, up to
   * `maxMatchXlm`.
   *
   * @returns The active matching configuration, or `null` when no sponsor has
   * called {@link FmcClient.setupMatching}. Check for `null` before reading
   * {@link FmcClient.getTotalMatched} or {@link FmcClient.getMatchingPool},
   * which both return `0` in that case and are indistinguishable from an
   * exhausted pool.
   * @throws {FmcContractError} If the contract rejects the call.
   */
  async getMatchingConfig(): Promise<MatchingConfig | null> {
    const raw = await this.view<Record<string, unknown> | null>("get_matching_config");
    if (!raw) return null;
    return {
      sponsor:       raw.sponsor as string,
      matchRatioBps: raw.match_ratio as number,
      maxMatchXlm:   stroopsToXlm(raw.max_match as bigint),
      maxMatchStroops: raw.max_match as bigint,
    };
  }

  /**
   * Returns how much the matching sponsor has paid out so far.
   *
   * Calls the contract's `get_total_matched`. This is money already committed
   * to the campaign, and is included in {@link FmcClient.getStats}'s
   * `raisedXlm` — do not add the two together.
   *
   * @returns Total matched to date in XLM. `0` when no matching pool exists;
   * use {@link FmcClient.getMatchingConfig} to tell that apart from a pool that
   * simply has not matched anything yet.
   * @throws {FmcContractError} If the contract rejects the call.
   */
  async getTotalMatched(): Promise<number> {
    const stroops = await this.view<bigint>("get_total_matched");
    return stroopsToXlm(stroops);
  }

  /**
   * Returns the matching funds still available to be paid out.
   *
   * Calls the contract's `get_matching_pool`. This is the sponsor's remaining
   * commitment — `maxMatchXlm` minus {@link FmcClient.getTotalMatched} — so it
   * only decreases as contributions are matched.
   *
   * @returns Remaining unspent matching pool in XLM. `0` means either no pool
   * exists or it has been fully consumed; {@link FmcClient.getMatchingConfig}
   * distinguishes the two.
   * @throws {FmcContractError} If the contract rejects the call.
   */
  async getMatchingPool(): Promise<number> {
    const stroops = await this.view<bigint>("get_matching_pool");
    return stroopsToXlm(stroops);
  }

  // ── Write methods ──────────────────────────────────────────────────────────

  /**
   * Pledges tokens to the campaign.
   *
   * Calls the contract's `contribute`, signed by the contributor. `amountXlm`
   * is converted to stroops by rounding to the nearest stroop, so amounts with
   * more than 7 decimal places are not represented exactly.
   *
   * The transaction is submitted and polled to completion, so this resolves
   * only after the contribution is confirmed on-chain.
   *
   * @param opts - Contributor address, amount in XLM, the token contract ID to
   * pay with, an optional public message, and the wallet `signTx` callback.
   * @returns The confirmed transaction hash.
   * @throws {FmcContractError} If the contract rejects the contribution — for
   * example the campaign has ended (`#2`), is not active (`#7`), the amount is
   * below the minimum (`#9`) or would exceed the per-contributor cap (`#14`),
   * the token is not accepted (`#13`), the address is blacklisted (`#16`) or
   * not whitelisted (`#15`), or the message exceeds 256 characters (`#26`).
   * @throws {Error} If the contributor's account cannot be loaded from Horizon,
   * if `signTx` rejects, or if the transaction is not confirmed within the
   * polling window (~30s).
   */
  async contribute(opts: ContributeOptions): Promise<string> {
    return this.invoke(opts.contributor, "contribute", [
      new Address(opts.contributor).toScVal(),
      nativeToScVal(xlmToStroops(opts.amountXlm), { type: "i128" }),
      new Address(opts.tokenId).toScVal(),
      opts.message
        ? nativeToScVal(opts.message, { type: "string" })
        : { switch: () => "scvVoid" } as unknown as ReturnType<typeof nativeToScVal>,
    ], opts.signTx);
  }

  /**
   * Withdraws the raised funds to the campaign creator.
   *
   * Calls the contract's `withdraw`, signed by the creator. Only the creator
   * may call this, and only once the campaign has succeeded — the goal was met
   * and the deadline has passed. If a platform fee is configured, it is
   * deducted on-chain before the payout.
   *
   * @param opts - Creator address and the wallet `signTx` callback.
   * @returns The confirmed transaction hash.
   * @throws {FmcContractError} If the contract rejects the withdrawal — for
   * example the caller is not the creator (`#39`), the campaign is still active
   * (`#3`), the goal was not reached (`#4`), or funds have already been
   * withdrawn.
   * @throws {Error} If the creator's account cannot be loaded from Horizon, if
   * `signTx` rejects, or if the transaction is not confirmed within the polling
   * window (~30s).
   */
  async withdraw(opts: WithdrawOptions): Promise<string> {
    return this.invoke(opts.creator, "withdraw", [], opts.signTx);
  }

  /**
   * Claims a refund for one contributor.
   *
   * Calls the contract's `refund_single`, signed by the contributor. Refunds
   * follow a pull-based model: each contributor claims their own, and there is
   * no bulk refund. Available once the campaign has failed — the deadline
   * passed without the goal being met — or after it was cancelled.
   *
   * @param opts - Contributor address and the wallet `signTx` callback. An
   * address can only refund itself; passing someone else's fails authorization.
   * @returns The confirmed transaction hash.
   * @throws {FmcContractError} If the contract rejects the refund — for example
   * the campaign is still active (`#3`), the goal was reached so refunds are
   * unavailable (`#5`), the address never contributed, or it has already been
   * refunded.
   * @throws {Error} If the contributor's account cannot be loaded from Horizon,
   * if `signTx` rejects, or if the transaction is not confirmed within the
   * polling window (~30s).
   * @see [ADR-001 — pull-based refund model](https://github.com/Fund-My-Cause/Fund-My-Cause/blob/main/docs/adr/ADR-001-pull-based-refund-model.md)
   * for why refunds are claimed individually rather than pushed in bulk.
   */
  async refundSingle(opts: RefundOptions): Promise<string> {
    return this.invoke(opts.contributor, "refund_single", [
      new Address(opts.contributor).toScVal(),
    ], opts.signTx);
  }

  /**
   * Cancels the campaign.
   *
   * Calls the contract's `cancel_campaign`, signed by the creator. Cancelling
   * stops further contributions and makes every contributor eligible to claim a
   * refund via {@link FmcClient.refundSingle}. It does **not** refund anyone
   * automatically — refunds remain pull-based.
   *
   * This is irreversible.
   *
   * @param opts - Creator address and the wallet `signTx` callback.
   * @returns The confirmed transaction hash.
   * @throws {FmcContractError} If the contract rejects the cancellation — for
   * example the caller is not the creator (`#39`), or the campaign is not in an
   * active state (`#7`) because it already completed or was cancelled.
   * @throws {Error} If the creator's account cannot be loaded from Horizon, if
   * `signTx` rejects, or if the transaction is not confirmed within the polling
   * window (~30s).
   */
  async cancelCampaign(opts: CancelOptions): Promise<string> {
    return this.invoke(opts.creator, "cancel_campaign", [], opts.signTx);
  }

  /**
   * Sets up a matching pool, funded by a sponsor.
   *
   * Calls the contract's `setup_matching`, signed by the sponsor. Once
   * configured, contributions are matched at `matchRatioBps` basis points until
   * `maxMatchXlm` is exhausted — for example `matchRatioBps: 5000` matches 50%
   * of each contribution.
   *
   * @param opts - Sponsor address, match ratio in basis points, the maximum to
   * match in XLM, and the wallet `signTx` callback. `matchRatioBps` is sent as
   * a `u32` and must be a non-negative integer.
   * @returns The confirmed transaction hash.
   * @throws {FmcContractError} If the contract rejects the setup — for example
   * the basis points exceed 10 000 (`#8`), the campaign is not active (`#7`),
   * or a matching pool already exists.
   * @throws {Error} If the sponsor's account cannot be loaded from Horizon, if
   * `signTx` rejects, or if the transaction is not confirmed within the polling
   * window (~30s).
   */
  async setupMatching(opts: SetupMatchingOptions): Promise<string> {
    return this.invoke(opts.sponsorAddress, "setup_matching", [
      new Address(opts.sponsorAddress).toScVal(),
      nativeToScVal(opts.matchRatioBps,                  { type: "u32"  }),
      nativeToScVal(xlmToStroops(opts.maxMatchXlm), { type: "i128" }),
    ], opts.signTx);
  }

  /**
   * Returns unspent matching funds to the sponsor.
   *
   * Calls the contract's `refund_matching_sponsor`. Only the amount still
   * unmatched — {@link FmcClient.getMatchingPool} — is returned; funds already
   * matched into contributions stay with the campaign.
   *
   * Note that despite refunding the *sponsor*, this call is signed by the
   * **creator**, which is why `opts` takes `creatorAddress` rather than a
   * sponsor address.
   *
   * @param opts - Creator address and the wallet `signTx` callback.
   * @returns The confirmed transaction hash.
   * @throws {FmcContractError} If the contract rejects the refund — for example
   * the caller is not the creator (`#39`), no matching pool was configured, or
   * the campaign has not reached a state where the pool can be released.
   * @throws {Error} If the creator's account cannot be loaded from Horizon, if
   * `signTx` rejects, or if the transaction is not confirmed within the polling
   * window (~30s).
   */
  async refundMatchingSponsor(opts: RefundMatchingSponsorOptions): Promise<string> {
    return this.invoke(opts.creatorAddress, "refund_matching_sponsor", [], opts.signTx);
  }

}
