import { TransactionBuilder, rpc as SorobanRpc } from "@stellar/stellar-sdk";
import * as sorobanClient from "../client";
import { simulateTx, submitSignedTx } from "../submit";

jest.mock("../client");
jest.mock("@stellar/stellar-sdk");

describe("soroban submit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("simulateTx", () => {
    it("should return min fee and prepared XDR on success", async () => {
      const mockRpcServer = {
        simulateTransaction: jest.fn().mockResolvedValue({
          minResourceFee: "1000",
        }),
      };

      (sorobanClient.getRpcServer as jest.Mock).mockReturnValue(mockRpcServer);

      const mockTx = {};
      (TransactionBuilder.fromXDR as jest.Mock).mockReturnValue(mockTx);

      const mockPrepared = {
        toXDR: jest.fn().mockReturnValue("prepared-xdr"),
      };

      (SorobanRpc.assembleTransaction as jest.Mock).mockReturnValue({
        build: jest.fn().mockReturnValue(mockPrepared),
      });

      const result = await simulateTx("unsigned-xdr");

      expect(result).toEqual({
        minFee: 1000,
        minFeeXlm: "0.0001 XLM",
        preparedXdr: "prepared-xdr",
      });
      expect(mockRpcServer.simulateTransaction).toHaveBeenCalledWith(mockTx);
    });

    it("should handle zero fee", async () => {
      const mockRpcServer = {
        simulateTransaction: jest.fn().mockResolvedValue({
          minResourceFee: "0",
        }),
      };

      (sorobanClient.getRpcServer as jest.Mock).mockReturnValue(mockRpcServer);
      (TransactionBuilder.fromXDR as jest.Mock).mockReturnValue({});

      const mockPrepared = {
        toXDR: jest.fn().mockReturnValue("prepared-xdr"),
      };

      (SorobanRpc.assembleTransaction as jest.Mock).mockReturnValue({
        build: jest.fn().mockReturnValue(mockPrepared),
      });

      const result = await simulateTx("unsigned-xdr");

      expect(result.minFee).toBe(0);
      expect(result.minFeeXlm).toBe("0 XLM");
    });

    it("should throw error on simulation error", async () => {
      const mockRpcServer = {
        simulateTransaction: jest.fn().mockResolvedValue({
          error: "ContractError(42)",
        }),
      };

      (sorobanClient.getRpcServer as jest.Mock).mockReturnValue(mockRpcServer);
      (TransactionBuilder.fromXDR as jest.Mock).mockReturnValue({});
      (SorobanRpc.Api.isSimulationError as jest.Mock).mockReturnValue(true);

      await expect(simulateTx("unsigned-xdr")).rejects.toThrow(
        "Contract error code 42",
      );
    });

    it("should throw error for minimum contribution", async () => {
      const mockRpcServer = {
        simulateTransaction: jest.fn().mockResolvedValue({
          error: "Amount is below minimum",
        }),
      };

      (sorobanClient.getRpcServer as jest.Mock).mockReturnValue(mockRpcServer);
      (TransactionBuilder.fromXDR as jest.Mock).mockReturnValue({});
      (SorobanRpc.Api.isSimulationError as jest.Mock).mockReturnValue(true);

      await expect(simulateTx("unsigned-xdr")).rejects.toThrow(
        "Amount is below the campaign's minimum contribution",
      );
    });

    it("should throw error for deadline passed", async () => {
      const mockRpcServer = {
        simulateTransaction: jest.fn().mockResolvedValue({
          error: "deadline passed",
        }),
      };

      (sorobanClient.getRpcServer as jest.Mock).mockReturnValue(mockRpcServer);
      (TransactionBuilder.fromXDR as jest.Mock).mockReturnValue({});
      (SorobanRpc.Api.isSimulationError as jest.Mock).mockReturnValue(true);

      await expect(simulateTx("unsigned-xdr")).rejects.toThrow(
        "This campaign's deadline has passed",
      );
    });

    it("should throw error for cancelled campaign", async () => {
      const mockRpcServer = {
        simulateTransaction: jest.fn().mockResolvedValue({
          error: "Cancelled",
        }),
      };

      (sorobanClient.getRpcServer as jest.Mock).mockReturnValue(mockRpcServer);
      (TransactionBuilder.fromXDR as jest.Mock).mockReturnValue({});
      (SorobanRpc.Api.isSimulationError as jest.Mock).mockReturnValue(true);

      await expect(simulateTx("unsigned-xdr")).rejects.toThrow(
        "This campaign has been cancelled",
      );
    });

    it("should throw error on restore needed", async () => {
      const mockRpcServer = {
        simulateTransaction: jest.fn().mockResolvedValue({}),
      };

      (sorobanClient.getRpcServer as jest.Mock).mockReturnValue(mockRpcServer);
      (TransactionBuilder.fromXDR as jest.Mock).mockReturnValue({});
      (SorobanRpc.Api.isSimulationError as jest.Mock).mockReturnValue(false);
      (SorobanRpc.Api.isSimulationRestore as jest.Mock).mockReturnValue(true);

      await expect(simulateTx("unsigned-xdr")).rejects.toThrow(
        "This transaction requires a ledger entry restore",
      );
    });

    it("should format fee correctly for large amounts", async () => {
      const mockRpcServer = {
        simulateTransaction: jest.fn().mockResolvedValue({
          minResourceFee: "50000000",
        }),
      };

      (sorobanClient.getRpcServer as jest.Mock).mockReturnValue(mockRpcServer);
      (TransactionBuilder.fromXDR as jest.Mock).mockReturnValue({});
      (SorobanRpc.Api.isSimulationError as jest.Mock).mockReturnValue(false);
      (SorobanRpc.Api.isSimulationRestore as jest.Mock).mockReturnValue(false);

      const mockPrepared = {
        toXDR: jest.fn().mockReturnValue("prepared-xdr"),
      };

      (SorobanRpc.assembleTransaction as jest.Mock).mockReturnValue({
        build: jest.fn().mockReturnValue(mockPrepared),
      });

      const result = await simulateTx("unsigned-xdr");

      expect(result.minFee).toBe(50000000);
      expect(result.minFeeXlm).toBe("5 XLM");
    });
  });

  describe("submitSignedTx", () => {
    it("should submit a signed transaction and return hash", async () => {
      const mockHorizonServer = {
        submitTransaction: jest.fn().mockResolvedValue({
          hash: "transaction-hash-123",
        }),
      };

      (sorobanClient.getHorizonServer as jest.Mock).mockReturnValue(
        mockHorizonServer,
      );

      const mockTx = {};
      (TransactionBuilder.fromXDR as jest.Mock).mockReturnValue(mockTx);

      const result = await submitSignedTx("signed-xdr");

      expect(result).toBe("transaction-hash-123");
      expect(mockHorizonServer.submitTransaction).toHaveBeenCalledWith(mockTx);
    });

    it("should throw error if submission fails", async () => {
      const mockHorizonServer = {
        submitTransaction: jest
          .fn()
          .mockRejectedValue(new Error("Network error")),
      };

      (sorobanClient.getHorizonServer as jest.Mock).mockReturnValue(
        mockHorizonServer,
      );
      (TransactionBuilder.fromXDR as jest.Mock).mockReturnValue({});

      await expect(submitSignedTx("signed-xdr")).rejects.toThrow(
        "Network error",
      );
    });
  });
});
