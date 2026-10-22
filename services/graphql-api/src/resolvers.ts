/**
 * Resolver entrypoint (#1388).
 *
 * The resolver implementations now live in ./resolvers/* by domain. This
 * module re-exports them for backward compatibility — every existing
 * importer (`./resolvers.js`) keeps working without change.
 */
export { resolvers } from "./resolvers/index.js";
export { CAMPAIGN_STATUS_ENUM_MAP } from "./resolvers/shared.js";
