"use client";

import React from "react";
import { CheckCircle2, Circle, Lock, Unlock } from "lucide-react";
import type { Milestone } from "@/types/milestone";
import { useNotifications } from "@/hooks/useNotifications";

interface Props {
  milestones: Milestone[];
  currentAmount: number;
}

/**
 * Maps milestone on-chain state to a display state:
 * - "released"  — funds released (reached === true AND amount <= currentAmount)
 * - "funded"    — target met but not yet released
 * - "active"    — currently being funded (previous milestones met, this one in progress)
 * - "unfunded"  — not yet reached
 */
type MilestoneState = "released" | "funded" | "active" | "unfunded";

function getMilestoneState(
  milestone: Milestone,
  currentAmount: number,
  isFirstUnreached: boolean,
): MilestoneState {
  const isMet = currentAmount >= milestone.amount;
  if (isMet && milestone.reached) return "released";
  if (isMet && !milestone.reached) return "funded";
  if (!isMet && isFirstUnreached) return "active";
  return "unfunded";
}

const STATE_STYLES: Record<MilestoneState, string> = {
  released:
    "border-green-400 bg-green-50 dark:bg-green-900/25 dark:border-green-600",
  funded:
    "border-indigo-400 bg-indigo-50 dark:bg-indigo-900/25 dark:border-indigo-600",
  active:
    "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 dark:border-yellow-600",
  unfunded: "border-gray-200 bg-white dark:bg-gray-800/50 dark:border-gray-700",
};

const STATE_LABEL: Record<MilestoneState, string> = {
  released: "Released",
  funded: "Funded — pending release",
  active: "In progress",
  unfunded: "Not yet funded",
};

const STATE_LABEL_STYLES: Record<MilestoneState, string> = {
  released:
    "text-green-700 bg-green-100 dark:text-green-300 dark:bg-green-900/40",
  funded:
    "text-indigo-700 bg-indigo-100 dark:text-indigo-300 dark:bg-indigo-900/40",
  active:
    "text-yellow-700 bg-yellow-100 dark:text-yellow-300 dark:bg-yellow-900/40",
  unfunded: "text-gray-500 bg-gray-100 dark:text-gray-400 dark:bg-gray-800",
};

function MilestoneIcon({ state }: { state: MilestoneState }) {
  switch (state) {
    case "released":
      return (
        <Unlock
          size={20}
          className="text-green-600 dark:text-green-400 shrink-0"
          aria-hidden
        />
      );
    case "funded":
      return (
        <CheckCircle2
          size={20}
          className="text-indigo-600 dark:text-indigo-400 shrink-0"
          aria-hidden
        />
      );
    case "active":
      return (
        <Circle
          size={20}
          className="text-yellow-500 dark:text-yellow-400 shrink-0 animate-pulse"
          aria-hidden
        />
      );
    default:
      return (
        <Lock
          size={20}
          className="text-gray-400 dark:text-gray-500 shrink-0"
          aria-hidden
        />
      );
  }
}

export function MilestoneDisplay({ milestones, currentAmount }: Props) {
  const { addNotification } = useNotifications();
  const sortedMilestones = [...milestones].sort((a, b) => a.amount - b.amount);

  // Track first unreached index for "active" state
  const firstUnreachedIndex = sortedMilestones.findIndex(
    (m) => currentAmount < m.amount,
  );

  React.useEffect(() => {
    const reachedMilestones = sortedMilestones.filter(
      (m) => m.reached && m.amount <= currentAmount,
    );
    if (reachedMilestones.length > 0) {
      const latest = reachedMilestones[reachedMilestones.length - 1];
      addNotification({
        type: "goal_reached",
        title: "Milestone Reached",
        message: `Milestone reached: ${latest.description}`,
      });
    }
  }, [currentAmount, sortedMilestones, addNotification]);

  if (milestones.length === 0) return null;

  // Overall progress toward the final milestone
  const finalTarget =
    sortedMilestones[sortedMilestones.length - 1]?.amount ?? 1;
  const overallPct = Math.min((currentAmount / finalTarget) * 100, 100);

  return (
    <section aria-labelledby="milestones-heading" className="space-y-4">
      <h3
        id="milestones-heading"
        className="text-base font-semibold text-gray-900 dark:text-white"
      >
        Campaign Milestones
      </h3>

      {/* ── Stepped progress track ───────────────────────────────────────── */}
      <div
        role="progressbar"
        aria-label="Overall milestone progress"
        aria-valuenow={Math.round(overallPct)}
        aria-valuemin={0}
        aria-valuemax={100}
        className="relative"
      >
        {/* Track rail */}
        <div className="h-2 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
          <div
            className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-700 ease-out"
            style={{ width: `${overallPct}%` }}
          />
        </div>

        {/* Step dots positioned along the track */}
        <div className="relative mt-1">
          {sortedMilestones.map((milestone, index) => {
            const positionPct = (milestone.amount / finalTarget) * 100;
            const state = getMilestoneState(
              milestone,
              currentAmount,
              index === firstUnreachedIndex,
            );
            const dotColor =
              state === "released"
                ? "bg-green-500 border-green-400"
                : state === "funded"
                  ? "bg-indigo-500 border-indigo-400"
                  : state === "active"
                    ? "bg-yellow-400 border-yellow-300"
                    : "bg-gray-300 border-gray-300 dark:bg-gray-600 dark:border-gray-600";

            return (
              <div
                key={milestone.id}
                className="absolute -top-4 -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${positionPct}%` }}
              >
                <div
                  className={`w-3.5 h-3.5 rounded-full border-2 ${dotColor} transition-colors duration-300`}
                  title={milestone.description}
                />
                {/* Amount label — only show for last milestone on small screens to avoid crowding */}
                <span className="hidden sm:block mt-1 text-[10px] text-gray-500 dark:text-gray-400 whitespace-nowrap">
                  {milestone.amount.toLocaleString()} XLM
                </span>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Milestone cards ──────────────────────────────────────────────── */}
      <ol aria-label="Milestone list" className="mt-8 space-y-3 list-none">
        {sortedMilestones.map((milestone, index) => {
          const state = getMilestoneState(
            milestone,
            currentAmount,
            index === firstUnreachedIndex,
          );
          const progressPct = Math.min(
            (currentAmount / milestone.amount) * 100,
            100,
          );

          return (
            <li
              key={milestone.id}
              className={`rounded-xl border p-4 transition-colors duration-300 ${STATE_STYLES[state]}`}
              aria-current={state === "active" ? "true" : undefined}
            >
              <div className="flex items-start gap-3">
                {/* Step number */}
                <div className="shrink-0 w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 flex items-center justify-center text-xs font-semibold text-gray-500 dark:text-gray-400 mt-0.5">
                  {index + 1}
                </div>

                <MilestoneIcon state={state} />

                <div className="flex-1 min-w-0 space-y-2">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-900 dark:text-white">
                      {milestone.description}
                    </p>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${STATE_LABEL_STYLES[state]}`}
                      >
                        {STATE_LABEL[state]}
                      </span>
                      <span className="text-sm font-semibold text-gray-700 dark:text-gray-300 tabular-nums">
                        {milestone.amount.toLocaleString()} XLM
                      </span>
                    </div>
                  </div>

                  {/* Progress bar for active / unfunded milestones */}
                  {(state === "active" || state === "unfunded") && (
                    <div className="space-y-1">
                      <div
                        className="h-1.5 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden"
                        role="presentation"
                      >
                        <div
                          className="h-full rounded-full bg-indigo-500 dark:bg-indigo-400 transition-all duration-700 ease-out"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        {progressPct.toFixed(1)}% of target ·{" "}
                        {(
                          milestone.amount -
                          Math.min(currentAmount, milestone.amount)
                        ).toLocaleString()}{" "}
                        XLM remaining
                      </p>
                    </div>
                  )}

                  {/* On-chain link for released milestones */}
                  {state === "released" && (
                    <p className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1">
                      <Unlock size={11} aria-hidden />
                      Funds released on-chain
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
