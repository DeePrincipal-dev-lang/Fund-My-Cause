"use client";

import React, { useRef, useEffect } from "react";
import { Search, Tag } from "lucide-react";
import type { SearchSuggestion } from "@/hooks/useSearchSuggestions";

interface SearchSuggestionsProps {
  suggestions: SearchSuggestion[];
  isOpen: boolean;
  onSelect: (suggestion: SearchSuggestion) => void;
  onClose: () => void;
  activeIndex?: number;
  onActiveIndexChange?: (index: number) => void;
}

export function SearchSuggestions({
  suggestions,
  isOpen,
  onSelect,
  onClose,
  activeIndex = -1,
  onActiveIndexChange,
}: SearchSuggestionsProps) {
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (listRef.current && !listRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen, onClose]);

  if (!isOpen || suggestions.length === 0) return null;

  return (
    <ul
      ref={listRef}
      role="listbox"
      aria-label="Search suggestions"
      className="absolute top-full left-0 right-0 z-50 mt-1 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl shadow-lg overflow-hidden"
    >
      {suggestions.map((suggestion, index) => (
        <li
          key={suggestion.id}
          role="option"
          aria-selected={index === activeIndex}
          onMouseDown={(e) => {
            e.preventDefault();
            onSelect(suggestion);
          }}
          onMouseEnter={() => onActiveIndexChange?.(index)}
          className={`flex items-center gap-3 px-4 py-2.5 cursor-pointer text-sm transition ${
            index === activeIndex
              ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300"
              : "text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50"
          }`}
        >
          <Search size={13} className="shrink-0 text-gray-400" aria-hidden />
          <span className="flex-1 truncate">{suggestion.title}</span>
          {suggestion.category && (
            <span className="flex items-center gap-1 text-xs text-gray-400 dark:text-gray-500">
              <Tag size={10} aria-hidden />
              {suggestion.category}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}
