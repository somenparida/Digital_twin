/**
 * API base: in production (Docker/K8s) nginx proxies /api → backend.
 * In Vite dev, vite.config.ts proxies /api to localhost:8000.
 */
export const DATA_URL = "/api/data";
export const MODE_URL = "/api/mode";
export const ALERTS_URL = "/api/alerts";
const API_TIMEOUT_MS = 5000;

export type SimulationMode = "normal" | "warning" | "critical";

export type Alert = {
  timestamp: string;
  alert: "Normal" | "Warning" | "Critical";
  temperature: number;
  occupancy: number;
  energy: number;
};

export type SystemHealth = {
  status: "UP" | "DOWN";
  timestamp: string;
  uptime_seconds: number;
};

export type CampusPayload = {
  temperature: number;
  occupancy: number;
  energy: number;
  alert: "Normal" | "Warning" | "Critical";
  mode: SimulationMode;
  alerts: Alert[];
  system_health: SystemHealth;
};

export type AlertsResponse = {
  alerts: Alert[];
  total_count: number;
};

async function fetchWithTimeout(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = API_TIMEOUT_MS): Promise<Response> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(`API timeout after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    window.clearTimeout(timer);
  }
}

/**
 * Fetch current campus data.
 */
export async function fetchCampusData(): Promise<CampusPayload> {
  const res = await fetchWithTimeout(DATA_URL);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json() as Promise<CampusPayload>;
}

/**
 * Set the simulation mode (normal, warning, critical).
 */
export async function setSimulationMode(mode: SimulationMode): Promise<{ mode: SimulationMode; message: string }> {
  const res = await fetchWithTimeout(`${MODE_URL}/${mode}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (!res.ok) {
    throw new Error(`Failed to set mode: ${res.status}`);
  }
  return res.json();
}

/**
 * Fetch alert history.
 */
export async function fetchAlerts(): Promise<AlertsResponse> {
  const res = await fetchWithTimeout(ALERTS_URL);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json() as Promise<AlertsResponse>;
}
