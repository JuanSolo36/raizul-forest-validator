import logging
from contextlib import asynccontextmanager
from datetime import date
from typing import Dict, Any, Optional
from fastapi import FastAPI, HTTPException, status, Body, Query
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from schemas.geojson_models import (
    AnalisisForestalResponse,
    GeoJSONValidationException
)
from geospatial import normalize_geojson
from services.gfw_service import gfw_service

# Configuración de logs con formato profesional
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("raizul_api")


@asynccontextmanager
async def lifespan(app: FastAPI):
    #Administra el ciclo de vida del servidor (apertura y cierre de recursos).
    logger.info("Iniciando servicio Raizul Forest Validator...")
    yield
    logger.info("Cerrando pool de conexiones HTTP hacia GFW...")
    await gfw_service.close()


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# Configuración de CORS dinámica según ALLOWED_ORIGINS (alineado con DEPLOY.md)
_allowed_origins = [
    origin.strip()
    for origin in settings.ALLOWED_ORIGINS.split(",")
    if origin.strip()
]
if not _allowed_origins or "*" in _allowed_origins:
    _allowed_origins = ["*"]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["Salud"])
async def root():
    return {
        "servicio": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "estado": "operativo",
        "documentacion": "/docs"
    }


@app.get("/health", tags=["Salud"])
async def health():
    """Probe de salud requerido por Google Cloud Run y Kubernetes."""
    return {"status": "healthy"}


@app.post(
    "/analisis-forestal",
    response_model=AnalisisForestalResponse,
    status_code=status.HTTP_200_OK,
    tags=["Análisis Forestal"],
    summary="Valida el polígono y consulta datos de pérdida histórica y alertas satelitales en GFW."
)
async def analisis_forestal(
    geojson_payload: Dict[str, Any] = Body(
        ...,
        description="Payload en formato GeoJSON (Polygon, MultiPolygon o Feature)."
    ),
    fecha_inicio: Optional[date] = Query(
        default=date(2020, 12, 31),
        description="Fecha de inicio para el filtro de alertas (por defecto corte EUDR 2020-12-31)."
    ),
    fecha_fin: Optional[date] = Query(
        default=None,
        description="Fecha de fin para el filtro de alertas (opcional)."
    )
):
    logger.info("Recibida solicitud de análisis forestal.")

    # Normalización y validación matemática de la geometría
    try:
        geometria_normalizada, farm_id, properties = normalize_geojson(geojson_payload)
    except GeoJSONValidationException as val_exc:
        logger.warning(f"Rechazo por GeoJSON inválido: {val_exc}")
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "error": "GeoJSON Inválido",
                "mensaje": str(val_exc),
                "requisitos": [
                    "Formato GeoJSON válido (Polygon, MultiPolygon o Feature con un solo predio).",
                    "Coordenadas estándar WGS84 (EPSG:4326): lon [-180, 180], lat [-90, 90].",
                    "Anillos cerrados (el primer punto debe ser idéntico al último).",
                    "Geometría no auto-intersecada (topológicamente válida)."
                ]
            }
        )
    except Exception as exc:
        logger.error(f"Error procesando estructura del GeoJSON: {exc}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Estructura JSON malformada: {str(exc)}"
        )

    #ejecutar doble consulta en Global Forest Watch
    try:
        resultado = await gfw_service.analyze_polygon(
            geometry=geometria_normalizada,
            farm_id=farm_id,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin
        )

        #si ambas consultas fallaron, devolvemos error 502 informando la indisponibilidad
        if not resultado.exito:
            logger.error("Ambas consultas a GFW fallaron. Retornando 502.")
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="No fue posible obtener información satelital de Global Forest Watch para ninguna de las fuentes."
            )

        logger.info(
            f"Análisis procesado exitosamente para '{resultado.farm_id}' (Estado: {resultado.estado_general}). "
            f"Geostore ID: {resultado.geostore_id} - Riesgo: {resultado.forest_summary.deforestation_risk_level}"
        )
        return resultado

    except HTTPException as http_err:
        raise http_err
    except Exception as exc:
        logger.exception(f"Error inesperado en el servidor: {exc}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Fallo interno del servidor al procesar el análisis: {str(exc)}"
        )


@app.get("/muestras", tags=["Datos de Muestra"])
async def obtener_muestras_cacaoteras():
    return {
        "muestras": [
            {
                "id": "finca_el_paraiso_01",
                "nombre": "Finca El Paraíso (Valle del Cauca)",
                "departamento": "Valle del Cauca",
                "descripcion": "Predio oficial de prueba entregado en el reto técnico de Raizul.",
                "geojson": {
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
            },
            {
                "id": "santander",
                "nombre": "Finca Cacaotera San Vicente de Chucurí (Santander)",
                "departamento": "Santander",
                "descripcion": "Zona montañosa tradicional de cacao fino de aroma.",
                "geojson": {
                    "type": "Feature",
                    "properties": {"nombre": "Finca El Progreso", "cultivo": "Cacao Fino de Aroma", "farm_id": "santander_01"},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-73.50, 6.80],
                            [-73.49, 6.80],
                            [-73.49, 6.81],
                            [-73.50, 6.81],
                            [-73.50, 6.80]
                        ]]
                    }
                }
            },
            {
                "id": "tumaco",
                "nombre": "Predio Agroforestal Tumaco (Nariño)",
                "departamento": "Nariño",
                "descripcion": "Zona costera pacífica de cultivo de cacao criollo ancestral.",
                "geojson": {
                    "type": "Feature",
                    "properties": {"nombre": "Asociación Cacao Pacífico", "cultivo": "Cacao Criollo", "farm_id": "tumaco_01"},
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[
                            [-78.75, 1.78],
                            [-78.74, 1.78],
                            [-78.74, 1.79],
                            [-78.75, 1.79],
                            [-78.75, 1.78]
                        ]]
                    }
                }
            }
        ]
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.HOST, port=settings.PORT, reload=True)
