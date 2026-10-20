//! Unit tests for [`AccessControl`] — targets ≥90 % coverage of
//! `contracts/common/src/access_control.rs`.
//!
//! # Coverage strategy
//!
//! `access_control.rs` exposes a single public item:
//!
//! ```text
//! pub struct AccessControl;
//! impl AccessControl {
//!     pub fn require_role_auth(role_address: &Address) { role_address.require_auth(); }
//! }
//! ```
//!
//! Every reachable line/branch in that file is exercised by the tests below:
//!
//! | Branch / path                        | Test(s)                                       |
//! |--------------------------------------|-----------------------------------------------|
//! | `require_role_auth` — authorized     | `test_require_role_auth_authorized`           |
//! | `require_role_auth` — unauthorized   | `test_require_role_auth_unauthorized`         |
//! | Two distinct roles both authorized   | `test_two_roles_both_authorized`              |
//! | Same role authorized N times         | `test_same_role_auth_called_multiple_times`   |
//! | N distinct roles                     | `test_multiple_distinct_roles`                |
//! | Struct is publicly accessible        | `test_access_control_is_accessible`           |
//! | Address passed by reference          | `test_require_role_auth_with_address_ref`     |

#[cfg(test)]
mod tests {
    use soroban_sdk::{testutils::Address as _, Address, Env, Vec};

    use crate::AccessControl;

    // ── helpers ───────────────────────────────────────────────────────────────

    /// Fresh environment with **no** pre-mocked auths.
    /// Tests that expect a panic use this.
    fn env_no_auths() -> Env {
        Env::default()
    }

    /// Fresh environment with all authentications mocked (every `require_auth`
    /// call succeeds).
    fn env_all_auths() -> Env {
        let env = Env::default();
        env.mock_all_auths();
        env
    }

    // ── authorized path ───────────────────────────────────────────────────────

    /// Happy-path: `require_role_auth` with a mocked auth must not panic and
    /// must record an auth entry for the supplied address.
    #[test]
    fn test_require_role_auth_authorized() {
        let env = env_all_auths();
        let role = Address::generate(&env);

        AccessControl::require_role_auth(&role);

        let auths = env.auths();
        assert_eq!(auths.len(), 1, "expected exactly one auth record");
        let (authorized_addr, _invocation) = &auths[0];
        assert_eq!(
            authorized_addr, &role,
            "auth entry must be for the role address"
        );
    }

    /// Two distinct addresses authorized in one environment — both must appear
    /// in the auth log.
    #[test]
    fn test_two_roles_both_authorized() {
        let env = env_all_auths();
        let role_a = Address::generate(&env);
        let role_b = Address::generate(&env);

        assert_ne!(role_a, role_b, "test requires two different addresses");

        AccessControl::require_role_auth(&role_a);
        AccessControl::require_role_auth(&role_b);

        let auths = env.auths();
        assert_eq!(auths.len(), 2, "expected two auth records");

        let auth_addresses: Vec<Address> = auths.iter().map(|(addr, _)| addr.clone()).collect();
        assert!(
            auth_addresses.contains(&role_a),
            "auth records must include role_a"
        );
        assert!(
            auth_addresses.contains(&role_b),
            "auth records must include role_b"
        );
    }

    /// Calling `require_role_auth` multiple times with the **same** address
    /// accumulates one auth entry per call.
    #[test]
    fn test_same_role_auth_called_multiple_times() {
        let env = env_all_auths();
        let role = Address::generate(&env);

        AccessControl::require_role_auth(&role);
        AccessControl::require_role_auth(&role);
        AccessControl::require_role_auth(&role);

        assert_eq!(
            env.auths().len(),
            3,
            "each require_role_auth call records one entry"
        );
    }

    // ── unauthorized path ─────────────────────────────────────────────────────

    /// When no auth is mocked, `require_role_auth` must panic — this exercises
    /// the `require_auth` rejection branch inside the Soroban test host.
    #[test]
    #[should_panic]
    fn test_require_role_auth_unauthorized() {
        let env = env_no_auths();
        let role = Address::generate(&env);
        // No mocked auth → `require_auth()` must panic.
        AccessControl::require_role_auth(&role);
    }

    // ── struct accessibility ──────────────────────────────────────────────────

    /// Confirm `AccessControl` is reachable via the crate's public re-export.
    /// The fact that this compiles is the meaningful assertion.
    #[test]
    fn test_access_control_is_accessible() {
        let _ = core::mem::size_of::<AccessControl>();
    }

    // ── N-role scenarios ──────────────────────────────────────────────────────

    /// Authorize N distinct addresses; confirm exactly N auth records.
    #[test]
    fn test_multiple_distinct_roles() {
        const ROLE_COUNT: usize = 5;
        let env = env_all_auths();

        let roles: Vec<Address> = (0..ROLE_COUNT)
            .map(|_| Address::generate(&env))
            .collect();

        // Sanity: all addresses are unique.
        for i in 0..roles.len() {
            for j in (i + 1)..roles.len() {
                assert_ne!(roles[i], roles[j]);
            }
        }

        for role in &roles {
            AccessControl::require_role_auth(role);
        }

        assert_eq!(
            env.auths().len(),
            ROLE_COUNT,
            "expect one auth record per role"
        );
    }

    /// Confirm the function accepts an address passed via an explicit shared
    /// reference (no ownership issues).
    #[test]
    fn test_require_role_auth_with_address_ref() {
        let env = env_all_auths();
        let role = Address::generate(&env);
        let role_ref: &Address = &role;
        // Must compile and run cleanly.
        AccessControl::require_role_auth(role_ref);
        assert_eq!(env.auths().len(), 1);
    }
}
