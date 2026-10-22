import { describe, it, expect } from "vitest";
import {
  calculateProgress,
  clampProgress,
  isProgressFunded,
} from "../utils/progress";

describe("progress utilities", () => {
  describe("calculateProgress", () => {
    it("calculates standard percentage correctly", () => {
      expect(calculateProgress(50, 100)).toBe(50);
      expect(calculateProgress(25, 100)).toBe(25);
      expect(calculateProgress(75, 100)).toBe(75);
      expect(calculateProgress(300, 1000)).toBe(30);
    });

    it("handles 0 goal by returning 0", () => {
      expect(calculateProgress(100, 0)).toBe(0);
    });

    it("handles negative goal by returning 0", () => {
      expect(calculateProgress(100, -50)).toBe(0);
    });

    it("handles 0 or negative raised amounts by returning 0", () => {
      expect(calculateProgress(0, 100)).toBe(0);
      expect(calculateProgress(-50, 100)).toBe(0);
    });

    it("handles overfunded goals without clamping", () => {
      expect(calculateProgress(150, 100)).toBe(150);
      expect(calculateProgress(2000, 1000)).toBe(200);
    });

    it("handles invalid or NaN values gracefully", () => {
      expect(calculateProgress(NaN, 100)).toBe(0);
      expect(calculateProgress(100, NaN)).toBe(0);
      // @ts-expect-error test runtime boundary
      expect(calculateProgress(undefined, 100)).toBe(0);
      // @ts-expect-error test runtime boundary
      expect(calculateProgress(100, null)).toBe(0);
    });
  });

  describe("clampProgress", () => {
    it("returns values between 0 and 100 unchanged", () => {
      expect(clampProgress(0)).toBe(0);
      expect(clampProgress(45)).toBe(45);
      expect(clampProgress(100)).toBe(100);
    });

    it("clamps negative values to minimum (default 0)", () => {
      expect(clampProgress(-10)).toBe(0);
      expect(clampProgress(-0.5)).toBe(0);
    });

    it("clamps values greater than 100 to maximum (default 100)", () => {
      expect(clampProgress(105)).toBe(100);
      expect(clampProgress(250)).toBe(100);
    });

    it("supports custom min and max bounds", () => {
      expect(clampProgress(5, 10, 50)).toBe(10);
      expect(clampProgress(60, 10, 50)).toBe(50);
      expect(clampProgress(25, 10, 50)).toBe(25);
    });

    it("handles NaN or invalid numbers", () => {
      expect(clampProgress(NaN)).toBe(0);
      // @ts-expect-error test runtime boundary
      expect(clampProgress(undefined)).toBe(0);
    });
  });

  describe("isProgressFunded", () => {
    it("returns true for 100% or greater", () => {
      expect(isProgressFunded(100)).toBe(true);
      expect(isProgressFunded(150)).toBe(true);
    });

    it("returns false for less than 100%", () => {
      expect(isProgressFunded(99.9)).toBe(false);
      expect(isProgressFunded(0)).toBe(false);
      expect(isProgressFunded(-10)).toBe(false);
    });

    it("evaluates raised and goal amounts directly when goal is provided", () => {
      expect(isProgressFunded(100, 100)).toBe(true);
      expect(isProgressFunded(120, 100)).toBe(true);
      expect(isProgressFunded(90, 100)).toBe(false);
      expect(isProgressFunded(100, 0)).toBe(false);
    });
  });
});
