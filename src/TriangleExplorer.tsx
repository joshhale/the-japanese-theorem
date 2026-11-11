import { useId, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { analyzeTriangle, createFreeTriangle, fitTriangleCircles, INITIAL_VIEW, LENGTH_UNIT } from './triangleGeometry'
import type { TrianglePoints } from './triangleGeometry'
import type { Point } from './geometry'
import './TriangleExplorer.css'

const NAMES = ['A', 'B', 'C']
const DISTANCE_COLORS = ['#487d82', '#8476a5', '#9c8644']
const INITIAL_LAYERS = {
  circumcircle: true,
  incircle: true,
  perpendiculars: false,
  angles: false,
  centers: true,
  radii: false,
  carnot: false,
}
const LAYERS: { key: keyof typeof INITIAL_LAYERS; label: string; color: string }[] = [
  { key: 'circumcircle', label: 'Circumcircle', color: '#487d82' },
  { key: 'incircle', label: 'Incircle', color: '#bd6b4d' },
  { key: 'perpendiculars', label: 'Perpendicular bisectors', color: '#487d82' },
  { key: 'angles', label: 'Angle bisectors', color: '#bd6b4d' },
  { key: 'centers', label: 'Centers O and I', color: '#54766e' },
  { key: 'radii', label: 'Radius segments R and r', color: '#54766e' },
  { key: 'carnot', label: 'Carnot distances', color: '#8476a5' },
]
const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
const formatLength = (length: number, unit = LENGTH_UNIT) => (Math.abs(length) < 1e-8 ? 0 : length / unit).toFixed(6)

function angleMarker(center: Point, from: Point, to: Point, radius: number, tickSize: number) {
  const start = Math.atan2(from.y - center.y, from.x - center.x)
  const end = Math.atan2(to.y - center.y, to.x - center.x)
  const cross = (from.x - center.x) * (to.y - center.y) - (from.y - center.y) * (to.x - center.x)
  const dot = (from.x - center.x) * (to.x - center.x) + (from.y - center.y) * (to.y - center.y)
  const middle = start + Math.atan2(cross, dot) / 2
  const tick = Math.min(tickSize, radius * 0.1)
  return {
    arc: `M${center.x + radius * Math.cos(start)},${center.y + radius * Math.sin(start)} A${radius},${radius} 0 0 ${cross > 0 ? 1 : 0} ${center.x + radius * Math.cos(end)},${center.y + radius * Math.sin(end)}`,
    tick: `M${center.x + (radius - tick) * Math.cos(middle)},${center.y + (radius - tick) * Math.sin(middle)} L${center.x + (radius + tick) * Math.cos(middle)},${center.y + (radius + tick) * Math.sin(middle)}`,
  }
}

export function CarnotSegments({ outerRadius, innerRadius, distances, lengthUnit = LENGTH_UNIT }: {
  outerRadius: number; innerRadius: number; distances: readonly number[]; lengthUnit?: number
}) {
  const markerPrefix = useId()
  const radiusEnds = [0, outerRadius, outerRadius + innerRadius]
  const distanceEnds = [0]
  for (const value of distances) distanceEnds.push(distanceEnds[distanceEnds.length - 1] + value)
  const minimum = Math.min(0, ...distanceEnds)
  const maximum = Math.max(...radiusEnds, ...distanceEnds)
  const x = (value: number) => `${8 + (value - minimum) / (maximum - minimum) * 84}%`
  const colors = ['#487d82', '#bd6b4d', ...distances.map((value, index) => value < -1e-8 ? '#b65341' : DISTANCE_COLORS[index])]
  const hasNegative = distances.some((value) => value < -1e-8)
  const row = (index: number) => 100 + (hasNegative ? index * 36 : 0)
  const height = hasNegative ? 210 : 142

  return <div className="carnot-segment-comparison">
    <svg className="carnot-segments" width="100%" height={height} role="img"
      aria-label="Length comparison of R plus r and the signed Carnot distances">
      <title>R + r and the signed sum of the three Carnot distances, on one scale</title>
      <desc>Both constructions start at zero. Radius segments point right. Distance segments join head-to-tail, using separate tracks when a negative segment points left. Vertical connectors do not contribute length.</desc>
      <defs>
        {colors.map((color, index) => (
          <marker key={index} id={`${markerPrefix}-carnot-sum-arrow-${index}`} viewBox="0 -4 8 8" refX="7" refY="0"
            markerWidth="8" markerHeight="8" markerUnits="userSpaceOnUse" orient="auto">
            <path d="M0,-3 L7,0 L0,3" fill="none" stroke={color} strokeWidth="1.7" />
          </marker>
        ))}
      </defs>
      <line className="sum-guide" x1={x(0)} y1="12" x2={x(0)} y2={height - 18} />
      <line className="sum-guide" x1={x(radiusEnds[2])} y1="12" x2={x(radiusEnds[2])} y2={height - 18} />
      <text className="sum-origin-label" x={x(0)} y={height - 5}>0</text>
      {[outerRadius, innerRadius].map((value, index) => (
        <g key={index} className="sum-segment" style={{ color: colors[index] }}>
          <line data-testid="radius-sum-segment" x1={x(radiusEnds[index])} y1="40" x2={x(radiusEnds[index + 1])} y2="40"
            markerEnd={`url(#${markerPrefix}-carnot-sum-arrow-${index})`} />
          <text x={x((radiusEnds[index] + radiusEnds[index + 1]) / 2)} y="27">{index === 0 ? 'R' : 'r'}</text>
          <title>{`${index === 0 ? 'R' : 'r'} = ${formatLength(value, lengthUnit)}`}</title>
        </g>
      ))}
      {distances.map((value, index) => (
        <g key={index} className={`sum-segment${value < -1e-8 ? ' negative' : ''}`} style={{ color: colors[index + 2] }}>
          {hasNegative && index < distances.length - 1 && <line className="sum-connector"
            x1={x(distanceEnds[index + 1])} y1={row(index)} x2={x(distanceEnds[index + 1])} y2={row(index + 1)} />}
          <line data-testid="distance-sum-segment" x1={x(distanceEnds[index])} y1={row(index)}
            x2={x(distanceEnds[index + 1])} y2={row(index)}
            markerEnd={Math.abs(value) > 1e-8 ? `url(#${markerPrefix}-carnot-sum-arrow-${index + 2})` : undefined} />
          <text x={x((distanceEnds[index] + distanceEnds[index + 1]) / 2)} y={row(index) - 13}>
            d<tspan baselineShift="sub" fontSize="10">{'abc'[index]}</tspan>{value < -1e-8 ? ' < 0' : Math.abs(value) <= 1e-8 ? ' = 0' : ''}
          </text>
          <title>{`d${'abc'[index]} = ${formatLength(value, lengthUnit)}${value < -1e-8 ? ', points left' : ''}`}</title>
        </g>
      ))}
      <circle className="sum-endpoint" cx={x(0)} cy="40" r="3" />
      <circle className="sum-endpoint" cx={x(radiusEnds[2])} cy="40" r="3" />
      <circle className="sum-endpoint" cx={x(0)} cy={row(0)} r="3" />
      <circle className="sum-endpoint" cx={x(distanceEnds[distances.length])} cy={row(distances.length - 1)} r="3" />
    </svg>
    <p>Same scale. Add segments head-to-tail; a negative distance points left.{hasNegative ? ' Vertical steps only separate overlapping segments.' : ''}</p>
  </div>
}

function TriangleExplorer() {
  const [seed, setSeed] = useState(7)
  const [points, setPoints] = useState<TrianglePoints>(() => createFreeTriangle(7))
  const [layers, setLayers] = useState(INITIAL_LAYERS)
  const [view, setView] = useState(INITIAL_VIEW)
  const [dragged, setDragged] = useState<number | null>(null)
  const [message, setMessage] = useState('Drag A, B, or C. Arrow keys move a focused vertex; Shift moves it faster.')
  const svgRef = useRef<SVGSVGElement>(null)
  const dragStart = useRef<TrianglePoints | null>(null)
  const geometry = analyzeTriangle(points)
  const scale = view.size / 640
  const centroid = { x: (points[0].x + points[1].x + points[2].x) / 3, y: (points[0].y + points[1].y + points[2].y) / 3 }
  const clipped = geometry.valid && (
    geometry.outer.x - geometry.outer.radius < view.x ||
    geometry.outer.y - geometry.outer.radius < view.y ||
    geometry.outer.x + geometry.outer.radius > view.x + view.size ||
    geometry.outer.y + geometry.outer.radius > view.y + view.size
  )

  function reset(nextSeed: number) {
    setSeed(nextSeed)
    setPoints(createFreeTriangle(nextSeed))
    setView(INITIAL_VIEW)
    setDragged(null)
    dragStart.current = null
    setMessage(`Triangle reset to seed ${nextSeed}.`)
  }

  function moveVertex(index: number, position: Point) {
    const next: [Point, Point, Point] = [...points]
    next[index] = {
      x: Math.max(view.x + 25 * scale, Math.min(view.x + view.size - 25 * scale, position.x)),
      y: Math.max(view.y + 25 * scale, Math.min(view.y + view.size - 25 * scale, position.y)),
    }
    setPoints(next)
  }

  function pointerPosition(event: PointerEvent<SVGSVGElement>) {
    return new DOMPoint(event.clientX, event.clientY).matrixTransform(svgRef.current!.getScreenCTM()!.inverse())
  }

  function finishDrag() {
    if (dragged !== null) setMessage(`Vertex ${NAMES[dragged]} moved.`)
    setDragged(null)
    dragStart.current = null
  }

  function cancelDrag() {
    if (dragStart.current) setPoints(dragStart.current)
    setDragged(null)
    dragStart.current = null
    setMessage('Vertex movement cancelled.')
  }

  function vertexKey(event: KeyboardEvent<SVGGElement>, index: number) {
    const step = (event.shiftKey ? 10 : 3) * scale
    const offsets: Record<string, Point> = {
      ArrowLeft: { x: -step, y: 0 }, ArrowRight: { x: step, y: 0 },
      ArrowUp: { x: 0, y: -step }, ArrowDown: { x: 0, y: step },
    }
    const offset = offsets[event.key]
    if (!offset) return
    event.preventDefault()
    moveVertex(index, { x: points[index].x + offset.x, y: points[index].y + offset.y })
    setMessage(`Vertex ${NAMES[index]} moved.`)
  }

  function marker(point: Point, label: string, className: string) {
    return <g className={className}>
      <circle cx={point.x} cy={point.y} r={3.5 * scale} />
      <text x={point.x + 10 * scale} y={point.y - 9 * scale} fontSize={14 * scale}>{label}</text>
    </g>
  }

  function radiusSegment(from: Point, to: Point, label: string, className: string) {
    return <g className={className}>
      <line x1={from.x} y1={from.y} x2={to.x} y2={to.y} />
      <text x={(from.x + to.x) / 2 + 8 * scale} y={(from.y + to.y) / 2 - 7 * scale}
        fontSize={15 * scale}>{label}</text>
    </g>
  }

  return (
    <>
      <div className="exploration-layout triangle-layout">
        <section className="drawing-card" aria-label="Interactive triangle">
          <div className="drawing-header">
            <span className="diagram-title">Triangle <strong>ABC</strong></span>
          </div>
          <svg ref={svgRef} viewBox={`${view.x} ${view.y} ${view.size} ${view.size}`} className="triangle-diagram"
            aria-label="Triangle with draggable vertices A, B, and C"
            onPointerMove={(event) => { if (dragged !== null) moveVertex(dragged, pointerPosition(event)) }}
            onPointerUp={finishDrag} onPointerCancel={cancelDrag} onLostPointerCapture={finishDrag}
            onKeyDown={(event) => { if (event.key === 'Escape' && dragged !== null) cancelDrag() }}>
            <title>Incircle and circumcircle of a freely movable triangle</title>
            <desc>The incircle touches the three sides. The circumcircle passes through the three vertices. Toggle bisectors, radii, centers, and Carnot distances using the controls.</desc>
            <defs>
              <pattern id="triangle-grid" width={32 * scale} height={32 * scale} patternUnits="userSpaceOnUse">
                <circle cx={scale} cy={scale} r={0.8 * scale} fill="#dcded8" />
              </pattern>
            </defs>
            <rect x={view.x} y={view.y} width={view.size} height={view.size} fill="url(#triangle-grid)" />
            {geometry.valid && <>
              {layers.circumcircle && <circle data-testid="triangle-circumcircle" className="triangle-circumcircle"
                cx={geometry.outer.x} cy={geometry.outer.y} r={geometry.outer.radius} />}
              {layers.perpendiculars && geometry.sides.map((side, index) => {
                const inward = (side.opposite.x - side.midpoint.x) * side.normal.x + (side.opposite.y - side.midpoint.y) * side.normal.y
                const size = Math.min(8 * scale, side.length / 8, Math.abs(inward) / 4)
                const dx = (side.end.x - side.start.x) / side.length * size
                const dy = (side.end.y - side.start.y) / side.length * size
                const nx = side.normal.x * Math.sign(inward) * size
                const ny = side.normal.y * Math.sign(inward) * size
                return <g key={index} data-testid="perpendicular-bisector">
                  <line className="perpendicular-bisector"
                    x1={side.midpoint.x - side.normal.x * view.size * 3} y1={side.midpoint.y - side.normal.y * view.size * 3}
                    x2={side.midpoint.x + side.normal.x * view.size * 3} y2={side.midpoint.y + side.normal.y * view.size * 3} />
                  <circle cx={side.midpoint.x} cy={side.midpoint.y} r={2.5 * scale} fill="#487d82" />
                  <path data-testid="bisector-right-angle" className="bisector-right-angle"
                    d={`M${side.midpoint.x + dx},${side.midpoint.y + dy} l${nx},${ny} l${-dx},${-dy}`} />
                </g>
              })}
              {layers.angles && geometry.sides.map((side, index) => {
                const altitude = Math.abs((side.opposite.x - side.midpoint.x) * side.normal.x + (side.opposite.y - side.midpoint.y) * side.normal.y)
                const radius = Math.min(24 * scale, altitude / 4)
                return <g key={index}>
                  <line data-testid="angle-bisector" className="angle-bisector"
                    x1={side.opposite.x} y1={side.opposite.y} x2={side.angleFoot.x} y2={side.angleFoot.y} />
                  {[[side.start, side.angleFoot], [side.angleFoot, side.end]].map(([from, to], half) => (
                    <g key={half} data-testid="equal-angle-indicator" className="equal-angle-indicator" data-vertex={index}>
                      {Array.from({ length: index + 1 }, (_, arc) => {
                        const mark = angleMarker(side.opposite, from, to, radius * (1 + arc * 0.18), 2 * scale)
                        return <g key={arc}>
                          <path className="angle-arc" d={mark.arc} />
                          <path d={mark.tick} />
                        </g>
                      })}
                    </g>
                  ))}
                </g>
              })}
              {layers.incircle && <circle data-testid="triangle-incircle" className="triangle-incircle"
                cx={geometry.inner.x} cy={geometry.inner.y} r={geometry.inner.radius} />}
            </>}
            <polygon points={points.map((point) => `${point.x},${point.y}`).join(' ')}
              className="free-triangle-boundary" data-testid="free-triangle" />
            {geometry.valid && <>
              {layers.carnot && geometry.sides.map((side, index) => {
                const sign = side.signedDistance < -1e-8 ? 'negative' : 'positive'
                const legLength = distance(geometry.outer, side.foot)
                const dx = (side.end.x - side.start.x) / side.length * 7 * scale
                const dy = (side.end.y - side.start.y) / side.length * 7 * scale
                const nx = legLength > 1e-8 ? (geometry.outer.x - side.foot.x) / legLength * 7 * scale : 0
                const ny = legLength > 1e-8 ? (geometry.outer.y - side.foot.y) / legLength * 7 * scale : 0
                return <g key={index} data-testid="carnot-distance" data-sign={sign} className={`carnot-distance ${sign}`}
                  style={{ color: side.signedDistance < -1e-8 ? '#b65341' : DISTANCE_COLORS[index] }}>
                  <line x1={geometry.outer.x} y1={geometry.outer.y} x2={side.foot.x} y2={side.foot.y} />
                  {legLength > 1e-8 && <path d={`M${side.foot.x + dx},${side.foot.y + dy} l${nx},${ny} l${-dx},${-dy}`} />}
                  <circle cx={side.foot.x} cy={side.foot.y} r={2.5 * scale} />
                  <text x={(geometry.outer.x + side.foot.x) / 2 + 9 * scale}
                    y={(geometry.outer.y + side.foot.y) / 2 - 9 * scale} fontSize={13 * scale}>
                    d<tspan baselineShift="sub" fontSize={9 * scale}>{'abc'[index]}</tspan>{sign === 'negative' ? ' < 0' : ''}
                  </text>
                </g>
              })}
              {layers.radii && <>
                {radiusSegment(geometry.outer, points[0], 'R', 'outer-radius')}
                {radiusSegment(geometry.inner, geometry.sides[0].touch, 'r', 'inner-radius')}
                <circle cx={geometry.sides[0].touch.x} cy={geometry.sides[0].touch.y} r={3 * scale} fill="#bd6b4d" />
              </>}
              {layers.centers && <>
                {marker(geometry.outer, 'O', 'circumcenter-marker')}
                {marker(geometry.inner, 'I', 'incenter-marker')}
              </>}
            </>}
            {points.map((point, index) => {
              const labelDistance = distance(point, centroid) || 1
              return <g key={index} role="button" tabIndex={0} aria-label={`Triangle vertex ${NAMES[index]}`}
                aria-description="Drag or use arrow keys to move this vertex. Hold Shift for larger steps."
                className={`triangle-vertex${dragged === index ? ' moving' : ''}`}
                onKeyDown={(event) => vertexKey(event, index)}
                onPointerDown={(event) => {
                  if (event.button !== 0 || !event.isPrimary) return
                  event.preventDefault()
                  event.currentTarget.focus()
                  dragStart.current = points
                  setDragged(index)
                  svgRef.current!.setPointerCapture(event.pointerId)
                }}>
                <circle cx={point.x} cy={point.y} r={14 * scale} className="triangle-vertex-hit" />
                <circle cx={point.x} cy={point.y} r={5 * scale} className="triangle-vertex-dot" />
                <text x={point.x + (point.x - centroid.x) / labelDistance * 23 * scale}
                  y={point.y + (point.y - centroid.y) / labelDistance * 23 * scale} fontSize={14 * scale}>
                  {NAMES[index]}
                </text>
              </g>
            })}
          </svg>
          <div className="drawing-footer">
            <div className="legend"><span><i className="legend-circle outer-legend" /> Circumcircle</span><span><i className="legend-circle" /> Incircle</span></div>
            <span className="drag-hint">Drag vertices freely</span>
          </div>
        </section>

        <aside className="controls triangle-controls" aria-label="Triangle controls">
          <div className="panel-heading"><span className="eyebrow">TRIANGLE CONSTRUCTION</span><span className="tiny-cross">+</span></div>
          <div className="slider-control">
            <label>
              <span className="control-heading"><span>Triangle seed</span><output>{seed.toString().padStart(2, '0')}</output></span>
              <input aria-label="Triangle seed" type="range" min="1" max="25" value={seed}
                style={{ '--progress': `${(seed - 1) / 24 * 100}%` } as React.CSSProperties}
                onChange={(event) => reset(Number(event.target.value))} />
            </label>
            <div className="range-endpoints"><span>1</span><span>25</span></div>
          </div>
          <div className="layer-toggles" aria-label="Diagram layers">
            {LAYERS.map(({ key, label, color }) => (
              <button key={key} className={`circle-toggle${layers[key] ? ' on' : ''}`} aria-pressed={layers[key]}
                onClick={() => setLayers({ ...layers, [key]: !layers[key] })}>
                <span><i className="layer-dot" style={{ background: color }} />{label}</span>
                <span className="switch" aria-hidden="true"><span /></span>
              </button>
            ))}
          </div>
          <div className="triangle-actions">
            <button onClick={() => reset(seed)}>Reset triangle</button>
            <button onClick={() => { setView(fitTriangleCircles(points)); setMessage('View fitted to the triangle and its circles.') }}>Fit circles</button>
          </div>
          <p className="triangle-control-note">Perpendicular side bisectors meet at O. Angle bisectors meet at I.</p>
          {layers.carnot && <p className="triangle-control-note">A distance is negative when O and the opposite vertex lie on different sides of that edge.</p>}
          {clipped && layers.circumcircle && <p className="view-notice" role="note">Circumcircle extends beyond the pane. Use Fit circles to see it all.</p>}
        </aside>
      </div>

      <section className="circle-readouts" aria-label="Circle radii">
        <div className="circle-readout outer-readout"><span className="eyebrow">CIRCUMRADIUS</span>
          <div><span>R =</span><output data-testid="circumradius">{geometry.valid ? formatLength(geometry.outer.radius) : '—'}</output><small>u</small></div>
          <p>Distance from O to each vertex.</p>
        </div>
        <div className="circle-readout inner-readout"><span className="eyebrow">INRADIUS</span>
          <div><span>r =</span><output data-testid="inradius">{geometry.valid ? formatLength(geometry.inner.radius) : '—'}</output><small>u</small></div>
          <p>Perpendicular distance from I to each side.</p>
        </div>
      </section>
      {layers.carnot && <section className="carnot-readout" aria-label="Carnot identity">
        <span className="eyebrow">CARNOT’S THEOREM</span>
        {geometry.valid ? <>
          <div className="carnot-equation"><span>d<sub>a</sub> + d<sub>b</sub> + d<sub>c</sub></span><span>=</span><span>R + r</span></div>
          <div className="carnot-values">
            <span>{geometry.sides.map((side, index) => <span key={index} style={{ color: side.signedDistance < -1e-8 ? '#b65341' : DISTANCE_COLORS[index] }}>
              {index > 0 ? ' + ' : ''}{side.signedDistance < -1e-8 ? '(' : ''}{formatLength(side.signedDistance)}{side.signedDistance < -1e-8 ? ')' : ''}
            </span>)}</span>
            <span>= <output data-testid="carnot-sum">{formatLength(geometry.sides.reduce((total, side) => total + side.signedDistance, 0))}</output></span>
            <span>R + r = <output data-testid="radii-sum">{formatLength(geometry.outer.radius + geometry.inner.radius)}</output></span>
          </div>
          <CarnotSegments outerRadius={geometry.outer.radius} innerRadius={geometry.inner.radius}
            distances={geometry.sides.map((side) => side.signedDistance)} />
        </> : <p>A nondegenerate triangle is needed for this identity.</p>}
        <p>Signed distances are computed from O to the side lines. Rounded display; full-precision calculations.</p>
      </section>}
      <div className="status-message" role="status" aria-label="Triangle updates">{geometry.valid ? message : geometry.reason}</div>
    </>
  )
}

export default TriangleExplorer
