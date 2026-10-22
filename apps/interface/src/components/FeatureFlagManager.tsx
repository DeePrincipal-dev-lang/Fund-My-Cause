/**
 * Feature Flag Management UI
 * 
 * Admin component for managing feature flags
 */

'use client';

import { useState, useCallback } from 'react';
import { useAllFeatureFlags, useUpdateFeatureFlag } from '@/lib/use-feature-flags';
import { FeatureFlag } from '@/lib/feature-flags';

interface FeatureFlagManagerUIProps {
  className?: string;
}

/**
 * Feature Flag Manager UI Component
 */
export function FeatureFlagManagerUI({ className }: FeatureFlagManagerUIProps) {
  const flags = useAllFeatureFlags();
  const [expandedFlag, setExpandedFlag] = useState<string | null>(null);

  return (
    <div className={`space-y-4 ${className || ''}`}>
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Feature Flags</h2>
        <div className="text-sm text-gray-600">
          {flags.length} flags configured
        </div>
      </div>

      <div className="space-y-2">
        {flags.map((flag) => (
          <FeatureFlagItem
            key={flag.name}
            flag={flag}
            isExpanded={expandedFlag === flag.name}
            onToggleExpand={() =>
              setExpandedFlag(
                expandedFlag === flag.name ? null : flag.name
              )
            }
          />
        ))}
      </div>
    </div>
  );
}

interface FeatureFlagItemProps {
  flag: FeatureFlag;
  isExpanded: boolean;
  onToggleExpand: () => void;
}

/**
 * Individual Feature Flag Item
 */
function FeatureFlagItem({
  flag,
  isExpanded,
  onToggleExpand,
}: FeatureFlagItemProps) {
  const updateFlag = useUpdateFeatureFlag(flag.name, {});
  const [isEditing, setIsEditing] = useState(false);
  const [editedFlag, setEditedFlag] = useState<FeatureFlag>(flag);

  const handleSave = useCallback(() => {
    updateFlag();
    setIsEditing(false);
  }, [updateFlag]);

  const handleCancel = useCallback(() => {
    setEditedFlag(flag);
    setIsEditing(false);
  }, [flag]);

  return (
    <div className="border rounded-lg p-4 bg-white">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <button
            onClick={onToggleExpand}
            className="text-gray-600 hover:text-gray-900"
          >
            {isExpanded ? '▼' : '▶'}
          </button>

          <div className="flex-1">
            <h3 className="font-semibold text-gray-900">{flag.name}</h3>
            {typeof flag.metadata?.description === "string" && (
              <p className="text-sm text-gray-600">
                {flag.metadata.description}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <StatusBadge enabled={flag.enabled} />
            <RolloutBadge percentage={flag.rolloutPercentage} />
          </div>
        </div>

        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="ml-4 px-3 py-1 text-sm bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
          >
            Edit
          </button>
        )}
      </div>

      {isExpanded && (
        <div className="mt-4 pt-4 border-t space-y-4">
          {isEditing ? (
            <FeatureFlagEditor
              flag={editedFlag}
              onChange={setEditedFlag}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          ) : (
            <FeatureFlagDetails flag={flag} />
          )}
        </div>
      )}
    </div>
  );
}

interface FeatureFlagDetailsProps {
  flag: FeatureFlag;
}

/**
 * Display Feature Flag Details
 */
function FeatureFlagDetails({ flag }: FeatureFlagDetailsProps) {
  return (
    <div className="space-y-3 text-sm">
      <div>
        <span className="font-semibold text-gray-700">Status:</span>
        <span className="ml-2 text-gray-600">
          {flag.enabled ? 'Enabled' : 'Disabled'}
        </span>
      </div>

      <div>
        <span className="font-semibold text-gray-700">Rollout:</span>
        <span className="ml-2 text-gray-600">{flag.rolloutPercentage}%</span>
      </div>

      {flag.targetUsers && flag.targetUsers.length > 0 && (
        <div>
          <span className="font-semibold text-gray-700">Target Users:</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {flag.targetUsers.map((user) => (
              <span
                key={user}
                className="px-2 py-1 bg-gray-100 text-gray-700 rounded text-xs"
              >
                {user}
              </span>
            ))}
          </div>
        </div>
      )}

      {flag.targetGroups && flag.targetGroups.length > 0 && (
        <div>
          <span className="font-semibold text-gray-700">Target Groups:</span>
          <div className="mt-1 flex flex-wrap gap-1">
            {flag.targetGroups.map((group) => (
              <span
                key={group}
                className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs"
              >
                {group}
              </span>
            ))}
          </div>
        </div>
      )}

      {flag.metadata && (
        <div>
          <span className="font-semibold text-gray-700">Metadata:</span>
          <pre className="mt-1 p-2 bg-gray-100 rounded text-xs overflow-auto">
            {JSON.stringify(flag.metadata, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

interface FeatureFlagEditorProps {
  flag: FeatureFlag;
  onChange: (flag: FeatureFlag) => void;
  onSave: () => void;
  onCancel: () => void;
}

/**
 * Edit Feature Flag
 */
function FeatureFlagEditor({
  flag,
  onChange,
  onSave,
  onCancel,
}: FeatureFlagEditorProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Enabled
        </label>
        <input
          type="checkbox"
          checked={flag.enabled}
          onChange={(e) =>
            onChange({ ...flag, enabled: e.target.checked })
          }
          className="w-4 h-4"
        />
      </div>

      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-1">
          Rollout Percentage: {flag.rolloutPercentage}%
        </label>
        <input
          type="range"
          min="0"
          max="100"
          value={flag.rolloutPercentage}
          onChange={(e) =>
            onChange({
              ...flag,
              rolloutPercentage: parseInt(e.target.value, 10),
            })
          }
          className="w-full"
        />
      </div>

      <div className="flex gap-2">
        <button
          onClick={onSave}
          className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
        >
          Save
        </button>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-gray-300 text-gray-700 rounded hover:bg-gray-400"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  enabled: boolean;
}

/**
 * Status Badge Component
 */
function StatusBadge({ enabled }: StatusBadgeProps) {
  return (
    <span
      className={`px-2 py-1 rounded text-xs font-semibold ${
        enabled
          ? 'bg-green-100 text-green-700'
          : 'bg-red-100 text-red-700'
      }`}
    >
      {enabled ? 'Enabled' : 'Disabled'}
    </span>
  );
}

interface RolloutBadgeProps {
  percentage: number;
}

/**
 * Rollout Badge Component
 */
function RolloutBadge({ percentage }: RolloutBadgeProps) {
  let bgColor = 'bg-gray-100 text-gray-700';
  if (percentage > 0 && percentage < 50) {
    bgColor = 'bg-yellow-100 text-yellow-700';
  } else if (percentage >= 50 && percentage < 100) {
    bgColor = 'bg-blue-100 text-blue-700';
  } else if (percentage === 100) {
    bgColor = 'bg-green-100 text-green-700';
  }

  return (
    <span className={`px-2 py-1 rounded text-xs font-semibold ${bgColor}`}>
      {percentage}%
    </span>
  );
}
