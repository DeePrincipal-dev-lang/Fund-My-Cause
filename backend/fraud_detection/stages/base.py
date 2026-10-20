"""Stage protocol for the fraud-detection pipeline (#1466).

A stage is any object with a ``name`` and a ``run(context)`` method that
returns a result.  Stages receive a shared mutable context dict and may
read from and write to it, so later stages can consume earlier outputs.
Stages do not import each other; the caller decides which stages run and
in what order.
"""
from __future__ import annotations

from typing import Any, Iterable, Protocol, runtime_checkable


@runtime_checkable
class Stage(Protocol):
    name: str

    def run(self, context: dict[str, Any]) -> Any: ...


def run_stages(stages: Iterable[Stage], context: dict[str, Any]) -> dict[str, Any]:
    """Run stages in order, storing each result under its ``name`` in the context."""
    results: dict[str, Any] = {}
    for stage in stages:
        result = stage.run(context)
        results[stage.name] = result
        context[stage.name] = result
    return results


def stage_names(stages: Iterable[Stage]) -> list[str]:
    return [stage.name for stage in stages]


__all__: list[str] = ["Stage", "run_stages", "stage_names"]
