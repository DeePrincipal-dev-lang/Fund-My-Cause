/**
 * Client-side transaction building for the campaign contract.
 *
 * `buildSimpleContractTx` is the single parameterized builder behind every
 * no-arg/simple-arg contract call; the named `build*Tx` exports below are
 * thin wrappers over it (method name + arg shaping only, no duplicated
 * transaction-assembly logic).
 */

import {
  Address,
  BASE_FEE,
  Contract,
  TransactionBuilder,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import { isValidContractId } from "@/lib/validation";
import type { InitializeParams } from "@/types/soroban";
import { getHorizonServer, NETWORK_PASSPHRASE } from "./client";

export async function buildInitializeTx(
  params: InitializeParams,
): Promise<string> {
  if (!isValidContractId(params.contractId)) {
    throw new Error(`Invalid contract ID format: ${params.contractId}`);
  }

  const server = getHorizonServer();
  const account = await server.loadAccount(params.creator);
  const contract = new Contract(params.contractId);

  const socialLinksVal =
    params.socialLinks && params.socialLinks.length > 0
      ? xdr.ScVal.scvVec(
          params.socialLinks.map((value) =>
            nativeToScVal(value, { type: "string" }),
          ),
        )
      : xdr.ScVal.scvVoid();

  const acceptedTokensVal =
    params.acceptedTokens && params.acceptedTokens.length > 0
      ? xdr.ScVal.scvVec(
          params.acceptedTokens.map((value) => new Address(value).toScVal()),
        )
      : xdr.ScVal.scvVoid();

  const platformConfigVal =
    params.platformFeeAddress && params.platformFeeBps !== undefined
      ? xdr.ScVal.scvMap([
          new xdr.ScMapEntry({
            key: nativeToScVal("address", { type: "symbol" }),
            val: new Address(params.platformFeeAddress).toScVal(),
          }),
          new xdr.ScMapEntry({
            key: nativeToScVal("fee_bps", { type: "symbol" }),
            val: nativeToScVal(params.platformFeeBps, { type: "u32" }),
          }),
        ])
      : xdr.ScVal.scvVoid();

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(
      contract.call(
        "initialize",
        new Address(params.creator).toScVal(),
        new Address(params.token).toScVal(),
        nativeToScVal(params.goal, { type: "i128" }),
        nativeToScVal(params.deadline, { type: "u64" }),
        nativeToScVal(params.minContribution, { type: "i128" }),
        nativeToScVal(params.title, { type: "string" }),
        nativeToScVal(params.description, { type: "string" }),
        socialLinksVal,
        platformConfigVal,
        acceptedTokensVal,
      ),
    )
    .setTimeout(30)
    .build();

  return tx.toXDR();
}

export const buildInitializeXdr = buildInitializeTx;

export async function buildSimpleContractTx(
  caller: string,
  contractId: string,
  method: string,
  args: xdr.ScVal[] = [],
): Promise<string> {
  const server = getHorizonServer();
  const account = await server.loadAccount(caller);
  const contract = new Contract(contractId);

  const tx = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  return tx.toXDR();
}

export const buildWithdrawTx = (caller: string, contractId: string) =>
  buildSimpleContractTx(caller, contractId, "withdraw");
export const buildWithdrawXdr = buildWithdrawTx;

export const buildCancelTx = (
  caller: string,
  contractId: string,
  reason?: string,
) =>
  buildSimpleContractTx(
    caller,
    contractId,
    "cancel_campaign",
    reason ? [nativeToScVal(reason, { type: "string" })] : [],
  );
export const buildCancelCampaignXdr = buildCancelTx;

export const buildPauseTx = (caller: string, contractId: string) =>
  buildSimpleContractTx(caller, contractId, "pause");
export const buildPauseXdr = buildPauseTx;

export const buildUnpauseTx = (caller: string, contractId: string) =>
  buildSimpleContractTx(caller, contractId, "unpause");
export const buildUnpauseXdr = buildUnpauseTx;

export async function buildRefundTx(
  caller: string,
  contractId: string,
): Promise<string> {
  return buildSimpleContractTx(caller, contractId, "refund_single", [
    new Address(caller).toScVal(),
  ]);
}
export const buildRefundSingleXdr = buildRefundTx;

export async function buildUpdateMetadataTx(
  caller: string,
  contractId: string,
  title: string,
  description: string,
): Promise<string> {
  return buildSimpleContractTx(caller, contractId, "update_metadata", [
    nativeToScVal(title, { type: "string" }),
    nativeToScVal(description, { type: "string" }),
    xdr.ScVal.scvVoid(),
  ]);
}
export const buildUpdateMetadataXdr = buildUpdateMetadataTx;

/**
 * Build a contribute (pledge) transaction XDR.
 * @param caller  - contributor's Stellar address
 * @param contractId - campaign contract ID
 * @param amountXlm  - amount in XLM (converted to stroops internally)
 */
export async function buildContributeTx(
  caller: string,
  contractId: string,
  amountXlm: number,
): Promise<string> {
  const amountStroops = BigInt(Math.round(amountXlm * 1e7));
  return buildSimpleContractTx(caller, contractId, "contribute", [
    nativeToScVal(amountStroops, { type: "i128" }),
  ]);
}
export const buildContributeXdr = buildContributeTx;
