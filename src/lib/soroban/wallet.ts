import {
  isConnected as freighterIsConnected,
  getPublicKey,
  signTransaction,
  getNetwork,
} from "@stellar/freighter-api";
import {
  Contract,
  Networks,
  TransactionBuilder,
  Account,
  SorobanRpc,
  xdr,
} from "@stellar/stellar-sdk";

export type WalletNetwork = "PUBLIC" | "TESTNET" | "FUTURENET" | "SANDBOX";

export interface WalletConnection {
  publicKey: string;
  network: WalletNetwork;
}

export interface SignAndSubmitResult {
  hash: string;
  status: string;
  result?: unknown;
}

const NETWORK_PASSPHRASES: Record<WalletNetwork, string> = {
  PUBLIC: Networks.PUBLIC,
  TESTNET: Networks.TESTNET,
  FUTURENET: Networks.FUTURENET,
  SANDBOX: Networks.SANDBOX,
};

const RPC_URLS: Record<WalletNetwork, string> = {
  PUBLIC: "https://mainnet.sorobanrpc.com",
  TESTNET: "https://soroban-testnet.stellar.org",
  FUTURENET: "https://rpc-futurenet.stellar.org",
  SANDBOX: "http://localhost:8000/soroban/rpc",
};

function normalizeNetwork(network: string | undefined): WalletNetwork {
  const upper = (network ?? "TESTNET").toUpperCase();
  if (upper === "PUBLIC" || upper === "MAINNET") return "PUBLIC";
  if (upper === "FUTURENET") return "FUTURENET";
  if (upper === "SANDBOX" || upper === "STANDALONE") return "SANDBOX";
  return "TESTNET";
}

export function getNetworkPassphrase(network: WalletNetwork): string {
  return NETWORK_PASSPHRASES[network];
}

export function getRpcUrl(network: WalletNetwork): string {
  return RPC_URLS[network];
}

export async function isWalletAvailable(): Promise<boolean> {
  try {
    const { isConnected } = await freighterIsConnected();
    return Boolean(isConnected);
  } catch {
    return false;
  }
}

export async function connectWallet(): Promise<WalletConnection> {
  const available = await isWalletAvailable();
  if (!available) {
    throw new Error("No Soroban-compatible wallet detected. Please install Freighter.");
  }

  const { publicKey } = await getPublicKey();
  if (!publicKey) {
    throw new Error("Wallet did not return a public key.");
  }

  const { network } = await getNetwork();

  return {
    publicKey,
    network: normalizeNetwork(network),
  };
}

export async function signTransactionXdr(
  xdrEnvelope: string,
  network: WalletNetwork,
  publicKey?: string,
): Promise<string> {
  const { signedTxXdr, error } = await signTransaction(xdrEnvelope, {
    networkPassphrase: getNetworkPassphrase(network),
    address: publicKey,
  });

  if (error) {
    throw new Error(typeof error === "string" ? error : "Failed to sign transaction.");
  }
  if (!signedTxXdr) {
    throw new Error("Wallet returned an empty signed transaction.");
  }

  return signedTxXdr;
}

export async function submitSignedTransaction(
  signedXdr: string,
  network: WalletNetwork,
): Promise<SignAndSubmitResult> {
  const server = new SorobanRpc.Server(getRpcUrl(network));
  const transaction = TransactionBuilder.fromXDR(
    signedXdr,
    getNetworkPassphrase(network),
  );

  const response = await server.sendTransaction(transaction);

  if (response.status === "ERROR") {
    throw new Error(
      `Transaction submission failed: ${JSON.stringify(response.errorResult ?? {})}`,
    );
  }

  return {
    hash: response.hash,
    status: response.status,
    result: response,
  };
}

export async function signAndSubmit(
  xdrEnvelope: string,
  network: WalletNetwork,
  publicKey?: string,
): Promise<SignAndSubmitResult> {
  const signedXdr = await signTransactionXdr(xdrEnvelope, network, publicKey);
  return submitSignedTransaction(signedXdr, network);
}

export async function buildContractCallXdr(params: {
  contractId: string;
  method: string;
  args?: xdr.ScVal[];
  publicKey: string;
  network: WalletNetwork;
}): Promise<string> {
  const { contractId, method, args = [], publicKey, network } = params;
  const server = new SorobanRpc.Server(getRpcUrl(network));
  const account = await server.getAccount(publicKey);
  const contract = new Contract(contractId);

  const transaction = new TransactionBuilder(account as Account, {
    fee: "100",
    networkPassphrase: getNetworkPassphrase(network),
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  return transaction.toXDR();
}
