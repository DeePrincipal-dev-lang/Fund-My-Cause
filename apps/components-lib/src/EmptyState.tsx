import React from "react";
import { cn } from "./lib/utils";

export interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  iconClassName?: string;
  contentClassName?: string;
}

export function EmptyState({
  title,
  description,
  icon,
  action,
  className,
  iconClassName,
  contentClassName,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-12 px-4 text-center",
        className,
      )}
      data-testid="empty-state"
    >
      {icon && (
        <div
          className={cn("mb-4 text-gray-400", iconClassName)}
          data-testid="empty-state-icon"
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
      </div>
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium transition"
          data-testid="empty-state-action"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
