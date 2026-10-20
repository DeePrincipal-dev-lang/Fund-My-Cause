/**
 * Manual mock for @stellar/stellar-sdk used by unit tests in src/lib/soroban.
 *
 * Provides lightweight, deterministic stand-ins for the SDK surface used by the
 * wallet and transaction helpers so tests can exercise success and error paths
 * without hitting a real Soroban RPC endpoint.
 */

import { jest } from '@jest/globals';

// ---------------------------------------------------------------------------
// Keypair
// ---------------------------------------------------------------------------

export class Keypair {
  public publicKey(): string {
    return 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';
  }

  public secret(): string {
    return 'SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  }

  public sign(_data: Buffer | Uint8Array): Buffer {
    return Buffer.from('mock-signature');
  }

  public static fromSecret(secret: string): Keypair {
    if (!secret || !secret.startsWith('S')) {
      throw new Error('Invalid secret key');
    }
    return new Keypair();
  }

  public static fromPublicKey(publicKey: string): Keypair {
    if (!publicKey || !publicKey.startsWith('G')) {
      throw new Error('Invalid public key');
    }
    return new Keypair();
  }

  public static random(): Keypair {
    return new Keypair();
  }
}

// ---------------------------------------------------------------------------
// Networks
// ---------------------------------------------------------------------------

export const Networks = {
  PUBLIC: 'Public Global Stellar Network ; September 2015',
  TESTNET: 'Test SDF Network ; September 2015',
  FUTURENET: 'Test SDF Future Network ; October 2022',
  SANDBOX: 'Local Sandbox Stellar Network ; September 2022',
} as const;

// ---------------------------------------------------------------------------
// Account / TransactionBuilder / Transaction
// ---------------------------------------------------------------------------

export class Account {
  constructor(
    public readonly accountId: string,
    public readonly sequence: string,
  ) {}

  public sequenceNumber(): string {
    return this.sequence;
  }

  public incrementSequenceNumber(): void {
    // no-op for tests
  }
}

export class Transaction {
  public readonly operations: unknown[];
  public readonly source: string;
  public readonly fee: string;
  public readonly networkPassphrase: string;
  public signed = false;

  constructor(params: {
    operations?: unknown[];
    source?: string;
    fee?: string;
    networkPassphrase?: string;
  } = {}) {
    this.operations = params.operations ?? [];
    this.source = params.source ?? '';
    this.fee = params.fee ?? '100';
    this.networkPassphrase = params.networkPassphrase ?? Networks.TESTNET;
  }

  public sign(..._keypairs: Keypair[]): void {
    this.signed = true;
  }

  public toXDR(): string {
    return 'AAAAAgAAAABtb2NrLXRyYW5zYWN0aW9uLXhkcg==';
  }

  public toEnvelope(): { toXDR: () => string } {
    return { toXDR: () => this.toXDR() };
  }
}

export class TransactionBuilder {
  private readonly operations: unknown[] = [];
  private readonly source: string;
  private fee = '100';
  private networkPassphrase: string = Networks.TESTNET;
  private timeout = 0;

  constructor(sourceAccount: Account, opts: { fee?: string; networkPassphrase?: string } = {}) {
    this.source = sourceAccount.accountId;
    if (opts.fee) this.fee = opts.fee;
    if (opts.networkPassphrase) this.networkPassphrase = opts.networkPassphrase;
  }

  public addOperation(operation: unknown): this {
    this.operations.push(operation);
    return this;
  }

  public setTimeout(timeout: number): this {
    this.timeout = timeout;
    return this;
  }

  public setNetworkPassphrase(passphrase: string): this {
    this.networkPassphrase = passphrase;
    return this;
  }

  public build(): Transaction {
    return new Transaction({
      operations: this.operations,
      source: this.source,
      fee: this.fee,
      networkPassphrase: this.networkPassphrase,
    });
  }
}

// ---------------------------------------------------------------------------
// Contract
// ---------------------------------------------------------------------------

export class Contract {
  constructor(public readonly contractId: string) {}

  public call(method: string, ...params: unknown[]): { method: string; params: unknown[] } {
    return { method, params };
  }
}

// ---------------------------------------------------------------------------
// Soroban RPC server
// ---------------------------------------------------------------------------

export const SorobanRpc = {
  Server: class Server {
    constructor(public readonly serverURL: string) {}

    public getAccount = jest.fn(async (accountId: string) => new Account(accountId, '0'));

    public simulateTransaction = jest.fn(async (_tx: Transaction) => ({
      id: '1',
      latestLedger: 1,
      events: [],
      results: [{ xdr: 'mock-result-xdr' }],
      transactionData: 'mock-transaction-data',
      minResourceFee: '100',
      cost: { cpuInsns: '0', memBytes: '0' },
      stateChanges: [],
    }));

    public prepareTransaction = jest.fn(async (tx: Transaction) => tx);

    public sendTransaction = jest.fn(async (_tx: Transaction) => ({
      status: 'PENDING',
      hash: 'mock-transaction-hash',
      latestLedger: 1,
      latestLedgerCloseTime: '0',
    }));

    public getTransaction = jest.fn(async (_hash: string) => ({
      status: 'SUCCESS',
      latestLedger: 1,
      latestLedgerCloseTime: '0',
      ledger: 1,
      createdAt: '0',
      applicationOrder: 1,
      feeBump: false,
      envelopeXdr: 'mock-envelope-xdr',
      resultXdr: 'mock-result-xdr',
      resultMetaXdr: 'mock-meta-xdr',
    }));
  },
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export const StrKey = {
  isValidEd25519PublicKey: (value: string): boolean =>
    typeof value === 'string' && value.startsWith('G') && value.length === 56,
  isValidEd25519SecretSeed: (value: string): boolean =>
    typeof value === 'string' && value.startsWith('S') && value.length === 56,
};

export const xdr = {
  ScVal: {
    scvI128: (value: unknown) => ({ type: 'i128', value }),
    scvString: (value: string) => ({ type: 'string', value }),
    scvAddress: (value: string) => ({ type: 'address', value }),
  },
};

export const nativeToScVal = (value: unknown, _opts?: unknown) => ({
  type: 'scval',
  value,
});

export const scValToNative = (value: unknown) => value;

export const Address = {
  fromString: (value: string) => ({ address: value, toString: () => value }),
};

export const BASE_FEE = '100';

export default {
  Keypair,
  Networks,
  Account,
  Transaction,
  TransactionBuilder,
  Contract,
  SorobanRpc,
  StrKey,
  xdr,
  nativeToScVal,
  scValToNative,
  Address,
  BASE_FEE,
};
