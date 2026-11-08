import math
from datetime import date
from typing import List, Dict, Any, Optional, Literal
from pydantic import BaseModel, Field, field_validator

from geospatial import (
    GeoJSONValidationException,
    POLYGON_TYPES,
    validate_coordinates_wgs84,
    _validar_anillo_cerrado,
    extract_polygon_geometry,
    normalize_geojson
)

# Compatibilidad hacia atrás
def extract_and_validate_geometry(raw_data: Dict[str, Any]) -> Dict[str, Any]:
    geometry, _, _ = normalize_geojson(raw_data)
    return geometry

# ==============================================================================
# TIPOS ESTRICTOS (LITERALS)
# ==============================================================================
EstadoConsulta = Literal["exitosa", "no_disponible", "error"]
NivelConfianzaAlerta = Literal["high", "nominal", "low"]
NivelRiesgo = Literal["Bajo", "Medio", "Alto", "No evaluable"]
RiskLevelEn = Literal["Low", "Medium", "High", "Not evaluable"]
EstadoGeneral = Literal["completo", "parcial", "fallido"]


# ==============================================================================
# 1. MODELOS DE CONSULTA 1: HISTÓRICO DE PÉRDIDA (UMD Tree Cover Loss)
# ==============================================================================

class PerdidaAnual(BaseModel):
    ano: int = Field(..., description="Año de la pérdida registrada.")
    perdida_ha: float = Field(..., description="Hectáreas de pérdida de cobertura arbórea.")
    emisiones_co2_mg: Optional[float] = Field(
        None, description="Emisiones brutas de carbono en Mg de CO2e si el pixel las reporta."
    )

class AnalisisHistoricoLoss(BaseModel):
    estado_consulta: EstadoConsulta = Field(
        ..., description="Estado de la consulta: 'exitosa', 'no_disponible' o 'error'."
    )
    perdida_acumulada_ha: Optional[float] = Field(
        None, description="Pérdida acumulada total durante el período disponible del dataset."
    )
    porcentaje_perdida: Optional[float] = Field(
        None, description="Porcentaje del predio que ha experimentado pérdida de cobertura."
    )
    ano_mayor_perdida: Optional[int] = Field(
        None, description="Año con el pico máximo de pérdida histórica detectada."
    )
    historico: List[PerdidaAnual] = Field(
        default_factory=list, description="Desglose año por año para el gráfico de barras."
    )
    mensaje: Optional[str] = Field(
        None, description="Mensaje explicativo del estado o causa de error en la consulta."
    )


# ==============================================================================
# 2. MODELOS DE CONSULTA 2: ALERTAS INTEGRADAS (GFW Integrated Alerts)
# ==============================================================================

class AlertaTemporal(BaseModel):
    fecha: date = Field(..., description="Fecha de detección satelital validada.")
    confianza: NivelConfianzaAlerta = Field(
        ..., description="Nivel de confianza nativo de GFW: 'high', 'nominal' o 'low'."
    )
    cantidad: int = Field(..., description="Número de celdas/alertas detectadas en esa fecha.")

class AnalisisAlertas(BaseModel):
    estado_consulta: EstadoConsulta = Field(
        ..., description="Estado de la consulta: 'exitosa', 'no_disponible' o 'error'."
    )
    periodo: str = Field(
        ..., description="Descripción del periodo analizado (ej. 'post_2020' o 'ultimos_90_dias')."
    )
    fecha_inicio: Optional[date] = Field(None, description="Fecha de inicio del filtro temporal.")
    fecha_fin: Optional[date] = Field(None, description="Fecha de fin del filtro temporal.")
    total_registros: Optional[int] = Field(
        None, description="Total de celdas devueltas por el raster satelital."
    )
    alta_confianza: Optional[int] = Field(
        None, description="Alertas con confianza alta ('high')."
    )
    confianza_nominal: Optional[int] = Field(
        None, description="Alertas con confianza nominal ('nominal')."
    )
    baja_confianza: Optional[int] = Field(
        None, description="Alertas con confianza baja ('low')."
    )
    superficie_alertada_ha: Optional[float] = Field(
        None,
        description="Superficie acumulada de celdas de alerta (SUM(area__ha)). Representa área bruta de píxeles y puede incluir solapamiento temporal de detecciones."
    )
    serie_temporal: List[AlertaTemporal] = Field(
        default_factory=list, description="Línea de tiempo de alertas para alimentar gráficos."
    )
    mensaje: Optional[str] = Field(
        None, description="Mensaje explicativo del estado de las alertas."
    )


# ==============================================================================
# 3. EVALUACIÓN Y METODOLOGÍA DEL RIESGO
# ==============================================================================

class EvaluacionRiesgo(BaseModel):
    nivel_riesgo: NivelRiesgo = Field(
        ..., description="Nivel de riesgo: 'Bajo', 'Medio', 'Alto' o 'No evaluable'."
    )
    metodologia: str = Field(
        "Criterio experimental propuesto para el MVP de Raizul (sujeto a validación agronómica): "
        "Alto: pérdida acumulada >15% o >=5 alertas de alta confianza; "
        "Medio: pérdida acumulada >3% o presencia de alertas relevantes; "
        "Bajo: ambas consultas exitosas y umbrales no superados; "
        "No evaluable: área <=0 o información satelital insuficiente.",
        description="Documentación explícita de los umbrales metodológicos aplicados."
    )
    justificacion: str = Field(
        ..., description="Explicación detallada del resultado para este predio."
    )


# ==============================================================================
# 4. CONTRATO OFICIAL EXIGIDO POR RAIZUL
# ==============================================================================

class ForestSummary(BaseModel):
    current_tree_cover_pct: float = Field(
        ..., description="Porcentaje estimado de cobertura arbórea actual."
    )
    deforestation_risk_level: RiskLevelEn = Field(
        ..., description="Nivel de riesgo de deforestación ('Low', 'Medium', 'High', 'Not evaluable')."
    )
    critical_alert: bool = Field(
        ..., description="Indicador booleano de alertas críticas detectadas."
    )

class TreeCoverLossEntry(BaseModel):
    year: int = Field(..., description="Año de la pérdida registrada.")
    hectares_lost: float = Field(..., description="Hectáreas de pérdida de cobertura arbórea.")


# ==============================================================================
# 5. RESPUESTA CONSOLIDADA DE LA API (POST /analisis-forestal)
# ==============================================================================

class AnalisisForestalResponse(BaseModel):
    # --------------------------------------------------------------------------
    # Contrato Oficial Especificado por Raizul
    # --------------------------------------------------------------------------
    farm_id: str = Field(..., description="Identificador único del predio cacaotero.")
    polygon_valid: bool = Field(True, description="Indicador de validez topológica del polígono.")
    area_hectares: float = Field(..., description="Área superficial en hectáreas calculada.")
    forest_summary: ForestSummary = Field(..., description="Resumen forestal con cobertura y riesgo.")
    tree_cover_loss_history: List[TreeCoverLossEntry] = Field(..., description="Histórico de pérdida anual.")
    analysis_timestamp: str = Field(..., description="Estampa de tiempo ISO 8601 del análisis.")

    # --------------------------------------------------------------------------
    # Campos Extendidos para el Frontend (Mapa y Gráficos)
    # --------------------------------------------------------------------------
    exito: bool = Field(True, description="True si al menos una fuente de datos pudo consultarse.")
    estado_general: EstadoGeneral = Field(
        "completo", description="Representa el estado conjunto de ambas fuentes: 'completo', 'parcial' o 'fallido'."
    )
    geostore_id: str = Field(..., description="ID canónico del polígono en GFW Geostore.")
    area_total_ha: float = Field(..., description="Área superficial del predio calculada por GFW.")
    bbox: List[float] = Field(..., description="Bounding box del predio [min_lon, min_lat, max_lon, max_lat].")
    analisis_historico: AnalisisHistoricoLoss = Field(..., description="Resultados del dataset UMD Loss.")
    analisis_alertas: AnalisisAlertas = Field(..., description="Resultados del dataset Integrated Alerts.")
    evaluacion_riesgo: EvaluacionRiesgo = Field(..., description="Dictamen de riesgo ambiental documentado.")
    geometria_procesada: Dict[str, Any] = Field(..., description="Geometría validada enviada al Geostore.")
    fuente: str = Field(
        "Global Forest Watch Data API",
        description="Fuente de los datos consultados."
    )

    @field_validator("bbox")
    @classmethod
    def validar_bbox(cls, value: List[float]) -> List[float]:
        """
        Valida que el Bounding Box 2D contenga exactamente 4 números finitos
        [west, south, east, north] en rangos válidos WGS84 y en orden geográfico correcto.
        """
        if len(value) != 4:
            raise ValueError("El Bounding Box 2D requiere exactamente 4 coordenadas [west, south, east, north].")
        if not all(math.isfinite(v) and not isinstance(v, bool) for v in value):
            raise ValueError("El Bounding Box contiene valores no numéricos o infinitos.")
        west, south, east, north = value
        if not (-180.0 <= west <= 180.0 and -180.0 <= east <= 180.0):
            raise ValueError("Longitudes del Bounding Box fuera del rango WGS84 [-180, 180].")
        if not (-90.0 <= south <= 90.0 and -90.0 <= north <= 90.0):
            raise ValueError("Latitudes del Bounding Box fuera del rango WGS84 [-90, 90].")
        if west > east or south > north:
            raise ValueError("Orden incorrecto en los límites geográficos del Bounding Box (se espera west <= east y south <= north).")
        return value
