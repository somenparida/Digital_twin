import { useCallback, useEffect, useMemo, useState, useRef } from "react";
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
import { fetchCampusData, setSimulationMode, type CampusPayload, type SimulationMode, type Alert } from "./api";
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

/**
 * Get color for alert level
 */
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

/**
 * Play alert sound when critical
 */
function playAlertSound() {
  try {
    // Create a simple beep sound using Web Audio API
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = 800; // 800 Hz beep
    oscillator.type = "sine";
    
    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.error("Error playing alert sound:", e);
  }
}

/**
 * Format timestamp to readable time
 */
function formatTime(isoString: string): string {
  const date = new Date(isoString);
  return date.toLocaleTimeString();
}

export default function App() {
  const [data, setData] = useState<CampusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    { t: string; temperature: number; occupancy: number; energy: number }[]
  >([]);
  
  // New state for enhanced features
  const [currentMode, setCurrentMode] = useState<SimulationMode>("normal");
  const [showCriticalPopup, setShowCriticalPopup] = useState(false);
  const [modeLoading, setModeLoading] = useState(false);
  const [showAlertHistory, setShowAlertHistory] = useState(false);
  const previousAlertRef = useRef<string | null>(null);

  /**
   * Load campus data from API
   */
  const load = useCallback(async () => {
    try {
      const next = await fetchCampusData();
      setData(next);
      setError(null);
      setCurrentMode(next.mode);
      
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
      
      // Handle critical alert popup and sound
      if (next.alert === "Critical" && previousAlertRef.current !== "Critical") {
        setShowCriticalPopup(true);
        playAlertSound();
        // Auto-close popup after 5 seconds
        setTimeout(() => setShowCriticalPopup(false), 5000);
      }
      
      previousAlertRef.current = next.alert;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Handle mode change button click
   */
  const handleModeChange = useCallback(async (mode: SimulationMode) => {
    setModeLoading(true);
    try {
      await setSimulationMode(mode);
      setCurrentMode(mode);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to change mode");
    } finally {
      setModeLoading(false);
    }
  }, []);

  /**
   * Poll API for data updates
   */
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  /**
   * Chart data configuration
   */
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

  /**
   * Chart options
   */
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
          <p className="subtitle">DevOps-enabled dashboard · realtime telemetry · mode control</p>
        </div>
        <div className="badge">DevOps v2.0</div>
      </header>

      {/* Critical Alert Popup */}
      {showCriticalPopup && (
        <div className="critical-popup" role="alert">
          <span className="critical-icon">⚠️</span>
          <div>
            <strong>CRITICAL ALERT!</strong>
            <p>System has entered critical state. Auto-recovery in 10 seconds.</p>
          </div>
          <button
            className="popup-close"
            onClick={() => setShowCriticalPopup(false)}
            aria-label="Close alert"
          >
            ✕
          </button>
        </div>
      )}

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

      {/* System Health Panel */}
      {data && (
        <section className="system-health">
          <div className="health-item">
            <span className="health-label">System Status</span>
            <span className={`health-value ${data.system_health.status.toLowerCase()}`}>
              🟢 {data.system_health.status}
            </span>
          </div>
          <div className="health-item">
            <span className="health-label">Uptime</span>
            <span className="health-value">{Math.floor(data.system_health.uptime_seconds)}s</span>
          </div>
          <div className="health-item">
            <span className="health-label">Current Mode</span>
            <span className={`health-value mode-${data.mode}`}>{data.mode.toUpperCase()}</span>
          </div>
          <div className="health-item">
            <span className="health-label">Timestamp</span>
            <span className="health-value">{formatTime(data.system_health.timestamp)}</span>
          </div>
        </section>
      )}

      {/* Mode Control Buttons */}
      <section className="mode-control">
        <label className="mode-label">Simulation Mode:</label>
        <div className="mode-buttons">
          <button
            className={`mode-btn mode-normal ${currentMode === "normal" ? "active" : ""}`}
            onClick={() => handleModeChange("normal")}
            disabled={modeLoading}
            aria-pressed={currentMode === "normal"}
          >
            🟢 Normal
          </button>
          <button
            className={`mode-btn mode-warning ${currentMode === "warning" ? "active" : ""}`}
            onClick={() => handleModeChange("warning")}
            disabled={modeLoading}
            aria-pressed={currentMode === "warning"}
          >
            🟡 Warning
          </button>
          <button
            className={`mode-btn mode-critical ${currentMode === "critical" ? "active" : ""}`}
            onClick={() => handleModeChange("critical")}
            disabled={modeLoading}
            aria-pressed={currentMode === "critical"}
          >
            🔴 Critical
          </button>
        </div>
      </section>

      {/* Metrics Cards */}
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

      {/* Chart */}
      <section className="chart-wrap">
        {history.length === 0 && !loading ? (
          <p className="muted">No chart data yet.</p>
        ) : (
          <Line data={chartData} options={chartOptions} />
        )}
      </section>

      {/* Alert History Toggle */}
      <section className="alert-history-section">
        <button
          className="toggle-history-btn"
          onClick={() => setShowAlertHistory(!showAlertHistory)}
          aria-expanded={showAlertHistory}
        >
          {showAlertHistory ? "Hide" : "Show"} Alert History ({data?.alerts.length || 0})
        </button>

        {/* Alert History List */}
        {showAlertHistory && (
          <div className="alert-history">
            <h3>Alert History (Last 10)</h3>
            {!data || data.alerts.length === 0 ? (
              <p className="muted">No alerts yet.</p>
            ) : (
              <ul className="alert-list">
                {[...data.alerts].reverse().map((alert: Alert, idx: number) => (
                  <li key={idx} className={`alert-item alert-${alert.alert.toLowerCase()}`}>
                    <span className="alert-time">{formatTime(alert.timestamp)}</span>
                    <span className="alert-badge">{alert.alert}</span>
                    <span className="alert-details">
                      {alert.temperature}°C | {alert.occupancy}% | {alert.energy} kWh
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>

      <footer className="footer">
        <span>FastAPI backend v2.0 · React + Chart.js · Prometheus metrics · Dark theme</span>
      </footer>
    </div>
  );
}
