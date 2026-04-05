"""API contract tests for /data and /health."""
from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


def test_health_returns_ok() -> None:
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_data_shape_and_ranges() -> None:
    response = client.get("/data")
    assert response.status_code == 200
    data = response.json()
    assert set(data.keys()) == {"temperature", "occupancy", "energy", "alert"}
    assert isinstance(data["temperature"], (int, float))
    assert 20 <= data["temperature"] <= 40
    assert isinstance(data["occupancy"], int)
    assert 0 <= data["occupancy"] <= 100
    assert isinstance(data["energy"], int)
    assert 100 <= data["energy"] <= 500
    assert data["alert"] in ("Normal", "Warning", "Critical")
