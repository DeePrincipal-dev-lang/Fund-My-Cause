"use client";

import React, { useState, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import {
  fetchContributorList,
  type ContributorEntry,
} from "@/lib/graphql/client";
import { QUERY_KEYS } from "@/lib/queryKeys";
import { formatXLM, formatAddress } from "@/lib/format";
import {
  Trophy,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";

export interface Props {
  contractId: string;
  totalRaised: bigint;
  connectedAddress?: string | null;
  pageSize?: number;
}

interface LeaderboardRow extends ContributorEntry {
  rank: number;
  pct: string;
  isYou: boolean;
  isTopContributor: boolean;
  rankDelta: number | null; // positive = moved up, negative = moved down
}

type StoredRanks = Record<string, number>; // address -> last-seen rank

function loadStoredRanks(contractId: string): StoredRanks {
  try {
    const raw = localStorage.getItem(`fmc:lb-ranks:${contractId}`);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveStoredRanks(contractId: string, ranks: StoredRanks) {
  try {
    localStorage.setItem(`fmc:lb-ranks:${contractId}`, JSON.stringify(ranks));
  } catch {}
}

function RankDeltaBadge({ delta }: { delta: number | null }) {
  if (delta === null) return null;
  if (delta === 0)
    return <Minus size={12} className="text-gray-500" aria-label="No change" />;
  if (delta > 0)
    return (
      <span
        className="flex items-center gap-0.5 text-green-500 text-[10px] font-semibold"
        aria-label={`Up ${delta}`}
      >
        <TrendingUp size={11} />+{delta}
      </span>
    );
  return (
    <span
      className="flex items-center gap-0.5 text-red-400 text-[10px] font-semibold"
      aria-label={`Down ${Math.abs(delta)}`}
    >
      <TrendingDown size={11} />
      {delta}
    </span>
  );
}

// Only one page of rows is ever in the DOM: the server returns `pageSize` entries (10 by default)
// per request, so the table stays small however many contributors a campaign has. Virtualising it
// would add cost without any benefit, so rows are not virtualised.
export function ContributionLeaderboard({
  contractId,
  totalRaised,
  connectedAddress,
  pageSize = 10,
}: Props) {
  const [page, setPage] = useState(0);
  const [anonymize, setAnonymize] = useState(false);
  const prevRanksRef = useRef<StoredRanks>({});
  const isFirstLoad = useRef(true);

  // Load last-seen ranks on mount
  useEffect(() => {
    prevRanksRef.current = loadStoredRanks(contractId);
  }, [contractId]);

  const { data: rows = [], isLoading } = useQuery<LeaderboardRow[]>({
    queryKey: QUERY_KEYS.leaderboard(contractId, page, pageSize),
    queryFn: async () => {
      const entries = await fetchContributorList(contractId, page, pageSize);
      const sorted = [...entries].sort((a, b) =>
        b.amount > a.amount ? 1 : -1,
      );
      const prevRanks = prevRanksRef.current;

      return sorted.map((e, i) => {
        const rank = page * pageSize + i + 1;
        const prev = prevRanks[e.address];
        const rankDelta = prev !== undefined ? prev - rank : null; // prev=3, now=1 → delta=+2
        return {
          ...e,
          rank,
          pct:
            totalRaised > 0n
              ? ((Number(e.amount) / Number(totalRaised)) * 100).toFixed(1) +
                "%"
              : "0%",
          isYou: !!connectedAddress && e.address === connectedAddress,
          isTopContributor: page === 0 && i === 0,
          rankDelta,
        };
      });
    },
  });

  // Persist current ranks after data loads, on subsequent loads (not first)
  useEffect(() => {
    if (rows.length === 0) return;
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      return;
    }
    const updated: StoredRanks = { ...prevRanksRef.current };
    for (const row of rows) updated[row.address] = row.rank;
    saveStoredRanks(contractId, updated);
    prevRanksRef.current = updated;
  }, [rows, contractId]);

  if (isLoading)
    return (
      <p className="text-sm text-gray-500 dark:text-gray-400 animate-pulse">
        Loading leaderboard…
      </p>
    );
  if (rows.length === 0) return null;

  const hasNextPage = rows.length === pageSize;
  const hasPrevPage = page > 0;

  return (
    <section aria-labelledby="leaderboard-heading" className="space-y-3">
      <div className="flex items-center justify-between">
        <h3
          id="leaderboard-heading"
          className="text-base font-semibold text-gray-900 dark:text-white"
        >
          Top Contributors
        </h3>
        <button
          onClick={() => setAnonymize(!anonymize)}
          className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition"
          aria-label={anonymize ? "Show addresses" : "Hide addresses"}
        >
          {anonymize ? <Eye size={14} /> : <EyeOff size={14} />}
          {anonymize ? "Show" : "Hide"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900">
        <table className="w-full text-sm" aria-label="Contribution leaderboard">
          <thead>
            <tr className="text-left text-xs text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-800/50">
              <th scope="col" className="px-4 py-2">
                #
              </th>
              <th scope="col" className="px-4 py-2">
                Contributor
              </th>
              <th scope="col" className="px-4 py-2 text-right">
                Amount
              </th>
              <th scope="col" className="px-4 py-2 text-right">
                Share
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={row.address}
                className={cn(
                  "border-b border-gray-200 dark:border-gray-800 last:border-0 hover:bg-gray-50 dark:hover:bg-gray-800/30 transition",
                  row.isYou && "bg-indigo-50 dark:bg-indigo-950/40",
                )}
                aria-current={row.isYou ? "true" : undefined}
              >
                <td className="px-4 py-3 text-gray-600 dark:text-gray-400">
                  <div className="flex items-center gap-1.5">
                    {row.rank}
                    {row.isTopContributor && (
                      <Trophy
                        size={14}
                        className="text-yellow-500"
                        aria-label="Top contributor"
                      />
                    )}
                    <RankDeltaBadge delta={row.rankDelta} />
                  </div>
                </td>
                <td className="px-4 py-3 font-mono text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    {anonymize ? "Anonymous" : formatAddress(row.address)}
                    {row.isYou && (
                      <span
                        className="text-xs text-indigo-600 dark:text-indigo-400 font-semibold"
                        aria-label="your entry"
                      >
                        You
                      </span>
                    )}
                    {row.isTopContributor && (
                      <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400">
                        TOP
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-right text-gray-900 dark:text-white font-medium">
                  {formatXLM(row.amount)}
                </td>
                <td className="px-4 py-3 text-right text-gray-600 dark:text-gray-400">
                  {row.pct}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {(hasNextPage || hasPrevPage) && (
        <div className="flex items-center justify-between text-sm">
          <button
            onClick={() => setPage((p) => p - 1)}
            disabled={!hasPrevPage}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
            aria-label="Previous page"
          >
            <ChevronLeft size={16} />
            Previous
          </button>
          <span className="text-gray-500 dark:text-gray-400">
            Page {page + 1}
          </span>
          <button
            onClick={() => setPage((p) => p + 1)}
            disabled={!hasNextPage}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition disabled:opacity-50 disabled:cursor-not-allowed text-gray-700 dark:text-gray-300"
            aria-label="Next page"
          >
            Next
            <ChevronRight size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
