//! Audit of the storage key table in `src/storage.rs` (issue #1485).
//!
//! The table in the module docs is checked against the `KEY_*` constants
//! declared in the same file. The source is read at compile time so the audit
//! cannot drift from the code it describes.

#![cfg(test)]

const SOURCE: &str = include_str!("../src/storage.rs");

/// Metadata symbols that intentionally share a slot with a `KEY_*` constant.
/// Any collision outside this list is a regression.
const KNOWN_METADATA_ALIASES: &[&str] = &["TITLE", "DESC", "SOCIAL", "METAHIST", "IPFSCID"];

const RECOGNISED_POLICIES: &[&str] = &["persistent:", "instance:", "reserved:"];

/// Names of every `pub const KEY_*` declared in `src/storage.rs`.
fn declared_keys() -> Vec<String> {
    SOURCE
        .lines()
        .filter_map(|line| line.trim().strip_prefix("pub const "))
        .filter(|rest| rest.starts_with("KEY_"))
        .map(|rest| rest.split(':').next().unwrap().trim().to_string())
        .collect()
}

/// Rows of the key table: (constant, symbol, storage, ttl policy).
fn table_rows() -> Vec<(String, String, String, String)> {
    SOURCE
        .lines()
        .filter(|line| line.starts_with("//! | `KEY_"))
        .map(|line| {
            let cols: Vec<&str> = line.split('|').map(str::trim).collect();
            let strip = |s: &str| s.trim_matches('`').to_string();
            (
                strip(cols[1]),
                strip(cols[2]),
                cols[3].to_string(),
                cols[4].to_string(),
            )
        })
        .collect()
}

/// Symbol strings used by `metadata_field_key`.
fn metadata_symbols() -> Vec<String> {
    let start = SOURCE.find("pub fn metadata_field_key").unwrap();
    let end = start + SOURCE[start..].find("/// Contract version").unwrap();
    SOURCE[start..end]
        .split("symbol_short!(\"")
        .skip(1)
        .map(|s| s.split('"').next().unwrap().to_string())
        .collect()
}

#[test]
fn every_key_has_a_table_row() {
    let mut declared = declared_keys();
    let mut documented: Vec<String> = table_rows().into_iter().map(|r| r.0).collect();
    declared.sort();
    documented.sort();
    assert_eq!(
        declared, documented,
        "every KEY_* constant needs exactly one row in the storage key table"
    );
}

#[test]
fn every_row_declares_a_recognised_ttl_policy() {
    for (name, _, storage, policy) in table_rows() {
        assert!(
            RECOGNISED_POLICIES.iter().any(|p| policy.starts_with(p)),
            "{name} has no recognised TTL policy: {policy:?}"
        );
        assert!(
            matches!(storage.as_str(), "persistent" | "instance" | "none"),
            "{name} has an unknown storage kind: {storage:?}"
        );
    }
}

#[test]
fn key_symbols_are_unique() {
    let rows = table_rows();
    for (i, a) in rows.iter().enumerate() {
        for b in rows.iter().skip(i + 1) {
            assert_ne!(a.1, b.1, "{} and {} share symbol {}", a.0, b.0, a.1);
        }
    }
}

#[test]
fn metadata_symbols_only_alias_known_slots() {
    let keys: Vec<String> = table_rows().into_iter().map(|r| r.1).collect();
    let mut aliased: Vec<String> = metadata_symbols()
        .into_iter()
        .filter(|s| keys.contains(s))
        .collect();
    aliased.sort();
    let mut expected: Vec<String> = KNOWN_METADATA_ALIASES
        .iter()
        .map(|s| s.to_string())
        .collect();
    expected.sort();
    assert_eq!(
        aliased, expected,
        "metadata key collides with a KEY_* symbol outside the known set"
    );
}
