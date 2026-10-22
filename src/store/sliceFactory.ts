/**
 * Shared factory helper for creating store slices in a consistent pattern.
 *
 * All slices in `src/store` should be created via `createSlice` so that
 * actions and selectors follow the same naming conventions:
 *
 * - Actions are exposed as `set<Key>` / `reset` and are always defined on the
 *   slice's `actions` object.
 * - Selectors are exposed as `select<Key>` and read from the slice state.
 *
 * Example:
 *
 * ```ts
 * interface CounterState {
 *   count: number;
 * }
 *
 * const counterSlice = createSlice<CounterState>({
 *   name: 'counter',
 *   initialState: { count: 0 },
 *   actions: (set) => ({
 *     setCount: (count: number) => set({ count }),
 *   }),
 *   selectors: {
 *     selectCount: (state) => state.count,
 *   },
 * });
 * ```
 */

export type SliceSet<State> = (partial: Partial<State> | ((state: State) => Partial<State>)) => void;

export type SliceActions<State> = Record<string, (...args: any[]) => void>;

export type SliceSelectors<State> = Record<string, (state: State) => unknown>;

export interface SliceConfig<State, Actions extends SliceActions<State>, Selectors extends SliceSelectors<State>> {
  /** Unique name identifying the slice. */
  name: string;
  /** Initial state for the slice. */
  initialState: State;
  /** Factory for the slice's actions, receiving a state setter. */
  actions: (set: SliceSet<State>) => Actions;
  /** Selectors reading values from the slice state. */
  selectors: Selectors;
}

export interface Slice<State, Actions extends SliceActions<State>, Selectors extends SliceSelectors<State>> {
  name: string;
  initialState: State;
  actions: Actions;
  selectors: Selectors;
}

/**
 * Creates a store slice following the standardized action/selector pattern.
 *
 * The returned slice exposes `name`, `initialState`, `actions`, and
 * `selectors` so that consumers can rely on a single, predictable shape
 * regardless of which slice they are using.
 */
export function createSlice<
  State,
  Actions extends SliceActions<State> = SliceActions<State>,
  Selectors extends SliceSelectors<State> = SliceSelectors<State>,
>(config: SliceConfig<State, Actions, Selectors>): Slice<State, Actions, Selectors> {
  const { name, initialState, actions, selectors } = config;

  return {
    name,
    initialState,
    actions: actions(() => {
      throw new Error(
        `Slice "${name}" actions must be bound to a store before use.`,
      );
    }),
    selectors,
  };
}

export default createSlice;
