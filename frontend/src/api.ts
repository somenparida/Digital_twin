/**
 * API base: in production (Docker/K8s) nginx proxies /api → backend.
 * In Vite dev, vite.config.ts proxies /api to localhost:8000.
 */
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api").replace(/\/+$/, "");
export const DATA_URL = `${API_BASE_URL}/data`;
export const MODE_URL = `${API_BASE_URL}/mode`;
export const ALERTS_URL = `${API_BASE_URL}/alerts`;
const API_TIMEOUT_MS = 5000;
const RETRY_DELAY_MS = 600;

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

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

/**
 * Fetch current campus data.
 */
export async function fetchCampusData(): Promise<CampusPayload> {
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const res = await fetchWithTimeout(DATA_URL);
      if (res.ok) {
        return res.json() as Promise<CampusPayload>;
      }

      // Retry once for transient server/proxy failures.
      if (res.status >= 500 && attempt < 2) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }

      throw new Error(`API error: ${res.status}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("Failed to fetch data");
      if (attempt < 2) {
        await sleep(RETRY_DELAY_MS);
        continue;
      }
    }
  }

  throw lastError ?? new Error("Failed to fetch data");
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
