#!/usr/bin/env python3
"""Check a compiled WASM artifact against a configured size budget."""

import argparse
import os
import sys


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Validate that generated WASM artifacts stay under the configured size budget."
    )
    parser.add_argument(
        "--artifact",
        required=False,
        default=None,
        help="Deprecated single-artifact form. Prefer passing one or more artifact paths positionally.",
    )
    parser.add_argument(
        "artifacts",
        nargs="*",
        help="Paths to the .wasm artifacts to inspect.",
    )
    parser.add_argument(
        "--budget",
        type=int,
        default=262_144,
        help="Maximum allowed size in bytes. Default: 256 KiB.",
    )
    parser.add_argument(
        "--budget-file",
        default=None,
        help="Optional file containing the size budget in bytes (first integer found).",
    )
    return parser.parse_args()


def check_artifact(artifact: str, budget: int) -> int:
    if not os.path.exists(artifact):
        print(f"ERROR: artifact not found: {artifact}", file=sys.stderr)
        return 2

    size = os.path.getsize(artifact)
    print(f"artifact={artifact}")
    print(f"size_bytes={size}")
    print(f"budget_bytes={budget}")

    if size > budget:
        print(
            f"FAIL: WASM artifact exceeds budget by {size - budget} bytes.",
            file=sys.stderr,
        )
        return 1

    print("PASS: WASM artifact is within the configured size budget.")
    return 0


def read_budget_file(path: str) -> int:
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            for token in line.split():
                if token.isdigit():
                    return int(token)
    raise ValueError(f"no integer budget found in {path}")


def main() -> int:
    args = parse_args()
    artifacts = list(args.artifacts)
    if args.artifact is not None:
        artifacts.append(args.artifact)

    if not artifacts:
        print("ERROR: no artifacts provided.", file=sys.stderr)
        return 2

    budget = args.budget
    if args.budget_file is not None:
        try:
            budget = read_budget_file(args.budget_file)
        except (OSError, ValueError) as exc:
            print(f"ERROR: {exc}", file=sys.stderr)
            return 2

    rc = 0
    for artifact in artifacts:
        rc = max(rc, check_artifact(artifact, budget))
    return rc


if __name__ == "__main__":
    raise SystemExit(main())
