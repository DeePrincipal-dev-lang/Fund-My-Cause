/**
 * Wallet balance reads (#1575).
 *
 * No balance logic lives in the app-level wallet service at present —
 * balance and account reads are handled by `@fund-my-cause/sdk/wallet`
 * and consumed directly from the wallet hook.
 *
 * This module exists to hold the balance responsibility should the app
 * need to wrap SDK balance calls in the future (e.g. network selection,
 * caching, retries). Until then it exposes no public API.
 */

export {};
