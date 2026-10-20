"use client";

import dynamic from "next/dynamic";

// The dynamic import is only reachable when NODE_ENV is "development", so production
// builds drop the ErrorSimulator module from the bundle entirely.
const ErrorSimulator =
  process.env.NODE_ENV === "development"
    ? dynamic(() => import("@/components/ErrorSimulator").then((m) => m.ErrorSimulator))
    : () => null;

export function DevErrorSimulator() {
  return <ErrorSimulator />;
}
