"use client";

import React, { useCallback, useEffect, useState } from "react";
import { X, ChevronRight, ChevronLeft } from "lucide-react";
import { useLocalStorage } from "@/hooks/useLocalStorage";

export interface TourStep {
  target: string; // CSS selector for the highlighted element
  title: string;
  content: string;
  placement?: "top" | "bottom" | "left" | "right";
}

const TOUR_STEPS: TourStep[] = [
  {
    target: "[data-tour='connect-wallet']",
    title: "Connect your wallet",
    content: "Click here to connect Freighter or LOBSTR and start interacting with campaigns.",
    placement: "bottom",
  },
  {
    target: "[data-tour='discover-campaigns']",
    title: "Discover campaigns",
    content: "Browse all active crowdfunding campaigns on the Stellar network.",
    placement: "bottom",
  },
  {
    target: "[data-tour='create-campaign']",
    title: "Create a campaign",
    content: "Launch your own campaign and start raising funds on-chain.",
    placement: "bottom",
  },
  {
    target: "[data-tour='contribute']",
    title: "Contribute",
    content: "Pledge XLM to campaigns you believe in. Refunds are automatic if the goal isn't met.",
    placement: "top",
  },
];

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

const PADDING = 8;

function getTooltipStyle(
  targetRect: Rect,
  placement: TourStep["placement"] = "bottom",
): React.CSSProperties {
  const { top, left, width, height } = targetRect;
  switch (placement) {
    case "top":
      return { bottom: `calc(100vh - ${top - PADDING}px)`, left: left + width / 2, transform: "translateX(-50%)" };
    case "left":
      return { top: top + height / 2, right: `calc(100vw - ${left - PADDING}px)`, transform: "translateY(-50%)" };
    case "right":
      return { top: top + height / 2, left: left + width + PADDING, transform: "translateY(-50%)" };
    case "bottom":
    default:
      return { top: top + height + PADDING, left: left + width / 2, transform: "translateX(-50%)" };
  }
}

interface ProductTourProps {
  /** Called when the user wants to replay the tour from the help button */
  onReplayRef?: React.MutableRefObject<(() => void) | null>;
}

export function ProductTour({ onReplayRef }: ProductTourProps) {
  const [completed, setCompleted, removeCompleted] = useLocalStorage<boolean>(
    "product-tour-completed",
    false,
  );
  const [active, setActive] = useState(!completed);
  const [step, setStep] = useState(0);
  const [targetRect, setTargetRect] = useState<Rect | null>(null);
  const prefersReducedMotion =
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
      : false;

  const currentStep = TOUR_STEPS[step];

  const measureTarget = useCallback(() => {
    if (!currentStep) return;
    const el = document.querySelector(currentStep.target);
    if (!el) {
      setTargetRect(null);
      return;
    }
    const rect = el.getBoundingClientRect();
    setTargetRect({ top: rect.top, left: rect.left, width: rect.width, height: rect.height });
    el.scrollIntoView({ behavior: prefersReducedMotion ? "auto" : "smooth", block: "nearest" });
  }, [currentStep, prefersReducedMotion]);

  useEffect(() => {
    if (!active) return;
    measureTarget();
    window.addEventListener("resize", measureTarget);
    return () => window.removeEventListener("resize", measureTarget);
  }, [active, measureTarget]);

  const replay = useCallback(() => {
    removeCompleted();
    setStep(0);
    setActive(true);
  }, [removeCompleted]);

  // Expose replay to parent via ref
  useEffect(() => {
    if (onReplayRef) onReplayRef.current = replay;
  }, [onReplayRef, replay]);

  const dismiss = useCallback(() => {
    setCompleted(true);
    setActive(false);
  }, [setCompleted]);

  const next = useCallback(() => {
    if (step + 1 >= TOUR_STEPS.length) {
      dismiss();
    } else {
      setStep((s) => s + 1);
    }
  }, [step, dismiss]);

  const prev = useCallback(() => {
    setStep((s) => Math.max(0, s - 1));
  }, []);

  // Keyboard navigation
  useEffect(() => {
    if (!active) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismiss();
      if (e.key === "ArrowRight" || e.key === "Enter") next();
      if (e.key === "ArrowLeft") prev();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [active, dismiss, next, prev]);

  if (!active || !currentStep) return null;

  const tooltipStyle = targetRect
    ? getTooltipStyle(targetRect, currentStep.placement)
    : { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };

  return (
    <>
      {/* Spotlight overlay */}
      <div
        aria-hidden="true"
        className="fixed inset-0 z-40 pointer-events-none"
        style={{
          background: targetRect
            ? `radial-gradient(ellipse ${targetRect.width + PADDING * 2}px ${targetRect.height + PADDING * 2}px at ${targetRect.left + targetRect.width / 2}px ${targetRect.top + targetRect.height / 2}px, transparent 0%, rgba(0,0,0,0.55) 1%)`
            : "rgba(0,0,0,0.55)",
        }}
      />

      {/* Click-to-dismiss backdrop */}
      <div
        className="fixed inset-0 z-40"
        onClick={dismiss}
        aria-label="Dismiss tour"
      />

      {/* Tooltip */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Product tour step ${step + 1} of ${TOUR_STEPS.length}: ${currentStep.title}`}
        className="fixed z-50 w-72 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 p-4"
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          onClick={dismiss}
          aria-label="Close tour"
          className="absolute top-3 right-3 p-1 rounded-lg text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition"
        >
          <X size={14} />
        </button>

        {/* Step indicator */}
        <div className="flex gap-1 mb-3" aria-hidden="true">
          {TOUR_STEPS.map((_, i) => (
            <div
              key={i}
              className={`h-1 flex-1 rounded-full transition-colors ${i === step ? "bg-indigo-600" : "bg-gray-200 dark:bg-gray-700"}`}
            />
          ))}
        </div>

        <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-1">
          {currentStep.title}
        </h3>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed mb-4">
          {currentStep.content}
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between">
          <button
            onClick={prev}
            disabled={step === 0}
            aria-label="Previous step"
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-30 transition"
          >
            <ChevronLeft size={14} />
            Back
          </button>

          <span className="text-xs text-gray-400">
            {step + 1} / {TOUR_STEPS.length}
          </span>

          <button
            onClick={next}
            aria-label={step + 1 === TOUR_STEPS.length ? "Finish tour" : "Next step"}
            className="flex items-center gap-1 text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-500 transition"
          >
            {step + 1 === TOUR_STEPS.length ? "Finish" : "Next"}
            <ChevronRight size={14} />
          </button>
        </div>
      </div>
    </>
  );
}
