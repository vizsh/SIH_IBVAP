import * as L from 'leaflet'

declare module 'leaflet' {
  function heatLayer(latlngs: Array<[number, number, number?]>, options?: Record<string, unknown>): L.Layer

  namespace HeatLayer {
    interface HeatLayerOptions {
      minOpacity?: number
      maxZoom?: number
      max?: number
      radius?: number
      blur?: number
      gradient?: Record<number, string>
    }
  }
}

declare module 'leaflet.heat'
