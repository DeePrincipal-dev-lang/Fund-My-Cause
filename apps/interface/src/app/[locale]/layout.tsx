import type { Metadata, Viewport } from "next";
import "../globals.css";
import "../rtl.css";
import { WalletSelectModalHost } from "@/components/WalletSelectModalHost";
import { ModalRenderer } from "@/components/ModalRenderer";
import { ToastProvider } from "@/components/ui/Toast";
import { ThemeInitializer } from "@/components/ThemeInitializer";
import { NotificationPreferencesProvider } from "@/context/NotificationPreferencesContext";
import { CurrencyProvider } from "@/context/CurrencyContext";
import { ComparisonProvider } from "@/context/ComparisonContext";
import { BookmarkProvider } from "@/context/BookmarkContext";
import { ErrorHandlerInitializer } from "@/components/ErrorHandlerInitializer";
import { SkipNav } from "@/components/ui/SkipNav";
import { ErrorBoundary, ThemeProvider } from "@fund-my-cause/components";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { rtlLocales, type Locale } from "@/i18n/config";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";
import { ServiceWorkerRegistration } from "@/components/ServiceWorkerRegistration";
import { CommandPaletteProvider } from "@/components/ui/CommandPaletteProvider";
import { LimitedConnectivityBanner } from "@/components/ui/LimitedConnectivityBanner";
import { DevErrorSimulator } from "@/components/DevErrorSimulator";

export const metadata: Metadata = {
  title: "Fund My Cause",
  description: "Decentralized crowdfunding on the Stellar network",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Fund My Cause",
  },
};

export const viewport: Viewport = {
  themeColor: "#6366f1",
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  viewportFit: "cover",
};

export default async function LocaleLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;

  if (!routing.locales.includes(locale as Locale)) {
    notFound();
  }

  const messages = await getMessages();
  const dir = rtlLocales.includes(locale as Locale) ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className="dark">
      <body>
        <ServiceWorkerRegistration />
        <SkipNav />
        <LimitedConnectivityBanner />
        <DevErrorSimulator />
        <ErrorBoundary level="page">
          <ErrorHandlerInitializer />
          <ThemeProvider>
            <ThemeInitializer>
              <NextIntlClientProvider messages={messages}>
                <ToastProvider>
                  <NotificationPreferencesProvider>
                    <CurrencyProvider>
                      <ComparisonProvider>
                        <BookmarkProvider>
                          <CommandPaletteProvider>
                            <div
                              id="main-content"
                              role="main"
                              tabIndex={-1}
                              className="outline-none"
                            >
                              {children}
                            </div>
                          </CommandPaletteProvider>
                          <WalletSelectModalHost />
                          <ModalRenderer />
                        </BookmarkProvider>
                      </ComparisonProvider>
                    </CurrencyProvider>
                  </NotificationPreferencesProvider>
                </ToastProvider>
              </NextIntlClientProvider>
            </ThemeInitializer>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
