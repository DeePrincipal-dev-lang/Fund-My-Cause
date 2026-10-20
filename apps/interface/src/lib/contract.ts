/**
 * Contract interaction layer for the Fund-My-Cause crowdfunding contract.
 * Wraps all Soroban RPC calls using @stellar/stellar-sdk.
 */

import {
  Contract,
  TransactionBuilder,
  BASE_FEE,
  Account,
  nativeToScVal,
  Address,
  scValToNative,
  rpc as SorobanRpc,
  Horizon,
  xdr,
} from "@stellar/stellar-sdk";
import {
  CONTRACT_ID,
  RPC_URL,
  NETWORK_PASSPHRASE,
  HORIZON_URL,
} from "@/lib/constants";
import { isValidContractId } from "@/lib/validation";
import type { SignFn } from "@/types/contract";
import { ContractError } from "@/types/contract";
import {
  cacheGet,
  cacheSet,
  cacheInvalidateLive,
  rpcSuccess,
  rpcFailure,
} from "@/lib/rpc-cache";

// Re-export types for backward compatibility
export type { SignFn } from "@/types/contract";
export { ContractError } from "@/types/contract";

// ── Internal helpers ──────────────────────────────────────────────────────────

/**
 * Returns a configured Soroban RPC server instance.
 * @param {string} [rpcUrl=RPC_URL] - Optional override; defaults to NEXT_PUBLIC_RPC_URL env var
 * @returns {SorobanRpc.Server} Configured Soroban RPC server
 */
export function getContractClient(rpcUrl: string = RPC_URL): SorobanRpc.Server {
  return new SorobanRpc.Server(rpcUrl);
}

/**
 * Simulates a read-only contract call and returns the decoded native value.
 * Uses a dummy account — no signing required.
 * @param {string} contractId - The Soroban contract address
 * @param {string} method - Contract method name to call
 * @param {unknown[]} [args=[]] - Method arguments
 * @returns {Promise<unknown>} Decoded return value from the contract
 * @throws {ContractError} If simulation fails
 */
async function simulateView(
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<unknown> {
  if (!isValidContractId(contractId)) {
    throw new ContractError(`Invalid contract ID format: ${contractId}`);
  }

  // Return cached value when available (args-less calls only)
  if (args.length === 0) {
    const cached = cacheGet(contractId, method);
    if (cached !== undefined) return cached;
  }

  const rpc = getContractClient();
  const contract = new Contract(contractId);
  // Dummy account — only used for simulation, never submitted.
  const account = new Account(
    "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    "0",
  );
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const result = await rpc
    .simulateTransaction(tx)
    .then((r) => {
      rpcSuccess();
      return r;
    })
    .catch((err: unknown) => {
      rpcFailure();
      throw err;
    });
  if (SorobanRpc.Api.isSimulationError(result)) {
    throw new ContractError(result.error);
  }
  const sim = result as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  const value = scValToNative(sim.result!.retval);

  if (args.length === 0) cacheSet(contractId, method, value);

  return value;
}

/**
 * Builds, prepares, signs, submits, and polls a state-changing contract call.
 * Returns the transaction hash on success.
 * @param {string} caller - The caller's Stellar public key
 * @param {string} contractId - The Soroban contract address
 * @param {string} method - Contract method name to call
 * @param {unknown[]} args - Method arguments
 * @param {SignFn} signTx - Wallet signing function
 * @returns {Promise<string>} Transaction hash on success
 * @throws {ContractError} If submission or confirmation fails
 */
async function invokeContract(
  caller: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
  signTx: SignFn,
): Promise<string> {
  if (!isValidContractId(contractId)) {
    throw new ContractError(`Invalid contract ID format: ${contractId}`);
  }

  const rpc = getContractClient();
  const horizon = new Horizon.Server(HORIZON_URL);
  const account = await horizon.loadAccount(caller);

  const contract = new Contract(contractId);
  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  // Prepare (adds footprint / resource fees)
  const prepared = await rpc.prepareTransaction(tx);
  const signedXdr = await signTx(prepared.toXDR());
  const signedTx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);

  const sendResult = await rpc.sendTransaction(signedTx);
  if (sendResult.status === "ERROR") {
    throw new ContractError(
      `Submit failed: ${JSON.stringify(sendResult.errorResult)}`,
    );
  }

  // Poll until confirmed
  const hash = sendResult.hash;
  let attempts = 0;
  while (attempts < 20) {
    await new Promise((r) => setTimeout(r, 1500));
    const status = await rpc.getTransaction(hash);
    if (status.status === SorobanRpc.Api.GetTransactionStatus.SUCCESS) {
      cacheInvalidateLive(contractId);
      return hash;
    }
    if (status.status === SorobanRpc.Api.GetTransactionStatus.FAILED) {
      throw new ContractError(`Transaction failed on-chain: ${hash}`);
    }
    attempts++;
  }
  throw new ContractError(`Transaction not confirmed after polling: ${hash}`);
}

export interface ContractCampaignInfo {
  title: string;
  description: string;
  creator: string;
  goal: bigint;
  deadline: bigint;
  minContribution: bigint;
  maxContribution: bigint;
}

export interface ContractCampaignStats {
  totalRaised: bigint;
  progressBps: number;
  progressPercent: number;
  contributorCount: number;
}

/**
 * Fetches high-level campaign metadata from the contract.
 * @param {string} [contractId=CONTRACT_ID] - The Soroban contract address
 * @returns {Promise<ContractCampaignInfo>} Decoded campaign metadata
 * @throws {ContractError} If the contract call fails
 */
export async function getCampaignInfo(
  contractId: string = CONTRACT_ID,
): Promise<ContractCampaignInfo> {
  const [
    title,
    description,
    creator,
    goal,
    deadline,
    minContribution,
    maxContribution,
  ] = await Promise.all([
    simulateView(contractId, "title"),
    simulateView(contractId, "description"),
    simulateView(contractId, "creator"),
    simulateView(contractId, "goal"),
    simulateView(contractId, "deadline"),
    simulateView(contractId, "min_contribution"),
    simulateView(contractId, "max_contribution"),
  ]);
  return {
    title: String(title),
    description: String(description),
    creator: String(creator),
    goal: BigInt(goal as string | number),
    deadline: BigInt(deadline as string | number),
    minContribution: BigInt(minContribution as string | number),
    maxContribution: BigInt(maxContribution as string | number),
  };
}

/**
 * Fetches live campaign statistics (raised amount, progress, contributor count).
 * @param {string} [contractId=CONTRACT_ID] - The Soroban contract address
 * @returns {Promise<ContractCampaignStats>} Decoded campaign statistics
 * @throws {ContractError} If the contract call fails
 */
export async function getCampaignStats(
  contractId: string = CONTRACT_ID,
): Promise<ContractCampaignStats> {
  const raw = (await simulateView(contractId, "get_stats")) as {
    total_raised: string | number;
    progress_bps: string | number;
    contributor_count: string | number;
  };
  return {
    totalRaised: BigInt(raw.total_raised),
    progressBps: Number(raw.progress_bps),
    progressPercent: Number(raw.progress_bps) / 100,
    contributorCount: Number(raw.contributor_count),
  };
}

/**
 * Submits a contribution to the campaign.
 * @param {string} contractId - The Soroban contract address
 * @param {string} contributor - The contributor's Stellar public key
 * @param {bigint} amount - Contribution amount in stroops
 * @param {SignFn} signTx - Wallet signing function (e.g. from WalletContext)
 * @param {string} [tokenId] - Token contract address (defaults to campaign primary token)
 * @param {string} [message] - Optional contribution message (max 256 chars)
 * @returns {Promise<string>} Transaction hash on success
 * @throws {ContractError} If submission fails
 */
export async function contribute(
  contractId: string,
  contributor: string,
  amount: bigint,
  signTx: SignFn,
  tokenId?: string,
  message?: string,
): Promise<string> {
  // Resolve token: use provided tokenId or fall back to the campaign's primary token
  const resolvedToken =
    tokenId ?? String(await simulateView(contractId, "token"));

  return invokeContract(
    contributor,
    contractId,
    "contribute",
    [
      new Address(contributor).toScVal(),
      nativeToScVal(amount, { type: "i128" }),
      new Address(resolvedToken).toScVal(),
      message != null
        ? nativeToScVal(message, { type: "string" })
        : nativeToScVal(null),
    ],
    signTx,
  );
}

/**
 * Withdraws raised funds to the campaign creator after a successful campaign.
 * @param {string} contractId - The Soroban contract address
 * @param {string} creator - The creator's Stellar public key
 * @param {SignFn} signTx - Wallet signing function
 * @returns {Promise<string>} Transaction hash on success
 * @throws {ContractError} If withdrawal fails
 */
export async function withdraw(
  contractId: string,
  creator: string,
  signTx: SignFn,
): Promise<string> {
  return invokeContract(creator, contractId, "withdraw", [], signTx);
}

/**
 * Claims a refund for a single contributor after a failed campaign.
 * @param {string} contractId - The Soroban contract address
 * @param {string} contributor - The contributor's Stellar public key
 * @param {SignFn} signTx - Wallet signing function
 * @returns {Promise<string>} Transaction hash on success
 * @throws {ContractError} If refund fails
 */
export async function refundSingle(
  contractId: string,
  contributor: string,
  signTx: SignFn,
): Promise<string> {
  return invokeContract(
    contributor,
    contractId,
    "refund_single",
    [new Address(contributor).toScVal()],
    signTx,
  );
}

/**
 * Refunds multiple contributors in a single transaction (batch refund).
 * The contract caps the batch at 25 contributors per call.
 * @param {string} contractId - The Soroban contract address
 * @param {string} caller - The caller's Stellar public key (any authorized address)
 * @param {string[]} contributors - List of contributor addresses to refund
 * @param {SignFn} signTx - Wallet signing function
 * @returns {Promise<string>} Transaction hash on success
 * @throws {ContractError} If batch refund fails
 */
export async function refundBatch(
  contractId: string,
  caller: string,
  contributors: string[],
  signTx: SignFn,
): Promise<string> {
  const { xdr } = await import("@stellar/stellar-sdk");
  const contributorVec = xdr.ScVal.scvVec(
    contributors.map((addr) => new Address(addr).toScVal()),
  );
  return invokeContract(
    caller,
    contractId,
    "refund_batch",
    [contributorVec],
    signTx,
  );
}

/**
 * Pauses the campaign, blocking new contributions. Admin only.
 * @param {string} contractId - The Soroban contract address
 * @param {string} admin - The admin's Stellar public key
 * @param {SignFn} signTx - Wallet signing function
 * @returns {Promise<string>} Transaction hash on success
 * @throws {ContractError} If pause fails
 */
export async function pauseCampaign(
  contractId: string,
  admin: string,
  signTx: SignFn,
): Promise<string> {
  return invokeContract(admin, contractId, "pause", [], signTx);
}

/**
 * Resumes a paused campaign, allowing contributions again. Admin only.
 * @param {string} contractId - The Soroban contract address
 * @param {string} admin - The admin's Stellar public key
 * @param {SignFn} signTx - Wallet signing function
 * @returns {Promise<string>} Transaction hash on success
 * @throws {ContractError} If unpause fails
 */
export async function unpauseCampaign(
  contractId: string,
  admin: string,
  signTx: SignFn,
): Promise<string> {
  return invokeContract(admin, contractId, "unpause", [], signTx);
}

// ── Gas estimation ────────────────────────────────────────────────────────────

/**
 * Estimated network fee for a contract operation, in stroops and XLM.
 */
export interface GasEstimate {
  /** Minimum resource fee in stroops as reported by simulation */
  feeStroops: number;
  /** Human-readable fee string (e.g. "0.0001234 XLM") */
  feeXlm: string;
}

/**
 * Simulates a `contribute` call and returns the estimated network fee.
 *
 * Uses a read-only simulation (no transaction submitted) so no signing is
 * required. The returned fee is the `minResourceFee` from the Soroban RPC
 * simulation result — the actual fee the user will pay depends on the
 * resource fee set during `prepareTransaction`, but this provides a
 * transparent estimate before the user signs.
 *
 * @param {string} contractId - The Soroban contract address
 * @param {string} contributor - Contributor's Stellar public key (used for footprint)
 * @param {bigint} amount - Contribution amount in stroops
 * @param {string} tokenId - Token contract address
 * @returns {Promise<GasEstimate>} Estimated fee breakdown
 * @throws {ContractError} If simulation fails
 */
export async function estimateContributionGas(
  contractId: string,
  contributor: string,
  amount: bigint,
  tokenId: string,
): Promise<GasEstimate> {
  if (!isValidContractId(contractId)) {
    throw new ContractError(`Invalid contract ID format: ${contractId}`);
  }

  const rpc = getContractClient();
  const contract = new Contract(contractId);
  const account = new Account(
    "GAAZI4TCR3TY5OJHCTJC2A4QSY6CJWJH5IAJTGKIN2ER7LBNVKOCCWN",
    "0",
  );

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "contribute",
        new Address(contributor).toScVal(),
        nativeToScVal(amount, { type: "i128" }),
        new Address(tokenId).toScVal(),
        nativeToScVal(null),
      ),
    )
    .setTimeout(30)
    .build();

  const result = await rpc.simulateTransaction(tx);
  if (SorobanRpc.Api.isSimulationError(result)) {
    throw new ContractError(result.error);
  }
  const sim = result as SorobanRpc.Api.SimulateTransactionSuccessResponse;
  const feeStroops = parseInt(sim.minResourceFee ?? "0", 10);
  const feeXlm = (feeStroops / 10_000_000).toFixed(7) + " XLM";
  return { feeStroops, feeXlm };
}

// ── Paginated contributor access ──────────────────────────────────────────────

/**
 * Returns a page of contributor addresses from the campaign's indexed list.
 *
 * The contract stores contributors in O(1) indexed keys rather than a single
 * growing Vec, so each page read is proportional only to `limit`, not to the
 * total number of contributors. The contract caps `limit` at 50.
 *
 * @param {string} contractId - The Soroban contract address
 * @param {number} offset - Zero-based start index
 * @param {number} limit - Maximum addresses to return (capped at 50 on-chain)
 * @returns {Promise<string[]>} Contributor Stellar addresses for the requested page
 * @throws {ContractError} If the contract call fails
 */
export async function getContributorsPaginated(
  contractId: string,
  offset: number,
  limit: number,
): Promise<string[]> {
  const raw = await simulateView(contractId, "contributor_list", [
    nativeToScVal(offset, { type: "u32" }),
    nativeToScVal(limit, { type: "u32" }),
  ]);
  return (raw as Array<unknown>).map(String);
}

// ── DeFi helpers ──────────────────────────────────────────────────────────────

/**
 * Returns the list of accepted token contract addresses for a campaign.
 * Falls back to the campaign's primary token when no explicit whitelist is set.
 */
export async function getAcceptedTokens(contractId: string): Promise<string[]> {
  const raw = await simulateView(contractId, "accepted_tokens");
  return (raw as Array<unknown>).map(String);
}

/**
 * Returns the current yield configuration for a campaign, or null if not set.
 */
export async function getYieldConfig(contractId: string): Promise<{
  rewardToken: string;
  pool: bigint;
  rateBps: number;
  startTime: bigint;
} | null> {
  const raw = await simulateView(contractId, "get_yield_config");
  if (!raw) return null;
  const r = raw as Record<string, unknown>;
  return {
    rewardToken: String(r.reward_token),
    pool: BigInt(r.pool as string | number),
    rateBps: Number(r.rate_bps),
    startTime: BigInt(r.start_time as string | number),
  };
}

/**
 * Returns the pending (unclaimed) yield for a contributor, in reward token units.
 */
export async function getPendingYield(
  contractId: string,
  contributor: string,
): Promise<bigint> {
  const raw = await simulateView(contractId, "pending_yield", [
    new Address(contributor).toScVal(),
  ]);
  return BigInt(raw as string | number);
}

/**
 * Claims accrued yield for the calling contributor.
 * Returns the amount claimed (in reward token units).
 */
export async function claimYield(
  contractId: string,
  contributor: string,
  signTx: SignFn,
): Promise<string> {
  return invokeContract(
    contributor,
    contractId,
    "claim_yield",
    [new Address(contributor).toScVal()],
    signTx,
  );
}

/**
 * Configures a yield reward pool. Creator only.
 * @param rewardTokenId - Token contract address used to pay yield
 * @param pool - Total reward tokens to deposit (in token's smallest unit)
 * @param rateBps - Annual yield rate in basis points (e.g. 500 = 5%)
 */
export async function configureYield(
  contractId: string,
  creator: string,
  rewardTokenId: string,
  pool: bigint,
  rateBps: number,
  signTx: SignFn,
): Promise<string> {
  return invokeContract(
    creator,
    contractId,
    "configure_yield",
    [
      new Address(rewardTokenId).toScVal(),
      nativeToScVal(pool, { type: "i128" }),
      nativeToScVal(rateBps, { type: "u32" }),
    ],
    signTx,
  );
}
