import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { fetchCampusData, type CampusPayload } from "./api";
import "./App.css";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

const MAX_POINTS = 24;
const POLL_MS = 2000;

function alertColor(alert: CampusPayload["alert"]): string {
  switch (alert) {
    case "Normal":
      return "var(--green)";
    case "Warning":
      return "var(--yellow)";
    case "Critical":
      return "var(--red)";
    default:
      return "var(--muted)";
  }
}

export default function App() {
  const [data, setData] = useState<CampusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    { t: string; temperature: number; occupancy: number; energy: number }[]
  >([]);

  const load = useCallback(async () => {
    try {
      const next = await fetchCampusData();
      setData(next);
      setError(null);
      const label = new Date().toLocaleTimeString();
      setHistory((prev) => {
        const row = {
          t: label,
          temperature: next.temperature,
          occupancy: next.occupancy,
          energy: next.energy,
        };
        const merged = [...prev, row];
        return merged.slice(-MAX_POINTS);
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  const chartData = useMemo(
    () => ({
      labels: history.map((h) => h.t),
      datasets: [
        {
          label: "Temperature (°C)",
          data: history.map((h) => h.temperature),
          borderColor: "#58a6ff",
          backgroundColor: "rgba(88, 166, 255, 0.12)",
          fill: true,
          tension: 0.35,
          yAxisID: "y",
        },
        {
          label: "Occupancy (%)",
          data: history.map((h) => h.occupancy),
          borderColor: "#a371f7",
          backgroundColor: "rgba(163, 113, 247, 0.08)",
          fill: true,
          tension: 0.35,
          yAxisID: "y1",
        },
        {
          label: "Energy (units)",
          data: history.map((h) => h.energy),
          borderColor: "#3fb950",
          backgroundColor: "rgba(63, 185, 80, 0.08)",
          fill: true,
          tension: 0.35,
          yAxisID: "y2",
        },
      ],
    }),
    [history]
  );

  const chartOptions = useMemo(
    () => ({
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: "index" as const, intersect: false },
      plugins: {
        legend: {
          labels: { color: "#8b949e", font: { family: "Outfit" } },
        },
        title: {
          display: true,
          text: "Live telemetry (last samples)",
          color: "#e6edf3",
          font: { family: "Outfit", size: 14, weight: "600" as const },
        },
      },
      scales: {
        x: {
          ticks: { color: "#8b949e", maxRotation: 45, minRotation: 45 },
          grid: { color: "rgba(48, 54, 61, 0.6)" },
        },
        y: {
          type: "linear" as const,
          display: true,
          position: "left" as const,
          title: { display: true, text: "°C", color: "#58a6ff" },
          ticks: { color: "#8b949e" },
          grid: { color: "rgba(48, 54, 61, 0.6)" },
        },
        y1: {
          type: "linear" as const,
          display: true,
          position: "right" as const,
          title: { display: true, text: "Occ %", color: "#a371f7" },
          ticks: { color: "#8b949e" },
          grid: { drawOnChartArea: false },
        },
        y2: {
          type: "linear" as const,
          display: true,
          position: "right" as const,
          offset: true,
          title: { display: true, text: "Energy", color: "#3fb950" },
          ticks: { color: "#8b949e" },
          grid: { drawOnChartArea: false },
        },
      },
    }),
    []
  );

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Live Campus Digital Twin</h1>
          <p className="subtitle">Simulated real-time telemetry · refresh every {POLL_MS / 1000}s</p>
        </div>
        <div className="badge">DevOps Dashboard</div>
      </header>

      {loading && !data && (
        <div className="loading-banner" role="status" aria-live="polite">
          <span className="spinner" aria-hidden />
          Loading campus data…
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      <section className="cards">
        <article className="card">
          <span className="card-label">Temperature</span>
          <span className="card-value">
            {data ? `${data.temperature}°C` : "—"}
          </span>
        </article>
        <article className="card">
          <span className="card-label">Occupancy</span>
          <span className="card-value">{data ? `${data.occupancy}%` : "—"}</span>
        </article>
        <article className="card">
          <span className="card-label">Energy</span>
          <span className="card-value">{data ? `${data.energy} kWh` : "—"}</span>
        </article>
        <article className="card card-alert">
          <span className="card-label">Alert</span>
          <span
            className="card-value alert-pill"
            style={{
              color: data ? alertColor(data.alert) : "var(--muted)",
              borderColor: data ? alertColor(data.alert) : "var(--border)",
            }}
          >
            {data ? data.alert : "—"}
          </span>
        </article>
      </section>

      <section className="chart-wrap">
        {history.length === 0 && !loading ? (
          <p className="muted">No chart data yet.</p>
        ) : (
          <Line data={chartData} options={chartOptions} />
        )}
      </section>

      <footer className="footer">
        <span>FastAPI backend · React + Chart.js · Dark theme</span>
      </footer>
    </div>
  );
}
