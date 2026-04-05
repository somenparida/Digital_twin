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
const POLL_MS = 1000; // 1 second polling
const LATENCY_MIN = 10;
const LATENCY_MAX = 45;

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

  /**
   * Load campus data from API and update sliding window history
   */
  const load = useCallback(async () => {
    try {
      const next = await fetchCampusData();
      setData(next);
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
      setError(e instanceof Error ? e.message : 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Change simulation mode
   */
  const handleModeChange = useCallback(async (mode: SimulationMode) => {
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
