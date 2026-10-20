# Test Utilities

This directory contains shared test setup and helpers used across the test suite.

## Mock Fixtures (`src/__mocks__`)

Mock fixtures live under `src/__mocks__` and are grouped by the area they stub:

- `src/__mocks__/hooks` — mock implementations of custom React hooks used in component tests.
- `src/__mocks__/lib` — mock implementations of library/utility modules used in unit tests.
- `src/__mocks__/i18n` — mock i18n setup used to render translated strings in tests.

Each mock file documents its purpose with a one-line comment at the top. Before adding a new mock, cross-reference it against active test imports and remove any mock that has zero references so no orphaned fixtures remain.
