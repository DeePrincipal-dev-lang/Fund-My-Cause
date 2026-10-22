//! # Shared Issuance Validation
//!
//! Badge/achievement issuance (`contracts/achievements`) and registry
//! project-status issuance (`contracts/registry`, e.g. verification) both
//! follow the same shape: check a numeric "kind" is within a valid range,
//! then check the target hasn't already been issued/marked before mutating
//! state. This module centralizes that shared validation so both contracts
//! stop re-implementing it independently.

use crate::error::CommonError;

/// Shared issuance validation helpers used by any contract that grants a
/// one-time status (an achievement unlock, a badge, a verified/archived
/// flag, ...).
pub struct IssuanceValidator;

impl IssuanceValidator {
    /// Validate that `kind` falls within the inclusive `[min, max]` range
    /// used to identify a valid issuance "type" (e.g. an achievement type
    /// id, a badge tier).
    pub fn validate_type_range(kind: u32, min: u32, max: u32) -> Result<(), CommonError> {
        if kind < min || kind > max {
            return Err(CommonError::InvalidInput);
        }
        Ok(())
    }

    /// Validate that the target has not already been issued/marked. Callers
    /// pass whatever boolean check makes sense for their storage layout
    /// (e.g. `has_achievement(...)` or `project.verified`).
    pub fn check_not_already_issued(already_issued: bool) -> Result<(), CommonError> {
        if already_issued {
            return Err(CommonError::AlreadyExists);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_out_of_range_type() {
        assert!(IssuanceValidator::validate_type_range(0, 1, 13).is_err());
        assert!(IssuanceValidator::validate_type_range(14, 1, 13).is_err());
        assert!(IssuanceValidator::validate_type_range(5, 1, 13).is_ok());
    }

    #[test]
    fn rejects_double_issuance() {
        assert!(IssuanceValidator::check_not_already_issued(true).is_err());
        assert!(IssuanceValidator::check_not_already_issued(false).is_ok());
    }
}
