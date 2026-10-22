import { CampaignData } from "@/types/soroban";
import { getCachedAnalyticsData, invalidateAnalyticsCache, setCachedAnalyticsData } from "@/lib/cacheStrategy";
import { apiClient } from "@/lib/api-client";

export interface RealtimeAnalyticsPayload {
  campaigns: CampaignData[];
  timestamp: number;
}

export type AnalyticsMessageType = "snapshot" | "update";

export interface AnalyticsWebSocketMessage {
  type: AnalyticsMessageType;
  payload: RealtimeAnalyticsPayload;
}

const ANALYTICS_CACHE_KEY = "realtime-analytics-snapshot";
const SNAPSHOT_TTL = 15_000;

function getAnalyticsEndpoint(campaignIds: string[]): string {
  if (typeof window === "undefined") return "";
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const host = window.location.host;
  const query = campaignIds.map((id) => `campaignId=${encodeURIComponent(id)}`).join("&");
  return `${protocol}//${host}/ws/analytics${query ? `?${query}` : ""}`;
}

export function createAnalyticsWebSocket(
  campaignIds: string[],
  onMessage: (payload: RealtimeAnalyticsPayload) => void,
  onOpen?: () => void,
  onError?: (error: Error | Event) => void
) {
  let socket: WebSocket | null = null;
  if (typeof window === "undefined" || campaignIds.length === 0) {
    return {
      disconnect: () => undefined,
    };
  }

  try {
    const url = getAnalyticsEndpoint(campaignIds);
    socket = new WebSocket(url);

    socket.onopen = () => {
      onOpen?.();
    };

    socket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data) as AnalyticsWebSocketMessage;
        if (data?.payload?.campaigns) {
          setCachedAnalyticsData<RealtimeAnalyticsPayload>(ANALYTICS_CACHE_KEY, data.payload, SNAPSHOT_TTL);
          onMessage(data.payload);
        }
      } catch (error) {
        onError?.(error as Error);
      }
    };

    socket.onerror = (event) => {
      onError?.(event);
    };
  } catch (error) {
    onError?.(error as Error);
  }

  return {
    disconnect: () => {
      if (socket && socket.readyState !== WebSocket.CLOSED) {
        socket.close();
      }
      invalidateAnalyticsCache(/^realtime-analytics/);
    },
  };
}

export async function fetchAnalyticsSnapshot(
  campaignIds: string[]
): Promise<RealtimeAnalyticsPayload> {
  const cached = getCachedAnalyticsData<RealtimeAnalyticsPayload>(ANALYTICS_CACHE_KEY);
  if (cached?.campaigns?.length) {
    return cached;
  }

  if (typeof window === "undefined") {
    return { campaigns: [], timestamp: Date.now() };
  }

  try {
    const query = campaignIds.map((id) => `campaignId=${encodeURIComponent(id)}`).join("&");
    const payload = await apiClient.get<RealtimeAnalyticsPayload>(
      `/api/analytics/snapshot${query ? `?${query}` : ""}`,
    );
    setCachedAnalyticsData<RealtimeAnalyticsPayload>(ANALYTICS_CACHE_KEY, payload, SNAPSHOT_TTL);
    return payload;
  } catch {
    return { campaigns: [], timestamp: Date.now() };
  }
}
