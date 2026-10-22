import {
  rpc,
  Contract,
  TransactionBuilder,
  BASE_FEE,
  scValToNative,
  nativeToScVal,
} from "@stellar/stellar-sdk";
import type { RegistryClientConfig, ListOptions, ListByCategoryOptions } from "./types";
import { parseAndThrow } from "./errors";

/**
 * Read-only client for the Fund-My-Cause registry contract — the on-chain index
 * of deployed campaigns.
 *
 * The registry stores campaign *contract addresses*, not campaign data. Use it
 * to discover which campaigns exist, then construct an {@link FmcClient} per
 * address to read that campaign's stats and metadata.
 *
 * Every method here is a view call: they simulate rather than submit, so none
 * requires a wallet or costs fees. Registration is performed by the campaign
 * contract itself at deployment, so this client exposes no write methods.
 *
 * @example
 * ```ts
 * const registry = new FmcRegistryClient({
 *   contractId:        "C...", // registry contract, not a campaign
 *   rpcUrl:            "https://soroban-testnet.stellar.org",
 *   networkPassphrase: "Test SDF Network ; September 2015",
 *   horizonUrl:        "https://horizon-testnet.stellar.org",
 * });
 *
 * for (const address of await registry.listAll()) {
 *   const campaign = new FmcClient({ ...config, contractId: address });
 *   console.log(await campaign.getStats());
 * }
 * ```
 *
 * @see {@link FmcClient} for reading an individual campaign.
 */
export class FmcRegistryClient {
  private readonly rpc: rpc.Server;
  private readonly contract: Contract;
  private readonly networkPassphrase: string;

  /**
   * Creates a client bound to a registry contract.
   *
   * Performs no network I/O and does not verify that `contractId` is a
   * registry — pointing it at a campaign contract by mistake surfaces as a
   * contract error on the first call, not here.
   *
   * @param config - Registry contract ID plus the RPC URL and network
   * passphrase to reach it. `horizonUrl` is accepted for symmetry with
   * {@link FmcClientConfig} but is unused, since this client never submits
   * transactions.
   */
  constructor(config: RegistryClientConfig) {
    this.rpc               = new rpc.Server(config.rpcUrl);
    this.contract          = new Contract(config.contractId);
    this.networkPassphrase = config.networkPassphrase;
  }

  private async view<T>(method: string, args: ReturnType<typeof nativeToScVal>[]): Promise<T> {
    const DUMMY = "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN";
    const account = { accountId: () => DUMMY, sequenceNumber: () => "0", incrementSequenceNumber: () => {} } as unknown as ConstructorParameters<typeof TransactionBuilder>[0];

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: this.networkPassphrase,
    })
      .addOperation(this.contract.call(method, ...args))
      .setTimeout(30)
      .build();

    const result = await this.rpc.simulateTransaction(tx);
    if (rpc.Api.isSimulationError(result)) parseAndThrow(result.error);
    return scValToNative((result as rpc.Api.SimulateTransactionSuccessResponse).result!.retval) as T;
  }

  /**
   * Lists registered campaign contract addresses, one page at a time.
   *
   * Calls the registry's `list`. Advance by increasing `offset` until a page
   * comes back shorter than `limit`, or use {@link FmcRegistryClient.listAll}
   * to have that loop done for you.
   *
   * @param opts - `offset` (0-based index to start from) and `limit` (maximum
   * addresses to return). Both are sent as `u32`, so both must be non-negative
   * integers.
   * @returns Up to `limit` campaign contract addresses. A short or empty page
   * means the end of the registry has been reached.
   * @throws {FmcContractError} If the contract rejects the call — for example
   * the registry has not been initialized (`#2`).
   */
  async list(opts: ListOptions): Promise<string[]> {
    return this.view<string[]>("list", [
      nativeToScVal(opts.offset, { type: "u32" }),
      nativeToScVal(opts.limit,  { type: "u32" }),
    ]);
  }

  /**
   * Lists registered campaigns in one category, a page at a time.
   *
   * Calls the registry's `get_campaigns_by_category`. Paginates exactly like
   * {@link FmcRegistryClient.list}, with offset and limit applied within the
   * filtered set rather than the whole registry.
   *
   * @param opts - `categoryId` to filter by, plus `offset` and `limit`. All
   * three are sent as `u32`, so all must be non-negative integers. Category IDs
   * are assigned by the contract; an unrecognised one yields an empty result
   * rather than an error.
   * @returns Up to `limit` campaign contract addresses in that category. A
   * short or empty page means the end of the filtered set.
   * @throws {FmcContractError} If the contract rejects the call — for example
   * the registry has not been initialized (`#2`).
   */
  async getByCampaignCategory(opts: ListByCategoryOptions): Promise<string[]> {
    return this.view<string[]>("get_campaigns_by_category", [
      nativeToScVal(opts.categoryId, { type: "u32" }),
      nativeToScVal(opts.offset,     { type: "u32" }),
      nativeToScVal(opts.limit,      { type: "u32" }),
    ]);
  }

  /**
   * Fetches every registered campaign address, paginating internally.
   *
   * Repeatedly calls {@link FmcRegistryClient.list}, advancing the offset until
   * a short page signals the end. Convenient, but the calls are sequential and
   * the result is unbounded — on a large registry this issues many round trips
   * and holds every address in memory. Prefer `list` with your own paging for
   * anything user-facing.
   *
   * @param pageSize - Addresses to request per underlying call. Defaults to
   * `50`. Larger values mean fewer round trips, but the registry enforces its
   * own per-page maximum.
   * @returns Every registered campaign contract address, in registry order.
   * @throws {FmcContractError} If any page's call is rejected. Pages already
   * fetched are discarded — the method is not resumable, so a failure part-way
   * through means starting over.
   */
  async listAll(pageSize = 50): Promise<string[]> {
    const all: string[] = [];
    let offset = 0;
    while (true) {
      const page = await this.list({ offset, limit: pageSize });
      all.push(...page);
      if (page.length < pageSize) break;
      offset += pageSize;
    }
    return all;
  }
}
