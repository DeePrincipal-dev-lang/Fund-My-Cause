/**
 * Migration runner for the in-memory EventStore (#894).
 *
 * Applies or rolls back migrations in registration order.  Because all
 * migrations operate on the same in-memory store instance (no persistent
 * state), this runner is intentionally simple — it does not track applied
 * migrations across restarts.  Migrations are always idempotent so running
 * `up` on an already-migrated store is safe.
 *
 * Usage
 * ─────
 * ```ts
 * import { runMigrations } from './run-migrations.js';
 *
 * // Apply all migrations at startup:
 * runMigrations(store, 'up', logger);
 *
 * // Roll back all migrations (e.g. in tests):
 * runMigrations(store, 'down', logger);
 * ```
 */

import type pino from "pino";
import type { IndexedEventStore } from "../event-store.js";
import type { Migration } from "./001_add_event_indexes.js";
import { migration001 } from "./001_add_event_indexes.js";

/** Ordered list of all registered migrations. */
const ALL_MIGRATIONS: Migration[] = [migration001];

export type Direction = "up" | "down";

export interface MigrationResult {
  id: string;
  direction: Direction;
  success: boolean;
  verified: boolean;
  durationMs: number;
  error?: string;
}

/**
 * Run all registered migrations in the given direction.
 *
 * @param store     - The EventStore instance to migrate.
 * @param direction - `'up'` to apply; `'down'` to roll back.
 * @param logger    - Optional pino logger; defaults to silent.
 * @returns         Array of per-migration results.
 */
export function runMigrations(
  store: IndexedEventStore,
  direction: Direction,
  logger?: pino.Logger,
): MigrationResult[] {
  const migrations =
    direction === "up" ? ALL_MIGRATIONS : [...ALL_MIGRATIONS].reverse();

  const results: MigrationResult[] = [];

  for (const migration of migrations) {
    const start = Date.now();
    try {
      logger?.info({ migration: migration.id, direction }, "Running migration");

      if (direction === "up") {
        migration.up(store);
      } else {
        migration.down(store);
      }

      const verified = direction === "up" ? migration.verify(store) : true;
      const durationMs = Date.now() - start;

      if (direction === "up" && !verified) {
        logger?.warn(
          { migration: migration.id, durationMs },
          "Migration applied but verification failed",
        );
      } else {
        logger?.info(
          { migration: migration.id, direction, durationMs, verified },
          "Migration completed",
        );
      }

      results.push({
        id: migration.id,
        direction,
        success: true,
        verified,
        durationMs,
      });
    } catch (err) {
      const durationMs = Date.now() - start;
      const error = err instanceof Error ? err.message : String(err);
      logger?.error(
        { migration: migration.id, direction, durationMs, error },
        "Migration failed",
      );
      results.push({
        id: migration.id,
        direction,
        success: false,
        verified: false,
        durationMs,
        error,
      });
      // Stop on first failure — subsequent migrations may depend on this one.
      break;
    }
  }

  return results;
}
