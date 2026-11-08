import React, { useRef, useMemo } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  TextField,
  Chip,
  Stack,
  CircularProgress,
  RadioGroup,
  FormControlLabel,
  Radio,
  Alert,
  Divider
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import SearchIcon from '@mui/icons-material/Search';
import AgricultureIcon from '@mui/icons-material/Agriculture';
import CalendarTodayIcon from '@mui/icons-material/CalendarToday';
import LayersIcon from '@mui/icons-material/Layers';
import { SAMPLE_FARMS } from '../data/samples';
import { SampleFarm } from '../types';

interface GeoJsonInputProps {
  geoJsonText: string;
  onGeoJsonChange: (text: string) => void;
  fechaInicio: string;
  onFechaInicioChange: (fecha: string) => void;
  onAnalyze: () => void;
  isLoading: boolean;
  onSelectSample: (sample: SampleFarm) => void;
  selectedSampleId?: string;
}

export const GeoJsonInput: React.FC<GeoJsonInputProps> = ({
  geoJsonText,
  onGeoJsonChange,
  fechaInicio,
  onFechaInicioChange,
  onAnalyze,
  isLoading,
  onSelectSample,
  selectedSampleId
}) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Inspector inteligente: detectar si el GeoJSON contiene múltiples lotes/polígonos
  const lotesDetectados = useMemo(() => {
    try {
      const parsed = JSON.parse(geoJsonText);
      if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {
        const polyFeatures = parsed.features.filter(
          (f: any) =>
            f &&
            f.geometry &&
            (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon')
        );
        return polyFeatures;
      }
    } catch {
      // Texto aún no parseable
    }
    return [];
  }, [geoJsonText]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      try {
        const parsed = JSON.parse(content);
        onGeoJsonChange(JSON.stringify(parsed, null, 2));
      } catch {
        onGeoJsonChange(content);
      }
    };
    reader.readAsText(file);
  };

  // Manejar selección de un lote individual o combinación de todos
  const handleSelectLote = (indexOrCombine: string) => {
    try {
      const parsed = JSON.parse(geoJsonText);
      if (indexOrCombine === 'combine') {
        // Combinar todos los polígonos en un MultiPolygon
        const allPolys = lotesDetectados.flatMap((f: any) => {
          if (f.geometry.type === 'Polygon') return [f.geometry.coordinates];
          if (f.geometry.type === 'MultiPolygon') return f.geometry.coordinates;
          return [];
        });

        const combinedGeoJson = {
          type: 'Feature',
          properties: {
            nombre: 'Finca Consolidada (Lotes Combinados)',
            descripcion: `Unión de ${lotesDetectados.length} lotes para análisis integral.`
          },
          geometry: {
            type: 'MultiPolygon',
            coordinates: allPolys
          }
        };
        onGeoJsonChange(JSON.stringify(combinedGeoJson, null, 2));
      } else {
        const idx = parseInt(indexOrCombine, 10);
        const selectedFeature = lotesDetectados[idx];
        if (selectedFeature) {
          onGeoJsonChange(JSON.stringify(selectedFeature, null, 2));
        }
      }
    } catch (err) {
      console.error('Error al procesar la selección del lote:', err);
    }
  };

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2.5,
        borderRadius: 2,
        backgroundColor: '#ffffff',
        display: 'flex',
        flexDirection: 'column',
        gap: 2
      }}
    >
      {/* Encabezado y Botón de Subir Archivo */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <AgricultureIcon sx={{ color: '#10b981' }} />
          <Typography variant="subtitle1" fontWeight={700} color="#1e293b">
            Ingreso de Predio Cacaotero
          </Typography>
        </Box>

        <Button
          variant="outlined"
          component="label"
          size="small"
          startIcon={<UploadFileIcon />}
          sx={{
            borderColor: '#cbd5e1',
            color: '#334155',
            textTransform: 'none',
            '&:hover': { borderColor: '#94a3b8', backgroundColor: '#f1f5f9' }
          }}
        >
          Cargar Archivo GeoJSON
          <input
            ref={fileInputRef}
            type="file"
            accept=".geojson,.json"
            hidden
            onChange={handleFileUpload}
          />
        </Button>
      </Box>

      {/* Selector rápido de fincas cacaoteras */}
      <Box>
        <Typography variant="caption" color="text.secondary" fontWeight={600} sx={{ mb: 1, display: 'block' }}>
          Predios de Prueba en Colombia (Cacao Fino y Criollo):
        </Typography>
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {SAMPLE_FARMS.map((farm) => {
            const isSelected = selectedSampleId === farm.id;
            return (
              <Chip
                key={farm.id}
                label={farm.nombre}
                onClick={() => onSelectSample(farm)}
                color={isSelected ? 'success' : 'default'}
                variant={isSelected ? 'filled' : 'outlined'}
                size="small"
                sx={{
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer'
                }}
              />
            );
          })}
        </Stack>
      </Box>

      {/* Inspector de Múltiples Lotes si se detectan en un FeatureCollection */}
      {lotesDetectados.length > 1 && (
        <Alert
          severity="info"
          icon={<LayersIcon fontSize="inherit" />}
          sx={{ borderRadius: 2 }}
        >
          <Typography variant="subtitle2" fontWeight={700}>
            Se encontraron {lotesDetectados.length} geometrías poligonales en el archivo
          </Typography>
          <Typography variant="body2" sx={{ mb: 1 }}>
            Selecciona qué terreno deseas analizar individualmente o combínalos como una sola finca:
          </Typography>
          <RadioGroup onChange={(e) => handleSelectLote(e.target.value)}>
            {lotesDetectados.map((lote: any, idx: number) => {
              const nombreLote =
                lote.properties?.nombre ||
                lote.properties?.name ||
                lote.properties?.lote ||
                `Lote ${idx + 1}`;
              return (
                <FormControlLabel
                  key={`lote-${idx}`}
                  value={idx.toString()}
                  control={<Radio size="small" />}
                  label={<Typography variant="body2">{nombreLote}</Typography>}
                />
              );
            })}
            <FormControlLabel
              value="combine"
              control={<Radio size="small" />}
              label={
                <Typography variant="body2" fontWeight={600} color="#059669">
                  Combinar los {lotesDetectados.length} lotes como una sola finca (MultiPolygon)
                </Typography>
              }
            />
          </RadioGroup>
        </Alert>
      )}

      {/* Editor / Textarea GeoJSON */}
      <TextField
        label="Estructura GeoJSON (WGS84 EPSG:4326)"
        multiline
        rows={7}
        value={geoJsonText}
        onChange={(e) => onGeoJsonChange(e.target.value)}
        placeholder='Pegue aquí su GeoJSON: {"type": "Polygon", "coordinates": [...]}'
        variant="outlined"
        fullWidth
        helperText="Acepta Polygon, MultiPolygon o Feature según estándar RFC 7946 en grados decimales [-73.50, 6.80]."
        InputProps={{
          sx: {
            fontFamily: 'Consolas, Monaco, "Courier New", monospace',
            fontSize: '0.82rem',
            backgroundColor: '#f8fafc'
          }
        }}
      />

      {/* Filtro de Fecha de Corte para Alertas Satelitales (EUDR) */}
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <CalendarTodayIcon fontSize="small" sx={{ color: '#64748b' }} />
          <Typography variant="body2" color="text.secondary" fontWeight={500}>
            Filtro de Alertas desde:
          </Typography>
        </Box>
        <TextField
          type="date"
          size="small"
          value={fechaInicio}
          onChange={(e) => onFechaInicioChange(e.target.value)}
          sx={{ width: 180 }}
          helperText="Corte EUDR por defecto: 2020-12-31"
        />
      </Box>

      {/* Botón de acción principal */}
      <Button
        variant="contained"
        size="large"
        fullWidth
        disabled={isLoading || !geoJsonText.trim()}
        onClick={onAnalyze}
        startIcon={isLoading ? <CircularProgress size={22} color="inherit" /> : <SearchIcon />}
        sx={{
          py: 1.4,
          backgroundColor: '#059669',
          color: '#ffffff',
          fontWeight: 700,
          textTransform: 'none',
          fontSize: '1rem',
          borderRadius: 2,
          '&:hover': { backgroundColor: '#047857' }
        }}
      >
        {isLoading ? 'Consultando Satélites de Global Forest Watch...' : 'Validar y Analizar Finca'}
      </Button>
    </Paper>
  );
};
