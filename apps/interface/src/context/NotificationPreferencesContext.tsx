"use client";

import React, { createContext, useContext, ReactNode } from "react";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  NOTIFICATION_PREFS_STORAGE_KEY,
  DEFAULT_NOTIFICATION_CATEGORY_PREFS,
  type NotificationType,
} from "@/store/useNotificationStore";

export interface NotificationPreferences {
  categories: Record<NotificationType, boolean>;
  channels: {
    inApp: boolean;
    browserPush: boolean;
  };
}

// Re-exported so callers of this context don't also need to import from the store.
export { NOTIFICATION_PREFS_STORAGE_KEY };

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  categories: DEFAULT_NOTIFICATION_CATEGORY_PREFS,
  channels: {
    inApp: true,
    browserPush: false,
  },
};

interface PrefsContextType {
  prefs: NotificationPreferences;
  setCategoryEnabled: (type: NotificationType, enabled: boolean) => void;
  setChannelEnabled: (
    channel: keyof NotificationPreferences["channels"],
    enabled: boolean,
  ) => void;
  isCategoryEnabled: (type: NotificationType) => boolean;
}

const PrefsContext = createContext<PrefsContextType | null>(null);

export function NotificationPreferencesProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [prefs, setPrefs] = useLocalStorage<NotificationPreferences>(
    NOTIFICATION_PREFS_STORAGE_KEY,
    DEFAULT_NOTIFICATION_PREFERENCES,
  );

  const setCategoryEnabled = (type: NotificationType, enabled: boolean) => {
    setPrefs((p) => ({
      ...p,
      categories: { ...p.categories, [type]: enabled },
    }));
  };

  const setChannelEnabled = (
    channel: keyof NotificationPreferences["channels"],
    enabled: boolean,
  ) => {
    setPrefs((p) => ({
      ...p,
      channels: { ...p.channels, [channel]: enabled },
    }));
  };

  const isCategoryEnabled = (type: NotificationType) =>
    prefs.categories[type] ?? true;

  return (
    <PrefsContext.Provider
      value={{
        prefs,
        setCategoryEnabled,
        setChannelEnabled,
        isCategoryEnabled,
      }}
    >
      {children}
    </PrefsContext.Provider>
  );
}

const fallbackPrefsContext: PrefsContextType = {
  prefs: DEFAULT_NOTIFICATION_PREFERENCES,
  setCategoryEnabled: () => {},
  setChannelEnabled: () => {},
  isCategoryEnabled: () => true,
};

export function useNotificationPreferences() {
  const ctx = useContext(PrefsContext);
  return ctx || fallbackPrefsContext;
}
