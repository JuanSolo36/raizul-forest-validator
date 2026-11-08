import { SampleFarm } from '../types';

export const SAMPLE_FARMS: SampleFarm[] = [
  {
    id: 'finca_el_paraiso_01',
    nombre: 'Finca El Paraíso (Oficial Raizul)',
    departamento: 'Valle del Cauca',
    descripcion: 'Predio oficial entregado en la especificación del reto técnico de Raizul.',
    geojson: {
      type: 'Feature',
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-76.5300, 3.4500],
            [-76.5200, 3.4600],
            [-76.5100, 3.4400],
            [-76.5300, 3.4500]
          ]
        ]
      },
      properties: {
        farm_id: 'finca_el_paraiso_01'
      }
    }
  },
  {
    id: 'santander',
    nombre: 'Finca Cacaotera San Vicente de Chucurí',
    departamento: 'Santander',
    descripcion: 'Zona montañosa tradicional de cacao fino de aroma en Santander. Sistema agroforestal.',
    geojson: {
      type: 'Feature',
      properties: {
        farm_id: 'santander_01',
        nombre: 'Finca El Progreso - San Vicente de Chucurí',
        cultivo: 'Cacao Fino de Aroma',
        departamento: 'Santander'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-73.50, 6.80],
            [-73.49, 6.80],
            [-73.49, 6.81],
            [-73.50, 6.81],
            [-73.50, 6.80]
          ]
        ]
      }
    }
  },
  {
    id: 'tumaco',
    nombre: 'Predio Agroforestal Tumaco',
    departamento: 'Nariño',
    descripcion: 'Zona costera pacífica de cultivo de cacao criollo bajo dosel y bosque tropical húmedo.',
    geojson: {
      type: 'Feature',
      properties: {
        farm_id: 'tumaco_01',
        nombre: 'Asociación Cacao Pacífico - Tumaco',
        cultivo: 'Cacao Criollo Ancestral',
        departamento: 'Nariño'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-78.75, 1.78],
            [-78.74, 1.78],
            [-78.74, 1.79],
            [-78.75, 1.79],
            [-78.75, 1.78]
          ]
        ]
      }
    }
  },
  {
    id: 'huila',
    nombre: 'Finca Agroecológica Gigante',
    departamento: 'Huila',
    descripcion: 'Plantación de cacao en el valle alto del río Magdalena con sombrío de maderables.',
    geojson: {
      type: 'Feature',
      properties: {
        farm_id: 'huila_01',
        nombre: 'Finca La Esmeralda - Gigante',
        cultivo: 'Cacao Especial de Origen',
        departamento: 'Huila'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-75.55, 2.38],
            [-75.54, 2.38],
            [-75.54, 2.39],
            [-75.55, 2.39],
            [-75.55, 2.38]
          ]
        ]
      }
    }
  },
  {
    id: 'caqueta',
    nombre: 'Frontera Forestal Amazónica (Control)',
    departamento: 'Caquetá',
    descripcion: 'Zona de amortiguamiento y transición en Caquetá con histórico de presión deforestadora.',
    geojson: {
      type: 'Feature',
      properties: {
        farm_id: 'caqueta_01',
        nombre: 'Frente de Monitoreo Caquetá',
        tipo: 'Zona de Alta Presión Forestal',
        departamento: 'Caquetá'
      },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [-74.90, 1.10],
            [-74.88, 1.10],
            [-74.88, 1.12],
            [-74.90, 1.12],
            [-74.90, 1.10]
          ]
        ]
      }
    }
  }
];
