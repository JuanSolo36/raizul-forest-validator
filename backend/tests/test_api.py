import pytest
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["estado"] == "operativo"
    assert "documentacion" in data


def test_health():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json() == {"status": "healthy"}


def test_muestras():
    response = client.get("/muestras")
    assert response.status_code == 200
    data = response.json()
    assert "muestras" in data
    assert len(data["muestras"]) >= 3
    ids = [m["id"] for m in data["muestras"]]
    assert "finca_el_paraiso_01" in ids


def test_analisis_forestal_invalid_unclosed_polygon():
    payload = {
        "type": "Polygon",
        "coordinates": [
            [
                [-73.50, 6.80],
                [-73.49, 6.80],
                [-73.49, 6.81],
                [-73.50, 6.81]  # Falta cerrar el anillo
            ]
        ]
    }
    response = client.post("/analisis-forestal", json=payload)
    assert response.status_code == 422
    data = response.json()
    assert "detail" in data
    assert "no está cerrado" in str(data["detail"])


def test_analisis_forestal_invalid_coordinates_range():
    payload = {
        "type": "Polygon",
        "coordinates": [
            [
                [-200.0, 6.80],  # Longitud fuera de [-180, 180]
                [-73.49, 6.80],
                [-73.49, 6.81],
                [-200.0, 6.81],
                [-200.0, 6.80]
            ]
        ]
    }
    response = client.post("/analisis-forestal", json=payload)
    assert response.status_code == 422
    assert "Longitud inválida" in str(response.json()["detail"])


def test_analisis_forestal_unsupported_type():
    payload = {
        "type": "Point",
        "coordinates": [-73.50, 6.80]
    }
    response = client.post("/analisis-forestal", json=payload)
    assert response.status_code == 422
    detalle = str(response.json()["detail"]).lower()
    assert "no compatible" in detalle or "no soportado" in detalle


def test_analisis_forestal_multi_polygon_collection_rejection():
    payload = {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [-73.50, 6.80], [-73.49, 6.80], [-73.49, 6.81], [-73.50, 6.81], [-73.50, 6.80]
                    ]]
                }
            },
            {
                "type": "Feature",
                "geometry": {
                    "type": "Polygon",
                    "coordinates": [[
                        [-73.40, 6.80], [-73.39, 6.80], [-73.39, 6.81], [-73.40, 6.81], [-73.40, 6.80]
                    ]]
                }
            }
        ]
    }
    response = client.post("/analisis-forestal", json=payload)
    assert response.status_code == 422
    assert "contiene 2 fincas/lotes" in str(response.json()["detail"])


def test_analisis_forestal_raizul_official_contract():
    """
    Test del contrato OFICIAL de Raizul usando el GeoJSON exacto que entregaron:
    Finca El Paraíso (Valle del Cauca).
    Valida: farm_id, polygon_valid, area_hectares, forest_summary, tree_cover_loss_history, analysis_timestamp.
    """
    payload = {
        "type": "Feature",
        "geometry": {
            "type": "Polygon",
            "coordinates": [
                [
                    [-76.5300, 3.4500],
                    [-76.5200, 3.4600],
                    [-76.5100, 3.4400],
                    [-76.5300, 3.4500]
                ]
            ]
        },
        "properties": {
            "farm_id": "finca_el_paraiso_01"
        }
    }

    response = client.post("/analisis-forestal", json=payload)
    assert response.status_code == 200
    data = response.json()

    # 1. Contrato exacto de Raizul
    assert data["farm_id"] == "finca_el_paraiso_01"
    assert data["polygon_valid"] is True
    assert isinstance(data["area_hectares"], float)
    assert data["area_hectares"] > 0

    assert "forest_summary" in data
    summary = data["forest_summary"]
    assert "current_tree_cover_pct" in summary
    assert summary["deforestation_risk_level"] in ["Low", "Medium", "High", "Not evaluable"]
    assert isinstance(summary["critical_alert"], bool)

    assert "tree_cover_loss_history" in data
    assert isinstance(data["tree_cover_loss_history"], list)
    if len(data["tree_cover_loss_history"]) > 0:
        first_entry = data["tree_cover_loss_history"][0]
        assert "year" in first_entry
        assert "hectares_lost" in first_entry
        assert first_entry["year"] >= 2001

    assert "analysis_timestamp" in data

    # 2. Compatibilidad extendida para el Frontend (Mapa y Gráficos)
    assert "geostore_id" in data
    assert "bbox" in data
    assert len(data["bbox"]) == 4
    assert data["estado_general"] in ["completo", "parcial"]
    assert "analisis_alertas" in data
    assert "evaluacion_riesgo" in data
