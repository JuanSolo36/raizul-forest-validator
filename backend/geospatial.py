import math
from typing import Any, Dict, List, Tuple, Optional
from shapely.geometry import shape
from shapely.validation import explain_validity

class GeoJSONValidationException(ValueError):
    """Excepción específica para errores de validación y normalización de GeoJSON."""
    pass

POLYGON_TYPES = {"Polygon", "MultiPolygon"}


def validate_coordinates_wgs84(coords: Any) -> None:
    #Valida recursivamente que cada punto sea numérico, finito (no NaN/Inf),
    #no booleano y pertenezca al estándar GeoJSON RFC 7946 (WGS84 EPSG:4326).
    #Detecta y advierte si los números parecen coordenadas proyectadas en metros.
    if not isinstance(coords, (list, tuple)) or not coords:
        raise GeoJSONValidationException(
            "Las coordenadas están vacías o tienen una estructura incorrecta."
        )

    # Identificar si estamos ante un par de coordenadas [lon, lat]
    if all(isinstance(v, (int, float)) and not isinstance(v, bool) for v in coords):
        if len(coords) < 2:
            raise GeoJSONValidationException(
                "Cada punto debe contener al menos longitud y latitud [lon, lat]."
            )
        lon, lat = coords[0], coords[1]

        if not math.isfinite(lon) or not math.isfinite(lat):
            raise GeoJSONValidationException(
                f"Las coordenadas deben ser números finitos. Se recibió: [{lon}, {lat}]."
            )
        if not (-180.0 <= lon <= 180.0):
            if abs(lon) > 1000:
                raise GeoJSONValidationException(
                    f"Longitud inválida {lon}. El valor parece pertenecer a un sistema de coordenadas proyectadas en metros "
                    "(ej. MAGNA-SIRGAS o UTM). El estándar GeoJSON RFC 7946 requiere grados decimales WGS84 (EPSG:4326) entre -180 y 180."
                )
            raise GeoJSONValidationException(
                f"Longitud inválida {lon}. Debe estar en el rango [-180, 180] (EPSG:4326)."
            )
        if not (-90.0 <= lat <= 90.0):
            if abs(lat) > 1000:
                raise GeoJSONValidationException(
                    f"Latitud inválida {lat}. El valor parece pertenecer a un sistema de coordenadas proyectadas en metros. "
                    "El estándar GeoJSON RFC 7946 requiere grados decimales WGS84 (EPSG:4326) entre -90 y 90."
                )
            raise GeoJSONValidationException(
                f"Latitud inválida {lat}. Debe estar en el rango [-90, 90] (EPSG:4326)."
            )
    else:
        # Continuar navegando los anillos y polígonos anidados
        for sub_coords in coords:
            validate_coordinates_wgs84(sub_coords)


def _validar_anillo_cerrado(ring: List[Any], nombre_anillo: str = "anillo") -> None:
    #Comprobación de que un anillo lineal tenga mínimo 4 puntos y esté cerrado.
    if len(ring) < 4:
        raise GeoJSONValidationException(
            f"Cada {nombre_anillo} debe tener al menos 4 puntos (3 vértices y el punto de cierre)."
        )
    if ring[0] != ring[-1]:
        raise GeoJSONValidationException(
            f"El {nombre_anillo} no está cerrado: el primer punto {ring[0]} no coincide con el último {ring[-1]}."
        )


def extract_polygon_geometry(raw_data: Dict[str, Any]) -> Tuple[Dict[str, Any], str, Dict[str, Any]]:
    #Función de extracción y normalización GeoJSON:
    #- Admite Polygon, MultiPolygon, Feature y FeatureCollection.
    #- Extrae la geometría poligonal, el farm_id y las properties.
    #- Rechaza amablemente Point, MultiPoint, LineString, MultiLineString y GeometryCollection.
    #- Rechaza colecciones ambiguas con múltiples polígonos pidiendo selección.
    
    if not isinstance(raw_data, dict):
        raise GeoJSONValidationException("El GeoJSON debe ser un objeto válido.")

    geo_type = raw_data.get("type")

    # Rechazo explícito de geometrías no superficiales
    if geo_type in ["Point", "MultiPoint", "LineString", "MultiLineString"]:
        raise GeoJSONValidationException(
            f"Geometría tipo '{geo_type}' no compatible para análisis forestal de superficie. "
            "Se requiere una delimitación de área predial mediante Polygon o MultiPolygon."
        )

    if geo_type == "GeometryCollection":
        raise GeoJSONValidationException(
            "El tipo GeometryCollection no es directamente compatible. "
            "Por favor proporcione directamente la geometría Polygon o MultiPolygon del predio."
        )

    geometry: Optional[Dict[str, Any]] = None
    farm_id: str = "predio_01"
    properties: Dict[str, Any] = {}

    # Caso 1: Polygon o MultiPolygon directo
    if geo_type in POLYGON_TYPES:
        geometry = raw_data
        farm_id = raw_data.get("id") or "predio_directo"

    # Caso 2: Feature
    elif geo_type == "Feature":
        properties = raw_data.get("properties") or {}
        farm_id = properties.get("farm_id") or properties.get("id") or raw_data.get("id") or "finca_sin_id"

        geom = raw_data.get("geometry")
        if not isinstance(geom, dict):
            raise GeoJSONValidationException("El Feature no contiene una geometría válida.")
        tipo_geom = geom.get("type")
        if tipo_geom in ["Point", "MultiPoint", "LineString", "MultiLineString"]:
            raise GeoJSONValidationException(
                f"La geometría '{tipo_geom}' dentro del Feature no representa una superficie predial. "
                "Se requiere Polygon o MultiPolygon."
            )
        if tipo_geom not in POLYGON_TYPES:
            raise GeoJSONValidationException("La finca debe tener geometría Polygon o MultiPolygon.")
        geometry = geom

    # Caso 3: FeatureCollection
    elif geo_type == "FeatureCollection":
        features = raw_data.get("features")
        if not isinstance(features, list) or not features:
            raise GeoJSONValidationException("FeatureCollection no contiene Features.")

        polygons = []
        features_validos = []
        for index, feature in enumerate(features):
            if not isinstance(feature, dict):
                raise GeoJSONValidationException(f"Feature {index} tiene una estructura incorrecta.")
            if feature.get("type") != "Feature":
                raise GeoJSONValidationException(f"Elemento {index} no es un Feature.")
            g = feature.get("geometry")
            if g is None:
                continue
            if not isinstance(g, dict):
                raise GeoJSONValidationException(f"Geometry del Feature {index} es inválida.")
            if g.get("type") in POLYGON_TYPES:
                polygons.append(g)
                features_validos.append(feature)

        if not polygons:
            raise GeoJSONValidationException("No encontramos ninguna geometría poligonal.")
        if len(polygons) > 1:
            raise GeoJSONValidationException(
                f"El archivo contiene {len(polygons)} fincas/lotes. "
                "Seleccione una antes de realizar el análisis o combínelos."
            )

        geometry = polygons[0]
        selected_feat = features_validos[0]
        properties = selected_feat.get("properties") or {}
        farm_id = properties.get("farm_id") or properties.get("id") or "finca_coleccion_01"

    else:
        raise GeoJSONValidationException(
            f"Tipo GeoJSON no compatible: '{geo_type}'. Se requiere Polygon, MultiPolygon, Feature o FeatureCollection."
        )

    return geometry, farm_id, properties


def normalize_geojson(raw_data: Dict[str, Any]) -> Tuple[Dict[str, Any], str, Dict[str, Any]]:
    #Pipeline completo de normalización y validación:
    #1. Extrae la geometría poligonal y el farm_id de cualquier contenedor GeoJSON.
    #2. Valida coordenadas en grados decimales WGS84 (EPSG:4326 RFC 7946).
    #3. Comprueba el cierre de anillos exteriores e interiores.
    #4. Valida consistencia topológica con Shapely (no vacía, válida).

    geometry, farm_id, properties = extract_polygon_geometry(raw_data)

    coords = geometry.get("coordinates")
    if not coords or not isinstance(coords, list):
        raise GeoJSONValidationException("La geometría no contiene coordenadas válidas.")

    # 1. Validación de números finitos y rango WGS84
    validate_coordinates_wgs84(coords)

    # 2. Validación de cierre de anillos para Polygon y MultiPolygon
    if geometry["type"] == "Polygon":
        for idx, ring in enumerate(coords):
            _validar_anillo_cerrado(ring, f"anillo {idx + 1} del polígono")
    elif geometry["type"] == "MultiPolygon":
        for p_idx, poly in enumerate(coords):
            for r_idx, ring in enumerate(poly):
                _validar_anillo_cerrado(ring, f"anillo {r_idx + 1} de la parte {p_idx + 1} del MultiPolygon")

    # 3. Validación matemática y topológica con Shapely
    try:
        geom_shape = shape(geometry)
        if geom_shape.is_empty:
            raise GeoJSONValidationException("La geometría está vacía (no contiene área ni vértices).")
        if geom_shape.geom_type not in ("Polygon", "MultiPolygon"):
            raise GeoJSONValidationException(
                f"La geometría procesada es de tipo '{geom_shape.geom_type}', no una superficie poligonal válida."
            )
        if not geom_shape.is_valid:
            razon = explain_validity(geom_shape)
            raise GeoJSONValidationException(f"Geometría no válida según estándares topológicos: {razon}")
    except Exception as e:
        if isinstance(e, GeoJSONValidationException):
            raise e
        raise GeoJSONValidationException(f"Error al analizar la geometría con Shapely: {str(e)}")

    return geometry, farm_id, properties
