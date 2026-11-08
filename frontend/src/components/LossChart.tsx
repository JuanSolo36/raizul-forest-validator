import React, { useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Alert
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import TableRowsIcon from '@mui/icons-material/TableRows';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { PerdidaAnual } from '../types';

interface LossChartProps {
  historico: PerdidaAnual[];
  anoPico?: number | null;
}

export const LossChart: React.FC<LossChartProps> = ({ historico, anoPico }) => {
  const [viewMode, setViewMode] = useState<'chart' | 'table'>('chart');

  if (!historico || historico.length === 0) {
    return (
      <Paper elevation={2} sx={{ p: 3, borderRadius: 2 }}>
        <Typography variant="h6" fontWeight={600} color="#1b4d3e" gutterBottom>
          Histórico de Pérdida de Cobertura Arbórea
        </Typography>
        <Alert severity="info" sx={{ mt: 1 }}>
          No se registró pérdida histórica de cobertura arbórea detectada por satélite en este predio.
        </Alert>
      </Paper>
    );
  }

  // Ordenar cronológicamente por año
  const data = [...historico].sort((a, b) => a.ano - b.ano);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const item = payload[0].payload as PerdidaAnual;
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
          <Typography variant="subtitle2" fontWeight={700} sx={{ color: '#38bdf8' }}>
            Año {label}
          </Typography>
          <Box sx={{ mt: 0.5 }}>
            <div>Pérdida arbórea: <b>{item.perdida_ha.toFixed(3)} ha</b></div>
            {item.emisiones_co2_mg !== undefined && item.emisiones_co2_mg !== null && (
              <div>Emisiones CO₂: <b>{item.emisiones_co2_mg.toFixed(1)} Mg</b></div>
            )}
          </Box>
        </Box>
      );
    }
    return null;
  };

  return (
    <Paper elevation={2} sx={{ p: 2.5, borderRadius: 2, backgroundColor: '#ffffff' }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2, flexWrap: 'wrap', gap: 1 }}>
        <Box>
          <Typography variant="subtitle1" fontWeight={700} color="#1b4d3e">
            Evolución Anual de Pérdida de Cobertura Arbórea
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Dataset UMD Tree Cover Loss (Global Forest Watch / Hansen)
          </Typography>
        </Box>

        <ToggleButtonGroup
          value={viewMode}
          exclusive
          onChange={(_e, val) => val && setViewMode(val)}
          size="small"
        >
          <ToggleButton value="chart">
            <BarChartIcon fontSize="small" sx={{ mr: 0.5 }} /> Gráfico
          </ToggleButton>
          <ToggleButton value="table">
            <TableRowsIcon fontSize="small" sx={{ mr: 0.5 }} /> Tabla
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {viewMode === 'chart' ? (
        <Box sx={{ width: '100%', height: 300 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} margin={{ top: 15, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
              <XAxis
                dataKey="ano"
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: '#64748b' }}
                tickLine={false}
                axisLine={{ stroke: '#cbd5e1' }}
                unit=" ha"
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="perdida_ha" radius={[4, 4, 0, 0]}>
                {data.map((entry) => (
                  <Cell
                    key={`cell-${entry.ano}`}
                    fill={entry.ano === anoPico ? '#dc2626' : '#d97706'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Box>
      ) : (
        <TableContainer sx={{ maxHeight: 300 }}>
          <Table size="small" stickyHeader>
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontWeight: 600 }}>Año</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Pérdida Cobertura (ha)</TableCell>
                <TableCell align="right" sx={{ fontWeight: 600 }}>Emisiones CO₂ (Mg / Ton)</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {data.map((row) => (
                <TableRow
                  key={row.ano}
                  sx={{
                    backgroundColor: row.ano === anoPico ? 'rgba(239, 68, 68, 0.08)' : 'inherit'
                  }}
                >
                  <TableCell component="th" scope="row">
                    <b>{row.ano}</b>{' '}
                    {row.ano === anoPico && (
                      <span style={{ color: '#dc2626', fontSize: '11px', fontWeight: 600 }}>
                        (Pico máx.)
                      </span>
                    )}
                  </TableCell>
                  <TableCell align="right">{row.perdida_ha.toFixed(4)} ha</TableCell>
                  <TableCell align="right">
                    {row.emisiones_co2_mg !== null && row.emisiones_co2_mg !== undefined
                      ? `${row.emisiones_co2_mg.toFixed(2)} Mg`
                      : 'N/A'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
    </Paper>
  );
};
