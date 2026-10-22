import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { ThemeProvider, useTheme } from "../context/ThemeContext";

describe("useTheme hook", () => {
  it("should provide default dark theme", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("dark");
  });

  it("should toggle theme from dark to light", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("light");
  });

  it("should toggle theme from light to dark", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider initialTheme="light">{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("dark");
  });

  it("should set theme explicitly", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider>{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.setTheme("light");
    });

    expect(result.current.theme).toBe("light");

    act(() => {
      result.current.setTheme("dark");
    });

    expect(result.current.theme).toBe("dark");
  });

  it("should call onThemeChange callback with the new theme when it changes", () => {
    const onThemeChangeSpy = vi.fn();

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider onThemeChange={onThemeChangeSpy}>{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    act(() => {
      result.current.toggleTheme();
    });

    expect(result.current.theme).toBe("light");
    expect(onThemeChangeSpy).toHaveBeenCalledTimes(1);
    expect(onThemeChangeSpy).toHaveBeenCalledWith("light");
  });

  it("should accept initial theme prop", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ThemeProvider initialTheme="light">{children}</ThemeProvider>
    );

    const { result } = renderHook(() => useTheme(), { wrapper });

    expect(result.current.theme).toBe("light");
  });

  // ── Fallback contract ──────────────────────────────────────────────────
  describe("fallback contract (rendered outside a ThemeProvider)", () => {
    it("falls back to the default dark theme instead of throwing", () => {
      const { result } = renderHook(() => useTheme());

      expect(result.current.theme).toBe("dark");
    });

    it("exposes no-op toggleTheme/setTheme that are safe to call", () => {
      const { result } = renderHook(() => useTheme());

      expect(() => result.current.toggleTheme()).not.toThrow();
      expect(() => result.current.setTheme("light")).not.toThrow();
      // No provider means no state to update — the theme never changes.
      expect(result.current.theme).toBe("dark");
    });
  });

  // ── Toggling edge cases ────────────────────────────────────────────────
  describe("toggling edge cases", () => {
    it("alternates correctly across repeated toggles", () => {
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      );
      const { result } = renderHook(() => useTheme(), { wrapper });

      const seen: Array<string> = [result.current.theme];
      for (let i = 0; i < 4; i++) {
        act(() => result.current.toggleTheme());
        seen.push(result.current.theme);
      }

      expect(seen).toEqual(["dark", "light", "dark", "light", "dark"]);
    });

    it("documents that toggleTheme/setTheme are not memoized across renders", () => {
      // Not a requirement — just the actual, documented contract: callers
      // should not depend on these functions' identity in a dependency list.
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider>{children}</ThemeProvider>
      );
      const { result, rerender } = renderHook(() => useTheme(), { wrapper });
      const { toggleTheme } = result.current;

      rerender();

      expect(result.current.toggleTheme).not.toBe(toggleTheme);
    });

    it("setTheme to the current value is a no-op that still notifies onThemeChange", () => {
      const onThemeChangeSpy = vi.fn();
      const wrapper = ({ children }: { children: React.ReactNode }) => (
        <ThemeProvider onThemeChange={onThemeChangeSpy}>
          {children}
        </ThemeProvider>
      );
      const { result } = renderHook(() => useTheme(), { wrapper });

      act(() => result.current.setTheme("dark"));

      expect(result.current.theme).toBe("dark");
      expect(onThemeChangeSpy).toHaveBeenCalledWith("dark");
    });
  });

  // ── SSR safety ─────────────────────────────────────────────────────────
  describe("SSR safety", () => {
    it("renders via renderToStaticMarkup with no window or document access", () => {
      const originalWindow = globalThis.window;
      const originalDocument = globalThis.document;
      // @ts-expect-error simulate a server environment with no DOM globals
      delete globalThis.window;
      // @ts-expect-error simulate a server environment with no DOM globals
      delete globalThis.document;

      function Consumer() {
        const { theme } = useTheme();
        return <span>{theme}</span>;
      }

      try {
        const html = renderToStaticMarkup(
          <ThemeProvider initialTheme="light">
            <Consumer />
          </ThemeProvider>,
        );
        expect(html).toContain("light");
      } finally {
        globalThis.window = originalWindow;
        globalThis.document = originalDocument;
      }
    });
  });
});
