/**
 * React Hook for Feature Flags
 * 
 * Provides React components and hooks for using feature flags in the application
 */

import { useContext, createContext, ReactNode, useMemo } from 'react';
import {
  FeatureFlagManager,
  getFeatureFlagManager,
  type FeatureFlag,
} from './feature-flags';

interface FeatureFlagContextType {
  manager: FeatureFlagManager;
  userId?: string;
  userGroups?: string[];
}

const FeatureFlagContext = createContext<FeatureFlagContextType | undefined>(
  undefined
);

interface FeatureFlagProviderProps {
  children: ReactNode;
  userId?: string;
  userGroups?: string[];
  manager?: FeatureFlagManager;
}

/**
 * Provider component for feature flags
 */
export function FeatureFlagProvider({
  children,
  userId,
  userGroups,
  manager,
}: FeatureFlagProviderProps) {
  const value = useMemo(
    () => ({
      manager: manager || getFeatureFlagManager(),
      userId,
      userGroups,
    }),
    [manager, userId, userGroups]
  );

  return (
    <FeatureFlagContext.Provider value={value}>
      {children}
    </FeatureFlagContext.Provider>
  );
}

/**
 * Hook to access feature flag context
 */
function useFeatureFlagContext(): FeatureFlagContextType {
  const context = useContext(FeatureFlagContext);
  if (!context) {
    return {
      manager: getFeatureFlagManager(),
    };
  }
  return context;
}

/**
 * Hook to check if a feature is enabled
 */
export function useFeatureFlag(flagName: string): boolean {
  const { manager, userId, userGroups } = useFeatureFlagContext();
  return useMemo(
    () => manager.isEnabled(flagName, userId, userGroups),
    [manager, flagName, userId, userGroups]
  );
}

/**
 * Hook to get a feature flag
 */
export function useFeatureFlagConfig(flagName: string): FeatureFlag | undefined {
  const { manager } = useFeatureFlagContext();
  return useMemo(() => manager.getFlag(flagName), [manager, flagName]);
}

/**
 * Hook to get all feature flags
 */
export function useAllFeatureFlags(): FeatureFlag[] {
  const { manager } = useFeatureFlagContext();
  return useMemo(() => manager.getAllFlags(), [manager]);
}

interface FeatureFlagProps {
  name: string;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Component to conditionally render content based on feature flag
 */
export function FeatureFlag({ name, children, fallback }: FeatureFlagProps) {
  const isEnabled = useFeatureFlag(name);
  return isEnabled ? <>{children}</> : <>{fallback}</>;
}

interface FeatureFlagWrapperProps {
  name: string;
  children: ReactNode;
  fallback?: ReactNode;
  className?: string;
}

/**
 * Component to wrap content with feature flag check
 */
export function FeatureFlagWrapper({
  name,
  children,
  fallback,
  className,
}: FeatureFlagWrapperProps) {
  const isEnabled = useFeatureFlag(name);

  if (!isEnabled) {
    return fallback ? <div className={className}>{fallback}</div> : null;
  }

  return <div className={className}>{children}</div>;
}

/**
 * Hook to register a feature flag
 */
export function useRegisterFeatureFlag(flag: FeatureFlag): void {
  const { manager } = useFeatureFlagContext();
  useMemo(() => {
    manager.registerFlag(flag);
  }, [manager, flag]);
}

/**
 * Hook to update a feature flag
 */
export function useUpdateFeatureFlag(
  name: string,
  updates: Partial<FeatureFlag>
): () => void {
  const { manager } = useFeatureFlagContext();
  return () => {
    manager.updateFlag(name, updates);
  };
}
