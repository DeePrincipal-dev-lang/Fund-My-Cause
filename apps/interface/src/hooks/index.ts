// Custom hooks library
export { useLocalStorage } from "./useLocalStorage";
export { useDebounce } from "./useDebounce";
export { useAsync } from "./useAsync";
export type { AsyncStatus, AsyncState, UseAsyncReturn } from "./useAsync";
export { useInfiniteList } from "./useInfiniteList";
export type {
  UseInfiniteListOptions,
  UseInfiniteListReturn,
  InfiniteListPage,
} from "./useInfiniteList";

// Wallet hook — single source of wallet state for all components
export { useWallet } from "./useWallet";

// Domain hooks
export {
  useCampaign,
  useContribute,
  useWithdraw,
  useRefund,
  useBatchRefund,
  usePause,
  useUnpause,
} from "./useCampaign";
export { useCampaignDraft } from "./useCampaignDraft";
export type { CampaignDraftData, DraftSaveStatus } from "./useCampaignDraft";
export { useXlmBalance } from "./useXlmBalance";
export { useAccountExists } from "./useAccountExists";
export {
  useSimilarCampaigns,
  useRecommendedCampaigns,
} from "./useRecommendations";
export { useComments } from "./useComments";
export { useBreakpoint } from "./useBreakpoint";
export { useFocusTrap } from "./useFocusTrap";
export { useSearchSuggestions } from "./useSearchSuggestions";
export type { SearchSuggestion } from "./useSearchSuggestions";
export { useBackButton } from "./useBackButton";
export type {
  UseBackButtonOptions,
  UseBackButtonReturn,
} from "./useBackButton";

// PWA hooks
export { useInstallPrompt } from "./useInstallPrompt";

// Store slice hooks (scoped selectors — prefer these over direct store imports)
export {
  useCampaignSlice,
  usePledgeModal,
  useOptimisticDelta,
} from "./useCampaignSlice";
export {
  useWalletSlice,
  useWalletStatus,
  useWalletSigning,
} from "./useWalletSlice";
export {
  useUiSlice,
  useNotifSlice,
  useModalSlice,
  useThemeSlice,
} from "./useUiSlice";
