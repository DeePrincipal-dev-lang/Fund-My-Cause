import axios, { AxiosInstance } from "axios";
import { createLogger } from "@fund-my-cause/shared-utils";

import type { AlertPayload, DeliveryResult, Transport } from "./alert-transport";

const logger = createLogger("monitoring-service:pagerduty");

interface PagerDutyIncidentRequest {
  title: string;
  description: string;
  severity: string;
  service_id: string;
  labels?: Record<string, string>;
  urgency?: string;
}

interface PagerDutyIncident {
  id: string;
  incident_number: number;
  title: string;
  description: string;
  status: string;
  severity: string;
  service_id: string;
  created_at: string;
  updated_at: string;
  html_url: string;
  urgency: string;
  assignments?: Array<{ at: string; assignee: { id: string; name: string } }>;
}

interface AcknowledgeResponse {
  success: boolean;
  incident_id: string;
  message: string;
}

interface ResolveResponse {
  success: boolean;
  incident_id: string;
  resolution_time_ms: number;
  message: string;
}

interface AssignResponse {
  success: boolean;
  incident_id: string;
  assigned_to: string;
  message: string;
}

interface EscalateResponse {
  success: boolean;
  incident_id: string;
  escalation_policy: string;
  message: string;
}

/**
 * PagerDuty Integration Client
 */
export class PagerDutyIntegration {
  private client: AxiosInstance;
  private readonly API_BASE_URL = "https://api.pagerduty.com";
  private readonly integration_key: string;

  constructor(api_key: string, integration_key?: string) {
    this.integration_key =
      integration_key || process.env.PAGERDUTY_INTEGRATION_KEY || "";

    this.client = axios.create({
      baseURL: this.API_BASE_URL,
      headers: {
        Authorization: `Token token=${api_key}`,
        "Content-Type": "application/json",
        Accept: "application/vnd.pagerduty+json;version=2",
      },
    });
  }

  /**
   * Create incident in PagerDuty
   */
  async createIncident(
    request: PagerDutyIncidentRequest,
  ): Promise<PagerDutyIncident> {
    try {
      const response = await this.client.post("/incidents", {
        incidents: [
          {
            type: "incident",
            title: request.title,
            description: request.description,
            service: {
              id: request.service_id,
              type: "service_reference",
            },
            body: {
              type: "incident_body",
              details: request.description,
            },
            urgency: request.urgency || "high",
            severity: request.severity,
            custom_fields: request.labels,
          },
        ],
      });

      return {
        id: response.data.incidents[0].id,
        incident_number: response.data.incidents[0].incident_number,
        title: response.data.incidents[0].title,
        description: response.data.incidents[0].description,
        status: response.data.incidents[0].status,
        severity: request.severity,
        service_id: request.service_id,
        created_at: response.data.incidents[0].created_at,
        updated_at: response.data.incidents[0].updated_at,
        html_url: response.data.incidents[0].html_url,
        urgency: request.urgency || "high",
      };
    } catch (error) {
      logger.error({ err: error }, "Failed to create PagerDuty incident");
      throw new Error(`Failed to create PagerDuty incident: ${error}`);
    }
  }

  /**
   * Acknowledge incident (set to triggered -> acknowledged)
   */
  async acknowledgeIncident(
    incident_id: string,
    user_id?: string,
  ): Promise<AcknowledgeResponse> {
    try {
      const response = await this.client.put(`/incidents/${incident_id}`, {
        incidents: [
          {
            id: incident_id,
            type: "incident_reference",
            status: "acknowledged",
            acknowledgements: [
              {
                at: new Date().toISOString(),
                acknowledger: {
                  id: user_id || "monitoring-service",
                  type: "service_reference",
                },
              },
            ],
          },
        ],
      });

      return {
        success: response.status === 200,
        incident_id,
        message: "Incident acknowledged",
      };
    } catch (error) {
      logger.error({ err: error }, "Failed to acknowledge incident");
      return {
        success: false,
        incident_id,
        message: `Failed to acknowledge: ${error}`,
      };
    }
  }

  /**
   * Resolve incident
   */
  async resolveIncident(
    incident_id: string,
    _user_id?: string,
  ): Promise<ResolveResponse> {
    const startTime = Date.now();
    try {
      const response = await this.client.put(`/incidents/${incident_id}`, {
        incidents: [
          {
            id: incident_id,
            type: "incident_reference",
            status: "resolved",
            resolution_time: new Date().toISOString(),
          },
        ],
      });

      return {
        success: response.status === 200,
        incident_id,
        resolution_time_ms: Date.now() - startTime,
        message: "Incident resolved",
      };
    } catch (error) {
      logger.error({ err: error }, "Failed to resolve incident");
      return {
        success: false,
        incident_id,
        resolution_time_ms: Date.now() - startTime,
        message: `Failed to resolve: ${error}`,
      };
    }
  }

  /**
   * Get incident details
   */
  async getIncident(incident_id: string): Promise<PagerDutyIncident> {
    try {
      const response = await this.client.get(`/incidents/${incident_id}`);

      return {
        id: response.data.incident.id,
        incident_number: response.data.incident.incident_number,
        title: response.data.incident.title,
        description: response.data.incident.body?.details || "",
        status: response.data.incident.status,
        severity: response.data.incident.severity || "unknown",
        service_id: response.data.incident.service?.id || "",
        created_at: response.data.incident.created_at,
        updated_at: response.data.incident.updated_at,
        html_url: response.data.incident.html_url,
        urgency: response.data.incident.urgency,
        assignments: response.data.incident.assignments,
      };
    } catch (error) {
      logger.error({ err: error }, "Failed to get incident");
      throw new Error(`Failed to get incident: ${error}`);
    }
  }

  /**
   * Assign incident to user
   */
  async assignIncident(
    incident_id: string,
    user_id: string,
  ): Promise<AssignResponse> {
    try {
      const response = await this.client.put(`/incidents/${incident_id}`, {
        incidents: [
          {
            id: incident_id,
            type: "incident_reference",
            assignments: [
              {
                assignee: {
                  id: user_id,
                  type: "user_reference",
                },
              },
            ],
          },
        ],
      });

      return {
        success: response.status === 200,
        incident_id,
        assigned_to: user_id,
        message: `Incident assigned to user ${user_id}`,
      };
    } catch (error) {
      logger.error({ err: error }, "Failed to assign incident");
      return {
        success: false,
        incident_id,
        assigned_to: "",
        message: `Failed to assign: ${error}`,
      };
    }
  }

  /**
   * Escalate incident
   */
  async escalateIncident(
    incident_id: string,
    escalation_policy_id: string,
  ): Promise<EscalateResponse> {
    try {
      const response = await this.client.put(`/incidents/${incident_id}`, {
        incidents: [
          {
            id: incident_id,
            type: "incident_reference",
            escalation_policy: {
              id: escalation_policy_id,
              type: "escalation_policy_reference",
            },
          },
        ],
      });

      return {
        success: response.status === 200,
        incident_id,
        escalation_policy: escalation_policy_id,
        message: "Incident escalated",
      };
    } catch (error) {
      logger.error({ err: error }, "Failed to escalate incident");
      return {
        success: false,
        incident_id,
        escalation_policy: "",
        message: `Failed to escalate: ${error}`,
      };
    }
  }

  /**
   * List on-call users
   */
  async getOnCallUsers(
    schedule_id?: string,
  ): Promise<Array<{ id: string; name: string }>> {
    try {
      const response = await this.client.get("/oncalls", {
        params: schedule_id ? { schedule_ids: [schedule_id] } : {},
      });

      return response.data.oncalls.map((oncall: any) => ({
        id: oncall.user.id,
        name: oncall.user.summary,
      }));
    } catch (error) {
      logger.error({ err: error }, "Failed to get on-call users");
      return [];
    }
  }

  /**
   * Create event (for Events API v2)
   */
  async createEvent(
    title: string,
    description: string,
    severity: "critical" | "error" | "warning" | "info",
  ): Promise<{ event_id: string; status: string }> {
    try {
      // Use Events API v2 for simpler incident creation
      const response = await axios.post(
        "https://events.pagerduty.com/v2/enqueue",
        {
          routing_key: this.integration_key,
          event_action: "trigger",
          payload: {
            summary: title,
            severity,
            source: "Fund My Cause Monitoring",
            custom_details: {
              description,
            },
          },
        },
        {
          headers: {
            "Content-Type": "application/json",
          },
        },
      );

      return {
        event_id: response.data.dedup_key,
        status: response.data.status,
      };
    } catch (error) {
      logger.error({ err: error }, "Failed to create PagerDuty event");
      throw new Error(`Failed to create PagerDuty event: ${error}`);
    }
  }

  /**
   * Create note on incident
   */
  async addNoteToIncident(
    incident_id: string,
    content: string,
  ): Promise<boolean> {
    try {
      await this.client.post(`/incidents/${incident_id}/notes`, {
        note: {
          content,
        },
      });
      return true;
    } catch (error) {
      logger.error({ err: error }, "Failed to add note to incident");
      return false;
    }
  }

  /**
   * Get incident alerts
   */
  async getIncidentAlerts(incident_id: string): Promise<any[]> {
    try {
      const response = await this.client.get(
        `/incidents/${incident_id}/alerts`,
      );
      return response.data.alerts || [];
    } catch (error) {
      logger.error({ err: error }, "Failed to get incident alerts");
      return [];
    }
  }

  /**
   * Get service details
   */
  async getService(service_id: string): Promise<any> {
    try {
      const response = await this.client.get(`/services/${service_id}`);
      return response.data.service;
    } catch (error) {
      logger.error({ err: error }, "Failed to get service");
      return null;
    }
  }

  /**
   * List services
   */
  async listServices(): Promise<Array<{ id: string; name: string }>> {
    try {
      const response = await this.client.get("/services");
      return response.data.services.map((service: any) => ({
        id: service.id,
        name: service.name,
      }));
    } catch (error) {
      logger.error({ err: error }, "Failed to list services");
      return [];
    }
  }

  /**
   * Test connection
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await this.client.get("/users?limit=1");
      return response.status === 200;
    } catch (error) {
      logger.error({ err: error }, "PagerDuty connection test failed");
      return false;
    }
  }
}

export interface PagerDutyTransportOptions {
  integration: PagerDutyIntegration;
  serviceId: string;
  urgency?: "high" | "low";
}

export class PagerDutyTransport implements Transport {
  private readonly integration: PagerDutyIntegration;
  private readonly serviceId: string;
  private readonly urgency: "high" | "low";

  constructor(options: PagerDutyTransportOptions) {
    this.integration = options.integration;
    this.serviceId = options.serviceId;
    this.urgency = options.urgency ?? "high";
  }

  async send(alert: AlertPayload): Promise<DeliveryResult[]> {
    try {
      await this.integration.createIncident({
        title: `[${alert.severity.toUpperCase()}] ${alert.ruleId}`,
        description: alert.message,
        severity: alert.severity,
        service_id: this.serviceId,
        urgency: this.urgency,
        labels: Object.fromEntries(
          Object.entries(alert.context).map(([key, value]) => [key, String(value)]),
        ),
      });
      return [{ channel: "pagerduty", success: true }];
    } catch (error) {
      return [
        {
          channel: "pagerduty",
          success: false,
          error: error instanceof Error ? error.message : String(error),
        },
      ];
    }
  }
}

export function buildPagerDutyTransportFromEnv(): PagerDutyTransport | null {
  const apiKey = process.env.PAGERDUTY_API_KEY;
  const serviceId = process.env.PAGERDUTY_SERVICE_ID;
  if (!apiKey || !serviceId) {
    return null;
  }

  return new PagerDutyTransport({
    integration: new PagerDutyIntegration(
      apiKey,
      process.env.PAGERDUTY_INTEGRATION_KEY,
    ),
    serviceId,
  });
}
