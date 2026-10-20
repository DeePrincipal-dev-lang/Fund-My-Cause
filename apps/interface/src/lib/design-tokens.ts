/**
 * Design tokens for Fund-My-Cause.
 *
 * These values are the single source of truth. They are mirrored as CSS custom
 * properties in globals.css so they are available to Tailwind utilities and
 * plain CSS alike.
 */

// ── Colors ────────────────────────────────────────────────────────────────────

export const colors = {
  // Brand / primary (indigo)
  primary: {
    50: "#eef2ff",
    100: "#e0e7ff",
    200: "#c7d2fe",
    300: "#a5b4fc",
    400: "#818cf8",
    500: "#6366f1",
    600: "#4f46e5",
    700: "#4338ca",
    800: "#3730a3",
    900: "#312e81",
  },

  // Success (green)
  success: {
    400: "#4ade80",
    500: "#22c55e",
    600: "#16a34a",
  },

  // Warning (yellow/amber)
  warning: {
    300: "#fde047",
    400: "#facc15",
    800: "#854d0e",
    900: "#713f12",
  },

  // Danger (red)
  danger: {
    400: "#f87171",
    500: "#ef4444",
    600: "#dc2626",
  },

  // Neutral (gray)
  neutral: {
    0: "#ffffff",
    50: "#f9fafb",
    100: "#f3f4f6",
    200: "#e5e7eb",
    300: "#d1d5db",
    400: "#9ca3af",
    500: "#6b7280",
    600: "#4b5563",
    700: "#374151",
    800: "#1f2937",
    850: "#18212f",
    900: "#111827",
    950: "#030712",
  },
} as const;

// ── Typography ────────────────────────────────────────────────────────────────

export const typography = {
  fontFamily: {
    sans: ["Inter", "Arial", "Helvetica", "sans-serif"],
    mono: ["JetBrains Mono", "Fira Code", "monospace"],
  },
  fontSize: {
    xs: ["0.75rem", { lineHeight: "1rem" }],
    sm: ["0.875rem", { lineHeight: "1.25rem" }],
    base: ["1rem", { lineHeight: "1.5rem" }],
    lg: ["1.125rem", { lineHeight: "1.75rem" }],
    xl: ["1.25rem", { lineHeight: "1.75rem" }],
    "2xl": ["1.5rem", { lineHeight: "2rem" }],
    "3xl": ["1.875rem", { lineHeight: "2.25rem" }],
    "4xl": ["2.25rem", { lineHeight: "2.5rem" }],
  },
  fontWeight: {
    normal: "400",
    medium: "500",
    semibold: "600",
    bold: "700",
  },
} as const;

// ── Spacing ───────────────────────────────────────────────────────────────────

export const spacing = {
  0: "0px",
  0.5: "0.125rem",
  1: "0.25rem",
  1.5: "0.375rem",
  2: "0.5rem",
  2.5: "0.625rem",
  3: "0.75rem",
  4: "1rem",
  5: "1.25rem",
  6: "1.5rem",
  8: "2rem",
  10: "2.5rem",
  12: "3rem",
  16: "4rem",
  20: "5rem",
  24: "6rem",
} as const;

// ── Border radius ─────────────────────────────────────────────────────────────

export const radius = {
  none: "0px",
  sm: "0.25rem",
  md: "0.5rem",
  lg: "0.75rem",
  xl: "1rem",
  "2xl": "1.25rem",
  full: "9999px",
} as const;

// ── Shadows ───────────────────────────────────────────────────────────────────

export const shadows = {
  sm: "0 1px 2px 0 rgb(0 0 0 / 0.05)",
  md: "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
  lg: "0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)",
  xl: "0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)",
  card: "0 8px 32px rgba(0,0,0,0.25)",
} as const;

// ── Transitions ───────────────────────────────────────────────────────────────

export const transitions = {
  fast: "150ms ease",
  base: "200ms ease",
  slow: "300ms ease",
} as const;

// ── Semantic aliases (light / dark) ───────────────────────────────────────────
// These map to CSS custom properties defined in globals.css.

/**
 * WCAG AA contrast audit results (audited 2026-08-30)
 * ──────────────────────────────────────────────────
 * All text/background pairs below have been verified to meet or exceed the
 * 4.5:1 contrast ratio required for normal text under WCAG 2.1 SC 1.4.3.
 *
 * Changes from pre-audit values:
 *
 * Dark theme:
 *   textMuted:  #6b7280 → #8691a0  (was 4.16:1 on bg, now 6.30:1)
 *   brandHover: #818cf8 already passed (6.75:1 on bg); brand (#6366f1) only
 *               used on dark background (4.51:1 PASS) or with white text on it.
 *
 * Light theme:
 *   textMuted:  #9ca3af → #565d6b  (was 2.54:1 on bg, now 6.62:1)
 *   brandHover: #6366f1 → #4f46e5  (was 4.47:1, now 6.29:1)
 *   success:    #22c55e → #15803d  (was 2.28:1, now 5.02:1)
 *   danger:     #ef4444 → #b91c1c  (was 3.76:1, now 6.47:1)
 *
 * Note: success/danger tokens in the light theme are used as text colours on
 * white/near-white surfaces.  The dark-theme values remain for icon tints on
 * dark surfaces where they already passed (e.g. success #22c55e on #030712 =
 * 8.84:1).  Separate semantic entries keep the two concerns independent.
 */
export const semanticTokens = {
  light: {
    background: colors.neutral[0],
    surface: colors.neutral[50],
    surfaceElevated: colors.neutral[100],
    border: colors.neutral[200],
    borderSubtle: colors.neutral[100],
    textPrimary: colors.neutral[900],
    textSecondary: colors.neutral[500],
    /** WCAG AA fix: darkened from neutral[400] (#9ca3af, 2.54:1) to #565d6b (6.62:1 on white) */
    textMuted: "#565d6b",
    brand: colors.primary[600],
    /** WCAG AA fix: reverted to primary[600] (#4f46e5, 6.29:1) from primary[500] (#6366f1, 4.47:1) */
    brandHover: colors.primary[600],
    brandSubtle: colors.primary[100],
    /** WCAG AA fix: darkened from success[500] (#22c55e, 2.28:1) to #15803d (5.02:1) */
    successText: "#15803d",
    /** WCAG AA fix: darkened from danger[500] (#ef4444, 3.76:1) to #b91c1c (6.47:1) */
    dangerText: "#b91c1c",
  },
  dark: {
    background: colors.neutral[950],
    surface: colors.neutral[900],
    surfaceElevated: colors.neutral[800],
    border: colors.neutral[800],
    borderSubtle: colors.neutral[700],
    textPrimary: colors.neutral[50],
    textSecondary: colors.neutral[400],
    /** WCAG AA fix: lightened from neutral[500] (#6b7280, 4.16:1) to #8691a0 (6.30:1 on #030712) */
    textMuted: "#8691a0",
    brand: colors.primary[500],
    brandHover: colors.primary[400],
    brandSubtle: colors.primary[900],
    /** Dark theme success/danger used as icon tints — already pass (8.84:1 and 5.35:1 on bg) */
    successText: colors.success[400],
    dangerText: colors.danger[400],
  },
} as const;
