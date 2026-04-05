"""
Live Campus Digital Twin — FastAPI backend.
Serves simulated campus metrics at GET /data with CORS enabled for the dashboard.
"""
import random
from typing import Literal

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Valid alert levels for the digital twin simulation
AlertLevel = Literal["Normal", "Warning", "Critical"]
ALERT_LEVELS: list[AlertLevel] = ["Normal", "Warning", "Critical"]

app = FastAPI(
    title="Campus Digital Twin API",
    description="Simulated real-time campus temperature, occupancy, energy, and alerts.",
    version="1.0.0",
)

# CORS: allow dashboard origins (local dev + Docker + any deployed host)
# Wildcard origin cannot be combined with credentials (browser CORS rules).
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/data")
def get_campus_data() -> dict:
    """
    Return one snapshot of simulated campus telemetry.
    Ranges: temperature 20–40°C, occupancy 0–100%, energy 100–500 kWh (arbitrary unit).
    """
    return {
        "temperature": round(random.uniform(20.0, 40.0), 1),
        "occupancy": random.randint(0, 100),
        "energy": random.randint(100, 500),
        "alert": random.choice(ALERT_LEVELS),
    }


@app.get("/health")
def health() -> dict:
    """Health check for orchestrators and load balancers."""
    return {"status": "ok"}
