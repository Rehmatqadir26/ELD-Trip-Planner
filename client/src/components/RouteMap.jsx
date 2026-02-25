import { useEffect, useRef } from 'react'
import L from 'leaflet'

// Fix leaflet default icon issue
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
  shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
})

const STOP_COLORS = {
  start: '#38a169',
  pickup: '#3182ce',
  dropoff: '#e53e3e',
  fuel: '#dd6b20',
  rest: '#805ad5',
  break: '#38a169',
  restart: '#d69e2e',
  other: '#718096',
}

const STOP_ICONS = {
  start: '🟢',
  pickup: '📦',
  dropoff: '🏁',
  fuel: '⛽',
  rest: '🛏️',
  break: '☕',
  restart: '🔄',
  other: '📍',
}

function createCustomIcon(color, label) {
  return L.divIcon({
    html: `<div style="
      background: ${color};
      width: 28px;
      height: 28px;
      border-radius: 50%;
      border: 3px solid white;
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
    ">${label}</div>`,
    className: '',
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -16],
  })
}

export default function RouteMap({ data }) {
  const mapRef = useRef(null)
  const mapInstanceRef = useRef(null)

  useEffect(() => {
    if (!mapRef.current) return

    // Initialize map if not already
    if (!mapInstanceRef.current) {
      mapInstanceRef.current = L.map(mapRef.current, {
        zoomControl: true,
        scrollWheelZoom: true,
      }).setView([39.8283, -98.5795], 5) // Center of US

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(mapInstanceRef.current)
    }

    const map = mapInstanceRef.current

    // Clear previous layers (except tile layer)
    map.eachLayer((layer) => {
      if (!(layer instanceof L.TileLayer)) {
        map.removeLayer(layer)
      }
    })

    if (!data) return

    const { route, locations, stops } = data
    const bounds = L.latLngBounds()

    // Draw route polyline
    if (route?.geometry?.length > 0) {
      // Leg 1: current -> pickup (blue)
      if (route.legs?.[0]?.geometry) {
        const leg1Line = L.polyline(route.legs[0].geometry, {
          color: '#3182ce',
          weight: 4,
          opacity: 0.8,
        }).addTo(map)
        route.legs[0].geometry.forEach((p) => bounds.extend(p))
      }

      // Leg 2: pickup -> dropoff (red)
      if (route.legs?.[1]?.geometry) {
        const leg2Line = L.polyline(route.legs[1].geometry, {
          color: '#e53e3e',
          weight: 4,
          opacity: 0.8,
        }).addTo(map)
        route.legs[1].geometry.forEach((p) => bounds.extend(p))
      }
    }

    // Add location markers
    if (locations?.current) {
      const pos = [locations.current.lat, locations.current.lon]
      L.marker(pos, {
        icon: createCustomIcon(STOP_COLORS.start, '🟢'),
      })
        .bindPopup(`<b>Start</b><br/>${locations.current.name}`)
        .addTo(map)
      bounds.extend(pos)
    }

    if (locations?.pickup) {
      const pos = [locations.pickup.lat, locations.pickup.lon]
      L.marker(pos, {
        icon: createCustomIcon(STOP_COLORS.pickup, '📦'),
      })
        .bindPopup(`<b>Pickup</b><br/>${locations.pickup.name}`)
        .addTo(map)
      bounds.extend(pos)
    }

    if (locations?.dropoff) {
      const pos = [locations.dropoff.lat, locations.dropoff.lon]
      L.marker(pos, {
        icon: createCustomIcon(STOP_COLORS.dropoff, '🏁'),
      })
        .bindPopup(`<b>Dropoff</b><br/>${locations.dropoff.name}`)
        .addTo(map)
      bounds.extend(pos)
    }

    // Add stop markers
    if (stops?.length > 0) {
      stops.forEach((stop) => {
        if (stop.type === 'pickup' || stop.type === 'dropoff') return // already added
        if (!stop.location) return

        const pos = [stop.location[0], stop.location[1]]
        const color = STOP_COLORS[stop.type] || STOP_COLORS.other
        const icon = STOP_ICONS[stop.type] || '📍'

        L.marker(pos, {
          icon: createCustomIcon(color, icon),
        })
          .bindPopup(
            `<b>${stop.description}</b><br/>` +
            `Duration: ${stop.duration_hours}h<br/>` +
            `Arrival: ${formatTime(stop.arrival_time)}`
          )
          .addTo(map)
        bounds.extend(pos)
      })
    }

    // Fit map to bounds
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [40, 40] })
    }
  }, [data])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
    }
  }, [])

  return (
    <div className="map-container">
      <div ref={mapRef} style={{ height: '100%', width: '100%' }} />
    </div>
  )
}

function formatTime(isoString) {
  if (!isoString) return ''
  const d = new Date(isoString)
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  })
}
