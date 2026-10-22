"use client";

import React, { createContext, useContext, ReactNode } from "react";

export type Theme = "dark" | "light";

/**
 * Public contract returned by {@link useTheme}.
 *
 * `theme` starts at `initialTheme` (or `"dark"` when there is no provider —
 * see the fallback contract below). `toggleTheme`/`setTheme` are fresh
 * function values on every render (they aren't memoized) — safe to call, but
 * don't rely on their identity for `useEffect`/`useCallback` dependency lists
 * or `React.memo` prop comparisons.
 *
 * SSR-safe: neither this hook nor `ThemeProvider` reads `window` or
 * `document`, so the first render is identical on the server and the client.
 *
 * Fallback contract: calling `useTheme()` outside a `<ThemeProvider>` does
 * not throw. It returns a default dark-theme context whose `toggleTheme`/
 * `setTheme` are no-ops, so a component stays renderable in isolation (a
 * unit test, an example, a provider that hasn't mounted yet) instead of
 * crashing. The tradeoff is that a genuinely missing provider fails
 * silently — nothing shows the theme actually applied.
 */
export interface UseThemeReturn {
  theme: Theme;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
}

type ThemeContextType = UseThemeReturn;

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export interface ThemeProviderProps {
  children: ReactNode;
  initialTheme?: Theme;
  onThemeChange?: (theme: Theme) => void;
}

export function ThemeProvider({
  children,
  initialTheme = "dark",
  onThemeChange,
}: ThemeProviderProps) {
  const [theme, setThemeState] = React.useState<Theme>(initialTheme);

  const setTheme = (newTheme: Theme) => {
    setThemeState(newTheme);
    onThemeChange?.(newTheme);
  };

  const toggleTheme = () => {
    const newTheme = theme === "dark" ? "light" : "dark";
    setTheme(newTheme);
  };

  const value: ThemeContextType = {
    theme,
    toggleTheme,
    setTheme,
  };

  return (
    <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
  );
}

const defaultThemeContext: ThemeContextType = {
  theme: "dark",
  toggleTheme: () => {},
  setTheme: () => {},
};

export function useTheme(): UseThemeReturn {
  const context = useContext(ThemeContext);
  return context || defaultThemeContext;
}
