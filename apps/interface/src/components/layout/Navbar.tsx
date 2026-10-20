"use client";

import React, { useRef, useState } from "react";
import {
  Wallet,
  Rocket,
  LogOut,
  Loader2,
  Sun,
  Moon,
  Menu,
  X,
  Bell,
  AlertTriangle,
  HelpCircle,
} from "lucide-react";
import { ProductTour } from "@/components/ui/ProductTour";
import { useWallet } from "@/hooks/useWallet";
import { useTheme } from "@/hooks/useTheme";
import { useNotifications } from "@/hooks/useNotifications";
import { NotificationDropdown } from "@/components/ui/NotificationDropdown";
import { WalletBalance } from "@/components/ui/WalletBalance";
import { NETWORK_NAME } from "@/lib/constants";
import { useTranslations } from "next-intl";
import { LanguageSelector } from "./LanguageSelector";

function truncate(addr: string) {
  return `${addr.substring(0, 5)}...${addr.substring(addr.length - 4)}`;
}

const iconBtnCls =
  "p-2 rounded-[var(--radius-xl)] bg-[var(--color-surface-elevated)] hover:bg-[var(--color-border-subtle)] transition";

const notifBadgeCls =
  "absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-[var(--color-brand)] text-white text-[10px] font-bold px-1";

export function Navbar() {
  const {
    address,
    connect,
    disconnect,
    isConnecting,
    isAutoConnecting,
    error,
    networkMismatch,
    walletNetwork,
  } = useWallet();
  const { theme, toggleTheme } = useTheme();
  const { unreadCount } = useNotifications();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const t = useTranslations("nav");
  const replayTourRef = useRef<(() => void) | null>(null);

  return (
    <div>
      <nav
        aria-label="Main navigation"
        className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-[var(--color-border)] bg-[var(--color-background)]"
      >
        <div className="flex items-center gap-2 font-bold text-lg text-[var(--color-text-primary)]">
          <Rocket className="text-[var(--color-brand)]" size={20} />
          <span className="hidden sm:inline">Fund-My-Cause</span>
        </div>

        {/* Desktop menu */}
        <div className="hidden md:flex items-center gap-3">
          {error && (
            <span className="text-[var(--color-danger)] text-sm">{error}</span>
          )}
          {address ? (
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {truncate(address)}
                </span>
                <WalletBalance address={address} />
              </div>
              <button
                onClick={disconnect}
                aria-label={t("disconnect")}
                className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition"
              >
                <LogOut size={16} aria-hidden="true" /> {t("disconnect")}
              </button>
            </div>
          ) : (
            <button
              onClick={connect}
              disabled={isConnecting}
              aria-label={t("connectWallet")}
              data-tour="connect-wallet"
              className="ds-btn-primary flex items-center gap-2 px-4 py-2 text-sm disabled:opacity-50"
            >
              {isConnecting ? (
                <Loader2
                  size={16}
                  className="animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Wallet size={16} aria-hidden="true" />
              )}
              {t("connectWallet")}
            </button>
          )}

          {/* Notification bell */}
          <div className="relative">
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className={`relative ${iconBtnCls}`}
              aria-label={t("notifications")}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className={notifBadgeCls}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <NotificationDropdown
              open={notifOpen}
              onClose={() => setNotifOpen(false)}
            />
          </div>

          <button
            onClick={toggleTheme}
            className={iconBtnCls}
            aria-label={t("toggleTheme")}
          >
            {theme === "dark" ? (
              <Sun size={18} className="text-[var(--color-warning)]" />
            ) : (
              <Moon size={18} className="text-[var(--color-brand)]" />
            )}
          </button>

          <LanguageSelector />

          <button
            onClick={() => replayTourRef.current?.()}
            className={iconBtnCls}
            aria-label="Replay product tour"
            title="Replay tour"
          >
            <HelpCircle size={18} />
          </button>
        </div>

        {/* Mobile menu button */}
        <div className="flex md:hidden items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setNotifOpen((o) => !o)}
              className={`relative ${iconBtnCls}`}
              aria-label={t("notifications")}
            >
              <Bell size={18} />
              {unreadCount > 0 && (
                <span className={notifBadgeCls}>
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              )}
            </button>
            <NotificationDropdown
              open={notifOpen}
              onClose={() => setNotifOpen(false)}
            />
          </div>

          <button
            onClick={toggleTheme}
            className={iconBtnCls}
            aria-label={t("toggleTheme")}
          >
            {theme === "dark" ? (
              <Sun
                size={18}
                className="text-[var(--color-warning)]"
                aria-hidden="true"
              />
            ) : (
              <Moon
                size={18}
                className="text-[var(--color-brand)]"
                aria-hidden="true"
              />
            )}
          </button>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={iconBtnCls}
            aria-label={mobileMenuOpen ? t("closeMenu") : t("openMenu")}
            aria-expanded={mobileMenuOpen}
          >
            {mobileMenuOpen ? (
              <X size={18} aria-hidden="true" />
            ) : (
              <Menu size={18} aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="absolute top-16 left-0 right-0 md:hidden bg-[var(--color-background)] border-b border-[var(--color-border)] px-4 py-4 space-y-4 z-50">
            {error && (
              <span className="text-[var(--color-danger)] text-sm" role="alert">
                {error}
              </span>
            )}
            {address ? (
              <div className="space-y-3">
                <div className="flex flex-col gap-1">
                  <span className="text-xs text-[var(--color-text-secondary)]">
                    {truncate(address)}
                  </span>
                  <WalletBalance address={address} />
                </div>
                <button
                  onClick={() => {
                    disconnect();
                    setMobileMenuOpen(false);
                  }}
                  aria-label={t("disconnect")}
                  className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition w-full"
                >
                  <LogOut size={16} aria-hidden="true" /> {t("disconnect")}
                </button>
              </div>
            ) : (
              <button
                onClick={() => {
                  connect();
                  setMobileMenuOpen(false);
                }}
                disabled={isConnecting}
                aria-label={t("connectWallet")}
                className="ds-btn-primary flex items-center justify-center gap-2 px-4 py-2 text-sm disabled:opacity-50 w-full"
              >
                {isConnecting ? (
                  <Loader2
                    size={16}
                    className="animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <Wallet size={16} aria-hidden="true" />
                )}
                {t("connectWallet")}
              </button>
            )}
            <LanguageSelector />
          </div>
        )}
      </nav>

      {networkMismatch && walletNetwork && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-warning-bg)] border-b border-[var(--color-warning)]/40 text-[var(--color-warning)] text-sm">
          <AlertTriangle size={15} className="shrink-0" />
          <span
            dangerouslySetInnerHTML={{
              __html: t("networkMismatch", {
                walletNetwork,
                appNetwork: NETWORK_NAME,
              }).replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>"),
            }}
          />
        </div>
      )}

      {isAutoConnecting && (
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-surface)] border-b border-[var(--color-border)] text-[var(--color-text-muted)] text-xs">
          <Loader2 size={12} className="animate-spin" /> {t("restoringSession")}
        </div>
      )}

      <ProductTour onReplayRef={replayTourRef} />
    </div>
  );
}
