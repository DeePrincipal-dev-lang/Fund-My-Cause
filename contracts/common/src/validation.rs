//! Shared validation helpers for Fund-My-Cause Soroban contracts.
//!
//! These are primitive, context-free checks with no dependency on
//! contract-specific storage or types.  Each function returns
//! [`CommonError`] so callers can fold the result into their own
//! `ContractError` via the standard `From<CommonError>` impl.

use crate::error::CommonError;

/// Validates that an `i128` amount is strictly positive (> 0).
///
/// This is the single canonical implementation of the "amount must be
/// positive" check previously duplicated as:
/// - `achievements/src/validation.rs::validate_amount` (returns `ContractError::InvalidAmount`)
/// - `crowdfund/src/validation.rs::validate_positive_amount` (returns `ContractError::AmountNotPositive`)
///
/// Both callers now delegate here and let their `From<CommonError>` impl
/// map `CommonError::InvalidInput` onto the appropriate local variant.
///
/// # Arguments
/// * `amount` — the value to check
///
/// # Returns
/// * `Ok(())` if `amount > 0`
/// * `Err(CommonError::InvalidInput)` otherwise
pub fn validate_positive_amount(amount: i128) -> Result<(), CommonError> {
    if amount <= 0 {
        return Err(CommonError::InvalidInput);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn positive_amount_is_valid() {
        assert!(validate_positive_amount(1).is_ok());
        assert!(validate_positive_amount(i128::MAX).is_ok());
    }

    #[test]
    fn zero_is_invalid() {
        assert_eq!(validate_positive_amount(0), Err(CommonError::InvalidInput));
    }

    #[test]
    fn negative_is_invalid() {
        assert_eq!(validate_positive_amount(-1), Err(CommonError::InvalidInput));
        assert_eq!(
            validate_positive_amount(i128::MIN),
            Err(CommonError::InvalidInput)
        );
    }
}
