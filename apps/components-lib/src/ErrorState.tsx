import React from "react";
import { cn } from "./lib/utils";

export interface ErrorStateProps {
  title: string;
  description?: string;
  error?: string;
  icon?: React.ReactNode;
  actions?: Array<{
    label: string;
    onClick: () => void;
    variant?: "primary" | "secondary";
  }>;
  className?: string;
  iconClassName?: string;
  contentClassName?: string;
}

export function ErrorState({
  title,
  description,
  error,
  icon,
  actions,
  className,
  iconClassName,
  contentClassName,
}: ErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className,
      )}
      data-testid="error-state"
    >
      {icon && (
        <div
          className={cn("mb-4 text-red-400", iconClassName)}
          data-testid="error-state-icon"
        >
          {icon}
        </div>
      )}
      <div className={cn("space-y-2", contentClassName)}>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {title}
        </h3>
        {description && (
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {description}
          </p>
        )}
        {error && (
          <p className="text-sm text-red-500 dark:text-red-400 mt-3">{error}</p>
        )}
      </div>
      {actions && actions.length > 0 && (
        <div className="mt-4 flex flex-col sm:flex-row gap-2 justify-center">
          {actions.map((action, idx) => (
            <button
              key={idx}
              onClick={action.onClick}
              className={cn(
                "px-4 py-2 rounded-lg text-sm font-medium transition",
                action.variant === "secondary"
                  ? "bg-gray-200 hover:bg-gray-300 text-gray-900 dark:bg-gray-700 dark:hover:bg-gray-600 dark:text-white"
                  : "bg-red-600 hover:bg-red-700 text-white",
              )}
              data-testid={`error-state-action-${idx}`}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
