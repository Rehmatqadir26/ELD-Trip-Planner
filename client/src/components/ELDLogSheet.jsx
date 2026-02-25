import { useEffect, useRef } from 'react'

/**
 * ELD Log Sheet - draws the standard FMCSA daily log grid on canvas.
 * 
 * The grid shows:
 * - 24 hours (midnight to midnight) on x-axis
 * - 4 duty status rows on y-axis:
 *   1. Off Duty
 *   2. Sleeper Berth
 *   3. Driving
 *   4. On Duty (Not Driving)
 * - A continuous line showing driver's status throughout the day
 */

const STATUS_ORDER = ['off_duty', 'sleeper_berth', 'driving', 'on_duty_not_driving']
const STATUS_LABELS = ['Off Duty', 'Sleeper Berth', 'Driving', 'On Duty (ND)']
const STATUS_SHORT = ['OFF', 'SB', 'D', 'ON']

// Canvas dimensions
const CANVAS_WIDTH = 920
const CANVAS_HEIGHT = 310
const GRID_LEFT = 115
const GRID_RIGHT = 65
const GRID_TOP = 45
const GRID_BOTTOM = 20
const GRID_WIDTH = CANVAS_WIDTH - GRID_LEFT - GRID_RIGHT
const GRID_HEIGHT = CANVAS_HEIGHT - GRID_TOP - GRID_BOTTOM
const ROW_HEIGHT = GRID_HEIGHT / 4
const HOUR_WIDTH = GRID_WIDTH / 24

// Colors
const COLORS = {
  gridLine: '#d0d5dd',
  gridLineMajor: '#98a2b3',
  gridLineHour: '#667085',
  text: '#344054',
  textLight: '#667085',
  textMuted: '#98a2b3',
  statusLine: '#1a365d',
  statusLineShadow: 'rgba(26, 54, 93, 0.15)',
  headerBg: '#f8fafc',
  rowAlt: '#fafbfc',
  driving: '#c6f6d5',
  onDuty: '#fed7e2',
  sleeper: '#bee3f8',
  offDuty: '#fefcbf',
}

function drawGrid(ctx) {
  // Background
  ctx.fillStyle = 'white'
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

  // Header background
  ctx.fillStyle = COLORS.headerBg
  ctx.fillRect(GRID_LEFT, 0, GRID_WIDTH, GRID_TOP)

  // Alternate row backgrounds
  for (let i = 0; i < 4; i++) {
    const y = GRID_TOP + i * ROW_HEIGHT
    if (i === 2) {
      ctx.fillStyle = 'rgba(198, 246, 213, 0.15)' // Driving row highlight
    } else if (i % 2 === 1) {
      ctx.fillStyle = COLORS.rowAlt
    } else {
      ctx.fillStyle = 'white'
    }
    ctx.fillRect(GRID_LEFT, y, GRID_WIDTH, ROW_HEIGHT)
  }

  // Draw horizontal row dividers
  ctx.strokeStyle = COLORS.gridLine
  ctx.lineWidth = 1
  for (let i = 0; i <= 4; i++) {
    const y = GRID_TOP + i * ROW_HEIGHT
    ctx.beginPath()
    ctx.moveTo(GRID_LEFT, y)
    ctx.lineTo(GRID_LEFT + GRID_WIDTH, y)
    ctx.stroke()
  }

  // Thicker borders
  ctx.strokeStyle = COLORS.gridLineMajor
  ctx.lineWidth = 2
  ctx.strokeRect(GRID_LEFT, GRID_TOP, GRID_WIDTH, GRID_HEIGHT)

  // Draw vertical hour lines
  for (let h = 0; h <= 24; h++) {
    const x = GRID_LEFT + h * HOUR_WIDTH
    const isMajor = h % 6 === 0 // midnight, 6am, noon, 6pm, midnight

    ctx.beginPath()
    ctx.strokeStyle = isMajor ? COLORS.gridLineHour : COLORS.gridLine
    ctx.lineWidth = isMajor ? 1.5 : 0.5
    ctx.moveTo(x, GRID_TOP)
    ctx.lineTo(x, GRID_TOP + GRID_HEIGHT)
    ctx.stroke()

    // 15-minute tick marks
    if (h < 24) {
      for (let q = 1; q <= 3; q++) {
        const qx = x + (q / 4) * HOUR_WIDTH
        ctx.beginPath()
        ctx.strokeStyle = COLORS.gridLine
        ctx.lineWidth = 0.3
        ctx.moveTo(qx, GRID_TOP)
        ctx.lineTo(qx, GRID_TOP + GRID_HEIGHT)
        ctx.stroke()
      }
    }
  }

  // Hour labels
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillStyle = COLORS.text
  ctx.font = 'bold 9px Inter, sans-serif'

  const hourLabels = [
    'M', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11',
    'N', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', 'M'
  ]

  for (let h = 0; h <= 24; h++) {
    const x = GRID_LEFT + h * HOUR_WIDTH
    ctx.fillStyle = (h === 0 || h === 12 || h === 24) ? COLORS.text : COLORS.textLight
    ctx.font = (h === 0 || h === 12 || h === 24) ? 'bold 10px Inter, sans-serif' : '9px Inter, sans-serif'
    ctx.fillText(hourLabels[h], x, GRID_TOP / 2)
  }

  // AM/PM labels
  ctx.font = '8px Inter, sans-serif'
  ctx.fillStyle = COLORS.textMuted
  ctx.fillText('AM', GRID_LEFT + 6 * HOUR_WIDTH, GRID_TOP - 5)
  ctx.fillText('PM', GRID_LEFT + 18 * HOUR_WIDTH, GRID_TOP - 5)

  // Status labels (left side)
  ctx.textAlign = 'right'
  ctx.textBaseline = 'middle'

  for (let i = 0; i < 4; i++) {
    const y = GRID_TOP + i * ROW_HEIGHT + ROW_HEIGHT / 2
    ctx.font = 'bold 10px Inter, sans-serif'
    ctx.fillStyle = COLORS.text
    ctx.fillText(STATUS_LABELS[i], GRID_LEFT - 10, y)
  }

  // Row number labels
  ctx.textAlign = 'left'
  ctx.font = '9px Inter, sans-serif'
  ctx.fillStyle = COLORS.textMuted
  for (let i = 0; i < 4; i++) {
    const y = GRID_TOP + i * ROW_HEIGHT + ROW_HEIGHT / 2
    ctx.fillText(`${i + 1}`, GRID_LEFT - 108, y)
  }
}

function drawStatusLine(ctx, segments) {
  if (!segments || segments.length === 0) return

  const getY = (status) => {
    const idx = STATUS_ORDER.indexOf(status)
    if (idx === -1) return GRID_TOP + ROW_HEIGHT / 2
    return GRID_TOP + idx * ROW_HEIGHT + ROW_HEIGHT / 2
  }

  const getX = (hour) => GRID_LEFT + (hour / 24) * GRID_WIDTH

  // Draw shadow
  ctx.beginPath()
  ctx.strokeStyle = COLORS.statusLineShadow
  ctx.lineWidth = 6
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  let started = false
  let prevY = null

  segments.forEach((seg) => {
    const x1 = getX(seg.start_hour)
    const x2 = getX(seg.end_hour)
    const y = getY(seg.status)

    if (!started) {
      ctx.moveTo(x1, y)
      started = true
    } else if (prevY !== null && Math.abs(prevY - y) > 0.5) {
      ctx.lineTo(x1, y)
    }
    ctx.lineTo(x2, y)
    prevY = y
  })
  ctx.stroke()

  // Draw main line
  ctx.beginPath()
  ctx.strokeStyle = COLORS.statusLine
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  started = false
  prevY = null

  segments.forEach((seg) => {
    const x1 = getX(seg.start_hour)
    const x2 = getX(seg.end_hour)
    const y = getY(seg.status)

    if (!started) {
      ctx.moveTo(x1, y)
      started = true
    } else if (prevY !== null && Math.abs(prevY - y) > 0.5) {
      ctx.lineTo(x1, y)
    }
    ctx.lineTo(x2, y)
    prevY = y
  })
  ctx.stroke()

  // Draw colored segment highlights
  segments.forEach((seg) => {
    const x1 = getX(seg.start_hour)
    const x2 = getX(seg.end_hour)
    const y = getY(seg.status)
    const width = x2 - x1

    if (width < 1) return

    let color = null
    if (seg.status === 'driving') color = 'rgba(56, 161, 105, 0.12)'
    else if (seg.status === 'on_duty_not_driving') color = 'rgba(229, 62, 62, 0.08)'
    else if (seg.status === 'sleeper_berth') color = 'rgba(49, 130, 206, 0.08)'

    if (color) {
      const idx = STATUS_ORDER.indexOf(seg.status)
      const rowY = GRID_TOP + idx * ROW_HEIGHT
      ctx.fillStyle = color
      ctx.fillRect(x1, rowY, width, ROW_HEIGHT)
    }
  })
}

function drawTotals(ctx, totalHours) {
  const x = GRID_LEFT + GRID_WIDTH + 8
  ctx.textAlign = 'left'

  const totals = [
    { key: 'off_duty', label: 'OFF', color: '#276749' },
    { key: 'sleeper_berth', label: 'SB', color: '#2a4365' },
    { key: 'driving', label: 'D', color: '#744210' },
    { key: 'on_duty_not_driving', label: 'ON', color: '#702459' },
  ]

  ctx.font = '8px Inter, sans-serif'
  ctx.fillStyle = COLORS.textMuted
  ctx.fillText('TOTAL', x + 10, GRID_TOP - 5)

  totals.forEach((t, i) => {
    const y = GRID_TOP + i * ROW_HEIGHT + ROW_HEIGHT / 2
    const hrs = totalHours?.[t.key] || 0

    ctx.font = 'bold 12px Inter, sans-serif'
    ctx.fillStyle = t.color
    ctx.fillText(formatHours(hrs), x + 5, y)
  })
}

function formatHours(hours) {
  const h = Math.floor(hours)
  const m = Math.round((hours - h) * 60)
  return `${h}:${m.toString().padStart(2, '0')}`
}

export default function ELDLogSheet({ log }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !log) return

    // Set canvas resolution (2x for retina)
    const dpr = window.devicePixelRatio || 1
    canvas.width = CANVAS_WIDTH * dpr
    canvas.height = CANVAS_HEIGHT * dpr
    canvas.style.width = `${CANVAS_WIDTH}px`
    canvas.style.height = `${CANVAS_HEIGHT}px`

    const ctx = canvas.getContext('2d')
    ctx.scale(dpr, dpr)

    // Clear
    ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT)

    // Draw
    drawGrid(ctx)
    drawStatusLine(ctx, log.segments)
    drawTotals(ctx, log.total_hours)
  }, [log])

  if (!log) return null

  const dateStr = new Date(log.date + 'T12:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })

  return (
    <div className="eld-log-sheet">
      <div className="eld-log-header">
        <h3>Daily Log - Driver's Record of Duty Status</h3>
        <span className="log-date">{dateStr}</span>
      </div>

      <div className="eld-log-canvas-wrapper">
        <canvas ref={canvasRef} />
      </div>

      <div className="eld-log-totals">
        <div className="eld-total-item off-duty">
          <span className="total-value">{formatHours(log.total_hours?.off_duty || 0)}</span>
          <span className="total-label">Off Duty</span>
        </div>
        <div className="eld-total-item sleeper">
          <span className="total-value">{formatHours(log.total_hours?.sleeper_berth || 0)}</span>
          <span className="total-label">Sleeper Berth</span>
        </div>
        <div className="eld-total-item driving">
          <span className="total-value">{formatHours(log.total_hours?.driving || 0)}</span>
          <span className="total-label">Driving</span>
        </div>
        <div className="eld-total-item on-duty">
          <span className="total-value">{formatHours(log.total_hours?.on_duty_not_driving || 0)}</span>
          <span className="total-label">On Duty (ND)</span>
        </div>
      </div>

      {log.remarks?.length > 0 && (
        <div className="eld-remarks">
          <h4>Remarks</h4>
          <ul>
            {log.remarks.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
