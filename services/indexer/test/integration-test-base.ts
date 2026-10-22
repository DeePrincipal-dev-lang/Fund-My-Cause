/**
 * integration-test-base.ts
 * ────────────────────────
 * Base class for integration tests that provides setup/teardown,
 * fixtures, and common assertions. Separates integration test infrastructure
 * from unit test organization.
 */

import { EventStore } from "../src/event-store";
import { EventDispatcher } from "../src/handlers/index";
import type { EventRepository } from "../src/repository";
import type { SorobanEvent } from "../src/repository";

/**
 * Base class for integration tests that work with the event indexer.
 * Provides setup/teardown lifecycle and common utilities.
 */
export abstract class IntegrationTestBase {
  protected eventStore!: EventStore;
  protected dispatcher!: EventDispatcher;
  protected repository!: EventRepository;

  /**
   * Initialize test environment before running tests.
   * Should be called in test setup (beforeEach or beforeAll).
   */
  async setupTestEnvironment(): Promise<void> {
    // Initialize in-memory event store
    this.eventStore = new EventStore();

    // Initialize repository if needed
    // this.repository = new InMemoryRepository();

    // Initialize dispatcher with handlers
    // this.dispatcher = new EventDispatcher([...handlers]);
  }

  /**
   * Clean up test environment after tests.
   * Should be called in test teardown (afterEach or afterAll).
   */
  async teardownTestEnvironment(): Promise<void> {
    // Clear event store
    if (this.eventStore) {
      await this.eventStore.clear();
    }

    // Additional cleanup as needed
  }

  /**
   * Submit events and wait for processing.
   * Useful for integration tests that need to verify event flow.
   */
  async submitAndProcess(events: SorobanEvent[]): Promise<void> {
    for (const event of events) {
      await this.eventStore.store(event);
    }

    // Process all stored events
    if (this.dispatcher) {
      await this.dispatcher.dispatch(events);
    }
  }

  /**
   * Assert that an event was processed successfully
   */
  protected async assertEventProcessed(
    eventId: string,
    expectedType: string
  ): Promise<void> {
    if (!this.eventStore) {
      throw new Error("EventStore not initialized");
    }

    const event = await this.eventStore.getEvent(eventId);
    if (!event) {
      throw new Error(`Event ${eventId} not found`);
    }

    if (event.type !== expectedType) {
      throw new Error(
        `Expected event type ${expectedType}, got ${event.type}`
      );
    }

    if (!event.processed) {
      throw new Error(`Event ${eventId} was not processed`);
    }
  }

  /**
   * Assert that a sequence of events was processed in order
   */
  protected async assertEventSequence(
    eventIds: string[],
    expectedOrder: string[]
  ): Promise<void> {
    if (!this.eventStore) {
      throw new Error("EventStore not initialized");
    }

    const events = await Promise.all(
      eventIds.map((id) => this.eventStore.getEvent(id))
    );

    const types = events.map((e) => e?.type);
    for (let i = 0; i < expectedOrder.length; i++) {
      if (types[i] !== expectedOrder[i]) {
        throw new Error(
          `Event sequence mismatch at index ${i}: expected ${expectedOrder[i]}, got ${types[i]}`
        );
      }
    }
  }

  /**
   * Get all events of a specific type
   */
  protected async getEventsByType(type: string): Promise<SorobanEvent[]> {
    if (!this.eventStore) {
      throw new Error("EventStore not initialized");
    }

    // Implementation depends on EventStore API
    // This is a placeholder
    return [];
  }

  /**
   * Get all events for a specific contract
   */
  protected async getEventsByContract(contractId: string): Promise<SorobanEvent[]> {
    if (!this.eventStore) {
      throw new Error("EventStore not initialized");
    }

    // Implementation depends on EventStore API
    return [];
  }

  /**
   * Mark integration tests as slow to exclude from unit test runs
   */
  protected static markAsSlow(): void {
    // This can be set as a test metadata tag or environment variable
    // Used by CI to run fast unit tests and slow integration tests separately
    process.env["TEST_TYPE"] = "integration";
  }
}

/**
 * Decorator to mark a test method as an integration test.
 * Allows CI to skip these in fast unit test runs.
 */
export function integration(target: any, propertyKey: string, descriptor: PropertyDescriptor) {
  descriptor.value.__isIntegrationTest = true;
  return descriptor;
}
