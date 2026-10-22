import { useEffect, useCallback } from "react";
import { useToast } from "@/components/ui/Toast";
import { useXlmBalance } from "@/hooks/useXlmBalance";
import { useWalletSlice } from "@/hooks/useWalletSlice";
import type { UseWalletReturn } from "@/types";

export function useWallet(): UseWalletReturn {
  const {
    address,
    isConnecting,
    isAutoConnecting,
    isSigning,
    error,
    networkMismatch,
    walletNetwork,
    setShowWalletSelect,
    disconnect: disconnectAction,
    signTx: signTxAction,
    autoRestore,
  } = useWalletSlice();

  const { addToast } = useToast();
  const { balance: xlmBalance, refresh: refreshBalance } =
    useXlmBalance(address);

  // Auto-restore from sessionStorage on mount
  useEffect(() => {
    autoRestore();
  }, [autoRestore]);

  const connect = useCallback(async () => {
    setShowWalletSelect(true);
  }, [setShowWalletSelect]);

  const disconnect = useCallback(
    () => disconnectAction((msg, type) => addToast(msg, type)),
    [disconnectAction, addToast],
  );

  const signTx = useCallback(
    (xdr: string) => signTxAction(xdr, (msg, type) => addToast(msg, type)),
    [signTxAction, addToast],
  );

  return {
    address,
    xlmBalance,
    refreshBalance,
    connect,
    disconnect,
    signTx,
    isConnecting,
    isAutoConnecting,
    isSigning,
    error,
    networkMismatch,
    walletNetwork,
  };
}
