//! Static audit for issue #1559.
//!
//! All crowdfund authorization must go through `common::AccessControl`. This
//! test scans the contract sources and fails if a direct `Address::require_auth`
//! call is reintroduced outside the shared module.

#![cfg(test)]

use std::{fs, path::Path};

fn rust_sources(dir: &Path, files: &mut Vec<std::path::PathBuf>) {
    for entry in fs::read_dir(dir).expect("read source directory") {
        let path = entry.expect("read directory entry").path();
        if path.is_dir() {
            rust_sources(&path, files);
        } else if path.extension().and_then(|ext| ext.to_str()) == Some("rs") {
            files.push(path);
        }
    }
}

#[test]
fn authorization_goes_through_common_access_control() {
    let src = Path::new(env!("CARGO_MANIFEST_DIR")).join("src");
    let mut files = Vec::new();
    rust_sources(&src, &mut files);

    let mut offenders = Vec::new();
    for path in files {
        let source = fs::read_to_string(&path).expect("read Rust source");
        for (line_no, line) in source.lines().enumerate() {
            let code = line.split("//").next().unwrap_or("");
            let direct = code.contains(".require_auth(") || code.contains("require_auth_for_args(");
            if direct && !code.contains("AccessControl::require_role_auth") {
                offenders.push(format!(
                    "{}:{}: {}",
                    path.display(),
                    line_no + 1,
                    line.trim()
                ));
            }
        }
    }

    assert!(
        offenders.is_empty(),
        "direct authorization calls bypass common::AccessControl:\n{}",
        offenders.join("\n")
    );
}
