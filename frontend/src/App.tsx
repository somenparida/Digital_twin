import { useMemo, useState, useRef, useEffect } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { useSensorData, type SensorRecord } from "./useSensorData";
import { type SimulationMode, type CampusPayload, type Alert } from "./api";
import "./App.css";

/**
 * Get color for alert level
 */
function alertColor(alert: CampusPayload['alert']): string {
  switch (alert) {
    case 'Normal':
      return 'var(--green)';
    case 'Warning':
      return 'var(--yellow)';
    case 'Critical':
      return 'var(--red)';
    default:
      return 'var(--muted)';
  }
}

/**
 * Get glow color based on simulation mode
 */
function getGlowColor(mode: SimulationMode): string {
  switch (mode) {
    case 'normal':
      return '#10b981'; // Green
    case 'warning':
      return '#f59e0b'; // Yellow
    case 'critical':
      return '#ef4444'; // Red
    default:
      return '#06b6d4'; // Cyan
  }
}

/**
 * Format time to HH:MM:SS
 */
function formatUptime(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Custom tooltip for Recharts
 */
function CustomTooltip({ active, payload }: any) {
  if (active && payload && payload.length) {
    return (
      <div className="recharts-custom-tooltip">
        <p className="tooltip-time">{payload[0].payload.timestamp}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }}>
            {entry.name}: {entry.value}
            {entry.name.includes('Temperature') && '°C'}
            {entry.name.includes('Occupancy') && '%'}
            {entry.name.includes('Energy') && ' kWh'}
          </p>
        ))}
      </div>
    );
  }
  return null;
}

export default function App() {
  const { data, history, loading, error, currentMode, uptime, latency, handleModeChange } =
    useSensorData();

  const [showCriticalPopup, setShowCriticalPopup] = useState(false);
  const [modeLoading, setModeLoading] = useState(false);
  const [showAlertHistory, setShowAlertHistory] = useState(false);
  const previousAlertRef = useRef<string | null>(null);

  /**
   * Handle critical alerts
   */
  useEffect(() => {
    if (data?.alert === 'Critical' && previousAlertRef.current !== 'Critical') {
      setShowCriticalPopup(true);
      setTimeout(() => setShowCriticalPopup(false), 5000);
    }
    previousAlertRef.current = data?.alert ?? null;
  }, [data?.alert]);

  /**
   * Handle mode change with loading state
   */
  const handleModeClick = async (mode: SimulationMode) => {
    setModeLoading(true);
    try {
      await handleModeChange(mode);
    } finally {
      setModeLoading(false);
    }
  };

  const glowColor = getGlowColor(currentMode);

  return (
    <div className="app">
      {/* DevOps Meta-Bar Header */}
      <header className="devops-header" style={{ '--glow-color': glowColor } as any}>
        <div className="header-content">
          <div className="header-title">
            <h1>🚀 Campus Digital Twin</h1>
            <p className="subtitle">Enterprise-Grade Monitoring Dashboard</p>
          </div>
          <nav className="header-badge-group">
            <div className="badge-item">
              <span className="badge-label">Environment</span>
              <span className="badge-value">Production/K8s</span>
            </div>
            <div className="badge-item">
              <span className="badge-label">Version</span>
              <span className="badge-value">v2.1.0-stable</span>
            </div>
            <div className="badge-item">
              <span className="badge-label">Uptime</span>
              <span className="badge-value">{formatUptime(uptime)}</span>
            </div>
            <div className="badge-item">
              <span className="badge-label">Latency</span>
              <span className="badge-value">{latency}ms</span>
            </div>
          </nav>
        </div>
      </header>

      {/* Critical Alert Popup */}
      {showCriticalPopup && (
        <div className="critical-popup" role="alert">
          <span className="critical-icon">⚠️</span>
          <div>
            <strong>CRITICAL ALERT!</strong>
            <p>System has entered critical state. Auto-recovery in progress.</p>
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
          Connecting to sensor cluster…
        </div>
      )}

      {error && (
        <div className="error-banner" role="alert">
          {error}
        </div>
      )}

      {/* Main Content */}
      {data && (
        <div className="content-wrapper">
          {/* System Health & Mode Control */}
          <div className="control-panel">
            {/* System Status Card */}
            <section className="system-health-card">
              <h2 className="card-title">System Status</h2>
              <div className="health-grid">
                <div className="health-item">
                  <span className="health-label">Status</span>
                  <span className={`health-value status-${data.system_health.status.toLowerCase()}`}>
                    🟢 {data.system_health.status}
                  </span>
                </div>
                <div className="health-item">
                  <span className="health-label">Mode</span>
                  <span className={`health-value mode-${currentMode}`}>
                    {currentMode.toUpperCase()}
                  </span>
                </div>
              </div>
            </section>

            {/* Mode Control */}
            <section className="mode-control-section">
              <label className="mode-label">Simulation Mode:</label>
              <div className="mode-buttons">
                <button
                  className={`mode-btn mode-normal ${currentMode === 'normal' ? 'active' : ''}`}
                  onClick={() => handleModeClick('normal')}
                  disabled={modeLoading}
                  aria-pressed={currentMode === 'normal'}
                >
                  🟢 Normal
                </button>
                <button
                  className={`mode-btn mode-warning ${currentMode === 'warning' ? 'active' : ''}`}
                  onClick={() => handleModeClick('warning')}
                  disabled={modeLoading}
                  aria-pressed={currentMode === 'warning'}
                >
                  🟡 Warning
                </button>
                <button
                  className={`mode-btn mode-critical ${currentMode === 'critical' ? 'active' : ''}`}
                  onClick={() => handleModeClick('critical')}
                  disabled={modeLoading}
                  aria-pressed={currentMode === 'critical'}
                >
                  🔴 Critical
                </button>
              </div>
            </section>
          </div>

          {/* Metrics Cards with Neon Glow */}
          <section className="metrics-grid">
            <article
              className="metric-card"
              style={{ '--neon-color': '#06b6d4' } as any}
            >
              <div className="metric-header">
                <span className="metric-icon">🌡️</span>
                <span className="metric-label">Temperature</span>
              </div>
              <div className="metric-value" style={{ color: '#06b6d4' }}>
                {data.temperature}°C
              </div>
              <div className="metric-spark">Live sensor data</div>
            </article>

            <article
              className="metric-card"
              style={{ '--neon-color': '#a78bfa' } as any}
            >
              <div className="metric-header">
                <span className="metric-icon">👥</span>
                <span className="metric-label">Occupancy</span>
              </div>
              <div className="metric-value" style={{ color: '#a78bfa' }}>
                {data.occupancy}%
              </div>
              <div className="metric-spark">Indoor presence</div>
            </article>

            <article
              className="metric-card"
              style={{ '--neon-color': '#10b981' } as any}
            >
              <div className="metric-header">
                <span className="metric-icon">⚡</span>
                <span className="metric-label">Energy</span>
              </div>
              <div className="metric-value" style={{ color: '#10b981' }}>
                {data.energy} kWh
              </div>
              <div className="metric-spark">Real-time consumption</div>
            </article>

            <article className="alert-card">
              <div className="metric-header">
                <span className="metric-icon">🔔</span>
                <span className="metric-label">Alert Status</span>
              </div>
              <div
                className="alert-badge-large"
                style={{ color: alertColor(data.alert) }}
              >
                {data.alert}
              </div>
              <div className="metric-spark">System state</div>
            </article>
          </section>

          {/* Chart Section */}
          <section className="chart-section">
            <div className="chart-header">
              <h2>Live Telemetry</h2>
              <p className="chart-subtitle">Last {history.length} samples • Smooth monotone curves</p>
            </div>
            {history.length === 0 ? (
              <p className="chart-empty">Collecting sensor data...</p>
            ) : (
              <ResponsiveContainer width="100%" height={400}>
                <LineChart data={history} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.05)" />
                  <XAxis
                    dataKey="timestamp"
                    tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }}
                  />
                  <YAxis tick={{ fill: 'rgba(255, 255, 255, 0.5)', fontSize: 12 }} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    name="Temperature (°C)"
                    stroke="#06b6d4"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="occupancy"
                    name="Occupancy (%)"
                    stroke="#a78bfa"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="energy"
                    name="Energy (kWh)"
                    stroke="#10b981"
                    dot={false}
                    strokeWidth={2}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </section>

          {/* Alert History */}
          <section className="alert-history-section">
            <button
              className="toggle-history-btn"
              onClick={() => setShowAlertHistory(!showAlertHistory)}
              aria-expanded={showAlertHistory}
            >
              {showAlertHistory ? '👁️ Hide' : '👀 Show'} Alert History ({data.alerts.length})
            </button>

            {showAlertHistory && (
              <div className="alert-history-panel">
                <h3>Alert History</h3>
                {data.alerts.length === 0 ? (
                  <p className="muted">No alerts recorded.</p>
                ) : (
                  <ul className="alert-list">
                    {[...data.alerts].reverse().map((alert: Alert, idx: number) => (
                      <li key={idx} className={`alert-item alert-${alert.alert.toLowerCase()}`}>
                        <span className="alert-time">{new Date(alert.timestamp).toLocaleTimeString()}</span>
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
        </div>
      )}

      {/* DevOps Footer Meta-Bar */}
      <footer className="devops-footer">
        <div className="footer-content">
          <span className="footer-text">🔬 Campus Digital Twin v2.1.0</span>
          <span className="footer-divider">—</span>
          <span className="footer-text">React 18 + Vite + Recharts</span>
          <span className="footer-divider">—</span>
          <span className="footer-text">K8s Orchestrated</span>
        </div>
      </footer>
    </div>
  );
}
