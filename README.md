# Raizul Forest Validator 
**Validador Geoespacial y Monitoreo Satelital de Cobertura Forestal para Predios Cacaoteros en Colombia**

[![Python 3.11](https://img.shields.io/badge/Python-3.11-3776AB?logo=python&logoColor=white)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688?logo=fastapi&logoColor=white)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?logo=react&logoColor=black)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Docker](https://img.shields.io/badge/Docker-Enabled-2496ED?logo=docker&logoColor=white)](https://www.docker.com/)
[![Google Cloud Run](https://img.shields.io/badge/Google_Cloud_Run-Ready-4285F4?logo=googlecloud&logoColor=white)](https://cloud.google.com/run)
[![Tests](https://img.shields.io/badge/Pytest-8%20Passed%20(100%25)-success)](https://docs.pytest.org/)

---

## 📌 Contexto del Proyecto

En el marco de la debida diligencia ambiental y el cumplimiento del **Reglamento Europeo contra la Deforestación (EUDR - Reglamento UE 2023/1115)**, las cadenas de suministro de cacao fino de aroma y especial en Colombia requieren verificar rigurosamente que los predios de producción:
1. Cuenten con delimitación geográfica poligonal válida en el sistema estándar **WGS84 (EPSG:4326)**.
2. Demuestren ausencia de deforestación posterior a la fecha de corte (**31 de diciembre de 2020**).
3. Monitoreen alertas tempranas de perturbación del dosel arbóreo para mitigar riesgos en tiempo real.

**Raizul Forest Validator** es un MVP full-stack diseñado para ingerir geometrías GeoJSON, normalizarlas, validar su topología con **Shapely** y consultar en tiempo real las capas satelitales oficiales de **Global Forest Watch (GFW)** para entregar un diagnóstico agroforestal certero y auditable.

---

## 🏛️ Arquitectura del Sistema

El sistema implementa una arquitectura desacoplada y orientada a microservicios:

```
                  ┌────────────────────────────────────────────────────────┐
                  │              Cliente Web (React 18 + MUI)              │
                  │   • Mapa Satelital (Leaflet / Esri World Imagery)      │
                  │   • Gráficos Interactivos de Pérdida y Alertas (Recharts)│
                  │   • Inspector de Lotes Múltiples y Selector Rápido     │
                  └───────────────────────────┬────────────────────────────┘
                                              │ HTTP (Reverse Proxy / CORS)
                                              ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                 Backend API (FastAPI)                  │
                  │   • Normalización GeoJSON (Polygon/MultiPolygon/Feature)│
                  │   • Validación WGS84 RFC 7946 & Topología (Shapely)    │
                  │   • Orquestador Asíncrono de Consultas (HTTPX Pool)   │
                  │   • Motor de Evaluación de Riesgo Metodológico         │
                  └──────────────┬──────────────────────────┬──────────────┘
                                 │                          │
                 POST /geostore  │                          │  GET /dataset/.../query
                                 ▼                          ▼
                  ┌────────────────────────────────────────────────────────┐
                  │            Global Forest Watch Data API                │
                  │   • GFW Geostore (Cálculo de Área Oficial y BoundingBox)│
                  │   • UMD Tree Cover Loss (Pérdida histórica 2001-reciente)│
                  │   • Integrated Alerts (Alertas GLAD-L, GLAD-S2 y RADD) │
                  └────────────────────────────────────────────────────────┘
```

### Componentes Principales:
* **Backend (`backend/`):** Desarrollado con **Python 3.11** y **FastAPI**, implementa el ciclo de vida asíncrono (`lifespan`), pool persistente de conexiones HTTP con `follow_redirects=True`, normalización de polígonos y cumplimiento estricto del contrato oficial de Raizul.
* **Capa Geoespacial (`backend/geospatial.py`):** Normaliza y valida que cada coordenada pertenezca a WGS84 RFC 7946 en grados decimales, detecta coordenadas proyectadas en metros (MAGNA-SIRGAS/UTM), verifica el cierre de anillos y evalúa validez topológica mediante GEOS/Shapely.
* **Frontend (`frontend/`):** Construido con **React 18**, **TypeScript**, **Vite** y **Material UI (MUI)**. Incluye visor satelital interactivo con **Leaflet**, tarjetas KPI y dos gráficos especializados en **Recharts**:
  1. *Evolución Anual de Pérdida de Cobertura Arbórea:* Destaca en color diferenciado el año con el mayor pico de deforestación y permite alternar a una tabla de datos numéricos con emisiones de CO₂.
  2. *Distribución Temporal de Alertas Satelitales:* Gráfico de barras apiladas por fecha con desglose en alta, nominal y baja confianza.
* **Infraestructura (`docker-compose.yml`, `DEPLOY.md`):** Contenedores Docker multi-etapa optimizados con Nginx para el frontend y Debian-slim para el backend, listos para despliegue serverless en **Google Cloud Run** con credenciales administradas en **Google Secret Manager**.

---

## 🚀 Inicio Rápido

### Opción A: Ejecución con Docker Compose (Recomendada)
Para levantar la solución completa en un solo comando:

```bash
docker compose up --build
```

* **Frontend:** [http://localhost:3000](http://localhost:3000)
* **Backend API & Swagger UI:** [http://localhost:8080/docs](http://localhost:8080/docs)
* **Health Check:** [http://localhost:8080/health](http://localhost:8080/health)

---

### Opción B: Ejecución Local en Desarrollo

#### 1. Iniciar el Backend:
```powershell
cd backend
python -m venv venv
.\venv\Scripts\pip install -r requirements.txt
.\venv\Scripts\uvicorn main:app --reload --port 8080
```

#### 2. Iniciar el Frontend:
```powershell
cd frontend
npm install
npm run dev
```
Abre en tu navegador: [http://localhost:3000](http://localhost:3000).

---

## 📡 Especificación de la API

### Endpoint Principal: `POST /analisis-forestal`

Permite enviar cualquier formato GeoJSON (`Feature`, `Polygon`, `MultiPolygon`, o `FeatureCollection`) junto con parámetros opcionales de filtro temporal.

#### Ejemplo de Petición (Payload Oficial de Raizul):
```json
{
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
```

#### Respuesta Oficial (200 OK):
```json
{
  "farm_id": "finca_el_paraiso_01",
  "polygon_valid": true,
  "area_hectares": 184.2,
  "forest_summary": {
    "current_tree_cover_pct": 98.4,
    "deforestation_risk_level": "Low",
    "critical_alert": false
  },
  "tree_cover_loss_history": [
    { "year": 2012, "hectares_lost": 0.45 },
    { "year": 2018, "hectares_lost": 1.20 }
  ],
  "analysis_timestamp": "2026-11-07T22:22:00Z"
}
```

> **Compatibilidad Dual:**  
> La respuesta contiene el contrato oficial exigido en su raíz, y adicionalmente expone metadatos enriquecidos (`bbox`, `analisis_alertas`, `geostore_id`, `estado_general`) para alimentar el mapa satelital y los gráficos del frontend sin romper los tests automatizados.

### Otros Endpoints:
* `GET /health`: Probe de salud para Cloud Run y orquestadores (`{"status": "healthy"}`).
* `GET /muestras`: Catálogo de fincas cacaoteras colombianas precargadas (Finca El Paraíso, San Vicente de Chucurí, Tumaco, Huila, Caquetá).

---

## 🗺️ Normalización Geoespacial y Compatibilidad

La función `normalize_geojson()` en `backend/geospatial.py` resuelve la ambigüedad de formatos según el estándar **RFC 7946**:

| Entrada Recibida | Decisión Técnica | Tratamiento |
| :--- | :---: | :--- |
| **Polygon** | ✅ Aceptado | Se normaliza y asigna identificador automático. |
| **MultiPolygon** | ✅ Aceptado | Se procesa como predio compuesto por múltiples islas/superficies. |
| **Feature** | ✅ Aceptado | Extrae la geometría poligonal y el `farm_id` de `properties`. |
| **FeatureCollection (1 predio)** | ✅ Aceptado | Extrae automáticamente el único lote encontrado. |
| **FeatureCollection (>1 predios)** | 🎛️ Asistido | El frontend detecta la colección y despliega un selector para elegir el lote deseado o unirlos con `unary_union`. |
| **Point / LineString** | ❌ Rechazado pedagógico | Código `422` explicando que no representan superficies prediales. |
| **Coordenadas Planas (Metros)** | ❌ Rechazado pedagógico | Detecta valores fuera de [-180, 180] y solicita reproyección a grados decimales WGS84. |

---

## 📊 Metodología de Evaluación de Riesgo

El sistema clasifica el riesgo agroforestal mediante una matriz metodológica explícita:

* **Riesgo Alto (`High`):** Pérdida histórica acumulada $>15\%$ del área del predio **o** detección crítica de $\ge 5$ alertas de alta confianza (`high`). Bandera `critical_alert: true`.
* **Riesgo Medio (`Medium`):** Pérdida acumulada $>3\%$ **o** presencia de alertas satelitales en el periodo analizado.
* **Riesgo Bajo (`Low`):** Ambas consultas satelitales exitosas, cobertura forestal estable, pérdida acumulada $\le 3\%$ y cero alertas detectadas.
* **No evaluable (`Not evaluable`):** Área predial $\le 0$ o indisponibilidad técnica total de los servicios satelitales.

> **Resiliencia Operativa:** Si una de las capas satelitales no está disponible en GFW, el sistema clasifica el estado como `parcial` y advierte al analista en lugar de transformar los fallos de red en falsos ceros de deforestación.

---

## 🧪 Pruebas Automatizadas

El proyecto cuenta con una suite completa de pruebas unitarias y de integración real en `backend/tests/test_api.py`.

Para ejecutar las pruebas:
```powershell
cd backend
.\venv\Scripts\pytest -v
```

### Resultados de la Suite (8/8 Passed - 100%):
```text
tests/test_api.py::test_root PASSED                                      [ 12%]
tests/test_api.py::test_health PASSED                                    [ 25%]
tests/test_api.py::test_muestras PASSED                                  [ 37%]
tests/test_api.py::test_analisis_forestal_invalid_unclosed_polygon PASSED [ 50%]
tests/test_api.py::test_analisis_forestal_invalid_coordinates_range PASSED [ 62%]
tests/test_api.py::test_analisis_forestal_unsupported_type PASSED        [ 75%]
tests/test_api.py::test_analisis_forestal_multi_polygon_collection_rejection PASSED [ 87%]
tests/test_api.py::test_analisis_forestal_raizul_official_contract PASSED [100%]

======================= 8 passed in 13.95s =======================
```

---

## ☁️ Despliegue en Producción (Google Cloud Run)

Para compilar, publicar en **Google Artifact Registry** y desplegar el servicio serverless en **Google Cloud Run** con credenciales seguras en **Google Secret Manager**, consulta la guía completa:

👉 **[Ver Manual de Despliegue: DEPLOY.md](./DEPLOY.md)**

Comando de despliegue principal:
```bash
gcloud run deploy raizul-forest-validator \
  --image=us-central1-docker.pkg.dev/$PROJECT_ID/raizul-repo/forest-validator-backend:v1.0.0 \
  --region=us-central1 \
  --allow-unauthenticated \
  --port=8080 \
  --memory=1Gi \
  --cpu=1 \
  --min-instances=0 \
  --max-instances=10 \
  --timeout=300s \
  --service-account=$RUNTIME_SA \
  --set-secrets="GFW_API_KEY=gfw-api-key:1" \
  --set-env-vars="GFW_DATA_API_BASE=https://data-api.globalforestwatch.org,GFW_ORIGIN_HEADER=$FRONTEND_ORIGIN"
```

---

## 👨‍💻 Autor

* **Desarrollador:** Juan Bahos
* **Reto Técnico:** Junior Developer — Raizul
* **Evaluadora:** Camila Mejía (CTO, Raizul)
* **Fecha:** Noviembre de 2026
