import {
  BASE_FEE,
  TransactionBuilder,
  Contract,
  Address,
  nativeToScVal,
  xdr,
} from "@stellar/stellar-sdk";
import * as sorobanClient from "../client";
import {
  buildInitializeTx,
  buildSimpleContractTx,
  buildWithdrawTx,
  buildCancelTx,
  buildPauseTx,
  buildUnpauseTx,
  buildRefundTx,
  buildUpdateMetadataTx,
  buildContributeTx,
} from "../tx-builders";
import type { InitializeParams } from "@/types/soroban";

jest.mock("../client");
jest.mock("@stellar/stellar-sdk");

describe("soroban tx-builders", () => {
  const mockAccount = {
    accountId: () => "GTEST",
    getSequenceNumber: () => "1",
    incrementSequenceNumber: () => {},
  };

  const mockHorizonServer = {
    loadAccount: jest.fn().mockResolvedValue(mockAccount),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (sorobanClient.getHorizonServer as jest.Mock).mockReturnValue(
      mockHorizonServer,
    );
  });

  describe("buildSimpleContractTx", () => {
    it("should build a simple contract transaction", async () => {
      const mockTx = {
        toXDR: jest.fn().mockReturnValue("mock-xdr"),
      };

      const mockOperation = jest.fn().mockReturnThis();
      const mockBuilder = {
        addOperation: mockOperation,
        setTimeout: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(mockTx),
      };

      (TransactionBuilder as jest.Mock).mockImplementation(() => mockBuilder);
      (Contract as jest.Mock).mockImplementation(() => ({
        call: jest.fn().mockReturnValue({}),
      }));

      const result = await buildSimpleContractTx(
        "GCALLER",
        "CONTRACT123",
        "test_method",
      );

      expect(result).toBe("mock-xdr");
      expect(TransactionBuilder).toHaveBeenCalledWith(mockAccount, {
        fee: BASE_FEE,
        networkPassphrase: sorobanClient.NETWORK_PASSPHRASE,
      });
    });

    it("should include args in the contract call", async () => {
      const mockArg = nativeToScVal("test", { type: "string" });
      const mockTx = {
        toXDR: jest.fn().mockReturnValue("mock-xdr"),
      };

      const mockBuilder = {
        addOperation: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(mockTx),
      };

      (TransactionBuilder as jest.Mock).mockImplementation(() => mockBuilder);
      const mockContractCall = jest.fn().mockReturnValue({});
      (Contract as jest.Mock).mockImplementation(() => ({
        call: mockContractCall,
      }));

      await buildSimpleContractTx("GCALLER", "CONTRACT123", "test", [mockArg]);

      expect(mockContractCall).toHaveBeenCalledWith("test", mockArg);
    });
  });

  describe("buildInitializeTx", () => {
    it("should build an initialize transaction with all parameters", async () => {
      const params: InitializeParams = {
        contractId: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
        creator: "GCREATOR",
        token: "GTOKEN",
        goal: 1000000n,
        deadline: 1704067200n,
        minContribution: 1000n,
        title: "Test Campaign",
        description: "Test Description",
        socialLinks: ["https://twitter.com"],
        platformFeeAddress: "GPLATFORM",
        platformFeeBps: 500,
        acceptedTokens: ["GTOKEN1", "GTOKEN2"],
      };

      const mockTx = {
        toXDR: jest.fn().mockReturnValue("initialize-xdr"),
      };

      const mockBuilder = {
        addOperation: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(mockTx),
      };

      (TransactionBuilder as jest.Mock).mockImplementation(() => mockBuilder);
      (Contract as jest.Mock).mockImplementation(() => ({
        call: jest.fn().mockReturnValue({}),
      }));

      const result = await buildInitializeTx(params);

      expect(result).toBe("initialize-xdr");
      expect(mockHorizonServer.loadAccount).toHaveBeenCalledWith("GCREATOR");
    });

    it("should throw error for invalid contract ID", async () => {
      const params: InitializeParams = {
        contractId: "INVALID",
        creator: "GCREATOR",
        token: "GTOKEN",
        goal: 1000000n,
        deadline: 1704067200n,
        minContribution: 1000n,
        title: "Test Campaign",
        description: "Test Description",
      };

      await expect(buildInitializeTx(params)).rejects.toThrow(
        "Invalid contract ID format",
      );
    });
  });

  describe("buildWithdrawTx", () => {
    it("should build a withdraw transaction", async () => {
      const mockTx = {
        toXDR: jest.fn().mockReturnValue("withdraw-xdr"),
      };

      const mockBuilder = {
        addOperation: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(mockTx),
      };

      (TransactionBuilder as jest.Mock).mockImplementation(() => mockBuilder);
      (Contract as jest.Mock).mockImplementation(() => ({
        call: jest.fn().mockReturnValue({}),
      }));

      const result = await buildWithdrawTx("GCALLER", "CONTRACT123");

      expect(result).toBe("withdraw-xdr");
    });
  });

  describe("buildCancelTx", () => {
    it("should build a cancel transaction without reason", async () => {
      const mockTx = {
        toXDR: jest.fn().mockReturnValue("cancel-xdr"),
      };

      const mockBuilder = {
        addOperation: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(mockTx),
      };

      (TransactionBuilder as jest.Mock).mockImplementation(() => mockBuilder);
      (Contract as jest.Mock).mockImplementation(() => ({
        call: jest.fn().mockReturnValue({}),
      }));

      const result = await buildCancelTx("GCALLER", "CONTRACT123");

      expect(result).toBe("cancel-xdr");
    });

    it("should build a cancel transaction with reason", async () => {
      const mockTx = {
        toXDR: jest.fn().mockReturnValue("cancel-xdr"),
      };

      const mockBuilder = {
        addOperation: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(mockTx),
      };

      (TransactionBuilder as jest.Mock).mockImplementation(() => mockBuilder);
      (Contract as jest.Mock).mockImplementation(() => ({
        call: jest.fn().mockReturnValue({}),
      }));

      const result = await buildCancelTx(
        "GCALLER",
        "CONTRACT123",
        "Campaign postponed",
      );

      expect(result).toBe("cancel-xdr");
    });
  });

  describe("buildPauseTx", () => {
    it("should build a pause transaction", async () => {
      const mockTx = {
        toXDR: jest.fn().mockReturnValue("pause-xdr"),
      };

      const mockBuilder = {
        addOperation: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(mockTx),
      };

      (TransactionBuilder as jest.Mock).mockImplementation(() => mockBuilder);
      (Contract as jest.Mock).mockImplementation(() => ({
        call: jest.fn().mockReturnValue({}),
      }));

      const result = await buildPauseTx("GCALLER", "CONTRACT123");

      expect(result).toBe("pause-xdr");
    });
  });

  describe("buildUnpauseTx", () => {
    it("should build an unpause transaction", async () => {
      const mockTx = {
        toXDR: jest.fn().mockReturnValue("unpause-xdr"),
      };

      const mockBuilder = {
        addOperation: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(mockTx),
      };

      (TransactionBuilder as jest.Mock).mockImplementation(() => mockBuilder);
      (Contract as jest.Mock).mockImplementation(() => ({
        call: jest.fn().mockReturnValue({}),
      }));

      const result = await buildUnpauseTx("GCALLER", "CONTRACT123");

      expect(result).toBe("unpause-xdr");
    });
  });

  describe("buildRefundTx", () => {
    it("should build a refund transaction", async () => {
      const mockTx = {
        toXDR: jest.fn().mockReturnValue("refund-xdr"),
      };

      const mockBuilder = {
        addOperation: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(mockTx),
      };

      (TransactionBuilder as jest.Mock).mockImplementation(() => mockBuilder);
      (Contract as jest.Mock).mockImplementation(() => ({
        call: jest.fn().mockReturnValue({}),
      }));
      (Address as jest.Mock).mockImplementation(() => ({
        toScVal: jest.fn().mockReturnValue({}),
      }));

      const result = await buildRefundTx("GCALLER", "CONTRACT123");

      expect(result).toBe("refund-xdr");
    });
  });

  describe("buildUpdateMetadataTx", () => {
    it("should build an update metadata transaction", async () => {
      const mockTx = {
        toXDR: jest.fn().mockReturnValue("update-metadata-xdr"),
      };

      const mockBuilder = {
        addOperation: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(mockTx),
      };

      (TransactionBuilder as jest.Mock).mockImplementation(() => mockBuilder);
      (Contract as jest.Mock).mockImplementation(() => ({
        call: jest.fn().mockReturnValue({}),
      }));

      const result = await buildUpdateMetadataTx(
        "GCALLER",
        "CONTRACT123",
        "New Title",
        "New Description",
      );

      expect(result).toBe("update-metadata-xdr");
    });
  });

  describe("buildContributeTx", () => {
    it("should build a contribute transaction with XLM amount", async () => {
      const mockTx = {
        toXDR: jest.fn().mockReturnValue("contribute-xdr"),
      };

      const mockBuilder = {
        addOperation: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(mockTx),
      };

      (TransactionBuilder as jest.Mock).mockImplementation(() => mockBuilder);
      (Contract as jest.Mock).mockImplementation(() => ({
        call: jest.fn().mockReturnValue({}),
      }));

      const result = await buildContributeTx("GCALLER", "CONTRACT123", 10.5);

      expect(result).toBe("contribute-xdr");
    });

    it("should convert XLM to stroops correctly", async () => {
      const mockTx = {
        toXDR: jest.fn().mockReturnValue("contribute-xdr"),
      };

      const mockContractCall = jest.fn().mockReturnValue({});
      const mockBuilder = {
        addOperation: jest.fn().mockReturnThis(),
        setTimeout: jest.fn().mockReturnThis(),
        build: jest.fn().mockReturnValue(mockTx),
      };

      (TransactionBuilder as jest.Mock).mockImplementation(() => mockBuilder);
      (Contract as jest.Mock).mockImplementation(() => ({
        call: mockContractCall,
      }));

      await buildContributeTx("GCALLER", "CONTRACT123", 1.0);

      expect(nativeToScVal).toHaveBeenCalledWith(10000000n, { type: "i128" });
    });
  });
});
