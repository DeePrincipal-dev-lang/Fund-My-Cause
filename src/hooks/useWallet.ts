"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  connectWallet,
  disconnectWallet,
  getConnectedAddress,
  getWalletNetwork,
  isWalletAvailable,
  signTransaction,
  submitTransaction,
  type WalletConnection,
  type WalletNetwork,
  type WalletSignResult,
  type WalletSubmitResult,
} from "@/lib/soroban/wallet";

export interface UseWalletState {
  address: string | null;
  network: WalletNetwork | null;
  connected: boolean;
  connecting: boolean;
  available: boolean;
  error: string | null;
}

export interface UseWallet extends UseWalletState {
  connect: () => Promise<WalletConnection | null>;
  disconnect: () => Promise<void>;
  sign: (xdr: string) => Promise<WalletSignResult>;
  submit: (signedXdr: string) => Promise<WalletSubmitResult>;
  refresh: () => Promise<void>;
}

/**
 * React hook wrapping the Soroban wallet module in `src/lib/soroban/wallet`.
 * Components should consume this hook instead of importing the Soroban SDK
 * directly, keeping presentation code decoupled from chain logic.
 */
export function useWallet(): UseWallet {
  const [state, setState] = useState<UseWalletState>(() => ({
    address: null,
    network: null,
    connected: false,
    connecting: false,
    available: isWalletAvailable(),
    error: null,
  }));

  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const refresh = useCallback(async () => {
    try {
      const address = await getConnectedAddress();
      const network = await getWalletNetwork();
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        address,
        network,
        connected: Boolean(address),
        available: isWalletAvailable(),
        error: null,
      }));
    } catch (err) {
      if (!mountedRef.current) return;
      setState((prev) => ({
        ...prev,
        error: err instanceof Error ? err.message : String(err),
      }));
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const connect = useCallback(async (): Promise<WalletConnection | null> => {
    setState((prev) => ({ ...prev, connecting: true, error: null }));
    try {
      const connection = await connectWallet();
      if (!mountedRef.current) return connection;
      setState((prev) => ({
        ...prev,
        address: connection.address,
        network: connection.network,
        connected: true,
        connecting: false,
        available: true,
        error: null,
      }));
      return connection;
    } catch (err) {
      if (!mountedRef.current) return null;
      setState((prev) => ({
        ...prev,
        connecting: false,
        error: err instanceof Error ? err.message : String(err),
      }));
      return null;
    }
  }, []);

  const disconnect = useCallback(async () => {
    try {
      await disconnectWallet();
    } catch (err) {
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
      return;
    }
    if (!mountedRef.current) return;
    setState((prev) => ({
      ...prev,
      address: null,
      network: null,
      connected: false,
      connecting: false,
      error: null,
    }));
  }, []);

  const sign = useCallback(async (xdr: string): Promise<WalletSignResult> => {
    try {
      return await signTransaction(xdr);
    } catch (err) {
      if (mountedRef.current) {
        setState((prev) => ({
          ...prev,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
      throw err;
    }
  }, []);

  const submit = useCallback(
    async (signedXdr: string): Promise<WalletSubmitResult> => {
      try {
        return await submitTransaction(signedXdr);
      } catch (err) {
        if (mountedRef.current) {
          setState((prev) => ({
            ...prev,
            error: err instanceof Error ? err.message : String(err),
          }));
        }
        throw err;
      }
    },
    [],
  );

  return useMemo(
    () => ({
      ...state,
      connect,
      disconnect,
      sign,
      submit,
      refresh,
    }),
    [state, connect, disconnect, sign, submit, refresh],
  );
}

export default useWallet;
