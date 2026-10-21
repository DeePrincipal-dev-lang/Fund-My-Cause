//! Shared math utilities for basis-point calculations and proportional arithmetic.
//!
//! All monetary calculations in the workspace should use these functions
//! instead of raw `i128` arithmetic to ensure consistent overflow handling
//! and rounding behavior.

/// Maximum basis points (10,000 = 100%).
pub const BASIS_POINTS_MAX: i128 = 10_000;

/// Divisor used to convert stroops into whole units for reward and points
/// calculations.
pub const REWARD_DIVISOR: i128 = 1_000_000;

/// Apply a basis-point fee/ratio to an amount using checked arithmetic.
///
/// Returns `amount * bps / 10_000`, truncated toward zero.
/// Returns `Err(CommonError::InvalidInput)` on overflow or if bps > 10_000.
///
/// # Examples
/// ```
/// # use common::math::{apply_bps, BASIS_POINTS_MAX};
/// assert_eq!(apply_bps(10_000, 250).unwrap(), 250);
/// assert_eq!(apply_bps(1_000_000, 10_000).unwrap(), 1_000_000);
/// ```
pub fn apply_bps(amount: i128, bps: u32) -> Result<i128, crate::CommonError> {
    if bps as i128 > BASIS_POINTS_MAX {
        return Err(crate::CommonError::InvalidInput);
    }
    amount
        .checked_mul(bps as i128)
        .and_then(|v| v.checked_div(BASIS_POINTS_MAX))
        .ok_or(crate::CommonError::InvalidInput)
}

/// Apply a basis-point fee/ratio using saturating arithmetic (no overflow error).
///
/// Returns `amount * bps / 10_000`, truncated toward zero.
/// Saturates at `i128::MAX` on overflow instead of returning an error.
/// Use this in read-only views where degraded precision is preferred over failure.
pub fn apply_bps_saturating(amount: i128, bps: u32) -> i128 {
    (amount.saturating_mul(bps as i128)) / BASIS_POINTS_MAX
}

/// Proportional calculation: `numerator * total / denominator`.
///
/// Returns the floor-truncated result. Returns `Err(CommonError::InvalidInput)`
/// on overflow or if `denominator == 0`.
///
/// Useful for vesting schedules, refund proportions, and similar calculations.
pub fn proportional(
    numerator: i128,
    denominator: i128,
    total: i128,
) -> Result<i128, crate::CommonError> {
    if denominator == 0 {
        return Err(crate::CommonError::InvalidInput);
    }
    numerator
        .checked_mul(total)
        .and_then(|v| v.checked_div(denominator))
        .ok_or(crate::CommonError::InvalidInput)
}

/// Ratio expressed in basis points, capped at 10,000 (100%).
///
/// Returns `numerator * 10_000 / denominator`. Numerators at or above the
/// denominator return 10,000; saturating multiplication prevents overflow for
/// extreme values. Returns `0` for non-positive inputs or a zero denominator.
/// This is the shared replacement for the progress/success-rate calculations
/// in analytics views.
pub fn ratio_bps(numerator: i128, denominator: i128) -> u32 {
    if numerator <= 0 || denominator <= 0 {
        return 0;
    }
    if numerator >= denominator {
        return BASIS_POINTS_MAX as u32;
    }
    let raw = numerator.saturating_mul(BASIS_POINTS_MAX) / denominator;
    raw.min(BASIS_POINTS_MAX) as u32
}

#[cfg(test)]
mod tests {
    use super::*;
    use proptest::prelude::*;

    #[test]
    fn test_apply_bps_basic() {
        assert_eq!(apply_bps(10_000, 250).unwrap(), 250);
        assert_eq!(apply_bps(1_000_000, 10_000).unwrap(), 1_000_000);
        assert_eq!(apply_bps(1_000_000, 0).unwrap(), 0);
    }

    #[test]
    fn test_apply_bps_overflow() {
        let result = apply_bps(i128::MAX, 2);
        assert!(result.is_err());
    }

    #[test]
    fn test_apply_bps_invalid_bps() {
        let result = apply_bps(1000, 10_001);
        assert!(result.is_err());
    }

    #[test]
    fn test_apply_bps_saturating() {
        assert_eq!(apply_bps_saturating(10_000, 250), 250);
        assert_eq!(apply_bps_saturating(1_000_000, 10_000), 1_000_000);
        let _ = apply_bps_saturating(i128::MAX, 2);
    }

    #[test]
    fn test_proportional_basic() {
        assert_eq!(proportional(1, 2, 1000).unwrap(), 500);
        assert_eq!(proportional(3, 4, 1000).unwrap(), 750);
    }

    #[test]
    fn test_proportional_zero_denominator() {
        let result = proportional(1, 0, 1000);
        assert!(result.is_err());
    }

    #[test]
    fn test_proportional_overflow() {
        let result = proportional(i128::MAX, 1, 2);
        assert!(result.is_err());
    }

    #[test]
    fn test_apply_bps_max_representable_amount() {
        // The largest amount whose product with 10_000 still fits in i128.
        let amount = i128::MAX / BASIS_POINTS_MAX;
        assert_eq!(apply_bps(amount, 10_000).unwrap(), amount);
        // One unit more overflows the intermediate multiplication.
        assert_eq!(
            apply_bps(amount + 1, 10_000),
            Err(crate::CommonError::InvalidInput)
        );
    }

    #[test]
    fn test_apply_bps_zero_inputs() {
        assert_eq!(apply_bps(0, 10_000).unwrap(), 0);
        assert_eq!(apply_bps(i128::MIN, 0).unwrap(), 0);
    }

    #[test]
    fn test_apply_bps_truncates_toward_zero_for_negative_amounts() {
        // -5_000 / 10_000 truncates to 0, not -1.
        assert_eq!(apply_bps(-1, 5_000).unwrap(), 0);
        assert_eq!(apply_bps(-20_000, 5_000).unwrap(), -10_000);
    }

    #[test]
    fn test_apply_bps_saturating_clamps_at_extremes() {
        assert_eq!(
            apply_bps_saturating(i128::MAX, 2),
            i128::MAX / BASIS_POINTS_MAX
        );
        assert_eq!(
            apply_bps_saturating(i128::MIN, 2),
            i128::MIN / BASIS_POINTS_MAX
        );
        assert_eq!(apply_bps_saturating(0, 10_000), 0);
    }

    #[test]
    fn test_proportional_floors_fractional_results() {
        assert_eq!(proportional(2, 3, 1).unwrap(), 0);
        assert_eq!(proportional(-1, 2, 1000).unwrap(), -500);
    }

    #[test]
    fn test_proportional_max_value_without_overflow() {
        assert_eq!(proportional(i128::MAX, 1, 1).unwrap(), i128::MAX);
    }

    #[test]
    fn test_proportional_rejects_intermediate_overflow() {
        assert_eq!(
            proportional(i128::MAX, 2, 2),
            Err(crate::CommonError::InvalidInput)
        );
    }

    #[test]
    fn test_proportional_rejects_min_divided_by_negative_one() {
        // i128::MIN / -1 is not representable and must not panic.
        assert_eq!(
            proportional(i128::MIN, -1, 1),
            Err(crate::CommonError::InvalidInput)
        );
    }

    #[test]
    fn test_ratio_bps_basic() {
        assert_eq!(ratio_bps(5_000, 10_000), 5_000);
        assert_eq!(ratio_bps(1, 2), 5_000);
        assert_eq!(ratio_bps(10_000, 10_000), 10_000);
    }

    #[test]
    fn test_ratio_bps_caps_at_100_percent() {
        assert_eq!(ratio_bps(20_000, 10_000), 10_000);
        assert_eq!(ratio_bps(i128::MAX, 1), BASIS_POINTS_MAX as u32);
    }

    #[test]
    fn test_ratio_bps_zero_and_negative_inputs() {
        assert_eq!(ratio_bps(0, 10_000), 0);
        assert_eq!(ratio_bps(1, 0), 0);
        assert_eq!(ratio_bps(-1, 10_000), 0);
        assert_eq!(ratio_bps(1, -1), 0);
    }

    proptest! {
        #[test]
        fn prop_ratio_bps_is_bounded_and_matches_checked_formula(
            numerator in any::<i128>(),
            denominator in any::<i128>(),
        ) {
            let bps = ratio_bps(numerator, denominator);
            prop_assert!(bps <= BASIS_POINTS_MAX as u32);

            if numerator <= 0 || denominator <= 0 {
                prop_assert_eq!(bps, 0);
            } else if numerator >= denominator {
                prop_assert_eq!(bps, BASIS_POINTS_MAX as u32);
            } else if let Some(scaled) = numerator.checked_mul(BASIS_POINTS_MAX) {
                prop_assert_eq!(bps, (scaled / denominator).min(BASIS_POINTS_MAX) as u32);
            }
        }
    }
}
