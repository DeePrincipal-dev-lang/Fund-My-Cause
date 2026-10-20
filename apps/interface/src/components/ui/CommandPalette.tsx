"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Search,
  X,
  Plus,
  Wallet,
  Home,
  TrendingUp,
  BookOpen,
  BarChart3,
  Compass,
  Heart,
  Settings,
  ArrowRight,
} from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { ALL_CAMPAIGNS } from "@/lib/campaigns";
import { useWallet } from "@/hooks/useWallet";

interface Command {
  id: string;
  title: string;
  description?: string;
  icon: React.ReactNode;
  category: "navigation" | "action" | "campaign";
  action: () => void;
  keywords: string[];
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CommandPalette({ isOpen, onClose }: CommandPaletteProps) {
  const router = useRouter();
  const { connect } = useWallet();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  const debouncedQuery = useDebounce(query, 150);

  // Generate commands
  const commands: Command[] = [
    // Navigation
    {
      id: "nav-home",
      title: "Go to Home",
      description: "Return to the homepage",
      icon: <Home size={16} />,
      category: "navigation",
      action: () => router.push("/"),
      keywords: ["home", "start", "main"],
    },
    {
      id: "nav-campaigns",
      title: "Browse Campaigns",
      description: "View all active campaigns",
      icon: <Compass size={16} />,
      category: "navigation",
      action: () => router.push("/campaigns"),
      keywords: ["campaigns", "browse", "discover"],
    },
    {
      id: "nav-dashboard",
      title: "Go to Dashboard",
      description: "View your dashboard",
      icon: <BarChart3 size={16} />,
      category: "navigation",
      action: () => router.push("/dashboard"),
      keywords: ["dashboard", "my", "overview"],
    },
    {
      id: "nav-bookmarks",
      title: "View Bookmarks",
      description: "See your bookmarked campaigns",
      icon: <Heart size={16} />,
      category: "navigation",
      action: () => router.push("/bookmarks"),
      keywords: ["bookmarks", "favorites", "saved"],
    },
    {
      id: "nav-analytics",
      title: "Analytics",
      description: "View campaign analytics",
      icon: <TrendingUp size={16} />,
      category: "navigation",
      action: () => router.push("/analytics"),
      keywords: ["analytics", "stats", "data"],
    },
    {
      id: "nav-settings",
      title: "Go to Settings",
      description: "Manage your account settings",
      icon: <Settings size={16} />,
      category: "navigation",
      action: () => router.push("/settings"),
      keywords: ["settings", "preferences", "account"],
    },
    {
      id: "nav-create",
      title: "Create Campaign",
      description: "Start a new fundraising campaign",
      icon: <Plus size={16} />,
      category: "action",
      action: () => router.push("/create"),
      keywords: ["create", "new", "campaign", "fundraise"],
    },
    {
      id: "action-connect-wallet",
      title: "Connect Wallet",
      description: "Connect your Stellar wallet",
      icon: <Wallet size={16} />,
      category: "action",
      action: () => {
        connect();
        onClose();
      },
      keywords: ["wallet", "connect", "stellar", "login"],
    },
    // Recent campaigns
    ...ALL_CAMPAIGNS.slice(0, 5).map((campaign) => ({
      id: `campaign-${campaign.id}`,
      title: campaign.title,
      description: campaign.description,
      icon: <BookOpen size={16} />,
      category: "campaign" as const,
      action: () => router.push(`/campaigns/${campaign.id}`),
      keywords: [campaign.title, campaign.category ?? "", "campaign"],
    })),
  ];

  // Filter commands based on query
  const filteredCommands = commands.filter((cmd) => {
    if (!debouncedQuery) return true;
    const lowerQuery = debouncedQuery.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(lowerQuery) ||
      cmd.keywords.some((k) => k.toLowerCase().includes(lowerQuery)) ||
      (cmd.description?.toLowerCase().includes(lowerQuery) ?? false)
    );
  });

  // Reset state when opened
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Remember what had focus before the palette opened, and return focus there on close.
  const triggerRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    if (isOpen) {
      triggerRef.current = document.activeElement as HTMLElement | null;
    } else if (triggerRef.current) {
      triggerRef.current.focus();
      triggerRef.current = null;
    }
  }, [isOpen]);

  // Handle keyboard events
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((prev) =>
          Math.min(prev + 1, filteredCommands.length - 1),
        );
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        const selected = filteredCommands[activeIndex];
        if (selected) {
          selected.action();
          onClose();
        }
      }
    },
    [filteredCommands, activeIndex, onClose],
  );

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current && filteredCommands[activeIndex]) {
      const activeElement = listRef.current.children[
        activeIndex
      ] as HTMLElement;
      if (activeElement) {
        activeElement.scrollIntoView({ block: "nearest" });
      }
    }
  }, [activeIndex, filteredCommands]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative w-full max-w-xl mx-4 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-gray-800">
          <Search size={18} className="text-gray-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent border-none outline-none text-gray-900 dark:text-white placeholder-gray-500"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="Close command palette"
            className="p-1.5 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-400 transition"
          >
            <X size={16} />
          </button>
        </div>

        {/* Results list */}
        <div className="max-h-[50vh] overflow-y-auto">
          {filteredCommands.length === 0 ? (
            <div className="px-6 py-8 text-center text-gray-500">
              No results found
            </div>
          ) : (
            <ul
              ref={listRef}
              className="py-2"
              role="listbox"
              aria-label="Command palette results"
            >
              {filteredCommands.map((cmd, index) => (
                <li
                  key={cmd.id}
                  role="option"
                  aria-selected={index === activeIndex}
                  onClick={() => {
                    cmd.action();
                    onClose();
                  }}
                  onMouseEnter={() => setActiveIndex(index)}
                  className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer transition ${
                    index === activeIndex
                      ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
                      : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-800"
                  }`}
                >
                  <div className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                    {cmd.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-medium truncate">{cmd.title}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">
                        {cmd.category}
                      </span>
                    </div>
                    {cmd.description && (
                      <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
                        {cmd.description}
                      </p>
                    )}
                  </div>
                  <ArrowRight size={14} className="text-gray-400" />
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Footer with shortcuts */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-gray-200 dark:border-gray-800 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                ↑↓
              </kbd>
              Navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
                Enter
              </kbd>
              Select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <kbd className="px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800">
              Esc
            </kbd>
            Close
          </span>
        </div>
      </div>
    </div>
  );
}
