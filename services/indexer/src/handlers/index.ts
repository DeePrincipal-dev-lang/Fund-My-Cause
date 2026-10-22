/**
 * Domain event handlers for the indexer service (#896, modularized by
 * contract type in #1125).
 *
 * Handlers are grouped into per-contract-type directories so that adding
 * support for a new contract never requires touching an existing contract's
 * handler code:
 *
 *   handlers/
 *     types.ts               - shared EventHandler interface + ContractType
 *     dispatcher.ts           - router (event type -> handler instance)
 *     handler-registry.ts     - canonical event type -> handler constructor
 *     crowdfund/               - handlers for the crowdfund contract
 *       campaign.handler.ts
 *       donation.handler.ts
 *       achievement.handler.ts
 *     qf/                      - handlers for quadratic-funding events
 *       calculated.handler.ts
 *     achievements/            - handlers for the achievements contract
 *       unlocked.handler.ts
 *       points-awarded.handler.ts
 *     registry/                - handlers for the registry contract
 *       registered.handler.ts
 *
 * Re-exports all handler classes, the registry, the dispatcher, and the
 * shared interface so the indexer entry point (`src/index.ts`) can import
 * everything from a single path.
 */
export { CampaignHandler } from "./crowdfund/campaign.handler.js";
export { DonationHandler } from "./crowdfund/donation.handler.js";
export { AchievementHandler } from "./crowdfund/achievement.handler.js";
export { QFCalculatedHandler } from "./qf/calculated.handler.js";
export { AchievementUnlockedHandler } from "./achievements/unlocked.handler.js";
export { AchievementPointsAwardedHandler } from "./achievements/points-awarded.handler.js";
export { RegisteredHandler } from "./registry/registered.handler.js";
export { EventDispatcher } from "./dispatcher.js";
export {
  EVENT_HANDLER_CONSTRUCTORS,
  createEventDispatcher,
  createHandlers,
} from "./handler-registry.js";
export type {
  CanonicalEventType,
  HandlerConstructor,
} from "./handler-registry.js";
export type { EventHandler, ContractType } from "./types.js";
