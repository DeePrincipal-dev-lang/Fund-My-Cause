import express, { Express, Request, Response } from "express";
import { IncidentResponseEngine } from "./incident-response";
import { PagerDutyIntegration } from "./pagerduty-integration";
import { register, Counter, Histogram, Gauge } from "prom-client";
import { emailTransport, slackTransport } from "./notifier";
import { logger } from "./logger";

const app: Express = express();
const port = process.env.PORT || 9091;

// Middleware
app.use(express.json());

// Validate required secrets
if (!process.env.PAGERDUTY_API_KEY) {
  logger.warn(
    "PAGERDUTY_API_KEY environment variable is not set; PagerDuty integration will fail"
  );
}

// Initialize services
const incidentEngine = new IncidentResponseEngine();
const pagerDuty = new PagerDutyIntegration(
  process.env.PAGERDUTY_API_KEY || "",
);

// Alert pipeline – real transport built from env vars, rule evaluator wired to it.
// No MockTransport is used; if no channels are configured, notifications are
// logged only (buildAlertTransportFromEnv emits a startup warning).
const alertTransport = buildAlertTransportFromEnv();
const alertRuleEvaluator = new AlertRuleEvaluator(alertTransport);

// Metrics
const incidentCounter = new Counter({
  name: "incidents_created_total",
  help: "Total incidents created",
  labelNames: ["severity", "category"],
});

const incidentResolvedCounter = new Counter({
  name: "incidents_resolved_total",
  help: "Total incidents resolved",
  labelNames: ["severity"],
});

const remediationCounter = new Counter({
  name: "remediations_executed_total",
  help: "Total remediations executed",
  labelNames: ["action", "success"],
});

const alertCounter = new Counter({
  name: "alerts_processed_total",
  help: "Total alerts processed",
  labelNames: ["severity"],
});

const escalationHistogram = new Histogram({
  name: "escalation_duration_seconds",
  help: "Escalation duration in seconds",
  labelNames: ["level"],
});

const responseTimeHistogram = new Histogram({
  name: "response_time_seconds",
  help: "API response time in seconds",
  labelNames: ["endpoint", "method"],
});

const activeIncidentsGauge = new Gauge({
  name: "active_incidents_total",
  help: "Total active incidents",
  labelNames: ["severity"],
});

// ============================================================================
// API Endpoints
// ============================================================================

/**
 * 1. POST /incidents - Create incident
 */
app.post("/incidents", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const {
      alert_name,
      severity,
      description,
      category,
      triggered_at,
      source,
      labels,
      annotations,
    } = req.body;

    // Validate required fields
    if (!alert_name || !severity || !description) {
      return res.status(400).json({
        error: "Missing required fields: alert_name, severity, description",
      });
    }

    // Create incident
    const incident = {
      id: `incident-${Date.now()}`,
      alert_name,
      severity,
      description,
      category: category || "application",
      status: "open" as const,
      triggered_at: triggered_at || new Date().toISOString(),
      source: source || "alertmanager",
      labels: labels || {},
      annotations: annotations || {},
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      escalation_level: 1,
      assigned_to: null,
    };

    // Store incident (in production, use database)
    incidentEngine.storeIncident(incident);

    // Update metrics
    incidentCounter.labels(severity, category || "application").inc();
    activeIncidentsGauge.labels(severity).inc();

    // Create PagerDuty incident if critical
    if (severity === "critical") {
      try {
        const pdIncident = await pagerDuty.createIncident({
          title: alert_name,
          description,
          severity: "critical",
          service_id: process.env.PAGERDUTY_SERVICE_ID || "default",
          labels: {
            category: category || "application",
            source: source || "alertmanager",
          },
        });
        incident.id = pdIncident.id;
      } catch (error) {
        logger.error({ err: error }, "Failed to create PagerDuty incident");
      }
    }

    // Deliver alert to Email transport
    try {
      await emailTransport.send({
        title: alert_name,
        description,
        severity,
        channel: "email",
        timestamp: incident.created_at,
      });
    } catch (error) {
      logger.error({ err: error }, "Failed to deliver email alert");
    }

    // Deliver alert to Slack transport
    try {
      await slackTransport.send({
        title: alert_name,
        description,
        severity,
        channel: "slack",
        timestamp: incident.created_at,
      });
    } catch (error) {
      logger.error({ err: error }, "Failed to deliver slack alert");
    }

    responseTimeHistogram
      .labels("/incidents", "POST")
      .observe((Date.now() - startTime) / 1000);
    res.status(201).json(incident);
  } catch (error) {
    responseTimeHistogram
      .labels("/incidents", "POST")
      .observe((Date.now() - startTime) / 1000);
    res.status(500).json({ error: "Failed to create incident" });
  }
});

/**
 * 2. GET /incidents/:id - Get incident
 */
app.get("/incidents/:id", (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const incident = incidentEngine.getIncident(id);

    if (!incident) {
      responseTimeHistogram
        .labels("/incidents/:id", "GET")
        .observe((Date.now() - startTime) / 1000);
      return res.status(404).json({ error: "Incident not found" });
    }

    responseTimeHistogram
      .labels("/incidents/:id", "GET")
      .observe((Date.now() - startTime) / 1000);
    res.json(incident);
  } catch (error) {
    responseTimeHistogram
      .labels("/incidents/:id", "GET")
      .observe((Date.now() - startTime) / 1000);
    res.status(500).json({ error: "Failed to retrieve incident" });
  }
});

/**
 * 3. PUT /incidents/:id - Update incident
 */
app.put("/incidents/:id", (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { id } = req.params;
    const { status, assigned_to, escalation_level, notes } = req.body;

    const incident = incidentEngine.updateIncident(id, {
      status,
      assigned_to,
      escalation_level,
      notes,
    });

    if (!incident) {
      responseTimeHistogram
        .labels("/incidents/:id", "PUT")
        .observe((Date.now() - startTime) / 1000);
      return res.status(404).json({ error: "Incident not found" });
    }

    if (status === "resolved") {
      incidentResolvedCounter.labels(incident.severity).inc();
      activeIncidentsGauge.labels(incident.severity).dec();
    }

    responseTimeHistogram
      .labels("/incidents/:id", "PUT")
      .observe((Date.now() - startTime) / 1000);
    res.json(incident);
  } catch (error) {
    responseTimeHistogram
      .labels("/incidents/:id", "PUT")
      .observe((Date.now() - startTime) / 1000);
    res.status(500).json({ error: "Failed to update incident" });
  }
});

/**
 * 4. GET /incidents - List incidents
 */
app.get("/incidents", (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { status, severity, limit = 50, offset = 0 } = req.query;

    const incidents = incidentEngine.listIncidents({
      status: status as string,
      severity: severity as string,
      limit: parseInt(limit as string),
      offset: parseInt(offset as string),
    });

    responseTimeHistogram
      .labels("/incidents", "GET")
      .observe((Date.now() - startTime) / 1000);
    res.json(incidents);
  } catch (error) {
    responseTimeHistogram
      .labels("/incidents", "GET")
      .observe((Date.now() - startTime) / 1000);
    res.status(500).json({ error: "Failed to list incidents" });
  }
});

/**
 * 5. POST /alerts - Alertmanager webhook receiver
 *
 * Accepts the Alertmanager webhook payload, evaluates alert rules, and
 * delivers notifications over the configured transport channels.
 * This is the entry point wired from alertmanager.yml webhook_configs.
 */
app.post("/alerts", (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    // Support both bare single-alert objects (legacy) and the full
    // Alertmanager webhook envelope (preferred).
    const body = req.body as Record<string, unknown>;

    let webhookPayload: AlertmanagerWebhookPayload;

    if (Array.isArray(body['alerts'])) {
      // Full Alertmanager webhook envelope
      webhookPayload = body as unknown as AlertmanagerWebhookPayload;
    } else {
      // Wrap a bare alert into a minimal envelope so the evaluator can
      // handle both call shapes transparently.
      webhookPayload = {
        version: '4',
        groupKey: `bare|${Date.now()}`,
        status: (body['status'] as 'firing' | 'resolved') || 'firing',
        receiver: 'monitoring-service',
        groupLabels: {},
        commonLabels: (body['labels'] as Record<string, string>) || {},
        commonAnnotations: (body['annotations'] as Record<string, string>) || {},
        externalURL: '',
        alerts: [
          {
            status: (body['status'] as 'firing' | 'resolved') || 'firing',
            labels: (body['labels'] as Record<string, string>) || {},
            annotations: (body['annotations'] as Record<string, string>) || {},
            startsAt: (body['startsAt'] as string) || new Date().toISOString(),
          },
        ],
      };
    }

    // Evaluate rules and deliver notifications.
    const evaluationResults = await alertRuleEvaluator.evaluate(webhookPayload);

    const firedRules = evaluationResults.filter((r) => r.fired);
    const failedDeliveries = evaluationResults.filter((r) => r.fired && r.error);

    firedRules.forEach((r) => {
      alertCounter.labels(r.payload?.severity ?? 'unknown').inc();
    });

    if (failedDeliveries.length > 0) {
      console.error('[POST /alerts] Some notification deliveries failed:', failedDeliveries);
    }

    const alert = {
      id: `alert-${Date.now()}`,
      ...req.body,
      created_at: new Date().toISOString(),
      rules_evaluated: evaluationResults.length,
      rules_fired: firedRules.length,
    };

    alertCounter.labels(alert.severity).inc();

    responseTimeHistogram
      .labels("/alerts", "POST")
      .observe((Date.now() - startTime) / 1000);
    res.status(201).json(alert);
  } catch (error) {
    responseTimeHistogram
      .labels("/alerts", "POST")
      .observe((Date.now() - startTime) / 1000);
    res.status(500).json({ error: "Failed to create alert" });
  }
});

/**
 * 6. GET /alerts/:id - Get alert
 */
app.get("/alerts/:id", (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { id } = req.params;

    // In production, retrieve from database
    const alert = incidentEngine.getAlert(id);

    if (!alert) {
      responseTimeHistogram
        .labels("/alerts/:id", "GET")
        .observe((Date.now() - startTime) / 1000);
      return res.status(404).json({ error: "Alert not found" });
    }

    responseTimeHistogram
      .labels("/alerts/:id", "GET")
      .observe((Date.now() - startTime) / 1000);
    res.json(alert);
  } catch (error) {
    responseTimeHistogram
      .labels("/alerts/:id", "GET")
      .observe((Date.now() - startTime) / 1000);
    res.status(500).json({ error: "Failed to retrieve alert" });
  }
});

/**
 * 7. POST /remediate - Execute remediation
 */
app.post("/remediate", async (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { incident_id, action, parameters } = req.body;

    if (!incident_id || !action) {
      responseTimeHistogram
        .labels("/remediate", "POST")
        .observe((Date.now() - startTime) / 1000);
      return res.status(400).json({
        error: "Missing required fields: incident_id, action",
      });
    }

    // Execute remediation action
    const result = await incidentEngine.executeRemediation(
      incident_id,
      action,
      parameters,
    );

    remediationCounter.labels(action, result.success ? "true" : "false").inc();

    responseTimeHistogram
      .labels("/remediate", "POST")
      .observe((Date.now() - startTime) / 1000);
    res.json(result);
  } catch (error) {
    remediationCounter.labels("unknown", "false").inc();
    responseTimeHistogram
      .labels("/remediate", "POST")
      .observe((Date.now() - startTime) / 1000);
    res.status(500).json({ error: "Failed to execute remediation" });
  }
});

/**
 * 8. GET /health - Service health
 */
app.get("/health", (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const health = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: "1.0.0",
      services: {
        incident_engine: "ok",
        pagerduty: "ok",
      },
    };

    responseTimeHistogram
      .labels("/health", "GET")
      .observe((Date.now() - startTime) / 1000);
    res.json(health);
  } catch (error) {
    responseTimeHistogram
      .labels("/health", "GET")
      .observe((Date.now() - startTime) / 1000);
    res.status(500).json({ status: "unhealthy" });
  }
});

/**
 * 8a. GET /healthz - Kubernetes liveness probe
 */
app.get("/healthz", (req: Request, res: Response) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

/**
 * 8b. GET /readyz - Kubernetes readiness probe
 */
app.get("/readyz", (req: Request, res: Response) => {
  res.json({
    ready: true,
    checks: {
      incident_engine: "ok",
      pagerduty: "ok",
    },
    timestamp: new Date().toISOString(),
  });
});

/**
 * 9. POST /analyze - Performance analysis
 */
app.post("/analyze", (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { metric, threshold, window } = req.body;

    const analysis = await incidentEngine.analyzeMetricAsync(metric, threshold, window);

    responseTimeHistogram
      .labels("/analyze", "POST")
      .observe((Date.now() - startTime) / 1000);
    res.json(analysis);
  } catch (error) {
    responseTimeHistogram
      .labels("/analyze", "POST")
      .observe((Date.now() - startTime) / 1000);
    res.status(500).json({ error: "Failed to analyze metric" });
  }
});

/**
 * 10. POST /costs - Track costs
 */
app.post("/costs", (req: Request, res: Response) => {
  const startTime = Date.now();
  try {
    const { category, amount, timestamp } = req.body;

    const cost = {
      id: `cost-${Date.now()}`,
      category,
      amount,
      timestamp: timestamp || new Date().toISOString(),
      recorded_at: new Date().toISOString(),
    };

    responseTimeHistogram
      .labels("/costs", "POST")
      .observe((Date.now() - startTime) / 1000);
    res.status(201).json(cost);
  } catch (error) {
    responseTimeHistogram
      .labels("/costs", "POST")
      .observe((Date.now() - startTime) / 1000);
    res.status(500).json({ error: "Failed to track cost" });
  }
});

// ============================================================================
// Metrics Endpoint
// ============================================================================

app.get("/metrics", (req: Request, res: Response) => {
  try {
    res.set("Content-Type", register.contentType);
    res.end(register.metrics());
  } catch (error) {
    res
      .status(500)
      .end(error instanceof Error ? error.message : "Unknown error");
  }
});

// ============================================================================
// Health Check for Docker
// ============================================================================

app.get("/", (req: Request, res: Response) => {
  res.json({ message: "Fund My Cause Monitoring Service", version: "1.0.0" });
});

// ============================================================================
// Start Server
// ============================================================================

app.listen(port, () => {
  logger.info({ port }, "Monitoring service running");
  logger.info({ url: `http://localhost:${port}/metrics` }, "Metrics available");
  logger.info(
    { url: `http://localhost:${port}/health` },
    "Health check available",
  );
});

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.info("SIGTERM signal received: closing HTTP server");
  process.exit(0);
});

export default app;
