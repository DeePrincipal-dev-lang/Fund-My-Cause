/**
 * Shared progress and funding calculation utilities.
 */

/**
 * Calculates the progress percentage given a raised amount and a goal amount.
 * Returns 0 if goal is 0 or negative, or if values are invalid.
 * Values above 100 represent overfunded goals and are not clamped here.
 *
 * @param raised - The amount raised so far.
 * @param goal - The target goal amount.
 * @returns Progress percentage as a number.
 */
export function calculateProgress(raised: number, goal: number): number {
  if (
    typeof raised !== "number" ||
    typeof goal !== "number" ||
    Number.isNaN(raised) ||
    Number.isNaN(goal)
  ) {
    return 0;
  }
  if (goal <= 0) {
    return 0;
  }
  if (raised <= 0) {
    return 0;
  }
  return (raised / goal) * 100;
}

/**
 * Clamps a progress percentage between a minimum (default 0) and maximum (default 100).
 *
 * @param progress - The progress percentage to clamp.
 * @param min - Minimum allowed value (default 0).
 * @param max - Maximum allowed value (default 100).
 * @returns Clamped progress percentage.
 */
export function clampProgress(
  progress: number,
  min: number = 0,
  max: number = 100,
): number {
  if (typeof progress !== "number" || Number.isNaN(progress)) {
    return min;
  }
  return Math.min(max, Math.max(min, progress));
}

/**
 * Checks whether a campaign has reached or exceeded 100% funding.
 *
 * @param progress - The progress percentage or raised amount.
 * @param goal - Optional goal amount. If provided, progress is treated as `raised`.
 * @returns True if funded (>= 100%), false otherwise.
 */
export function isProgressFunded(progress: number, goal?: number): boolean {
  const percent =
    goal !== undefined ? calculateProgress(progress, goal) : progress;
  return percent >= 100;
}
