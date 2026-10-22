/**
 * Component prop types for Fund-My-Cause
 * Comprehensive type definitions for all component props
 */

import type { ReactNode } from "react";
import type { Campaign, FAQ, TeamMember } from "./campaign";
import type { Milestone } from "./milestone";
import type { Comment } from "./comment";
import type { NotificationResponse } from "./api";

/**
 * Modal component props
 */
export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  closeOnBackdropClick?: boolean;
}

/**
 * Button component props
 */
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  fullWidth?: boolean;
}

/**
 * Input component props
 */
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  helperText?: string;
  fullWidth?: boolean;
}

/**
 * Card component props
 */
export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  hoverable?: boolean;
  padding?: "sm" | "md" | "lg";
}

/**
 * Progress bar component props
 */
export interface ProgressBarProps {
  progress: number;
  animated?: boolean;
  showLabel?: boolean;
  color?: "indigo" | "green" | "blue" | "red";
}

/**
 * Campaign card component props
 */
export interface CampaignCardProps {
  campaign: Campaign;
  onClick?: () => void;
  showActions?: boolean;
  onBookmark?: (campaignId: string) => void;
  isBookmarked?: boolean;
}

/**
 * Pledge modal component props
 */
export interface PledgeModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

/**
 * Countdown timer component props
 */
export interface CountdownTimerProps {
  deadline: string;
  onExpired?: () => void;
  format?: "short" | "long";
}

/**
 * Share modal component props
 */
export interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  campaign: Campaign;
  url: string;
}

/**
 * Transaction status component props
 */
export interface TransactionStatusProps {
  status: "pending" | "confirmed" | "failed";
  hash?: string;
  error?: string;
}

/**
 * Navbar component props
 */
export interface NavbarProps {
  onWalletConnect?: () => void;
  onWalletDisconnect?: () => void;
  isConnected?: boolean;
  address?: string;
}

/**
 * Loading skeleton component props
 */
export interface LoadingSkeletonProps {
  count?: number;
  height?: string;
  width?: string;
  circle?: boolean;
}

/**
 * Empty state component props
 */
export interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

/**
 * Error boundary component props
 */
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error, reset: () => void) => ReactNode;
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
  level?: "page" | "section" | "component";
}

/**
 * Toast component props
 */
export interface ToastProps {
  message: string;
  type: "success" | "error" | "info";
  duration?: number;
  onClose?: () => void;
}

/**
 * Comment section component props
 */
export interface CommentSectionProps {
  campaignId: string;
  comments?: Comment[];
  onAddComment?: (content: string) => Promise<void>;
  isLoading?: boolean;
}

/**
 * Activity feed component props
 */
export interface ActivityFeedProps {
  campaignId?: string;
  limit?: number;
  onActivityClick?: (activityId: string) => void;
}

/**
 * Contribution leaderboard component props
 */
export interface ContributionLeaderboardProps {
  campaignId: string;
  limit?: number;
  isLoading?: boolean;
}

/**
 * FAQ accordion component props
 */
export interface FAQAccordionProps {
  faqs: FAQ[];
  onItemClick?: (faqId: string) => void;
}

/**
 * Team member card component props
 */
export interface TeamMemberCardProps {
  member: TeamMember;
  onClick?: () => void;
}

/**
 * Wallet balance component props
 */
export interface WalletBalanceProps {
  address?: string;
  isLoading?: boolean;
  onRefresh?: () => void;
}

/**
 * Notification dropdown component props
 */
export interface NotificationDropdownProps {
  notifications?: NotificationResponse[];
  onNotificationClick?: (notificationId: string) => void;
  onMarkAsRead?: (notificationId: string) => void;
  isLoading?: boolean;
}

/**
 * Milestone display component props
 */
export interface MilestoneDisplayProps {
  milestones: Milestone[];
  currentAmount: number;
}

/**
 * Trust signals component props
 */
export interface TrustSignalsProps {
  creator: string;
  isVerified?: boolean;
  campaignCount?: number;
  accountAgeDays?: number;
}

/**
 * Milestone input component props
 */
export interface MilestoneInputProps {
  value?: Milestone[];
  onChange?: (milestones: Milestone[]) => void;
  error?: string;
}

/**
 * Campaign preview component props
 */
export interface CampaignPreviewProps {
  campaign: Partial<Campaign>;
  isLoading?: boolean;
}

/**
 * Embed code generator component props
 */
export interface EmbedCodeGeneratorProps {
  campaignId: string;
  onCopy?: () => void;
}

/**
 * Video player component props
 */
export interface VideoPlayerProps {
  url: string;
  title?: string;
  autoplay?: boolean;
  controls?: boolean;
}
