import React, { useState, useEffect } from 'react';
import {
  ThemeProvider,
  createTheme,
  CssBaseline,
  Box,
  AppBar,
  Toolbar,
  Typography,
  Container,
  Grid,
  Alert,
  CircularProgress,
  Chip,
  Paper
} from '@mui/material';
import ForestIcon from '@mui/icons-material/Forest';
import VerifiedIcon from '@mui/icons-material/Verified';
import { SAMPLE_FARMS } from './data/samples';
import { SampleFarm, AnalisisForestalResponse } from './types';
import { MapViewer } from './components/MapViewer';
import { MetricsCards } from './components/MetricsCards';
import { LossChart } from './components/LossChart';
import { AlertsTimelineChart } from './components/AlertsTimelineChart';
import { GeoJsonInput } from './components/GeoJsonInput';

// Tema personalizado con la identidad visual agroforestal de Raizul
const theme = createTheme({
  palette: {
    primary: {
      main: '#059669', // Verde esmeralda
      dark: '#047857',
      light: '#34d399'
    },
    secondary: {
      main: '#b45309' // Tono cacao / ámbar
    },
    background: {
      default: '#f8fafc',
      paper: '#ffffff'
    }
  },
  typography: {
    fontFamily: '"Inter", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
  }
});

export const App: React.FC = () => {
  const [selectedSample, setSelectedSample] = useState<SampleFarm>(SAMPLE_FARMS[0]);
  const [geoJsonText, setGeoJsonText] = useState<string>(
    JSON.stringify(SAMPLE_FARMS[0].geojson, null, 2)
  );
  const [fechaInicio, setFechaInicio] = useState<string>('2020-12-31');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalisisForestalResponse | null>(null);

  // Extraer geometría para renderizar en el mapa en tiempo real
  const currentGeometry = React.useMemo(() => {
    try {
      const parsed = JSON.parse(geoJsonText);
      if (parsed.type === 'Feature') return parsed.geometry;
      if (parsed.type === 'FeatureCollection' && parsed.features?.[0]) {
        return parsed.features[0].geometry;
      }
      return parsed;
    } catch {
      return null;
    }
  }, [geoJsonText]);

  // Ejecutar análisis contra FastAPI
  const handleAnalyze = async () => {
    setError(null);
    setIsLoading(true);

    try {
      let payload: any;
      try {
        payload = JSON.parse(geoJsonText);
      } catch (e: any) {
        throw new Error(`Error de sintaxis JSON: ${e.message}`);
      }

      // Parámetros de consulta
      const params = new URLSearchParams();
      if (fechaInicio) {
        params.append('fecha_inicio', fechaInicio);
      }

      const response = await fetch(`/analisis-forestal?${params.toString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(payload)
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Manejar errores de validación 422 de Pydantic/FastAPI
        if (response.status === 422) {
          const detail = responseData.detail;
          if (typeof detail === 'object' && detail.mensaje) {
            throw new Error(`Validación rechazada: ${detail.mensaje}`);
          } else if (Array.isArray(detail)) {
            const msgs = detail.map((d: any) => `${d.loc.join('.')}: ${d.msg}`).join(', ');
            throw new Error(`Parámetros inválidos: ${msgs}`);
          }
          throw new Error(JSON.stringify(detail));
        }

        if (response.status === 502 || response.status === 504) {
          throw new Error(
            `Fallo de conexión con Global Forest Watch: ${responseData.detail || 'Servicio no disponible'}`
          );
        }

        throw new Error(responseData.detail || `Error HTTP ${response.status}`);
      }

      setResult(responseData);
    } catch (err: any) {
      console.error('Error al analizar el predio:', err);
      setError(err.message || 'Ocurrió un error inesperado al consultar la API.');
    } finally {
      setIsLoading(false);
    }
  };

  // Carga automática inicial del primer predio de prueba (Santander)
  useEffect(() => {
    handleAnalyze();
  }, []);

  const handleSelectSample = (sample: SampleFarm) => {
    setSelectedSample(sample);
    setGeoJsonText(JSON.stringify(sample.geojson, null, 2));
  };

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        {/* Barra Superior de Navegación */}
        <AppBar position="static" elevation={1} sx={{ backgroundColor: '#ffffff', color: '#1e293b' }}>
          <Toolbar sx={{ justifyContent: 'space-between' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
              <Box
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  borderRadius: 2,
                  p: 0.8
                }}
              >
                <ForestIcon fontSize="medium" />
              </Box>
              <Box>
                <Typography variant="h6" fontWeight={700} sx={{ lineHeight: 1.2 }}>
                  Raizul
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Validador Geoespacial y Forestal &bull; Reto Técnico
                </Typography>
              </Box>
            </Box>

          </Toolbar>
        </AppBar>

        {/* Contenido Principal */}
        <Container maxWidth="xl" sx={{ mt: 3, mb: 4, flex: 1 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 3, borderRadius: 2 }} onClose={() => setError(null)}>
              <strong>Error en la validación:</strong> {error}
            </Alert>
          )}

          <Grid container spacing={3}>
            {/* Columna Izquierda: Input GeoJSON y Visor de Mapa */}
            <Grid item xs={12} lg={5}>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                <GeoJsonInput
                  geoJsonText={geoJsonText}
                  onGeoJsonChange={setGeoJsonText}
                  fechaInicio={fechaInicio}
                  onFechaInicioChange={setFechaInicio}
                  onAnalyze={handleAnalyze}
                  isLoading={isLoading}
                  onSelectSample={handleSelectSample}
                  selectedSampleId={selectedSample?.id}
                />

                <Box sx={{ height: 420 }}>
                  <MapViewer
                    geometry={currentGeometry}
                    areaHa={result?.area_total_ha}
                    bbox={result?.bbox}
                  />
                </Box>
              </Box>
            </Grid>

            {/* Columna Derecha: Métricas y Gráficos */}
            <Grid item xs={12} lg={7}>
              {isLoading && !result ? (
                <Paper
                  elevation={2}
                  sx={{
                    p: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 400,
                    borderRadius: 2
                  }}
                >
                  <CircularProgress size={50} sx={{ color: '#059669', mb: 2 }} />
                  <Typography variant="h6" fontWeight={600} color="#1e293b">
                    Conectando con Global Forest Watch...
                  </Typography>
                  <Typography variant="body2" color="text.secondary">
                    Registrando Geostore, consultando pérdida histórica y raster de alertas satelitales.
                  </Typography>
                </Paper>
              ) : result ? (
                <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {/* Tarjetas KPI y Dictamen de Riesgo */}
                  <MetricsCards data={result} />

                  {/* Gráfico 1: Histórico de Pérdida UMD */}
                  <LossChart
                    historico={result.analisis_historico.historico}
                    anoPico={result.analisis_historico.ano_mayor_perdida}
                  />

                  {/* Gráfico 2: Evolución de Alertas Satelitales */}
                  <AlertsTimelineChart
                    serieTemporal={result.analisis_alertas.serie_temporal}
                    periodo={result.analisis_alertas.periodo}
                    totalAlertas={result.analisis_alertas.total_registros}
                  />
                </Box>
              ) : (
                <Paper
                  elevation={2}
                  sx={{
                    p: 6,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    minHeight: 400,
                    borderRadius: 2
                  }}
                >
                  <Typography variant="h6" color="text.secondary">
                    Selecciona una finca o ingresa un GeoJSON para comenzar el análisis.
                  </Typography>
                </Paper>
              )}
            </Grid>
          </Grid>
        </Container>
      </Box>
    </ThemeProvider>
  );
};
