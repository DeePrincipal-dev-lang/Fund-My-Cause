import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";

export const SOROBAN_RPC_URL    = process.env.SOROBAN_RPC_URL    ?? "https://soroban-testnet.stellar.org";
export const NETWORK_PASSPHRASE = process.env.NETWORK_PASSPHRASE ?? "Test SDF Network ; September 2015";
export const HORIZON_URL        = process.env.HORIZON_URL         ?? "https://horizon-testnet.stellar.org";

export function makeSignTx(secret: string) {
  const kp = Keypair.fromSecret(secret);
  return async (xdr: string): Promise<string> => {
    const tx = TransactionBuilder.fromXDR(xdr, NETWORK_PASSPHRASE);
    tx.sign(kp);
    return tx.toXDR();
  };
}

export function keypairFromSecret(secret: string) {
  const kp = Keypair.fromSecret(secret);
  return { kp, publicKey: kp.publicKey() };
}
