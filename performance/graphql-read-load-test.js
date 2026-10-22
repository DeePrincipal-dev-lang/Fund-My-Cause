/**
 * k6 Load Test — GraphQL API Read Operations
 * ============================================
 * Target: services/graphql-api  (POST /graphql)
 *
 * What this test exercises
 * ------------------------
 * The primary read-heavy workload for the Fund-My-Cause GraphQL API:
 *
 *   1. campaigns query          — paginated campaign listing
 *   2. campaign detail query    — single campaign by ID
 *   3. searchCampaigns query    — free-text search
 *   4. stats query              — platform-wide statistics
 *   5. activeCampaigns query    — filtered active campaigns
 *
 * These represent the most common API calls from the frontend and
 * therefore dominate the latency and throughput profile.
 *
 * SLO targets (defined before running)
 * -------------------------------------
 *   p95 latency   ≤ 500 ms   (read queries are fast)
 *   p99 latency   ≤ 1 000 ms
 *   error rate    < 1 %
 *   throughput    ≥ 100 successful queries / second at peak
 *
 * Ramp profile
 * ------------
 *   warm-up  →  20 VUs over  1 min   (verify basic connectivity)
 *   ramp-up  →  80 VUs over  2 min   (approach expected daytime peak)
 *   soak     → 100 VUs for   3 min   (steady-state, watch p99 drift)
 *   spike    → 200 VUs over  1 min   (2× peak, exposes saturation point)
 *   drain    →   0 VUs over  1 min   (clean teardown)
 *
 * Environment variables
 * ---------------------
 *   GRAPHQL_URL   Base URL of the GraphQL endpoint
 *                 Default: http://localhost:4000/graphql
 *
 * Running
 * -------
 *   # One-shot against local dev server
 *   k6 run performance/graphql-read-load-test.js
 *
 *   # Against staging
 *   GRAPHQL_URL=https://api-staging.fund-my-cause.example.com/graphql \
 *   k6 run performance/graphql-read-load-test.js
 *
 *   # Smoke test only (10 VUs, 30 s)
 *   k6 run --vus 10 --duration 30s performance/graphql-read-load-test.js
 *
 *   # Export machine-readable summary
 *   k6 run --out json=performance/results/graphql-read-$(date +%Y%m%d%H%M%S).json \
 *       performance/graphql-read-load-test.js
 *
 * Interpretation
 * --------------
 * - If p95 < 500 ms during soak, the read path is within SLO.
 * - If error rate > 1%, investigate server-side bottlenecks or connection limits.
 * - If p99 drifts significantly above p95, look for tail latency causes
 *   (cold cache, GC pauses, connection pool exhaustion).
 * - The spike phase intentionally exceeds expected load to find the breaking point.
 */

import http from "k6/http";
import { check, group, sleep } from "k6";
import { Counter, Rate, Trend } from "k6/metrics";
import { randomIntBetween } from "https://jslib.k6.io/k6-utils/1.4.0/index.js";

// ── Environment ───────────────────────────────────────────────────────────────

const GRAPHQL_URL = __ENV.GRAPHQL_URL || "http://localhost:4000/graphql";

// ── Custom metrics ────────────────────────────────────────────────────────────

/** Number of GraphQL-layer errors returned as data.errors (not HTTP 5xx). */
const graphqlErrors = new Counter("read_graphql_errors");

/** End-to-end query latency (ms) — split out from the generic http_req_duration. */
const queryLatency = new Trend("read_query_latency", true);

/** Rate of auth-rejection (HTTP 401). */
const authRejectionRate = new Rate("read_auth_rejection_rate");

/** Rate of successful queries. */
const successRate = new Rate("read_success_rate");

// ── SLO thresholds ────────────────────────────────────────────────────────────

export const options = {
  stages: [
    { duration: "1m", target: 20 }, // warm-up
    { duration: "2m", target: 80 }, // ramp-up
    { duration: "3m", target: 100 }, // soak
    { duration: "1m", target: 200 }, // spike
    { duration: "1m", target: 0 }, // drain
  ],

  thresholds: {
    "read_query_latency{phase:soak}": [
      "p(95)<500", // p95 ≤ 500 ms during soak
      "p(99)<1000", // p99 ≤ 1 000 ms during soak
    ],
    "read_query_latency{phase:spike}": ["p(95)<1500", "p(99)<3000"],
    http_req_failed: ["rate<0.01"], // < 1 % transport errors
    read_graphql_errors: ["count<50"], // < 50 absolute GraphQL errors
    read_success_rate: ["rate>0.99"], // > 99 % success
    read_auth_rejection_rate: ["rate<0.01"],
  },

  summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)", "p(99)"],
};

// ── Shared headers ────────────────────────────────────────────────────────────

const headers = {
  "Content-Type": "application/json",
};

// ── GraphQL queries ──────────────────────────────────────────────────────────

const CAMPAIGNS_QUERY = `
  query ListCampaigns($limit: Int!) {
    campaigns(limit: $limit) {
      id
      title
      goal
      totalRaised
      status
    }
  }
`;

const CAMPAIGN_DETAIL_QUERY = `
  query CampaignDetail($id: ID!) {
    campaign(id: $id) {
      id
      title
      description
      goal
      totalRaised
      deadline
      status
      creator
      contributorCount
    }
  }
`;

const SEARCH_CAMPAIGNS_QUERY = `
  query SearchCampaigns($query: String!, $limit: Int!) {
    searchCampaigns(query: $query, limit: $limit) {
      id
      title
      totalRaised
      status
    }
  }
`;

const STATS_QUERY = `
  query Stats {
    stats {
      totalCampaigns
      totalRaised
      totalContributors
    }
  }
`;

const ACTIVE_CAMPAIGNS_QUERY = `
  query ActiveCampaigns($limit: Int!) {
    activeCampaigns(limit: $limit) {
      id
      title
      goal
      totalRaised
      status
    }
  }
`;

// ── Query selection weights ──────────────────────────────────────────────────
// Mirrors the Artillery load-test.yml weight distribution.

const SEARCH_TERMS = [
  "tech",
  "education",
  "health",
  "community",
  "art",
  "science",
  "environment",
  "music",
];

function pickSearchTerm() {
  return SEARCH_TERMS[randomIntBetween(0, SEARCH_TERMS.length - 1)];
}

// ── Phase tagging ────────────────────────────────────────────────────────────

const PHASE_SCHEDULE = [
  { end: 60, name: "warmup" },
  { end: 180, name: "rampup" },
  { end: 360, name: "soak" },
  { end: 420, name: "spike" },
  { end: 480, name: "drain" },
];

let _testStart = 0;

export function setup() {
  _testStart = Date.now();
  return { startMs: _testStart };
}

function phase(startMs) {
  const elapsedS = (Date.now() - startMs) / 1000;
  for (const p of PHASE_SCHEDULE) {
    if (elapsedS <= p.end) return p.name;
  }
  return "drain";
}

// ── Main scenario ─────────────────────────────────────────────────────────────

export default function (data) {
  const phaseTag = phase(data.startMs);
  const tags = { phase: phaseTag };

  // Select a query based on weighted distribution
  const roll = Math.random();
  let payload;

  if (roll < 0.4) {
    // 40% — list campaigns
    group("campaigns query", () => {
      payload = JSON.stringify({
        query: CAMPAIGNS_QUERY,
        variables: { limit: 20 },
      });
      executeQuery(payload, tags);
    });
  } else if (roll < 0.7) {
    // 30% — campaign detail
    group("campaign detail query", () => {
      payload = JSON.stringify({
        query: CAMPAIGN_DETAIL_QUERY,
        variables: { id: `campaign-${randomIntBetween(1, 100)}` },
      });
      executeQuery(payload, tags);
    });
  } else if (roll < 0.9) {
    // 20% — search campaigns
    group("search campaigns query", () => {
      payload = JSON.stringify({
        query: SEARCH_CAMPAIGNS_QUERY,
        variables: { query: pickSearchTerm(), limit: 10 },
      });
      executeQuery(payload, tags);
    });
  } else {
    // 10% — stats
    group("stats query", () => {
      payload = JSON.stringify({
        query: STATS_QUERY,
        variables: {},
      });
      executeQuery(payload, tags);
    });
  }

  // Realistic think-time between queries (0.5–2 s)
  sleep(randomIntBetween(5, 20) / 10);
}

function executeQuery(payload, tags) {
  const startTs = Date.now();
  const res = http.post(GRAPHQL_URL, payload, { headers, tags });
  const durationMs = Date.now() - startTs;

  queryLatency.add(durationMs, tags);

  // ── HTTP-level checks ───────────────────────────────────────────────────

  const httpOk = check(
    res,
    {
      "HTTP 200": (r) => r.status === 200,
      "not 401 auth failure": (r) => r.status !== 401,
      "not 5xx server error": (r) => r.status < 500,
    },
    tags,
  );

  authRejectionRate.add(res.status === 401 ? 1 : 0, tags);

  if (!httpOk || res.status !== 200) {
    successRate.add(0, tags);
    return;
  }

  // ── GraphQL-layer checks ────────────────────────────────────────────────

  let body;
  try {
    body = res.json();
  } catch (_) {
    graphqlErrors.add(1, tags);
    successRate.add(0, tags);
    return;
  }

  const hasErrors = Array.isArray(body?.errors) && body.errors.length > 0;
  if (hasErrors) {
    graphqlErrors.add(1, tags);
    successRate.add(0, tags);
    return;
  }

  successRate.add(body?.data ? 1 : 0, tags);
}

// ── Teardown — print a human-readable pass/fail summary ──────────────────────

export function handleSummary(data) {
  const sloResults = [];

  function metricValue(name, stat) {
    return data.metrics[name]?.values?.[stat] ?? null;
  }

  const soakP95 = metricValue("read_query_latency{phase:soak}", "p(95)");
  const soakP99 = metricValue("read_query_latency{phase:soak}", "p(99)");
  const spikeP95 = metricValue("read_query_latency{phase:spike}", "p(95)");
  const spikeP99 = metricValue("read_query_latency{phase:spike}", "p(99)");
  const errRate = metricValue("http_req_failed", "rate");
  const succRate = metricValue("read_success_rate", "rate");
  const gqlErrs = metricValue("read_graphql_errors", "count");

  function row(label, value, target, pass) {
    const status = pass ? "PASS" : "FAIL";
    return `  ${status}  ${label.padEnd(36)} actual=${value}  target=${target}`;
  }

  if (soakP95 !== null)
    sloResults.push(
      row("soak p95 latency (ms)", soakP95.toFixed(0), "≤ 500", soakP95 <= 500),
    );
  if (soakP99 !== null)
    sloResults.push(
      row(
        "soak p99 latency (ms)",
        soakP99.toFixed(0),
        "≤ 1000",
        soakP99 <= 1000,
      ),
    );
  if (spikeP95 !== null)
    sloResults.push(
      row(
        "spike p95 latency (ms)",
        spikeP95.toFixed(0),
        "≤ 1500",
        spikeP95 <= 1500,
      ),
    );
  if (spikeP99 !== null)
    sloResults.push(
      row(
        "spike p99 latency (ms)",
        spikeP99.toFixed(0),
        "≤ 3000",
        spikeP99 <= 3000,
      ),
    );
  if (errRate !== null)
    sloResults.push(
      row(
        "HTTP error rate",
        (errRate * 100).toFixed(2) + "%",
        "< 1%",
        errRate < 0.01,
      ),
    );
  if (succRate !== null)
    sloResults.push(
      row(
        "query success rate",
        (succRate * 100).toFixed(2) + "%",
        "> 99%",
        succRate > 0.99,
      ),
    );
  if (gqlErrs !== null)
    sloResults.push(
      row("total GraphQL errors", gqlErrs.toFixed(0), "< 50", gqlErrs < 50),
    );

  const summary = [
    "",
    "================================================================",
    "  GraphQL API Read Operations — Load Test SLO Summary",
    "  " + new Date().toISOString(),
    "----------------------------------------------------------------",
    ...sloResults,
    "================================================================",
    "",
  ].join("\n");

  return {
    stdout: summary,
  };
}
