/**
 * Store barrel — single import point for all Zustand slices.
 *
 * Slices
 * ──────
 *  campaignSlice   transient campaign UI state (active ID, optimistic deltas, pledge modal)
 *  useWalletStore  wallet connection and session state
 *  uiSlice         notifications, modals, and theme
 *
 * Preferred usage pattern
 * ───────────────────────
 * Use the scoped selector hooks (useCampaignSlice, useWalletSlice, useUiSlice)
 * rather than importing stores directly — they pick the narrowest selector and
 * give you the same stable reference semantics without coupling consumers to
 * internal store shapes.
 */

// ── Campaign slice ────────────────────────────────────────────────────────────
export {
  useCampaignStore,
  selectActiveCampaignId,
  selectOptimisticDelta,
  selectPledgeModalOpen,
  selectPledgeAmountDraft,
  type CampaignSliceState,
  type OptimisticDelta,
} from "./campaignSlice";

// ── Wallet slice ──────────────────────────────────────────────────────────────
export {
  useWalletStore,
  selectWalletAddress,
  selectIsConnecting,
  selectIsAutoConnecting,
  selectIsSigning,
  selectWalletError,
  selectNetworkMismatch,
  selectWalletNetwork,
  selectShowWalletSelect,
  selectIsConnected,
  type WalletSliceState,
} from "./useWalletStore";

// ── UI slice ──────────────────────────────────────────────────────────────────
export {
  // Notifications
  useNotificationStore,
  selectNotifications,
  selectUnreadCount,
  selectHasUnread,
  // Modals
  useModalStore,
  selectModalStack,
  selectHasOpenModal,
  selectTopModal,
  // Theme
  useThemeStore,
  selectTheme,
  selectIsDarkTheme,
  type Notification,
  type NotificationType,
  type ModalConfig,
  type Theme,
} from "./uiSlice";
