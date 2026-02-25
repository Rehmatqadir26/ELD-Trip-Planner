import RouteMap from './RouteMap'
import ELDLogSheet from './ELDLogSheet'

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

function formatDuration(hours) {
  if (!hours) return '0h'
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
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

function formatDistance(miles) {
  if (!miles) return '0'
  return Math.round(miles).toLocaleString()
}

export default function TripResults({ data }) {
  if (!data) return null

  const { route, stops, daily_logs, schedule } = data

  // Calculate trip stats
  const totalDriving = schedule
    ?.filter((e) => e.status === 'driving')
    .reduce((sum, e) => {
      const start = new Date(e.start_time)
      const end = new Date(e.end_time)
      return sum + (end - start) / 3600000
    }, 0) || 0

  const totalStops = stops?.length || 0
  const fuelStops = stops?.filter((s) => s.type === 'fuel').length || 0
  const restStops = stops?.filter((s) => s.type === 'rest' || s.type === 'restart').length || 0
  const tripDays = daily_logs?.length || 0

  // Calculate total trip time from first to last event
  let totalTripHours = 0
  if (schedule?.length > 0) {
    const first = new Date(schedule[0].start_time)
    const last = new Date(schedule[schedule.length - 1].end_time)
    totalTripHours = (last - first) / 3600000
  }

  return (
    <div className="results-section">
      {/* Route Summary */}
      <div className="route-summary">
        <div className="summary-stat">
          <div className="value">{formatDistance(route?.total_distance_miles)}</div>
          <div className="label">Total Miles</div>
        </div>
        <div className="summary-stat">
          <div className="value">{formatDuration(totalDriving)}</div>
          <div className="label">Driving Time</div>
        </div>
        <div className="summary-stat">
          <div className="value">{formatDuration(totalTripHours)}</div>
          <div className="label">Total Trip Time</div>
        </div>
        <div className="summary-stat">
          <div className="value">{tripDays}</div>
          <div className="label">{tripDays === 1 ? 'Day' : 'Days'}</div>
        </div>
        <div className="summary-stat">
          <div className="value">{totalStops}</div>
          <div className="label">Total Stops</div>
        </div>
      </div>

      {/* Map */}
      <RouteMap data={data} />

      {/* Stops List */}
      {stops && stops.length > 0 && (
        <div className="stops-list card" style={{ marginTop: '1.5rem' }}>
          <div className="card-header">
            <span className="icon">📍</span>
            <h2>Stops &amp; Rest Schedule</h2>
          </div>
          <div className="card-body">
            {stops.map((stop, idx) => (
              <div key={idx} className="stop-item">
                <div className={`stop-icon ${stop.type}`}>
                  {STOP_ICONS[stop.type] || '📍'}
                </div>
                <div className="stop-info">
                  <h4>{stop.description}</h4>
                  <p>
                    {formatTime(stop.arrival_time)}
                    {stop.duration_hours > 0 && ` · ${formatDuration(stop.duration_hours)}`}
                    {stop.type === 'fuel' && ` · Refueling`}
                    {(stop.type === 'rest' || stop.type === 'restart') && ` · Mandatory rest`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ELD Log Sheets */}
      {daily_logs && daily_logs.length > 0 && (
        <div className="eld-logs-section">
          <div className="card" style={{ marginBottom: '1rem' }}>
            <div className="card-header">
              <span className="icon">📊</span>
              <h2>ELD Daily Log Sheets ({daily_logs.length} {daily_logs.length === 1 ? 'day' : 'days'})</h2>
            </div>
            <div className="card-body" style={{ padding: '0.75rem 1.25rem' }}>
              <p style={{ fontSize: '0.85rem', color: '#718096' }}>
                Property-carrying driver · 70-hour/8-day cycle · No adverse driving conditions
              </p>
            </div>
          </div>

          {daily_logs.map((log, idx) => (
            <ELDLogSheet key={idx} log={log} />
          ))}
        </div>
      )}
    </div>
  )
}
