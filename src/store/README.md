# Store

This directory contains the application's Zustand store slices.

## Standardized slice pattern

All slices in `src/store` must be created through the shared factory helper
(`createSlice`) so that action and selector naming stays consistent across the
codebase. Do not hand-roll `create(...)` calls in individual slice files.

### Conventions

- **Slice file**: `src/store/<name>Slice.ts`
- **State type**: `<Name>State`
- **Store hook**: `use<Name>Store`
- **Actions**: verb-first, camelCase (e.g. `setItems`, `addItem`, `reset`)
- **Selectors**: `select<Thing>` (e.g. `selectItems`, `selectIsLoading`)

### Example

```ts
import { createSlice } from './createSlice';

export interface ItemsState {
  items: string[];
  isLoading: boolean;
  setItems: (items: string[]) => void;
  reset: () => void;
}

export const useItemsStore = createSlice<ItemsState>((set) => ({
  items: [],
  isLoading: false,
  setItems: (items) => set({ items }),
  reset: () => set({ items: [], isLoading: false }),
}));

export const selectItems = (state: ItemsState) => state.items;
export const selectIsLoading = (state: ItemsState) => state.isLoading;
```

### Tests

Tests for slices live in `src/store/__tests__` and should exercise the store
hook returned by the factory, asserting on actions and selectors using the
naming conventions above.
