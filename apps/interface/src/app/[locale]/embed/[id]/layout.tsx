import type { Metadata } from "next";
import { ReactQueryProvider } from "@/context/ReactQueryProvider";
import { ErrorBoundary } from "@fund-my-cause/components";
import "@/app/globals.css";

export const metadata: Metadata = {
  title: "Fund-My-Cause — Campaign Widget",
  robots: { index: false, follow: false },
};

/**
 * Minimal layout for the embeddable widget route.
 * No Navbar, no wallet providers, no toast — just the bare minimum.
 * Framing is allowed via next.config.ts header override for /embed/*.
 */
export default function EmbedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-transparent m-0 p-0 overflow-hidden">
        <ErrorBoundary level="page">
          <ReactQueryProvider>{children}</ReactQueryProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
