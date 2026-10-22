import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve, extname, basename } from "node:path";

// #1471: all Horizon HTTP traffic in graphql-api must go through horizon-client.ts.
const SRC = resolve(__dirname, "../graphql-api/src");
const CLIENT_FILE = "horizon-client.ts";
const HORIZON = /horizon/i;
const HTTP_CALL = /\bfetch\s*\(|\baxios\b/;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (extname(entry) === ".ts" && !entry.endsWith(".test.ts"))
      out.push(full);
  }
  return out;
}

describe("#1471 — Horizon calls are isolated behind one client", () => {
  it("has no direct Horizon HTTP calls outside horizon-client.ts", () => {
    const offenders = walk(SRC)
      .filter((file) => basename(file) !== CLIENT_FILE)
      .flatMap((file) =>
        readFileSync(file, "utf8")
          .split("\n")
          .filter((line) => HORIZON.test(line) && HTTP_CALL.test(line))
          .map((line) => `${file.slice(SRC.length + 1)}: ${line.trim()}`),
      );
    expect(offenders).toEqual([]);
  });
});
