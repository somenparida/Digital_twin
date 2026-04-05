/**
 * API base: in production (Docker/K8s) nginx proxies /api → backend.
 * In Vite dev, vite.config.ts proxies /api to localhost:8000.
 */
export const DATA_URL = "/api/data";

export type CampusPayload = {
  temperature: number;
  occupancy: number;
  energy: number;
  alert: "Normal" | "Warning" | "Critical";
};

export async function fetchCampusData(): Promise<CampusPayload> {
  const res = await fetch(DATA_URL);
  if (!res.ok) {
    throw new Error(`API error: ${res.status}`);
  }
  return res.json() as Promise<CampusPayload>;
}
