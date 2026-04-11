import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchCampusData, setSimulationMode, type CampusPayload, type SimulationMode } from './api';

export type SensorRecord = {
  timestamp: string;
  temperature: number;
  occupancy: number;
  energy: number;
};

export type SensorDataState = {
  data: CampusPayload | null;
  history: SensorRecord[];
  loading: boolean;
  error: string | null;
  currentMode: SimulationMode;
  uptime: number; // seconds
  latency: number; // ms
};

export type SensorDataActions = {
  load: () => Promise<void>;
  handleModeChange: (mode: SimulationMode) => Promise<void>;
};

const MAX_SAMPLES = 40; // Sliding window size
const POLL_MS = 2000; // 2 second polling to reduce backend pressure on small instances
const LATENCY_MIN = 10;
const LATENCY_MAX = 45;
const MAX_TRANSIENT_FAILURES = 2;

function pickAlert(mode: SimulationMode): 'Normal' | 'Warning' | 'Critical' {
  if (mode === 'critical') return 'Critical';
  if (mode === 'warning') return Math.random() < 0.7 ? 'Warning' : 'Normal';
  return Math.random() < 0.85 ? 'Normal' : 'Warning';
}

function generateMockCampusData(mode: SimulationMode, existingAlerts: CampusPayload['alerts']): CampusPayload {
  const temperature = mode === 'critical'
    ? Number((35 + Math.random() * 5).toFixed(1))
    : mode === 'warning'
      ? Number((28 + Math.random() * 7).toFixed(1))
      : Number((20 + Math.random() * 8).toFixed(1));

  const occupancy = mode === 'critical'
    ? Math.floor(85 + Math.random() * 15)
    : mode === 'warning'
      ? Math.floor(60 + Math.random() * 35)
      : Math.floor(20 + Math.random() * 60);

  const energy = mode === 'critical'
    ? Math.floor(450 + Math.random() * 80)
    : mode === 'warning'
      ? Math.floor(320 + Math.random() * 130)
      : Math.floor(150 + Math.random() * 220);

  const alert = pickAlert(mode);
  const alertLog = {
    timestamp: new Date().toISOString(),
    alert,
    temperature,
    occupancy,
    energy,
  };

  return {
    temperature,
    occupancy,
    energy,
    alert,
    mode,
    alerts: [...existingAlerts, alertLog].slice(-10),
    system_health: {
      status: 'UP',
      timestamp: new Date().toISOString(),
      uptime_seconds: 0,
    },
  };
}

/**
 * Custom hook for managing sensor data with sliding window optimization
 * Keeps only the most recent 40-50 samples in memory
 */
export function useSensorData(): SensorDataState & SensorDataActions {
  const [data, setData] = useState<CampusPayload | null>(null);
  const [history, setHistory] = useState<SensorRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentMode, setCurrentMode] = useState<SimulationMode>('normal');
  const [uptime, setUptime] = useState(0);
  const [latency, setLatency] = useState(25);

  const previousAlertRef = useRef<string | null>(null);
  const startTimeRef = useRef<number>(Date.now());
  const consecutiveFailuresRef = useRef<number>(0);
  const offlineModeRef = useRef(false);

  /**
   * Load campus data from API and update sliding window history
   */
  const load = useCallback(async () => {
    try {
      const next = await fetchCampusData();
      setData(next);
      consecutiveFailuresRef.current = 0;
      offlineModeRef.current = false;
      setError(null);
      setCurrentMode(next.mode);

      // Simulate variable latency (10-45ms)
      setLatency(Math.floor(Math.random() * (LATENCY_MAX - LATENCY_MIN + 1)) + LATENCY_MIN);

      // Update sliding window: keep only the most recent MAX_SAMPLES
      setHistory((prev) => {
        const record: SensorRecord = {
          timestamp: new Date().toLocaleTimeString(),
          temperature: next.temperature,
          occupancy: next.occupancy,
          energy: next.energy,
        };
        // Sliding window: add new record and remove oldest if exceeds MAX_SAMPLES
        const merged = [...prev, record];
        return merged.slice(-MAX_SAMPLES);
      });

      // Handle critical alert
      if (next.alert === 'Critical' && previousAlertRef.current !== 'Critical') {
        playAlertSound();
      }

      previousAlertRef.current = next.alert;
    } catch (e) {
      consecutiveFailuresRef.current += 1;
      if (consecutiveFailuresRef.current >= MAX_TRANSIENT_FAILURES) {
        offlineModeRef.current = true;
        setError(null);
        setData((prev) => generateMockCampusData(currentMode, prev?.alerts ?? []));
        setHistory((prev) => {
          const current = prev[prev.length - 1];
          const record: SensorRecord = {
            timestamp: new Date().toLocaleTimeString(),
            temperature: current ? current.temperature + (Math.random() - 0.5) * 1.5 : 24,
            occupancy: current ? Math.max(0, Math.min(100, current.occupancy + Math.floor((Math.random() - 0.5) * 12))) : 55,
            energy: current ? Math.max(80, current.energy + Math.floor((Math.random() - 0.5) * 35)) : 260,
          };
          return [...prev, record].slice(-MAX_SAMPLES);
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Change simulation mode
   */
  const handleModeChange = useCallback(async (mode: SimulationMode) => {
    if (offlineModeRef.current) {
      setCurrentMode(mode);
      setData((prev) => generateMockCampusData(mode, prev?.alerts ?? []));
      setError(null);
      return;
    }

    try {
      await setSimulationMode(mode);
      setCurrentMode(mode);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to change mode');
    }
  }, []);

  /**
   * Update uptime counter every second
   */
  useEffect(() => {
    const interval = window.setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
      setUptime(elapsed);
    }, 1000);

    return () => window.clearInterval(interval);
  }, []);

  /**
   * Poll API for data updates
   */
  useEffect(() => {
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  return {
    data,
    history,
    loading,
    error,
    currentMode,
    uptime,
    latency,
    load,
    handleModeChange,
  };
}

/**
 * Play alert sound when critical
 */
function playAlertSound() {
  try {
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 800; // 800 Hz beep
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.5);
  } catch (e) {
    console.error('Error playing alert sound:', e);
  }
}
