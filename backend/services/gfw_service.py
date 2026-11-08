import logging
from datetime import date, datetime, timezone
from typing import Dict, Any, List, Tuple, Optional
import httpx
from fastapi import HTTPException

from config import settings
from schemas.geojson_models import (
    PerdidaAnual,
    AnalisisHistoricoLoss,
    AlertaTemporal,
    AnalisisAlertas,
    EvaluacionRiesgo,
    AnalisisForestalResponse,
    ForestSummary,
    TreeCoverLossEntry,
    EstadoGeneral
)

logger = logging.getLogger(__name__)

class GFWService:
    #Servicio encargado de la comunicación asíncrona con Global Forest Watch.
    #Maneja el registro en Geostore y ejecuta de forma desacoplada la Consulta 1
    #(UMD Tree Cover Loss) y la Consulta 2 (GFW Integrated Alerts).
    def __init__(self):
        self.base_url = settings.GFW_DATA_API_BASE
        self.headers = {
            "Content-Type": "application/json",
            "x-api-key": settings.GFW_API_KEY,
            "origin": settings.GFW_ORIGIN_HEADER
        }
        self.timeout = settings.GFW_TIMEOUT_SECONDS
        # Cliente HTTP asíncrono compartido con pool de conexiones y redirecciones activadas
        self._client: Optional[httpx.AsyncClient] = None

    def _get_client(self) -> httpx.AsyncClient:
        """Obtiene o inicializa el cliente HTTP persistente."""
        if self._client is None or self._client.is_closed:
            self._client = httpx.AsyncClient(
                timeout=self.timeout,
                follow_redirects=True,
                headers=self.headers
            )
        return self._client

    async def close(self):
        #Cierra el pool de conexiones cuando la aplicación se apaga.
        if self._client and not self._client.is_closed:
            await self._client.aclose()

    async def register_geostore(self, geometry: Dict[str, Any]) -> Dict[str, Any]:
        #Paso 1: Registra la geometría en GFW Geostore enviando las cabeceras completas (API Key y Origin).
        url = f"{self.base_url}/geostore"
        payload = {"geometry": geometry}
        client = self._get_client()

        try:
            response = await client.post(url, json=payload)

            if response.status_code not in (200, 201):
                logger.error(f"Error en Geostore: {response.status_code} - {response.text}")
                raise HTTPException(
                    status_code=502,
                    detail=f"Error al registrar polígono en GFW Geostore: {response.text}"
                )

            data = response.json().get("data", {})
            geostore_id = data.get("gfw_geostore_id")
            area_ha = data.get("gfw_area__ha", 0.0)
            bbox = data.get("gfw_bbox", [])

            if not geostore_id:
                raise HTTPException(
                    status_code=502,
                    detail="GFW Geostore no retornó un 'gfw_geostore_id' válido."
                )

            return {
                "geostore_id": geostore_id,
                "area_ha": round(float(area_ha), 4),
                "bbox": bbox
            }
        except httpx.RequestError as exc:
            logger.error(f"Error de red con GFW Geostore: {exc}")
            raise HTTPException(
                status_code=504,
                detail=f"Timeout o error de conexión con GFW Geostore: {str(exc)}"
            )

    async def get_tree_cover_loss(
        self,
        geostore_id: str,
        area_total_ha: float
    ) -> AnalisisHistoricoLoss:
        #Consulta 1: Serie histórica de pérdida de cobertura arbórea (UMD Tree Cover Loss).
        #Utiliza 'FROM results' según la documentación técnica de GFW.
        url = f"{self.base_url}/dataset/umd_tree_cover_loss/latest/query/json"
        sql = (
            "SELECT umd_tree_cover_loss__year as year, "
            "SUM(area__ha) as loss_area_ha, "
            "SUM(gfw_forest_carbon_gross_emissions__Mg_CO2e) as co2_emissions_mg "
            "FROM results "
            "GROUP BY umd_tree_cover_loss__year "
            "ORDER BY umd_tree_cover_loss__year"
        )
        client = self._get_client()

        try:
            response = await client.get(url, params={"geostore_id": geostore_id, "sql": sql})

            if response.status_code != 200:
                logger.error(f"Error en consulta UMD Loss: {response.status_code} - {response.text}")
                return AnalisisHistoricoLoss(
                    estado_consulta="no_disponible",
                    mensaje=f"GFW no pudo responder la consulta histórica (HTTP {response.status_code})."
                )

            results = response.json().get("data", [])
            historico: List[PerdidaAnual] = []

            for row in results:
                year = row.get("year")
                loss_ha = row.get("loss_area_ha") or 0.0
                co2 = row.get("co2_emissions_mg")
                if year is not None:
                    historico.append(
                        PerdidaAnual(
                            ano=int(year),
                            perdida_ha=round(float(loss_ha), 4),
                            emisiones_co2_mg=round(float(co2), 2) if co2 is not None else None
                        )
                    )

            perdida_acumulada = round(sum(p.perdida_ha for p in historico), 4)
            pct = round((perdida_acumulada / area_total_ha) * 100.0, 2) if area_total_ha > 0 else 0.0
            ano_pico = max(historico, key=lambda p: p.perdida_ha).ano if historico else None

            return AnalisisHistoricoLoss(
                estado_consulta="exitosa",
                perdida_acumulada_ha=perdida_acumulada,
                porcentaje_perdida=pct,
                ano_mayor_perdida=ano_pico,
                historico=historico,
                mensaje="Consulta histórica procesada con éxito."
            )

        except Exception as exc:
            logger.error(f"Fallo de conexión consultando UMD Loss: {exc}")
            return AnalisisHistoricoLoss(
                estado_consulta="no_disponible",
                mensaje=f"Error de conexión con el dataset de pérdida histórica: {str(exc)}"
            )

    async def get_integrated_alerts(
        self,
        geostore_id: str,
        fecha_inicio: Optional[date] = date(2020, 12, 31),
        fecha_fin: Optional[date] = None,
        periodo_nombre: str = "post_2020"
    ) -> AnalisisAlertas:
        #Consulta 2: Alertas integradas recientes (GLAD-L, GLAD-S2, RADD).
        #Calcula superficie alertada (SUM(area__ha)) y separa las 3 confianzas (high, nominal, low).
        url = f"{self.base_url}/dataset/gfw_integrated_alerts/latest/query/json"
        client = self._get_client()

        # Construcción del filtro WHERE por fechas
        filtros = []
        if fecha_inicio:
            filtros.append(f"gfw_integrated_alerts__date >= '{fecha_inicio.isoformat()}'")
        if fecha_fin:
            filtros.append(f"gfw_integrated_alerts__date <= '{fecha_fin.isoformat()}'")

        where_clause = f"WHERE {' AND '.join(filtros)}" if filtros else ""

        # Consulta de agregación: registros y superficie de celdas por confianza
        sql_agregado = f"""
        SELECT gfw_integrated_alerts__confidence as confidence, 
                count(*) as count, 
                SUM(area__ha) as superficie_ha 
        FROM results 
        {where_clause} 
        GROUP BY gfw_integrated_alerts__confidence
        """

        # Consulta cronológica: serie temporal para gráficos
        sql_timeline = f"""
        SELECT gfw_integrated_alerts__date as alert_date, 
                gfw_integrated_alerts__confidence as confidence, 
                count(*) as count 
        FROM results 
        {where_clause} 
        GROUP BY gfw_integrated_alerts__date, gfw_integrated_alerts__confidence 
        ORDER BY gfw_integrated_alerts__date DESC 
        LIMIT 50
        """

        try:
            resp_agregado = await client.get(
                url, params={"geostore_id": geostore_id, "sql": sql_agregado.strip()}
            )

            if resp_agregado.status_code != 200:
                logger.warning(f"GFW Alerts no disponible (Status {resp_agregado.status_code}).")
                return AnalisisAlertas(
                    estado_consulta="no_disponible",
                    periodo=periodo_nombre,
                    fecha_inicio=fecha_inicio,
                    fecha_fin=fecha_fin,
                    mensaje="El servicio de alertas satelitales no respondió o está temporalmente fuera de servicio."
                )

            data_agregada = resp_agregado.json().get("data", [])
            alta = 0
            nominal = 0
            baja = 0
            superficie_acumulada = 0.0

            for fila in data_agregada:
                conf = str(fila.get("confidence", "")).lower()
                cantidad = int(fila.get("count", 0))
                sup = float(fila.get("superficie_ha") or 0.0)
                superficie_acumulada += sup

                if conf in ["high", "highest"]:
                    alta += cantidad
                elif conf == "nominal":
                    nominal += cantidad
                elif conf == "low":
                    baja += cantidad

            total_registros = alta + nominal + baja

            # Serie temporal para gráficos
            serie_temporal: List[AlertaTemporal] = []
            resp_timeline = await client.get(
                url, params={"geostore_id": geostore_id, "sql": sql_timeline.strip()}
            )
            if resp_timeline.status_code == 200:
                for item in resp_timeline.json().get("data", []):
                    f_str = item.get("alert_date")
                    c_str = str(item.get("confidence", "")).lower()
                    cnt = int(item.get("count", 0))
                    if f_str and c_str in ["high", "nominal", "low"]:
                        try:
                            serie_temporal.append(
                                AlertaTemporal(
                                    fecha=date.fromisoformat(f_str),
                                    confianza=c_str,
                                    cantidad=cnt
                                )
                            )
                        except ValueError:
                            pass

            return AnalisisAlertas(
                estado_consulta="exitosa",
                periodo=periodo_nombre,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                total_registros=total_registros,
                alta_confianza=alta,
                confianza_nominal=nominal,
                baja_confianza=baja,
                superficie_alertada_ha=round(superficie_acumulada, 4),
                serie_temporal=serie_temporal,
                mensaje="Consulta de alertas procesada con éxito."
            )

        except Exception as exc:
            logger.error(f"Fallo consultando alertas: {exc}")
            return AnalisisAlertas(
                estado_consulta="no_disponible",
                periodo=periodo_nombre,
                fecha_inicio=fecha_inicio,
                fecha_fin=fecha_fin,
                mensaje=f"Error de red o timeout consultando alertas: {str(exc)}"
            )

    @staticmethod
    def calculate_environmental_risk(
        area_total_ha: float,
        historico: AnalisisHistoricoLoss,
        alertas: AnalisisAlertas
    ) -> EvaluacionRiesgo:
        #Paso 4: Metodología experimental documentada para el MVP de Raizul.
        # Si el área es inválida o ambas consultas fallaron, el predio es No Evaluable
        if area_total_ha <= 0 or (historico.estado_consulta != "exitosa" and alertas.estado_consulta != "exitosa"):
            return EvaluacionRiesgo(
                nivel_riesgo="No evaluable",
                justificacion="Información satelital insuficiente o área del predio no válida para emitir clasificación."
            )

        porcentaje = historico.porcentaje_perdida if historico.porcentaje_perdida is not None else 0.0
        alertas_alta = alertas.alta_confianza if alertas.alta_confianza is not None else 0
        total_alertas = alertas.total_registros if alertas.total_registros is not None else 0

        # Manejo de alerta cuando el servicio de alertas falló
        aviso_alertas = ""
        if alertas.estado_consulta != "exitosa":
            aviso_alertas = " (Nota: la capa satelital de alertas recientes no estuvo disponible; no se descarta perturbación reciente)."

        # 1. Nivel Alto
        if porcentaje > 15.0 or alertas_alta >= 5:
            return EvaluacionRiesgo(
                nivel_riesgo="Alto",
                justificacion=f"Riesgo Alto: Pérdida acumulada de {porcentaje:.1f}% o detección crítica de {alertas_alta} alertas de alta confianza.{aviso_alertas}"
            )
        # 2. Nivel Medio
        if porcentaje > 3.0 or total_alertas > 0 or alertas.estado_consulta != "exitosa":
            return EvaluacionRiesgo(
                nivel_riesgo="Medio",
                justificacion=f"Riesgo Medio: Pérdida acumulada del {porcentaje:.1f}% con {total_alertas} alertas detectadas.{aviso_alertas}"
            )

        # 3. Nivel Bajo (Solo si ambas consultas fueron exitosas y no superan los umbrales)
        if historico.estado_consulta == "exitosa" and alertas.estado_consulta == "exitosa":
            return EvaluacionRiesgo(
                nivel_riesgo="Bajo",
                justificacion=f"Riesgo Bajo: Cobertura arbórea estable. Pérdida acumulada de {porcentaje:.2f}% y cero alertas detectadas en el periodo analizado."
            )

        return EvaluacionRiesgo(
            nivel_riesgo="No evaluable",
            justificacion="No fue posible consolidar la evaluación con los datos disponibles."
        )

    async def analyze_polygon(
        self,
        geometry: Dict[str, Any],
        farm_id: str = 'finca_el_paraiso_01',
        fecha_inicio: Optional[date] = date(2020, 12, 31),
        fecha_fin: Optional[date] = None
    ) -> AnalisisForestalResponse:
        #Orquestador principal que ejecuta el Geostore y las dos consultas independientes,
        #calculando el EstadoGeneral (completo, parcial, fallido).
        #Registrar en Geostore
        geostore_data = await self.register_geostore(geometry)
        geostore_id = geostore_data["geostore_id"]
        area_total_ha = geostore_data["area_ha"]
        bbox = geostore_data["bbox"]

        #consulta 1: Histórico de pérdida
        analisis_historico = await self.get_tree_cover_loss(geostore_id, area_total_ha)

        #Consulta 2: Alertas integradas
        analisis_alertas = await self.get_integrated_alerts(
            geostore_id,
            fecha_inicio=fecha_inicio,
            fecha_fin=fecha_fin
        )

        #Determinar EstadoGeneral y Exito
        historico_ok = (analisis_historico.estado_consulta == "exitosa")
        alertas_ok = (analisis_alertas.estado_consulta == "exitosa")

        if historico_ok and alertas_ok:
            estado_general: EstadoGeneral = "completo"
        elif historico_ok or alertas_ok:
            estado_general: EstadoGeneral = "parcial"
        else:
            estado_general: EstadoGeneral = "fallido"

        exito = (estado_general != "fallido")

        #Evaluación de riesgo metodológica
        evaluacion_riesgo = self.calculate_environmental_risk(
            area_total_ha,
            analisis_historico,
            analisis_alertas
        )

        #Campos contrato oficial Raizul
        riesgo_en_map = {
            'Bajo': 'Low',
            'Medio': 'Medium',
            'Alto': 'High',
            'No evaluable': 'Not evaluable'
        }
        deforestation_risk_level = riesgo_en_map.get(evaluacion_riesgo.nivel_riesgo, 'Medium')
        altas = analisis_alertas.alta_confianza or 0
        critical_alert = (altas >= 5) or (evaluacion_riesgo.nivel_riesgo == 'Alto')
        pct_perdida = analisis_historico.porcentaje_perdida or 0.0
        current_tree_cover_pct = max(0.0, round(100.0 - pct_perdida, 1))

        tree_cover_loss_history = [
            TreeCoverLossEntry(
                year=item.ano,
                hectares_lost=round(item.perdida_ha, 2)
            )
            for item in analisis_historico.historico
        ]

        forest_summary = ForestSummary(
            current_tree_cover_pct=current_tree_cover_pct,
            deforestation_risk_level=deforestation_risk_level,
            critical_alert=critical_alert
        )
        analysis_timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%dT%H:%M:%SZ')

        return AnalisisForestalResponse(
            farm_id=farm_id,
            polygon_valid=True,
            area_hectares=round(area_total_ha, 2),
            forest_summary=forest_summary,
            tree_cover_loss_history=tree_cover_loss_history,
            analysis_timestamp=analysis_timestamp,
            exito=exito,
            estado_general=estado_general,
            geostore_id=geostore_id,
            area_total_ha=area_total_ha,
            bbox=bbox,
            analisis_historico=analisis_historico,
            analisis_alertas=analisis_alertas,
            evaluacion_riesgo=evaluacion_riesgo,
            geometria_procesada=geometry
        )

gfw_service = GFWService()