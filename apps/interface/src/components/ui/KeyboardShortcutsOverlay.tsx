"use client";

import React, { useEffect } from "react";
import { X, Keyboard } from "lucide-react";
import { useFocusTrap } from "@/hooks/useFocusTrap";

export interface ShortcutEntry {
  keys: string[];       // e.g. ["Ctrl", "K"] or ["?"]
  description: string;
  category: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  shortcuts?: ShortcutEntry[];
}

/** Default global shortcut registry — kept in sync with CommandPaletteProvider and other handlers. */
export const GLOBAL_SHORTCUTS: ShortcutEntry[] = [
  // Navigation
  { keys: ["G", "H"], description: "Go to Home", category: "Navigation" },
  { keys: ["G", "C"], description: "Go to Campaigns", category: "Navigation" },
  { keys: ["G", "D"], description: "Go to Dashboard", category: "Navigation" },
  { keys: ["G", "B"], description: "Go to Bookmarks", category: "Navigation" },
  { keys: ["G", "A"], description: "Go to Analytics", category: "Navigation" },
  // Actions
  { keys: ["Ctrl", "K"], description: "Open command palette", category: "Actions" },
  { keys: ["?"], description: "Show keyboard shortcuts", category: "Actions" },
  { keys: ["N"], description: "Create new campaign", category: "Actions" },
  { keys: ["Esc"], description: "Close overlay / modal", category: "Actions" },
  // Campaign detail
  { keys: ["P"], description: "Pledge to campaign", category: "Campaign" },
  { keys: ["S"], description: "Share campaign", category: "Campaign" },
  { keys: ["B"], description: "Bookmark / unbookmark", category: "Campaign" },
  // Accessibility
  { keys: ["Tab"], description: "Move focus forward", category: "Accessibility" },
  { keys: ["Shift", "Tab"], description: "Move focus backward", category: "Accessibility" },
  { keys: ["Enter", "Space"], description: "Activate focused element", category: "Accessibility" },
];

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center min-w-[1.75rem] h-7 px-1.5 rounded-md border border-gray-300 dark:border-gray-600 bg-gray-100 dark:bg-gray-800 text-xs font-mono font-medium text-gray-700 dark:text-gray-300 shadow-sm">
      {children}
    </kbd>
  );
}

export function KeyboardShortcutsOverlay({
  isOpen,
  onClose,
  shortcuts = GLOBAL_SHORTCUTS,
}: Props) {
  const trapRef = useFocusTrap(isOpen);

  // Group shortcuts by category
  const grouped = shortcuts.reduce<Record<string, ShortcutEntry[]>>((acc, s) => {
    if (!acc[s.category]) acc[s.category] = [];
    acc[s.category].push(s);
    return acc;
  }, {});

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Prevent body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => { document.body.style.overflow = ""; };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-overlay-title"
      className="fixed inset-0 z-[110] flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        ref={trapRef as React.RefObject<HTMLDivElement>}
        className="relative w-full max-w-2xl max-h-[80vh] flex flex-col bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-800 shrink-0">
          <div className="flex items-center gap-2">
            <Keyboard size={18} className="text-indigo-500" aria-hidden />
            <h2
              id="shortcuts-overlay-title"
              className="text-base font-semibold text-gray-900 dark:text-white"
            >
              Keyboard Shortcuts
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close keyboard shortcuts"
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        {/* Body — scrollable */}
        <div className="overflow-y-auto p-6 space-y-6">
          {Object.entries(grouped).map(([category, items]) => (
            <section key={category} aria-labelledby={`shortcut-cat-${category}`}>
              <h3
                id={`shortcut-cat-${category}`}
                className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3"
              >
                {category}
              </h3>
              <ul className="space-y-2" role="list">
                {items.map((s) => (
                  <li
                    key={s.keys.join("+")}
                    className="flex items-center justify-between gap-4 py-1.5"
                  >
                    <span className="text-sm text-gray-700 dark:text-gray-300">
                      {s.description}
                    </span>
                    <span className="flex items-center gap-1 shrink-0" aria-label={s.keys.join(" + ")}>
                      {s.keys.map((k, i) => (
                        <React.Fragment key={k}>
                          {i > 0 && (
                            <span className="text-gray-400 text-xs" aria-hidden>+</span>
                          )}
                          <Kbd>{k}</Kbd>
                        </React.Fragment>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        {/* Footer */}
        <div className="shrink-0 px-6 py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/80">
          <p className="text-xs text-gray-400 text-center">
            Press{" "}
            <Kbd>?</Kbd>
            {" "}at any time to open this overlay ·{" "}
            <Kbd>Esc</Kbd>
            {" "}to close
          </p>
        </div>
      </div>
    </div>
  );
}
