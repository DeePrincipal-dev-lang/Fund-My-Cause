/**
 * Shared Soroban RPC server factory.
 *
 * Both graphql-api (ContractService) and indexer (SorobanRPCClient) previously
 * constructed a `rpc.Server` / `SorobanRpc.Server` independently using
 * different @stellar/stellar-sdk major versions.  This factory is the single
 * place where an `rpc.Server` instance is created so that:
 *
 *  - Both services are pinned to the same SDK version (14.x, `rpc` namespace).
 *  - Connection options (allowHttp for local dev) are applied consistently.
 *  - A future change (e.g. custom transport, mTLS) only needs to be made here.
 *
 * ## Usage
 *
 * ```ts
 * import { createRpcServer, type RpcServerOptions } from "@fund-my-cause/rpc-client";
 *
 * const server = createRpcServer({ url: process.env.RPC_URL! });
 * // server is a fully-typed rpc.Server instance
 * ```
 */

import { rpc } from "@stellar/stellar-sdk";

export interface RpcServerOptions {
  /**
   * Full URL of the Soroban JSON-RPC endpoint.
   * `http://` URLs automatically enable `allowHttp` so local devnet works
   * without extra configuration.
   */
  url: string;
}

/**
 * Create a pre-configured `rpc.Server` instance.
 *
 * `allowHttp` is derived from the URL scheme so callers never have to remember
 * to set it manually for local (`http://`) endpoints.
 */
export function createRpcServer(options: RpcServerOptions): rpc.Server {
  const allowHttp = options.url.startsWith("http://");
  return new rpc.Server(options.url, { allowHttp });
}

/** Re-export the Server type so callers don't need a direct SDK import. */
export type { rpc };
