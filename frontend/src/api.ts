/**
 * API base: in production (Docker/K8s) nginx proxies /api → backend.
 * In Vite dev, vite.config.ts proxies /api to localhost:8000.
 */
export const DATA_URL = "/api/data";
export const MODE_URL = "/api/mode";
export const ALERTS_URL = "/api/alerts";

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

/**
 * Fetch current campus data.
 */
export async function fetchCampusData(): Promise<CampusPayload> {
  const res = await fetch(DATA_URL);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json() as Promise<CampusPayload>;
}

/**
 * Set the simulation mode (normal, warning, critical).
 */
export async function setSimulationMode(mode: SimulationMode): Promise<{ mode: SimulationMode; message: string }> {
  const res = await fetch(`${MODE_URL}/${mode}`, {
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
  const res = await fetch(ALERTS_URL);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json() as Promise<AlertsResponse>;
}
