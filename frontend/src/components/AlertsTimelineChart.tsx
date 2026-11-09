import React from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  Chip
} from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { AlertaTemporal, EstadoConsulta } from '../types';

interface AlertsTimelineChartProps {
  serieTemporal: AlertaTemporal[];
  periodo?: string;
  totalAlertas?: number | null;
  estadoConsulta?: EstadoConsulta;
  mensaje?: string | null;
}

export const AlertsTimelineChart: React.FC<AlertsTimelineChartProps> = ({
  serieTemporal,
  periodo,
  totalAlertas,
  estadoConsulta = 'exitosa',
  mensaje
}) => {
  if (
    !serieTemporal ||
    serieTemporal.length === 0 ||
    (totalAlertas !== undefined && totalAlertas === 0) ||
    estadoConsulta !== 'exitosa'
  ) {
    return (
      <Paper elevation={2} sx={{ p: 2.5, borderRadius: 2, backgroundColor: '#ffffff' }}>
        <Typography variant="subtitle1" fontWeight={700} color="#1b4d3e" gutterBottom>
          Evolución de Alertas Satelitales (GFW Integrated Alerts)
        </Typography>

        {estadoConsulta === 'error' && (
          <Alert severity="error" sx={{ mt: 1, borderRadius: 2 }}>
            <strong>Fallo en la consulta:</strong> Ocurrió un error al consultar las alertas satelitales recientes en Global Forest Watch. {mensaje ? `Detalle: ${mensaje}` : 'Intente nuevamente.'}
          </Alert>
        )}

        {estadoConsulta === 'no_disponible' && (
          <Alert severity="warning" sx={{ mt: 1, borderRadius: 2 }}>
            <strong>Alertas no disponibles:</strong> El servicio satelital de alertas integradas no respondió temporalmente. <em>Nota importante:</em> La falta de telemetría de alertas no certifica la ausencia de deforestación.
          </Alert>
        )}

        {estadoConsulta === 'exitosa' && (
          <Alert severity="success" sx={{ mt: 1, borderRadius: 2 }}>
            <strong>Sin alertas satelitales registradas:</strong> No se detectaron eventos de pérdida en el dataset integrado (GLAD/RADD) para el periodo analizado ({periodo ?? 'post-2020'}). <em>Nota:</em> La telemetría satelital complementa, pero no sustituye, las auditorías de campo.
          </Alert>
        )}
      </Paper>
    );
  }

  // Agrupar los registros por fecha para crear barras apiladas por nivel de confianza
  const agrupadoPorFecha: { [fecha: string]: { fecha: string; high: number; nominal: number; low: number; total: number } } = {};

  serieTemporal.forEach((item) => {
    if (!agrupadoPorFecha[item.fecha]) {
      agrupadoPorFecha[item.fecha] = {
        fecha: item.fecha,
        high: 0,
        nominal: 0,
        low: 0,
        total: 0
      };
    }
    agrupadoPorFecha[item.fecha][item.confianza] += item.cantidad;
    agrupadoPorFecha[item.fecha].total += item.cantidad;
  });

  // Convertir a lista y ordenar cronológicamente
  const data = Object.values(agrupadoPorFecha).sort((a, b) => a.fecha.localeCompare(b.fecha));

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload;
      return (
        <Box
          sx={{
            backgroundColor: 'rgba(15, 23, 42, 0.94)',
            color: '#ffffff',
            p: 1.5,
            borderRadius: 1.5,
            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.2)',
            fontSize: '0.85rem'
          }}
        >
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#f87171' }}>
            Fecha: {label}
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <div style={{ color: '#ef4444' }}>• Alta confianza: <b>{item.high}</b></div>
            <div style={{ color: '#f59e0b' }}>• Confianza nominal: <b>{item.nominal}</b></div>
            <div style={{ color: '#94a3b8' }}>• Baja confianza: <b>{item.low}</b></div>
            <div style={{ marginTop: '4px', borderTop: '1px solid #334155', paddingTop: '4px' }}>
              Total detecciones: <b>{item.total}</b>
            </div>
          </Box>
        </Box>
      );
    }
    return null;
  };

  return (
    <Paper elevation={2} sx={{ p: 2.5, borderRadius: 2, backgroundColor: '#ffffff' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} color="#1b4d3e">
            Distribución Temporal de Alertas Satelitales
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Dataset GFW Integrated Alerts (Sistemas GLAD-L, GLAD-S2 y RADD)
          </Typography>
        </Box>
        <Chip
          label={`${totalAlertas ?? data.reduce((acc, curr) => acc + curr.total, 0)} Alertas`}
          color="error"
          size="small"
          sx={{ fontWeight: 700 }}
        />
      </Box>

      <Box sx={{ width: '100%', height: 280 }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 15, right: 20, left: 0, bottom: 25 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
            <XAxis
              dataKey="fecha"
              tick={{ fontSize: 11, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              angle={-20}
              textAnchor="end"
            />
            <YAxis
              tick={{ fontSize: 12, fill: '#64748b' }}
              tickLine={false}
              axisLine={{ stroke: '#cbd5e1' }}
              allowDecimals={false}
              unit=" celdas"
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              verticalAlign="top"
              height={36}
              formatter={(value) => {
                if (value === 'high') return <span style={{ color: '#dc2626', fontWeight: 600 }}>Alta confianza</span>;
                if (value === 'nominal') return <span style={{ color: '#d97706', fontWeight: 600 }}>Nominal</span>;
                return <span style={{ color: '#64748b' }}>Baja confianza</span>;
              }}
            />
            <Bar dataKey="high" stackId="alertas" fill="#dc2626" radius={[0, 0, 0, 0]} />
            <Bar dataKey="nominal" stackId="alertas" fill="#f59e0b" radius={[0, 0, 0, 0]} />
            <Bar dataKey="low" stackId="alertas" fill="#94a3b8" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Paper>
  );
};
