/**
 * Error boundary for profile route segment — Issue #1285
 *
 * Catches errors during profile page rendering and provides recovery.
 */

"use client";

import { ErrorPageProps } from "@/components/ErrorBoundary";

export default function ProfileError({ error, reset }: ErrorPageProps) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "400px",
        padding: "20px",
        textAlign: "center",
      }}
    >
      <h1>Failed to load profile</h1>
      <p style={{ color: "#666", marginBottom: "20px", maxWidth: "500px" }}>
        {error?.message ||
          "Unable to load your profile. Please try again or contact support."}
      </p>
      <div style={{ display: "flex", gap: "10px" }}>
        <button
          onClick={reset}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "16px",
          }}
        >
          Try again
        </button>
        <a
          href="/"
          style={{
            padding: "10px 20px",
            backgroundColor: "#6c757d",
            color: "white",
            border: "none",
            borderRadius: "4px",
            textDecoration: "none",
            cursor: "pointer",
            fontSize: "16px",
            display: "inline-block",
          }}
        >
          Go home
        </a>
      </div>
    </div>
  );
}
