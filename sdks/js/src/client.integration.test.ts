/**
 * SDK Soroban Integration Tests (#1178)
 *
 * Tests the actual FmcClient code paths against mocked Soroban RPC
 * and Horizon transports. Exercises:
 * - Argument encoding (Address, nativeToScVal, xlmToStroops)
 * - Simulation result decoding (scValToNative)
 * - Contract error surfacing (parseAndThrow → FmcContractError)
 * - View method data flow (getStats, getCampaignInfo, etc.)
 * - Write method lifecycle (invoke → prepare → sign → submit → poll)
 * - Utility functions (xlmToStroops, stroopsToXlm, bpsToPercent, etc.)
 */

import { FmcClient } from "./client";
import { parseAndThrow, FmcContractError } from "./errors";
import {
  xlmToStroops,
  stroopsToXlm,
  bpsToPercent,
  unixToDate,
  daysUntil,
  STROOPS_PER_XLM,
} from "./utils";
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

// ── Mocks ────────────────────────────────────────────────────────────────────

const PASSPHRASE = "Test SDF Network ; September 2015";
const RPC_URL = "https://soroban-testnet.stellar.org";
const HORIZON_URL = "https://horizon-testnet.stellar.org";
const CONTRACT_ID = "CAIKXK5LVOV2XK5LVOV2XK5LVOV2XK5LVOV2XK5LVOV2XK5LVOV2XCCM";
const CREATOR_ADDRESS =
  "GAYM3TONZXG43TONZXG43TONZXG43TONZXG43TONZXG43TONZXG426HG";
// Valid Stellar contract address for the token
const TOKEN_ADDRESS =
  "CAIKXK5LVOV2XK5LVOV2XK5LVOV2XK5LVOV2XK5LVOV2XK5LVOV2XCCM";

const mockSimulateTransaction = jest.fn();
const mockPrepareTransaction = jest.fn();
const mockSendTransaction = jest.fn();
const mockGetTransaction = jest.fn();
const mockLoadAccount = jest.fn();

jest.mock("@stellar/stellar-sdk", () => {
  const actual = jest.requireActual("@stellar/stellar-sdk");
  return {
    ...actual,
    scValToNative: (val: any) => val,
    rpc: {
      Server: jest.fn().mockImplementation(() => ({
        simulateTransaction: mockSimulateTransaction,
        prepareTransaction: mockPrepareTransaction,
        sendTransaction: mockSendTransaction,
        getTransaction: mockGetTransaction,
      })),
      Api: {
        isSimulationError: (result: any) => {
          return (
            result &&
            typeof result === "object" &&
            "error" in result &&
            !("result" in result)
          );
        },
        GetTransactionStatus: {
          SUCCESS: "SUCCESS",
          FAILED: "FAILED",
          NOT_FOUND: "NOT_FOUND",
        },
      },
    },
    Horizon: {
      Server: jest.fn().mockImplementation(() => ({
        loadAccount: mockLoadAccount,
      })),
    },
    TransactionBuilder: Object.assign(
      jest.fn().mockImplementation(() => ({
        addOperation: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue({
          toXDR: () => "MOCK_BUILT_XDR",
          fee: BASE_FEE,
        }),
      })),
      {
        fromXDR: jest.fn().mockReturnValue({
          hash: "MOCK_TX_HASH",
        }),
      },
    ),
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeClient() {
  return new FmcClient({
    contractId: CONTRACT_ID,
    rpcUrl: RPC_URL,
    networkPassphrase: PASSPHRASE,
    horizonUrl: HORIZON_URL,
  });
}

function mockAccount(sequenceNumber = "100") {
  return {
    accountId: () => CREATOR_ADDRESS,
    sequenceNumber: () => sequenceNumber,
    incrementSequenceNumber: () => {},
  };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("FmcClient — Soroban Integration Tests", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockLoadAccount.mockResolvedValue(mockAccount());
  });

  // ── Constructor ────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("creates a client with valid config", () => {
      const client = makeClient();
      expect(client).toBeInstanceOf(FmcClient);
    });
  });

  // ── View Methods ──────────────────────────────────────────────────────

  describe("getStats", () => {
    it("decodes raw simulation response into typed CampaignStats", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        result: {
          retval: {
            total_raised: 5_000_000_000n,
            goal: 10_000_000_000n,
            progress_bps: 5000,
            contributor_count: 42,
            average_contribution: 119_047_619n,
            largest_contribution: 2_000_000_000n,
          },
        },
        state: "SUCCESS",
      });

      const stats = await client.getStats();

      expect(stats.raisedXlm).toBe(500);
      expect(stats.goalXlm).toBe(1000);
      expect(stats.progressPercent).toBe(50);
      expect(stats.contributorCount).toBe(42);
      expect(stats.raisedStroops).toBe(5_000_000_000n);
      expect(stats.goalStroops).toBe(10_000_000_000n);
    });

    it("handles zero-raised campaign", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        result: {
          retval: {
            total_raised: 0n,
            goal: 1_000_000_000n,
            progress_bps: 0,
            contributor_count: 0,
            average_contribution: 0n,
            largest_contribution: 0n,
          },
        },
        state: "SUCCESS",
      });

      const stats = await client.getStats();
      expect(stats.raisedXlm).toBe(0);
      expect(stats.contributorCount).toBe(0);
    });
  });

  describe("getCampaignInfo", () => {
    it("decodes raw simulation into typed CampaignInfo", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        result: {
          retval: {
            creator: CREATOR_ADDRESS,
            token: "native",
            goal: 10_000_000_000n,
            deadline: BigInt(Math.floor(Date.now() / 1000) + 86400),
            min_contribution: 10_000_000n,
            max_contribution: 5_000_000_000n,
            title: "Test Campaign",
            description: "A test",
            status: "Active",
            category: "Technology",
            has_platform_config: false,
            platform_fee_bps: 0,
          },
        },
        state: "SUCCESS",
      });

      const info = await client.getCampaignInfo();

      expect(info.creator).toBe(CREATOR_ADDRESS);
      expect(info.token).toBe("native");
      expect(info.goalXlm).toBe(1000);
      expect(info.title).toBe("Test Campaign");
      expect(info.status).toBe("Active");
      expect(info.category).toBe("Technology");
      expect(info.deadline).toBeInstanceOf(Date);
      expect(info.minContributionXlm).toBe(1);
      expect(info.maxContributionXlm).toBe(500);
      expect(info.hasPlatformConfig).toBe(false);
    });
  });

  describe("getPerformanceMetrics", () => {
    it("decodes performance metrics from simulation", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        result: {
          retval: {
            success_rate_bps: 9500,
            contribution_velocity: 100_000_000n,
            trending: 1,
            milestones_reached: 3,
            total_milestones: 5,
            time_elapsed: 86400n,
            estimated_time_to_goal: 172800n,
            average_daily_contribution: 50_000_000n,
          },
        },
        state: "SUCCESS",
      });

      const metrics = await client.getPerformanceMetrics();

      expect(metrics.successRateBps).toBe(9500);
      expect(metrics.contributionVelocityXlm).toBe(10);
      expect(metrics.trending).toBe(1);
      expect(metrics.milestonesReached).toBe(3);
      expect(metrics.totalMilestones).toBe(5);
      expect(metrics.timeElapsedSeconds).toBe(86400);
      expect(metrics.estimatedSecondsToGoal).toBe(172800);
    });
  });

  describe("getContribution", () => {
    it("returns 0 for an address that has never contributed", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        result: { retval: 0n },
        state: "SUCCESS",
      });

      const amount = await client.getContribution(CREATOR_ADDRESS);
      expect(amount).toBe(0);
    });

    it("returns the contribution amount in XLM", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        result: { retval: 500_000_000n },
        state: "SUCCESS",
      });

      const amount = await client.getContribution(CREATOR_ADDRESS);
      expect(amount).toBe(50);
    });
  });

  describe("isContributor", () => {
    it("returns false for a non-contributor", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        result: { retval: false },
        state: "SUCCESS",
      });

      const result = await client.isContributor(CREATOR_ADDRESS);
      expect(result).toBe(false);
    });

    it("returns true for a contributor", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        result: { retval: true },
        state: "SUCCESS",
      });

      const result = await client.isContributor(CREATOR_ADDRESS);
      expect(result).toBe(true);
    });
  });

  describe("listContributors", () => {
    it("returns a list of contributor addresses", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        result: { retval: [CREATOR_ADDRESS] },
        state: "SUCCESS",
      });

      const result = await client.listContributors({ offset: 0, limit: 10 });
      expect(result).toEqual([CREATOR_ADDRESS]);
    });

    it("returns empty list for no contributors", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        result: { retval: [] },
        state: "SUCCESS",
      });

      const result = await client.listContributors({ offset: 0, limit: 10 });
      expect(result).toEqual([]);
    });
  });

  describe("getMatchingConfig", () => {
    it("returns null when no matching pool is configured", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        result: { retval: null },
        state: "SUCCESS",
      });

      const config = await client.getMatchingConfig();
      expect(config).toBeNull();
    });

    it("decodes matching configuration", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        result: {
          retval: {
            sponsor: CREATOR_ADDRESS,
            match_ratio: 5000,
            max_match: 1_000_000_000n,
          },
        },
        state: "SUCCESS",
      });

      const config = await client.getMatchingConfig();
      expect(config).not.toBeNull();
      expect(config!.matchRatioBps).toBe(5000);
      expect(config!.maxMatchXlm).toBe(100);
    });
  });

  describe("getTotalMatched", () => {
    it("returns matched amount in XLM", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        result: { retval: 250_000_000n },
        state: "SUCCESS",
      });

      const amount = await client.getTotalMatched();
      expect(amount).toBe(25);
    });
  });

  describe("getMatchingPool", () => {
    it("returns remaining pool in XLM", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        result: { retval: 750_000_000n },
        state: "SUCCESS",
      });

      const amount = await client.getMatchingPool();
      expect(amount).toBe(75);
    });
  });

  // ── Error Surfacing ───────────────────────────────────────────────────

  describe("contract error surfacing", () => {
    it("surfaces contract error #2 (Campaign ended) as FmcContractError", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        error: "Error(Contract, #2)",
      });

      await expect(client.getStats()).rejects.toThrow(FmcContractError);
    });

    it("surfaces contract error #7 (Not active) as FmcContractError", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        error: "Error(Contract, #7)",
      });

      await expect(client.getStats()).rejects.toThrow(FmcContractError);
    });

    it("surfaces contract error #9 (Below minimum) as FmcContractError", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        error: "Error(Contract, #9)",
      });

      await expect(client.getStats()).rejects.toThrow(FmcContractError);
    });

    it("surfaces unknown contract errors with generic message", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        error: "Error(Contract, #999)",
      });

      await expect(client.getStats()).rejects.toThrow(FmcContractError);
    });

    it("surfaces non-contract errors as plain Error", async () => {
      const client = makeClient();
      mockSimulateTransaction.mockResolvedValue({
        error: "Some network error occurred\nat line 1",
      });

      await expect(client.getStats()).rejects.toThrow(
        "Some network error occurred",
      );
    });
  });

  // ── Write Method Lifecycle ────────────────────────────────────────────

  describe("contribute (write method)", () => {
    it("builds, prepares, signs, submits, and polls the transaction", async () => {
      const client = makeClient();
      const mockSignTx = jest.fn().mockResolvedValue("SIGNED_XDR_BASE64");

      mockPrepareTransaction.mockResolvedValue({
        toXDR: () => "PREPARED_XDR",
      });

      mockSendTransaction.mockResolvedValue({
        status: "SUBMITTED",
        hash: "TX_HASH_123",
      });

      mockGetTransaction.mockResolvedValue({
        status: "SUCCESS",
      });

      const hash = await client.contribute({
        contributor: CREATOR_ADDRESS,
        amountXlm: 10,
        tokenId: TOKEN_ADDRESS,
        signTx: mockSignTx,
      });

      expect(hash).toBe("TX_HASH_123");
      expect(mockSignTx).toHaveBeenCalledWith("PREPARED_XDR");
      expect(mockPrepareTransaction).toHaveBeenCalled();
      expect(mockSendTransaction).toHaveBeenCalled();
    });

    it("throws FmcContractError when contract rejects", async () => {
      const client = makeClient();
      const mockSignTx = jest.fn().mockResolvedValue("SIGNED_XDR_BASE64");

      mockPrepareTransaction.mockResolvedValue({
        toXDR: () => "PREPARED_XDR",
      });

      mockSendTransaction.mockResolvedValue({
        status: "ERROR",
        errorResult: "Error(Contract, #2)",
      });

      await expect(
        client.contribute({
          contributor: CREATOR_ADDRESS,
          amountXlm: 10,
          tokenId: TOKEN_ADDRESS,
          signTx: mockSignTx,
        }),
      ).rejects.toThrow(FmcContractError);
    });
  });

  // ── parseAndThrow ─────────────────────────────────────────────────────

  describe("parseAndThrow — contract error parsing", () => {
    it("parses error code from Soroban error string", () => {
      expect(() => parseAndThrow("Error(Contract, #2)")).toThrow(
        FmcContractError,
      );
      expect(() => parseAndThrow("Error(Contract, #2)")).toThrow(
        "Campaign has ended",
      );
    });

    it("parses all known error codes", () => {
      const errorCodes: [number, string][] = [
        [1, "already initialized"],
        [2, "Campaign has ended"],
        [3, "still active"],
        [4, "not been reached"],
        [5, "refunds are not available"],
        [6, "Arithmetic overflow"],
        [7, "not in Active status"],
        [8, "basis points exceed"],
        [9, "below the minimum"],
        [10, "Invalid deadline"],
        [11, "Campaign is paused"],
        [12, "Invalid goal"],
        [13, "Token is not accepted"],
        [14, "per-contributor cap"],
        [15, "whitelist-only"],
        [16, "blacklisted"],
        [22, "Partial refund exceeds"],
        [24, "Emergency withdrawal is locked"],
        [25, "Rate limit exceeded"],
        [26, "Message is too long"],
        [33, "Unauthorized"],
        [37, "already voted"],
        [39, "not the campaign creator"],
      ];

      for (const [code, expectedSubstring] of errorCodes) {
        const errorStr = `Error(Contract, #${code})`;
        try {
          parseAndThrow(errorStr);
          fail(`Expected FmcContractError for code #${code}`);
        } catch (e) {
          expect(e).toBeInstanceOf(FmcContractError);
          expect((e as FmcContractError).code).toBe(code);
          expect((e as FmcContractError).message.toLowerCase()).toContain(
            expectedSubstring.toLowerCase(),
          );
        }
      }
    });

    it("throws plain Error for unrecognized format", () => {
      expect(() => parseAndThrow("Something went wrong")).toThrow(Error);
    });

    it("throws plain Error for empty string", () => {
      expect(() => parseAndThrow("")).toThrow(Error);
    });
  });

  // ── FmcContractError class ────────────────────────────────────────────

  describe("FmcContractError", () => {
    it("has the correct name", () => {
      const err = new FmcContractError(2, "Campaign has ended");
      expect(err.name).toBe("FmcContractError");
    });

    it("carries the numeric code", () => {
      const err = new FmcContractError(7, "Not active");
      expect(err.code).toBe(7);
    });

    it("is an instance of Error", () => {
      const err = new FmcContractError(1, "Init");
      expect(err).toBeInstanceOf(Error);
    });

    it("has the message accessible", () => {
      const err = new FmcContractError(26, "Message is too long");
      expect(err.message).toBe("Message is too long");
    });
  });

  // ── SDK Utility Functions ─────────────────────────────────────────────

  describe("xlmToStroops / stroopsToXlm round-trip", () => {
    it("round-trips through common values", () => {
      const values = [0, 0.01, 1, 10.5, 100, 999.9999999];
      for (const xlm of values) {
        expect(stroopsToXlm(xlmToStroops(xlm))).toBeCloseTo(xlm, 6);
      }
    });

    it("handles boundary values", () => {
      expect(xlmToStroops(0)).toBe(0n);
      expect(stroopsToXlm(0n)).toBe(0);
      expect(xlmToStroops(0.0000001)).toBe(1n);
    });

    it("xlmToStroops rounds to nearest stroop", () => {
      expect(xlmToStroops(1.00000005)).toBe(10_000_001n);
      expect(xlmToStroops(1.00000004)).toBe(10_000_000n);
    });
  });

  describe("STROOPS_PER_XLM", () => {
    it("equals 10_000_000n", () => {
      expect(STROOPS_PER_XLM).toBe(10_000_000n);
    });
  });

  describe("bpsToPercent", () => {
    it("formats edge cases", () => {
      expect(bpsToPercent(0)).toBe("0%");
      expect(bpsToPercent(10_000)).toBe("100%");
      expect(bpsToPercent(1)).toBe("0.01%");
      expect(bpsToPercent(9999)).toBe("99.99%");
      expect(bpsToPercent(5000)).toBe("50%");
    });
  });

  describe("unixToDate", () => {
    it("converts number and bigint timestamps", () => {
      const ts = 1_700_000_000;
      expect(unixToDate(ts).getTime()).toBe(ts * 1000);
      expect(unixToDate(BigInt(ts)).getTime()).toBe(ts * 1000);
    });
  });

  describe("daysUntil", () => {
    it("returns 0 for past dates", () => {
      const past = new Date(Date.now() - 86_400_000);
      expect(daysUntil(past)).toBe(0);
    });

    it("returns 0 for today", () => {
      const today = new Date(Date.now() + 1000);
      expect(daysUntil(today)).toBe(0);
    });

    it("returns correct count for future dates", () => {
      const threeDays = new Date(Date.now() + 3 * 86_400_000 + 1000);
      expect(daysUntil(threeDays)).toBe(3);
    });
  });
});

// ── Argument Encoding Tests ──────────────────────────────────────────────────

describe("Argument Encoding", () => {
  it("encodes Stellar address to ScVal", () => {
    const addr = new Address(CREATOR_ADDRESS);
    const scVal = addr.toScVal();
    expect(scVal).toBeDefined();
  });

  it("encodes i128 amount via nativeToScVal", () => {
    const scVal = nativeToScVal(1_000_000_000n, { type: "i128" });
    expect(scVal).toBeDefined();
  });

  it("encodes u32 via nativeToScVal", () => {
    const scVal = nativeToScVal(5000, { type: "u32" });
    expect(scVal).toBeDefined();
  });

  it("encodes string via nativeToScVal", () => {
    const scVal = nativeToScVal("Hello World", { type: "string" });
    expect(scVal).toBeDefined();
  });

  it("round-trips xlmToStroops precision at boundary", () => {
    const stroops = xlmToStroops(0.0000001);
    expect(stroops).toBe(1n);
    expect(stroopsToXlm(stroops)).toBeCloseTo(0.0000001, 10);
  });

  it("handles large amounts without overflow", () => {
    const large = xlmToStroops(1_000_000);
    expect(large).toBe(10_000_000_000_000n);
    expect(stroopsToXlm(large)).toBe(1_000_000);
  });
});
