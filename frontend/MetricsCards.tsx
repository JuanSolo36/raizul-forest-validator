import React from 'react';
import {
  Grid,
  Card,
  CardContent,
  Typography,
  Box,
  Chip,
  Tooltip,
  Alert,
  Divider
} from '@mui/material';
import LandscapeIcon from '@mui/icons-material/Landscape';
import ParkIcon from '@mui/icons-material/Park';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import ShieldIcon from '@mui/icons-material/Shield';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import { AnalisisForestalResponse, NivelRiesgo } from '../types';

interface MetricsCardsProps {
  data: AnalisisForestalResponse;
}

export const MetricsCards: React.FC<MetricsCardsProps> = ({ data }) => {
  const {
    area_total_ha,
    analisis_historico,
    analisis_alertas,
    evaluacion_riesgo,
    estado_general
  } = data;

  // Asignación de colores semánticos según el nivel de riesgo
  const getRiskChipColor = (nivel: NivelRiesgo) => {
    switch (nivel) {
      case 'Bajo':
        return 'success';
      case 'Medio':
        return 'warning';
      case 'Alto':
        return 'error';
      default:
        return 'default';
    }
  };

  return (
    <Box sx={{ mb: 3 }}>
      {/* Alerta de advertencia si la consulta fue PARCIAL */}
      {estado_general === 'parcial' && (
        <Alert severity="warning" sx={{ mb: 2, borderRadius: 2 }}>
          <strong>Atención:</strong> Consulta parcial. Una de las capas satelitales (pérdida histórica o alertas recientes)
          no estuvo disponible temporalmente en Global Forest Watch. La evaluación de riesgo toma en cuenta esta limitación.
        </Alert>
      )}

      <Grid container spacing={2}>
        {/* 1. Área Total de la Finca */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <LandscapeIcon sx={{ color: '#059669', mr: 1 }} />
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Área Superficial
                </Typography>
              </Box>
              <Typography variant="h4" fontWeight={700} color="#1e293b">
                {area_total_ha.toLocaleString('es-CO', { maximumFractionDigits: 2 })}
                <Typography component="span" variant="h6" color="text.secondary" sx={{ ml: 0.5 }}>
                  ha
                </Typography>
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Calculada por GFW Geostore
              </Typography>
            </CardContent>
          </Card>
        </Grid>

        {/* 2. Pérdida Histórica Acumulada */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <ParkIcon sx={{ color: '#d97706', mr: 1 }} />
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Pérdida Cobertura
                </Typography>
              </Box>
              {analisis_historico.estado_consulta === 'exitosa' ? (
                <>
                  <Typography variant="h4" fontWeight={700} color="#b45309">
                    {analisis_historico.perdida_acumulada_ha?.toLocaleString('es-CO', {
                      maximumFractionDigits: 2
                    }) ?? '0'}{' '}
                    <Typography component="span" variant="h6" color="text.secondary">
                      ha
                    </Typography>
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {analisis_historico.porcentaje_perdida?.toFixed(2)}% del predio
                    {analisis_historico.ano_mayor_perdida &&
                      ` (Pico: ${analisis_historico.ano_mayor_perdida})`}
                  </Typography>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No disponible en GFW
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* 3. Alertas Satelitales Recientes */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2, height: '100%' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
                <WarningAmberIcon sx={{ color: '#dc2626', mr: 1 }} />
                <Typography variant="body2" color="text.secondary" fontWeight={500}>
                  Alertas Integradas
                </Typography>
              </Box>
              {analisis_alertas.estado_consulta === 'exitosa' ? (
                <>
                  <Typography variant="h4" fontWeight={700} color="#dc2626">
                    {analisis_alertas.total_registros ?? 0}
                    <Typography component="span" variant="caption" color="text.secondary" sx={{ ml: 1 }}>
                      detecciones
                    </Typography>
                  </Typography>
                  <Box sx={{ display: 'flex', gap: 0.5, mt: 0.5, flexWrap: 'wrap' }}>
                    <Chip
                      size="small"
                      label={`Alta: ${analisis_alertas.alta_confianza ?? 0}`}
                      color="error"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                    <Chip
                      size="small"
                      label={`Nominal: ${analisis_alertas.confianza_nominal ?? 0}`}
                      color="warning"
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                    <Chip
                      size="small"
                      label={`Baja: ${analisis_alertas.baja_confianza ?? 0}`}
                      variant="outlined"
                      sx={{ fontSize: '0.7rem' }}
                    />
                  </Box>
                </>
              ) : (
                <Typography variant="body2" color="text.secondary">
                  No disponible en GFW
                </Typography>
              )}
            </CardContent>
          </Card>
        </Grid>

        {/* 4. Dictamen y Nivel de Riesgo Agroforestal */}
        <Grid item xs={12} sm={6} md={3}>
          <Card elevation={2} sx={{ borderRadius: 2, height: '100%', bgcolor: '#f8fafc' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
                <Box sx={{ display: 'flex', alignItems: 'center' }}>
                  <ShieldIcon sx={{ color: '#2563eb', mr: 1 }} />
                  <Typography variant="body2" color="text.secondary" fontWeight={500}>
                    Nivel de Riesgo
                  </Typography>
                </Box>
                <Tooltip title={evaluacion_riesgo.metodologia} arrow placement="top">
                  <HelpOutlineIcon fontSize="small" sx={{ color: 'text.secondary', cursor: 'pointer' }} />
                </Tooltip>
              </Box>

              <Chip
                label={evaluacion_riesgo.nivel_riesgo.toUpperCase()}
                color={getRiskChipColor(evaluacion_riesgo.nivel_riesgo)}
                sx={{ fontWeight: 700, px: 1, fontSize: '0.9rem', mb: 1 }}
              />

              <Typography variant="caption" display="block" color="text.secondary" sx={{ mt: 0.5 }}>
                {evaluacion_riesgo.justificacion}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
};