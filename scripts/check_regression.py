#!/usr/bin/env python3
"""Check benchmark baselines for instruction regressions beyond a threshold.

Expected input format is a simple pipe-delimited table:
  name | instructions | cpu_cycles | notes

The script compares a baseline snapshot against a current run and fails if any
record regresses beyond the configured percentage threshold.
"""

import argparse
import sys
from typing import Dict, Tuple


def parse_metric_file(path: str) -> Dict[str, Tuple[int, int]]:
    metrics: Dict[str, Tuple[int, int]] = {}
    with open(path, "r", encoding="utf-8") as handle:
        for line in handle:
            candidate = line.strip()
            if not candidate or candidate.startswith("#") or candidate.startswith("//"):
                continue
            if "|" not in candidate:
                continue
            parts = [part.strip() for part in candidate.split("|")]
            if len(parts) < 3:
                continue
            name = parts[0]
            try:
                instructions = int(parts[1])
                cpu_cycles = int(parts[2])
            except ValueError:
                continue
            metrics[name] = (instructions, cpu_cycles)
    return metrics


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Fail if benchmark instructions exceed the configured regression threshold."
    )
    parser.add_argument("baseline", help="Baseline metrics file to compare against.")
    parser.add_argument("current", help="Current metrics file to validate.")
    parser.add_argument(
        "--threshold",
        type=float,
        default=15.0,
        help="Maximum allowed percent increase in benchmark instructions. Default: 15%.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    baseline = parse_metric_file(args.baseline)
    current = parse_metric_file(args.current)

    if not baseline:
        print(f"ERROR: no benchmark entries found in baseline: {args.baseline}", file=sys.stderr)
        return 2

    regressions = []
    for name, (baseline_instr, _) in baseline.items():
        if name not in current:
            print(f"ERROR: missing benchmark in current metrics: {name}", file=sys.stderr)
            return 2

        current_instr, _ = current[name]
        if baseline_instr == 0:
            continue
        delta_pct = ((current_instr - baseline_instr) / baseline_instr) * 100.0
        if delta_pct > args.threshold:
            regressions.append((name, baseline_instr, current_instr, delta_pct))

    if regressions:
        print("FAIL: benchmark regressions beyond threshold:")
        for name, old, new, pct in regressions:
            print(f"  {name}: {old} -> {new} instructions ({pct:.2f}% increase)")
        return 1

    print(f"PASS: no benchmark regression above {args.threshold:.0f}%.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
