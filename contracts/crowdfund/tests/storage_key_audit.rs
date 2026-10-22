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
        match storage.as_str() {
            "persistent" => assert!(
                policy.starts_with("persistent:") && policy.contains("TTL_PERSISTENT_ENTRY"),
                "{name} is persistent but its policy does not bump TTL_PERSISTENT_ENTRY: {policy:?}"
            ),
            "instance" => assert!(
                policy.starts_with("instance:")
                    && policy.contains("TTL_INSTANCE_EXTEND_MIN")
                    && policy.contains("TTL_INSTANCE_EXTEND_MAX"),
                "{name} is instance-backed but its policy is not the contract-wide bump: {policy:?}"
            ),
            "none" => assert!(
                policy.starts_with("reserved:"),
                "{name} is unused but is not marked reserved: {policy:?}"
            ),
            _ => unreachable!(),
        }
    }
}

/// All Rust sources under `src/`, so TTL calls made outside `storage.rs` are
/// visible to the audit.
fn contract_sources() -> Vec<String> {
    fn visit(dir: &std::path::Path, out: &mut Vec<String>) {
        for entry in std::fs::read_dir(dir).expect("read src directory") {
            let path = entry.expect("read dir entry").path();
            if path.is_dir() {
                visit(&path, out);
            } else if path.extension().and_then(|e| e.to_str()) == Some("rs") {
                out.push(std::fs::read_to_string(&path).expect("read Rust source"));
            }
        }
    }

    let src = std::path::Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut out = Vec::new();
    visit(&src, &mut out);
    out
}

#[test]
fn every_persistent_data_key_write_extends_ttl() {
    let sources: Vec<String> = contract_sources()
        .iter()
        .map(|s| s.chars().filter(|c| !c.is_whitespace()).collect())
        .collect();

    let set_needle = "persistent().set(&DataKey::";
    let ttl_needle = "persistent().extend_ttl(&DataKey::";
    let mut writes = 0;

        for source in &sources {
            for (idx, _) in source.match_indices(set_needle) {
                writes += 1;
                let end = source.len().min(idx + 320);
                let window = source.get(idx..end).unwrap_or(&source[idx..]);
                assert!(
                    window.contains(ttl_needle),
                    "a persistent DataKey write is not followed by a TTL bump: {window}"
                );
            }
        }

    assert!(writes > 0, "expected at least one persistent DataKey write");
}

#[test]
fn every_persistent_key_is_extended_on_write() {
    let sources: Vec<String> = contract_sources()
        .iter()
        .map(|s| s.chars().filter(|c| !c.is_whitespace()).collect())
        .collect();

    for (name, _, storage, _) in table_rows() {
        if storage != "persistent" {
            continue;
        }

        let set_needle = format!("persistent().set(&{name}");
        let ttl_needle = format!("persistent().extend_ttl(&{name}");
        let mut writes = 0;

        for source in &sources {
            for (idx, _) in source.match_indices(&set_needle) {
                writes += 1;
                let end = source.len().min(idx + 400);
                let window = source.get(idx..end).unwrap_or(&source[idx..]);
                assert!(
                    window.contains(&ttl_needle),
                    "{name} is written without an immediate TTL bump: {window}"
                );
            }
        }

        assert!(writes > 0, "{name} is documented as persistent but never written");
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
