/**
 * Unit test for selector memoization (#1291).
 * Validates that expensive selectors skip recomputation when unrelated state changes.
 */

import { useCampaignStore } from "../campaignSlice";
import { selectOptimisticDelta } from "../campaignSlice";

const INITIAL = useCampaignStore.getState();

beforeEach(() => {
  useCampaignStore.setState(INITIAL, true);
});

describe("Selector Memoization", () => {
  describe("selectOptimisticDelta memoization", () => {
    it("should return the same object reference for unchanged contract delta", () => {
      useCampaignStore.getState().applyOptimisticContribution("C1", 10);

      const state1 = useCampaignStore.getState();
      const delta1 = selectOptimisticDelta("C1")(state1);

      // Apply unrelated state change (update different campaign)
      useCampaignStore.getState().applyOptimisticContribution("C2", 5);

      const state2 = useCampaignStore.getState();
      const delta2 = selectOptimisticDelta("C1")(state2);

      // Delta for C1 should have same reference (memoized)
      expect(delta1).toBe(delta2);
    });

    it("should return different reference when delta changes", () => {
      useCampaignStore.getState().applyOptimisticContribution("C1", 10);
      const state1 = useCampaignStore.getState();
      const delta1 = selectOptimisticDelta("C1")(state1);

      useCampaignStore.getState().applyOptimisticContribution("C1", 5);
      const state2 = useCampaignStore.getState();
      const delta2 = selectOptimisticDelta("C1")(state2);

      // Delta reference should change when contribution is added
      expect(delta1).not.toBe(delta2);
    });

    it("should maintain stable reference across multiple unrelated state changes", () => {
      useCampaignStore.getState().applyOptimisticContribution("C1", 10);
      const state1 = useCampaignStore.getState();
      const delta1 = selectOptimisticDelta("C1")(state1);

      // Apply multiple unrelated changes
      useCampaignStore.getState().setPledgeAmountDraft("50");
      useCampaignStore.getState().openPledgeModal();
      useCampaignStore.getState().setActiveCampaign("OTHER");

      const state2 = useCampaignStore.getState();
      const delta2 = selectOptimisticDelta("C1")(state2);

      // Reference should remain stable through unrelated updates
      expect(delta1).toBe(delta2);
    });

    it("should return null consistently for non-existent contracts", () => {
      const state = useCampaignStore.getState();
      const delta1 = selectOptimisticDelta("GHOST")(state);

      useCampaignStore.getState().setPledgeAmountDraft("100");
      const state2 = useCampaignStore.getState();
      const delta2 = selectOptimisticDelta("GHOST")(state2);

      // Both should be null
      expect(delta1).toBeNull();
      expect(delta2).toBeNull();
    });
  });

  describe("selector correctness under state mutations", () => {
    it("should correctly compute deltas after rollback", () => {
      useCampaignStore.getState().applyOptimisticContribution("C1", 10);
      useCampaignStore.getState().applyOptimisticContribution("C1", 5);

      const state1 = useCampaignStore.getState();
      const deltaBefore = selectOptimisticDelta("C1")(state1);
      expect(deltaBefore!.countDelta).toBe(2);
      expect(deltaBefore!.raisedDelta).toBe(BigInt(150_000_000)); // 15 XLM

      useCampaignStore.getState().rollbackOptimistic("C1");

      const state2 = useCampaignStore.getState();
      const deltaAfter = selectOptimisticDelta("C1")(state2);
      expect(deltaAfter).toBeNull();
    });

    it("should handle parallel deltas for multiple contracts", () => {
      useCampaignStore.getState().applyOptimisticContribution("C1", 10);
      useCampaignStore.getState().applyOptimisticContribution("C2", 20);
      useCampaignStore.getState().applyOptimisticContribution("C3", 30);

      const state = useCampaignStore.getState();

      const delta1 = selectOptimisticDelta("C1")(state);
      const delta2 = selectOptimisticDelta("C2")(state);
      const delta3 = selectOptimisticDelta("C3")(state);

      expect(delta1!.raisedDelta).toBe(BigInt(100_000_000));
      expect(delta2!.raisedDelta).toBe(BigInt(200_000_000));
      expect(delta3!.raisedDelta).toBe(BigInt(300_000_000));

      // All should be different objects (different state snapshots)
      expect(delta1).not.toBe(delta2);
      expect(delta2).not.toBe(delta3);
    });
  });

  describe("selector performance characteristics", () => {
    it("should not recompute when other slices change", () => {
      useCampaignStore.getState().applyOptimisticContribution("PERF_TEST", 1);

      const state1 = useCampaignStore.getState();
      const result1 = selectOptimisticDelta("PERF_TEST")(state1);

      // Trigger multiple updates to other fields
      for (let i = 0; i < 100; i++) {
        useCampaignStore.getState().setPledgeAmountDraft(String(i));
      }

      const state2 = useCampaignStore.getState();
      const result2 = selectOptimisticDelta("PERF_TEST")(state2);

      // Should maintain reference identity
      expect(result1).toBe(result2);
    });

    it("should correctly handle state resets", () => {
      useCampaignStore.getState().applyOptimisticContribution("C1", 10);

      const stateBefore = useCampaignStore.getState();
      const deltaBefore = selectOptimisticDelta("C1")(stateBefore);
      expect(deltaBefore).not.toBeNull();

      // Reset to initial state
      useCampaignStore.setState(INITIAL, true);

      const stateAfter = useCampaignStore.getState();
      const deltaAfter = selectOptimisticDelta("C1")(stateAfter);
      expect(deltaAfter).toBeNull();
    });
  });
});
