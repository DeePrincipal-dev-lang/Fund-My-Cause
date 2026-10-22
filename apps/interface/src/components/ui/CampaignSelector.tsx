"use client";

import React, { useState, useRef, useEffect } from "react";
import { Search, Plus, ChevronDown } from "lucide-react";
import { ALL_CAMPAIGNS } from "@/lib/campaigns";
import { useComparison } from "@/context/ComparisonContext";
import { cn } from "@/lib/utils";

export function CampaignSelector() {
  const { selected, toggle, isSelected } = useComparison();
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const filtered = ALL_CAMPAIGNS.filter((c) => {
    if (isSelected(c.id)) return false;
    const q = search.toLowerCase();
    return (
      c.title.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  const isFull = selected.length >= 4;

  return (
    <div ref={dropdownRef} className="relative" data-testid="campaign-selector">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={isFull}
        aria-expanded={isOpen}
        aria-haspopup="listbox"
        aria-label="Add campaign to comparison"
        className={cn(
          "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition",
          "border",
          isFull
            ? "border-[var(--color-border-subtle)] text-[var(--color-text-muted)] cursor-not-allowed opacity-50"
            : "border-[var(--color-brand)] text-[var(--color-brand)] hover:bg-[var(--color-brand)] hover:text-white",
        )}
      >
        <Plus size={14} />
        Add Campaign
        <ChevronDown
          size={14}
          className={cn(
            "transition-transform",
            isOpen && "rotate-180",
          )}
        />
      </button>

      {isOpen && !isFull && (
        <div
          className="absolute top-full left-0 mt-2 w-80 max-h-80 rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] shadow-2xl z-50 overflow-hidden animate-fade-in-up"
          role="listbox"
          aria-label="Available campaigns"
        >
          {/* Search input */}
          <div className="p-3 border-b border-[var(--color-border)]">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)]"
              />
              <input
                ref={inputRef}
                type="text"
                placeholder="Search campaigns..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                aria-label="Search campaigns to compare"
                className="w-full pl-9 pr-3 py-2 rounded-xl text-sm bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)] text-[var(--color-text-primary)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-brand)]"
              />
            </div>
          </div>

          {/* Campaign list */}
          <div className="overflow-y-auto max-h-56">
            {filtered.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-[var(--color-text-muted)]">
                No campaigns found
              </p>
            ) : (
              filtered.map((campaign) => {
                const progress =
                  campaign.goal > 0
                    ? Math.round((campaign.raised / campaign.goal) * 100)
                    : 0;

                return (
                  <button
                    key={campaign.id}
                    role="option"
                    aria-selected={false}
                    onClick={() => {
                      toggle(campaign.id);
                      setSearch("");
                    }}
                    className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-[var(--color-surface-elevated)] transition group"
                  >
                    <div
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: `hsl(${(parseInt(campaign.id, 10) * 67) % 360}, 60%, 50%)`,
                      }}
                    >
                      <Plus
                        size={14}
                        className="text-white opacity-0 group-hover:opacity-100 transition"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--color-text-primary)] truncate">
                        {campaign.title}
                      </p>
                      <p className="text-xs text-[var(--color-text-muted)]">
                        {progress}% funded · {campaign.status}
                      </p>
                    </div>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="px-4 py-2 border-t border-[var(--color-border)] text-xs text-[var(--color-text-muted)]">
            {selected.length}/4 campaigns selected
          </div>
        </div>
      )}
    </div>
  );
}
