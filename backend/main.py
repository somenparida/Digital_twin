"""
Live Campus Digital Twin — FastAPI backend with DevOps monitoring.

Features:
- Simulation modes (normal, warning, critical) with switchable control
- Auto-recovery from critical mode after 10 seconds
- Alert logging (last 10 alerts with timestamps)
- System health tracking
- Prometheus metrics (request counter, active mode gauge)
"""
import os
import random
import threading
import time
from datetime import datetime, timedelta
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from prometheus_client import Counter, Gauge, generate_latest, CollectorRegistry
from influxdb_client import InfluxDBClient
from influxdb_client.client.write_api import SYNCHRONOUS
from pymongo import MongoClient
from pymongo.errors import ConnectionFailure

# ============================================================================
# TYPE DEFINITIONS
# ============================================================================
AlertLevel = Literal["Normal", "Warning", "Critical"]
SimulationMode = Literal["normal", "warning", "critical"]
SystemStatus = Literal["UP", "DOWN"]

ALERT_LEVELS: list[AlertLevel] = ["Normal", "Warning", "Critical"]
SIMULATION_MODES: list[SimulationMode] = ["normal", "warning", "critical"]

# ============================================================================
# GLOBAL STATE MANAGEMENT
# ============================================================================
class SimulationState:
    """Thread-safe simulation state manager."""
    
    def __init__(self):
        self.mode: SimulationMode = "normal"
        self.last_10_alerts: list[dict] = []  # [{timestamp, alert, temperature, occupancy, energy}, ...]
        self.system_status: SystemStatus = "UP"
        self.system_start_time = datetime.utcnow().isoformat()
        self.critical_start_time: float | None = None  # Track when critical mode started
        self.lock = threading.Lock()
    
    def set_mode(self, mode: SimulationMode) -> None:
        """Thread-safe mode setter."""
        with self.lock:
            self.mode = mode
            if mode == "critical":
                self.critical_start_time = time.time()
            else:
                self.critical_start_time = None
    
    def get_mode(self) -> SimulationMode:
        """Thread-safe mode getter."""
        with self.lock:
            # Auto-recovery: reset critical to normal after 10 seconds
            if self.mode == "critical" and self.critical_start_time:
                elapsed = time.time() - self.critical_start_time
                if elapsed > 10:
                    self.mode = "normal"
                    self.critical_start_time = None
            return self.mode
    
    def add_alert(self, alert_data: dict) -> None:
        """Add alert to history (keep last 10)."""
        with self.lock:
            self.last_10_alerts.append(alert_data)
            # Keep only last 10
            if len(self.last_10_alerts) > 10:
                self.last_10_alerts = self.last_10_alerts[-10:]
    
    def get_alerts(self) -> list[dict]:
        """Get current alerts."""
        with self.lock:
            return list(self.last_10_alerts)


state = SimulationState()

# ============================================================================
# PROMETHEUS METRICS SETUP
# ============================================================================
registry = CollectorRegistry()

# Counter: total API requests
request_counter = Counter(
    "campus_api_requests_total",
    "Total number of API requests",
    ["endpoint"],
    registry=registry,
)

# Gauge: current simulation mode (0=normal, 1=warning, 2=critical)
mode_gauge = Gauge(
    "campus_simulation_mode",
    "Current simulation mode (0=normal, 1=warning, 2=critical)",
    registry=registry,
)

# Counter: total alerts generated
alert_counter = Counter(
    "campus_alerts_total",
    "Total number of alerts generated",
    ["alert_level"],
    registry=registry,
)

# ============================================================================
# FASTAPI APP SETUP
# ============================================================================
app = FastAPI(
    title="Campus Digital Twin API",
    description="DevOps-enabled simulated campus telemetry with simulation control and monitoring.",
    version="2.0.0",
)

# CORS: allow dashboard origins (local dev + Docker + any deployed host)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================================
# DATABASE INITIALIZATION
# ============================================================================
# InfluxDB connection
INFLUXDB_URL = os.getenv("INFLUXDB_URL", "http://influxdb:8086")
INFLUXDB_TOKEN = os.getenv("INFLUXDB_TOKEN", "my-admin-token")
INFLUXDB_ORG = os.getenv("INFLUXDB_ORG", "myorg")
INFLUXDB_BUCKET = os.getenv("INFLUXDB_BUCKET", "sensors")

influxdb_client = None
influxdb_write_api = None

try:
    influxdb_client = InfluxDBClient(
        url=INFLUXDB_URL,
        token=INFLUXDB_TOKEN,
        org=INFLUXDB_ORG,
        timeout=5000,
    )
    influxdb_write_api = influxdb_client.write_api(write_type=SYNCHRONOUS)
    # Verify connection
    influxdb_client.ping()
    print("[✓] InfluxDB connected successfully")
except Exception as e:
    print(f"[!] InfluxDB connection failed: {e}. Will use simulation only.")
    influxdb_client = None
    influxdb_write_api = None

# MongoDB connection
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://admin:changeme@mongodb:27017/")
MONGODB_DB = os.getenv("MONGODB_DB", "digital_twin")

mongodb_client = None
mongodb_db = None

try:
    mongodb_client = MongoClient(MONGODB_URL, serverSelectionTimeoutMS=5000)
    mongodb_client.admin.command("ping")  # Test connection
    mongodb_db = mongodb_client[MONGODB_DB]
    print("[✓] MongoDB connected successfully")
except ConnectionFailure as e:
    print(f"[!] MongoDB connection failed: {e}. Alerts will be stored in memory only.")
    mongodb_client = None
    mongodb_db = None

# ============================================================================
# DATABASE HELPER FUNCTIONS
# ============================================================================
def write_telemetry_to_influxdb(telemetry: dict, mode: SimulationMode) -> bool:
    """Write telemetry data to InfluxDB."""
    if influxdb_write_api is None or influxdb_client is None:
        return False
    
    try:
        point = f"telemetry,mode={mode} temperature={telemetry['temperature']},occupancy={telemetry['occupancy']},energy={telemetry['energy']} {int(time.time() * 1e9)}"
        influxdb_write_api.write(bucket=INFLUXDB_BUCKET, record=point)
        return True
    except Exception as e:
        print(f"[!] InfluxDB write error: {e}")
        return False


def store_alert_to_mongodb(alert_data: dict) -> bool:
    """Store alert to MongoDB."""
    if mongodb_db is None:
        return False
    
    try:
        alerts_collection = mongodb_db["alerts"]
        alerts_collection.insert_one({
            **alert_data,
            "stored_at": datetime.utcnow(),
        })
        return True
    except Exception as e:
        print(f"[!] MongoDB insert error: {e}")
        return False


def query_latest_telemetry_from_influxdb() -> dict | None:
    """Query the latest telemetry from InfluxDB (if available)."""
    if influxdb_client is None:
        return None
    
    try:
        query_api = influxdb_client.query_api()
        query = f'''
        from(bucket: "{INFLUXDB_BUCKET}")
            |> range(start: -5m)
            |> filter(fn: (r) => r._measurement == "telemetry")
            |> sort(columns: ["_time"], desc: true)
            |> limit(n: 1)
        '''
        result = query_api.query(org=INFLUXDB_ORG, query=query)
        if result and len(result) > 0:
            records = result[0].records
            if records:
                latest = records[0]
                return {
                    "field": latest.field,
                    "value": latest.value,
                    "time": latest.get_time(),
                }
    except Exception as e:
        print(f"[!] InfluxDB query error: {e}")
    
    return None


# ============================================================================
# DATA GENERATION LOGIC
# ============================================================================
def _generate_telemetry(mode: SimulationMode) -> dict:
    """Generate telemetry based on current simulation mode."""
    if mode == "normal":
        temp = round(random.uniform(20.0, 28.0), 1)
        occupancy = random.randint(20, 80)
        energy = random.randint(150, 350)
        # In normal mode, heavily bias toward "Normal" alert
        alert = random.choices(ALERT_LEVELS, weights=[0.85, 0.10, 0.05])[0]
    
    elif mode == "warning":
        temp = round(random.uniform(28.0, 35.0), 1)
        occupancy = random.randint(60, 95)
        energy = random.randint(350, 450)
        # In warning mode, bias toward "Warning"
        alert = random.choices(ALERT_LEVELS, weights=[0.20, 0.70, 0.10])[0]
    
    else:  # critical
        temp = round(random.uniform(35.0, 40.0), 1)
        occupancy = random.randint(85, 100)
        energy = random.randint(450, 500)
        # In critical mode, always critical alert
        alert = "Critical"
    
    return {
        "temperature": temp,
        "occupancy": occupancy,
        "energy": energy,
        "alert": alert,
    }


# ============================================================================
# API ENDPOINTS
# ============================================================================

@app.get("/data")
def get_campus_data() -> dict:
    """
    Get current campus telemetry with system health.
    
    Response includes:
    - temperature, occupancy, energy: simulated metric values
    - alert: alert level (Normal/Warning/Critical)
    - mode: current simulation mode
    - alerts: last 10 alerts with timestamps
    - system_health: {status, timestamp}
    - database_status: {influxdb, mongodb} connectivity info
    """
    request_counter.labels(endpoint="data").inc()
    
    # Get current mode (with auto-recovery check)
    mode = state.get_mode()
    mode_gauge.set(SIMULATION_MODES.index(mode))
    
    # Generate telemetry based on mode (simulation)
    telemetry = _generate_telemetry(mode)
    
    # Write telemetry to InfluxDB
    influxdb_status = write_telemetry_to_influxdb(telemetry, mode)
    
    # Record alert
    alert_log = {
        "timestamp": datetime.utcnow().isoformat(),
        "alert": telemetry["alert"],
        "temperature": telemetry["temperature"],
        "occupancy": telemetry["occupancy"],
        "energy": telemetry["energy"],
    }
    state.add_alert(alert_log)
    
    # Store alert to MongoDB
    mongodb_status = store_alert_to_mongodb(alert_log)
    
    alert_counter.labels(alert_level=telemetry["alert"]).inc()
    
    return {
        "temperature": telemetry["temperature"],
        "occupancy": telemetry["occupancy"],
        "energy": telemetry["energy"],
        "alert": telemetry["alert"],
        "mode": mode,
        "alerts": state.get_alerts(),
        "system_health": {
            "status": state.system_status,
            "timestamp": datetime.utcnow().isoformat(),
            "uptime_seconds": (datetime.utcnow() - datetime.fromisoformat(state.system_start_time)).total_seconds(),
        },
        "database_status": {
            "influxdb": "connected" if influxdb_client else "disconnected",
            "influxdb_write": "success" if influxdb_status else "failed",
            "mongodb": "connected" if mongodb_client else "disconnected",
            "mongodb_write": "success" if mongodb_status else "failed",
        },
    }


@app.post("/mode/{mode}")
def set_simulation_mode(mode: SimulationMode) -> dict:
    """
    Set the simulation mode (normal, warning, critical).
    
    Modes:
    - normal: temp 20-28°C, occupancy 20-80%, low energy
    - warning: temp 28-35°C, occupancy 60-95%, medium energy
    - critical: temp 35-40°C, occupancy 85-100%, high energy
    
    Note: Critical mode auto-resets to normal after 10 seconds.
    """
    request_counter.labels(endpoint="mode").inc()
    
    if mode not in SIMULATION_MODES:
        return {"error": f"Invalid mode. Must be one of {SIMULATION_MODES}"}
    
    state.set_mode(mode)
    mode_gauge.set(SIMULATION_MODES.index(mode))
    
    return {
        "mode": mode,
        "message": f"Simulation mode set to {mode}",
        "auto_recovery": "Enabled (10s to reset from critical)" if mode == "critical" else "N/A",
    }


@app.get("/alerts")
def get_alert_history() -> dict:
    """Get alert history (from memory + MongoDB if available)."""
    request_counter.labels(endpoint="alerts").inc()
    
    alerts_data = state.get_alerts()
    mongodb_alerts = []
    
    # Query MongoDB for historical alerts
    if mongodb_db:
        try:
            alerts_collection = mongodb_db["alerts"]
            # Get last 100 alerts from MongoDB
            mongodb_alerts = list(alerts_collection.find().sort("stored_at", -1).limit(100))
            # Convert ObjectId to string for JSON serialization
            for alert in mongodb_alerts:
                alert["_id"] = str(alert.get("_id", ""))
        except Exception as e:
            print(f"[!] MongoDB query error: {e}")
    
    return {
        "alerts_memory": alerts_data,
        "alerts_mongodb": mongodb_alerts[:10],  # Last 10 from database
        "total_count": len(alerts_data),
        "database_alerts_count": len(mongodb_alerts),
    }


@app.get("/metrics")
def get_prometheus_metrics():
    """Prometheus metrics endpoint (port 8000)."""
    request_counter.labels(endpoint="metrics").inc()
    return generate_latest(registry)


@app.get("/health")
def health() -> dict:
    """Health check for orchestrators and load balancers."""
    request_counter.labels(endpoint="health").inc()
    return {
        "status": state.system_status,
        "timestamp": datetime.utcnow().isoformat(),
        "version": "2.0.0",
    }
