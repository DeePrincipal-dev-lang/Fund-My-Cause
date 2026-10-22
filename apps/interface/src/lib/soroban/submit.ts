/**
 * Simulation and submission pipeline for signed/unsigned campaign transactions.
 */

import { TransactionBuilder, rpc as SorobanRpc } from "@stellar/stellar-sdk";
import { getHorizonServer, getRpcServer, NETWORK_PASSPHRASE } from "./client";

export interface SimulateResult {
  /** Minimum resource fee in stroops */
  minFee: number;
  /** Fee formatted as XLM string for display, e.g. "0.0001234 XLM" */
  minFeeXlm: string;
  /** Transaction XDR with the simulation-populated soroban data attached */
  preparedXdr: string;
}

/**
 * Simulate a transaction against the Soroban RPC before asking the user to sign.
 * - Estimates the resource fee
 * - Detects contract errors early (before the user touches Freighter)
 * - Returns the fee-bumped, simulation-prepared XDR ready for signing
 *
 * Throws a user-friendly Error if simulation fails.
 */
export async function simulateTx(unsignedXdr: string): Promise<SimulateResult> {
  const rpc = getRpcServer();

  const tx = TransactionBuilder.fromXDR(unsignedXdr, NETWORK_PASSPHRASE);
  const result = await rpc.simulateTransaction(tx);

  if (SorobanRpc.Api.isSimulationError(result)) {
    const msg = result.error ?? "Simulation failed";
    throw new Error(parseSimulationError(msg));
  }

  if (SorobanRpc.Api.isSimulationRestore(result)) {
    throw new Error(
      "This transaction requires a ledger entry restore. Please try again shortly.",
    );
  }

  const success = result as SorobanRpc.Api.SimulateTransactionSuccessResponse;

  // Attach soroban auth + resource data to the transaction
  const prepared = SorobanRpc.assembleTransaction(tx, success).build();

  const minFee = Number(success.minResourceFee ?? 0);
  const minFeeXlm = (minFee / 1e7).toFixed(7).replace(/\.?0+$/, "") + " XLM";

  return { minFee, minFeeXlm, preparedXdr: prepared.toXDR() };
}
export const simulateTransaction = simulateTx;

/** Extract a readable message from a Soroban diagnostic error string. */
function parseSimulationError(raw: string): string {
  const contractMatch = raw.match(/ContractError\((\d+)\)/);
  if (contractMatch)
    return `Contract error code ${contractMatch[1]}. Please check your inputs.`;
  if (raw.includes("below minimum"))
    return "Amount is below the campaign's minimum contribution.";
  if (raw.includes("deadline")) return "This campaign's deadline has passed.";
  if (raw.includes("Cancelled")) return "This campaign has been cancelled.";
  return raw.split("\n")[0] ?? "Simulation failed. Please try again.";
}

export async function submitSignedTx(signedXdr: string): Promise<string> {
  const server = getHorizonServer();
  const tx = TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  const result = await server.submitTransaction(tx);
  return result.hash;
}
export const submitSignedTransaction = submitSignedTx;
