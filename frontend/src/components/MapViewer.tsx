import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import { Box, Paper, Typography, ToggleButtonGroup, ToggleButton, Chip } from '@mui/material';
import MapIcon from '@mui/icons-material/Map';
import SatelliteIcon from '@mui/icons-material/Satellite';

interface MapViewerProps {
  geometry: any;
  areaHa?: number;
  bbox?: number[];
}

export const MapViewer: React.FC<MapViewerProps> = ({ geometry, areaHa }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const geoJsonLayerRef = useRef<L.GeoJSON | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);

  const [mapType, setMapType] = useState<'satellite' | 'streets'>('satellite');

  // 1. Inicialización única del mapa Leaflet
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Coordenadas iniciales centradas en Colombia
    const map = L.map(mapContainerRef.current, {
      center: [4.5709, -74.2973],
      zoom: 6,
      zoomControl: true
    });

    // Capa satelital de Esri por defecto
    const initialTile = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        maxZoom: 19
      }
    ).addTo(map);

    tileLayerRef.current = initialTile;
    mapInstanceRef.current = map;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // 2. Alternar entre Vista Satelital y Calles
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map) return;

    if (tileLayerRef.current) {
      map.removeLayer(tileLayerRef.current);
    }

    if (mapType === 'satellite') {
      tileLayerRef.current = L.tileLayer(
        'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
        {
          attribution: 'Tiles &copy; Esri',
          maxZoom: 19
        }
      ).addTo(map);
    } else {
      tileLayerRef.current = L.tileLayer(
        'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        {
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
          maxZoom: 19
        }
      ).addTo(map);
    }
  }, [mapType]);

  // 3. Pintar la geometría y hacer fitBounds cuando cambie el GeoJSON
  useEffect(() => {
    const map = mapInstanceRef.current;
    if (!map || !geometry) return;

    if (geoJsonLayerRef.current) {
      map.removeLayer(geoJsonLayerRef.current);
      geoJsonLayerRef.current = null;
    }

    try {
      const geoLayer = L.geoJSON(geometry, {
        style: {
          color: '#10b981',        // Borde verde esmeralda
          weight: 3,
          opacity: 0.9,
          fillColor: '#34d399',    // Relleno verde suave
          fillOpacity: 0.35
        }
      }).addTo(map);

      geoJsonLayerRef.current = geoLayer;

      // Auto-centrar la cámara exactamente en el polígono del predio
      const bounds = geoLayer.getBounds();
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 16 });
      }
    } catch (err) {
      console.error('Error al renderizar el polígono en Leaflet:', err);
    }
  }, [geometry]);

  return (
    <Paper
      elevation={2}
      sx={{
        p: 2,
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        borderRadius: 2,
        overflow: 'hidden'
      }}
    >
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <Typography variant="h6" sx={{ fontWeight: 600, color: '#1e293b' }}>
            Delimitación Geoespacial
          </Typography>
          {areaHa !== undefined && areaHa > 0 && (
            <Chip
              label={`${areaHa.toLocaleString('es-CO', { maximumFractionDigits: 2 })} ha`}
              color="success"
              size="small"
              sx={{ fontWeight: 600 }}
            />
          )}
        </Box>

        <ToggleButtonGroup
          size="small"
          value={mapType}
          exclusive
          onChange={(_, val) => val && setMapType(val)}
        >
          <ToggleButton value="satellite" title="Vista Satelital">
            <SatelliteIcon fontSize="small" sx={{ mr: 0.5 }} /> Satélite
          </ToggleButton>
          <ToggleButton value="streets" title="Mapa de Calles">
            <MapIcon fontSize="small" sx={{ mr: 0.5 }} /> Calles
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      <Box
        ref={mapContainerRef}
        sx={{
          flex: 1,
          minHeight: 380,
          width: '100%',
          borderRadius: 2,
          border: '1px solid #e2e8f0',
          position: 'relative'
        }}
      />
    </Paper>
  );
};
