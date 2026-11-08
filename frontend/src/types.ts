export type EstadoConsulta = 'exitosa' | 'no_disponible' | 'error';
export type NivelConfianzaAlerta = 'high' | 'nominal' | 'low';
export type NivelRiesgo = 'Bajo' | 'Medio' | 'Alto' | 'No evaluable';
export type RiskLevelEn = 'Low' | 'Medium' | 'High' | 'Not evaluable';
export type EstadoGeneral = 'completo' | 'parcial' | 'fallido';

export interface ForestSummary {
  current_tree_cover_pct: number;
  deforestation_risk_level: RiskLevelEn;
  critical_alert: boolean;
}

export interface TreeCoverLossEntry {
  year: number;
  hectares_lost: number;
}

export interface PerdidaAnual {
  ano: number;
  perdida_ha: number;
  emisiones_co2_mg?: number | null;
}

export interface AnalisisHistoricoLoss {
  estado_consulta: EstadoConsulta;
  perdida_acumulada_ha?: number | null;
  porcentaje_perdida?: number | null;
  ano_mayor_perdida?: number | null;
  historico: PerdidaAnual[];
  mensaje?: string | null;
}

export interface AlertaTemporal {
  fecha: string;
  confianza: NivelConfianzaAlerta;
  cantidad: number;
}

export interface AnalisisAlertas {
  estado_consulta: EstadoConsulta;
  periodo: string;
  fecha_inicio?: string | null;
  fecha_fin?: string | null;
  total_registros?: number | null;
  alta_confianza?: number | null;
  confianza_nominal?: number | null;
  baja_confianza?: number | null;
  superficie_alertada_ha?: number | null;
  serie_temporal: AlertaTemporal[];
  mensaje?: string | null;
}

export interface EvaluacionRiesgo {
  nivel_riesgo: NivelRiesgo;
  metodologia: string;
  justificacion: string;
}

export interface AnalisisForestalResponse {
  // Contrato oficial de Raizul
  farm_id: string;
  polygon_valid: boolean;
  area_hectares: number;
  forest_summary: ForestSummary;
  tree_cover_loss_history: TreeCoverLossEntry[];
  analysis_timestamp: string;

  // Campos extendidos para la interfaz visual (mapa y gráficos)
  exito: boolean;
  estado_general: EstadoGeneral;
  geostore_id: string;
  area_total_ha: number;
  bbox: number[];
  analisis_historico: AnalisisHistoricoLoss;
  analisis_alertas: AnalisisAlertas;
  evaluacion_riesgo: EvaluacionRiesgo;
  geometria_procesada: any;
  fuente: string;
}

export interface SampleFarm {
  id: string;
  nombre: string;
  departamento: string;
  descripcion: string;
  geojson: any;
}
