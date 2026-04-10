"""API contract tests for updated endpoints with simulation modes and monitoring."""
import time

from fastapi.testclient import TestClient

from main import app

client = TestClient(app)


# ============================================================================
# HEALTH & BASIC TESTS
# ============================================================================

def test_health_returns_ok() -> None:
    """Test health check endpoint."""
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "UP"
    assert "timestamp" in data


# ============================================================================
# DATA ENDPOINT TESTS
# ============================================================================

def test_data_shape_and_ranges_normal_mode() -> None:
    """Test /data endpoint in normal mode."""
    # Set normal mode
    client.post("/mode/normal")
    
    response = client.get("/data")
    assert response.status_code == 200
    data = response.json()
    
    # Check required fields
    required_fields = {"temperature", "occupancy", "energy", "alert", "mode", "alerts", "system_health"}
    assert required_fields.issubset(set(data.keys()))

    # Database connectivity metadata is expected in v2.0
    assert "database_status" in data
    assert isinstance(data["database_status"], dict)
    
    # Validate normal mode ranges
    assert isinstance(data["temperature"], (int, float))
    assert 20 <= data["temperature"] <= 28, f"Expected 20-28°C in normal mode, got {data['temperature']}"
    
    assert isinstance(data["occupancy"], int)
    assert 20 <= data["occupancy"] <= 80, f"Expected 20-80% in normal mode, got {data['occupancy']}"
    
    assert isinstance(data["energy"], int)
    assert 150 <= data["energy"] <= 350, f"Expected 150-350 in normal mode, got {data['energy']}"
    
    assert data["alert"] in ("Normal", "Warning", "Critical")
    assert data["mode"] == "normal"


def test_data_shape_and_ranges_warning_mode() -> None:
    """Test /data endpoint in warning mode."""
    # Set warning mode
    client.post("/mode/warning")
    
    response = client.get("/data")
    assert response.status_code == 200
    data = response.json()
    
    # Validate warning mode ranges
    assert 28 <= data["temperature"] <= 35, f"Expected 28-35°C in warning mode, got {data['temperature']}"
    assert 60 <= data["occupancy"] <= 95, f"Expected 60-95% in warning mode, got {data['occupancy']}"
    assert 350 <= data["energy"] <= 450, f"Expected 350-450 in warning mode, got {data['energy']}"
    assert data["mode"] == "warning"


def test_data_shape_and_ranges_critical_mode() -> None:
    """Test /data endpoint in critical mode."""
    # Set critical mode
    client.post("/mode/critical")
    
    response = client.get("/data")
    assert response.status_code == 200
    data = response.json()
    
    # Validate critical mode ranges
    assert 35 <= data["temperature"] <= 40, f"Expected 35-40°C in critical mode, got {data['temperature']}"
    assert 85 <= data["occupancy"] <= 100, f"Expected 85-100% in critical mode, got {data['occupancy']}"
    assert 450 <= data["energy"] <= 500, f"Expected 450-500 in critical mode, got {data['energy']}"
    assert data["alert"] == "Critical", "Alert should always be Critical in critical mode"
    assert data["mode"] == "critical"


def test_system_health_in_data() -> None:
    """Test system health object in /data response."""
    response = client.get("/data")
    assert response.status_code == 200
    data = response.json()
    
    health = data["system_health"]
    assert health["status"] == "UP"
    assert "timestamp" in health
    assert "uptime_seconds" in health
    assert health["uptime_seconds"] >= 0


def test_alerts_in_data() -> None:
    """Test alerts list in /data response."""
    response = client.get("/data")
    assert response.status_code == 200
    data = response.json()
    
    assert isinstance(data["alerts"], list)
    # After a few calls, we should have some alerts
    assert len(data["alerts"]) > 0


# ============================================================================
# SIMULATION MODE ENDPOINT TESTS
# ============================================================================

def test_set_mode_normal() -> None:
    """Test setting mode to normal."""
    response = client.post("/mode/normal")
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "normal"
    assert "message" in data


def test_set_mode_warning() -> None:
    """Test setting mode to warning."""
    response = client.post("/mode/warning")
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "warning"


def test_set_mode_critical() -> None:
    """Test setting mode to critical."""
    response = client.post("/mode/critical")
    assert response.status_code == 200
    data = response.json()
    assert data["mode"] == "critical"
    assert "auto_recovery" in data


def test_mode_persistence() -> None:
    """Test that mode persists across requests."""
    # Set mode
    client.post("/mode/warning")
    
    # Get data multiple times and verify mode stays the same
    for _ in range(3):
        response = client.get("/data")
        assert response.json()["mode"] == "warning"


# ============================================================================
# ALERT HISTORY TESTS
# ============================================================================

def test_alerts_endpoint() -> None:
    """Test /alerts endpoint returns alert history."""
    response = client.get("/alerts")
    assert response.status_code == 200
    data = response.json()
    
    assert "alerts_memory" in data
    assert "total_count" in data
    assert isinstance(data["alerts_memory"], list)
    assert len(data["alerts_memory"]) == data["total_count"]


def test_alert_structure() -> None:
    """Test that alerts have correct structure."""
    response = client.get("/alerts")
    assert response.status_code == 200
    data = response.json()
    
    if data["total_count"] > 0:
        alert = data["alerts_memory"][0]
        required_fields = {"timestamp", "alert", "temperature", "occupancy", "energy"}
        assert set(alert.keys()) == required_fields


def test_alerts_limited_to_10() -> None:
    """Test that only last 10 alerts are kept."""
    # Make 15 requests to generate >10 alerts
    for _ in range(15):
        client.get("/data")
    
    response = client.get("/alerts")
    data = response.json()
    assert data["total_count"] <= 10, "Should keep maximum 10 alerts"


# ============================================================================
# PROMETHEUS METRICS TESTS
# ============================================================================

def test_metrics_endpoint() -> None:
    """Test /metrics endpoint returns Prometheus format."""
    response = client.get("/metrics")
    assert response.status_code == 200
    
    content = response.text
    # Check for Prometheus format indicators
    assert "campus_api_requests_total" in content
    assert "campus_simulation_mode" in content
    assert "campus_alerts_total" in content


# ============================================================================
# AUTO-RECOVERY TESTS
# ============================================================================

def test_critical_auto_recovery() -> None:
    """
    Test that critical mode auto-resets to normal after 10 seconds.
    
    Note: This test uses a 10-second timeout which is long for unit tests.
    In production, this would be verified via integration tests.
    """
    # Set critical mode
    client.post("/mode/critical")
    response1 = client.get("/data")
    assert response1.json()["mode"] == "critical"
    
    # Wait for auto-recovery
    time.sleep(11)
    
    # Mode should automatically reset to normal
    response2 = client.get("/data")
    assert response2.json()["mode"] == "normal"
