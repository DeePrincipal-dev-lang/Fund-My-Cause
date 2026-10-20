import type { IndexerEvent } from "../rpc-client.js";
import type { EventRepository } from "../repository.js";

/**
 * The Soroban contract family a handler's events originate from (#1125).
 *
 * The indexer's handlers are physically grouped by contract type under
 * `handlers/<contractType>/` (e.g. `handlers/crowdfund/`, `handlers/registry/`)
 * so that adding support for a new contract never requires touching an
 * existing contract's handler code — see `handlers/index.ts` for the module
 * layout and `index.ts` for how each contract's ID is wired to the RPC client.
 */
export type ContractType = "crowdfund" | "qf" | "achievements" | "registry";

/**
 * Shared interface for domain-specific event handlers.
 *
 * Each handler is responsible for a single event type (e.g. 'campaign',
 * 'donation', 'achievement', 'registered') emitted by a single contract type.
 * The EventDispatcher groups incoming events by type and routes each group to
 * the matching handler via this interface.
 *
 * Implementing a new domain handler:
 *  1. Create a class that implements EventHandler under
 *     `handlers/<contractType>/`, creating the directory if the contract
 *     type is new.
 *  2. Set `eventType` to the string that appears in IndexerEvent.type, and
 *     `contractType` to the owning contract family.
 *  3. Export the class from handlers/index.ts.
 *  4. Register it in the EventDispatcher instantiation in index.ts, and if
 *     the contract type is new, add its contract ID to the RPC client's
 *     `contractIds` list.
 */
export interface EventHandler {
  /** The event type this handler processes (e.g. 'campaign', 'donation', 'achievement') */
  readonly eventType: string;
  /** The contract family that emits this handler's event type. */
  readonly contractType: ContractType;
  /** Handle a batch of events of this handler's type */
  handle(events: IndexerEvent[], repository: EventRepository): void;
}
