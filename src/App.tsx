import { useMemo, useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import {
  createVertices, edgeKey, edgesCross, forceEdge, incircle, insertDiagonal, isBoundary,
  referenceSum, triangleEdges, triangulate,
} from './geometry'
import type { Edge, Point } from './geometry'
import TriangleExplorer from './TriangleExplorer'
import QuadrilateralExplorer from './QuadrilateralExplorer'
import './App.css'

const COLORS = ['#d47352', '#487d82', '#9c8644', '#8476a5', '#64815c', '#af6384']
const CENTER = 320
const RADIUS = 247
const screen = (point: Point) => ({
  x: CENTER + point.x * RADIUS,
  y: CENTER + point.y * RADIUS,
})
const vertexName = (index: number) => index < 26 ? String.fromCharCode(65 + index) : `V${index + 1}`

function Slider({ label, value, min, max, onChange, description, formatValue }: {
  label: string; value: number; min: number; max: number
  onChange: (value: number) => void; description: string
  formatValue?: (value: number) => string
}) {
  return (
    <div className="slider-control">
      <label>
        <span className="control-heading"><span>{label}</span><output>{formatValue ? formatValue(value) : value.toString().padStart(2, '0')}</output></span>
        <input type="range" aria-label={label} aria-valuetext={formatValue?.(value)} min={min} max={max} step={1} value={value}
          style={{ '--progress': `${(value - min) / (max - min) * 100}%` } as React.CSSProperties}
          onChange={(event) => onChange(Number(event.target.value))} />
      </label>
      <div className="range-endpoints"><span>{formatValue ? formatValue(min) : min}</span><span>{formatValue ? formatValue(max) : max}</span></div>
      <p>{description}</p>
    </div>
  )
}

function PolygonExplorer() {
  const [configuration, setConfiguration] = useState({ count: 8, placementSeed: 7, triangulationSeed: 1 })
  const { count, placementSeed, triangulationSeed } = configuration
  const [triangles, setTriangles] = useState(() => triangulate(8, 1))
  const [forced, setForced] = useState<Edge[]>([])
  const [showCircles, setShowCircles] = useState(true)
  const [fanVertex, setFanVertex] = useState(0)
  const fanIndex = fanVertex === 0 ? null : fanVertex - 1
  const [activeTriangle, setActiveTriangle] = useState<number | null>(null)
  const [drag, setDrag] = useState<{ start: number; point: Point; target: number | null } | null>(null)
  const [keyboardStart, setKeyboardStart] = useState<number | null>(null)
  const [message, setMessage] = useState('Try another triangulation. Watch the sum stay put.')
  const svgRef = useRef<SVGSVGElement>(null)

  const vertices = useMemo(() => createVertices(count, placementSeed), [count, placementSeed])
  const circles = triangles.map((triangle) => incircle(vertices, triangle))
  const edges = triangleEdges(triangles).filter((edge) => !isBoundary(edge, count))
  const previewEdge: Edge | null = drag && drag.target !== null && drag.target !== drag.start
    ? [drag.start, drag.target]
    : null
  const affectedTriangles = previewEdge
    ? triangles.filter((triangle) => triangleEdges([triangle]).some((edge) => edgesCross(edge, previewEdge)))
    : []
  const sum = circles.reduce((total, circle) => total + circle.radius, 0)
  const reference = referenceSum(vertices)
  const invariant = Math.abs(sum - reference) < 1e-10
  const visibleTerms = circles.length > 20
    ? [...circles.slice(0, 9).map((_, index) => index), -1, ...circles.slice(-9).map((_, index) => circles.length - 9 + index)]
    : circles.map((_, index) => index)

  function changeConfiguration(change: Partial<typeof configuration>) {
    const next = { ...configuration, ...change }
    setConfiguration(next)
    if (fanVertex > next.count) setFanVertex(0)
    setTriangles(triangulate(next.count, next.triangulationSeed))
    setForced([])
    setDrag(null)
    setKeyboardStart(null)
    setActiveTriangle(null)
    setMessage('Configuration changed. Forced diagonals cleared.')
  }

  function addDiagonal(a: number, b: number) {
    setKeyboardStart(null)
    if (a === b) {
      setMessage('Choose a different vertex to complete a diagonal.')
      return
    }
    if (isBoundary([a, b], count)) {
      setMessage('Those vertices already share a polygon side. Choose non-neighboring vertices.')
      return
    }
    const next = forceEdge(forced, [a, b])
    const removed = forced.filter((edge) => !next.some((item) => edgeKey(item) === edgeKey(edge))).length
    setTriangles(insertDiagonal(count, triangulationSeed, triangles, [a, b]))
    setForced(next)
    setActiveTriangle(null)
    setMessage(`Forced ${vertexName(a)}–${vertexName(b)}.${removed ? ` Replaced ${removed} crossing diagonal${removed === 1 ? '' : 's'}.` : ' Compatible diagonals kept.'}`)
  }

  function pointerPosition(event: PointerEvent<SVGSVGElement>): Point {
    const svg = svgRef.current!
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(svg.getScreenCTM()!.inverse())
    return { x: point.x, y: point.y }
  }

  function nearestVertex(point: Point): number | null {
    let nearest: number | null = null
    let distance = 25
    vertices.forEach((vertex, index) => {
      const target = screen(vertex)
      const candidate = Math.hypot(point.x - target.x, point.y - target.y)
      if (candidate < distance) {
        nearest = index
        distance = candidate
      }
    })
    return nearest
  }

  function vertexKey(event: KeyboardEvent<SVGGElement>, index: number) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      if (keyboardStart === null) {
        setKeyboardStart(index)
        setMessage(`Vertex ${vertexName(index)} selected. Tab to another vertex and press Enter.`)
      } else {
        addDiagonal(keyboardStart, index)
      }
    }
  }

  return (
    <>
        <div className="exploration-layout">
          <section className="drawing-card" aria-label="Interactive cyclic polygon">
            <div className="drawing-header">
              <span className="diagram-title">A circle. <strong>{count} vertices.</strong> Endless possibilities.</span>
              <span className="unit-label">CIRCUMRADIUS <strong>R = 1</strong></span>
            </div>
            <div className="svg-container">
              <svg ref={svgRef} viewBox="0 0 640 640" className={`geometry${drag ? ' dragging' : ''}${fanIndex !== null ? ' fan-shading' : ''}`}
                aria-label={`Cyclic ${count}-gon with ${triangles.length} triangles. Drag between vertices to force a diagonal.`}
                onPointerMove={(event) => {
                  if (!drag) return
                  const point = pointerPosition(event)
                  setDrag({ ...drag, point, target: nearestVertex(point) })
                }}
                onPointerUp={(event) => {
                  if (!drag) return
                  const target = nearestVertex(pointerPosition(event))
                  if (target !== null && target !== drag.start) addDiagonal(drag.start, target)
                  else setMessage('Drag from one vertex to another to force a diagonal.')
                  setDrag(null)
                }}
                onPointerCancel={() => setDrag(null)}
                onLostPointerCapture={() => setDrag(null)}
                onKeyDown={(event) => {
                  if (event.key === 'Escape') {
                    setDrag(null)
                    setKeyboardStart(null)
                    setMessage('Diagonal selection cancelled.')
                  }
                }}>
                <title>The Japanese theorem: explore a cyclic polygon</title>
                <desc>Colored triangles share a circumcircle. Each triangle has an incircle. The sum of their radii is independent of the triangulation. Vertices can also be selected with Tab and Enter.</desc>
                <defs>
                  <pattern id="dot-grid" width="22" height="22" patternUnits="userSpaceOnUse">
                    <circle cx="1" cy="1" r="0.8" fill="#dcded8" />
                  </pattern>
                </defs>
                <rect width="640" height="640" fill="url(#dot-grid)" />
                <line x1="305" y1="320" x2="335" y2="320" className="center-cross" />
                <line x1="320" y1="305" x2="320" y2="335" className="center-cross" />
                <circle cx={CENTER} cy={CENTER} r={RADIUS} className="circumcircle" />
                {triangles.map((triangle, index) => (
                  <polygon key={triangle.join('-')} data-testid="triangle"
                    points={triangle.map((vertex) => { const p = screen(vertices[vertex]); return `${p.x},${p.y}` }).join(' ')}
                    fill={COLORS[index % COLORS.length]} fillOpacity={activeTriangle === index ? 0.23 : 0.055}
                    className={`triangle-fill${fanIndex !== null && triangle.includes(fanIndex) ? ' fan-triangle' : ''}${activeTriangle === index ? ' active' : ''}`} />
                ))}
                <g className="affected-preview" aria-hidden="true">
                  {affectedTriangles.map((triangle) => (
                    <polygon key={triangle.join('-')} data-testid="affected-triangle"
                      points={triangle.map((vertex) => { const p = screen(vertices[vertex]); return `${p.x},${p.y}` }).join(' ')} />
                  ))}
                </g>
                <polygon points={vertices.map((vertex) => { const p = screen(vertex); return `${p.x},${p.y}` }).join(' ')}
                  className="polygon-boundary" />
                {edges.map((edge) => {
                  const a = screen(vertices[edge[0]])
                  const b = screen(vertices[edge[1]])
                  const isForced = forced.some((item) => edgeKey(item) === edgeKey(edge))
                  return <line key={edgeKey(edge)} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                    className={isForced ? 'diagonal forced' : 'diagonal'}
                    data-testid={isForced ? 'forced-edge' : 'diagonal'} data-edge={edgeKey(edge)} />
                })}
                {showCircles && circles.map((circle, index) => {
                  const point = screen(circle)
                  return <g key={triangles[index].join('-')} className="incircle-group"
                    onPointerEnter={() => { if (!drag) setActiveTriangle(index) }}
                    onPointerLeave={() => setActiveTriangle(null)}>
                    <circle data-testid="incircle" cx={point.x} cy={point.y} r={circle.radius * RADIUS}
                      stroke={COLORS[index % COLORS.length]} fill={COLORS[index % COLORS.length]}
                      fillOpacity={activeTriangle === index ? 0.22 : 0.12} strokeWidth={activeTriangle === index ? 2.7 : 1.7} />
                    <circle cx={point.x} cy={point.y} r="2" fill={COLORS[index % COLORS.length]} />
                    {circle.radius * RADIUS > 17 && <text x={point.x} y={point.y - 7} className="radius-label"
                      fill={COLORS[index % COLORS.length]}>r<tspan baselineShift="sub" fontSize="9">{index + 1}</tspan></text>}
                    <title>{`r${index + 1} = ${circle.radius.toFixed(6)} R`}</title>
                  </g>
                })}
                {drag && <line x1={screen(vertices[drag.start]).x} y1={screen(vertices[drag.start]).y}
                  x2={drag.target === null ? drag.point.x : screen(vertices[drag.target]).x}
                  y2={drag.target === null ? drag.point.y : screen(vertices[drag.target]).y} className="drag-preview" />}
                {vertices.map((vertex, index) => {
                  const point = screen(vertex)
                  const label = { x: CENTER + vertex.x * (RADIUS + 26), y: CENTER + vertex.y * (RADIUS + 26) }
                  const selected = keyboardStart === index || drag?.start === index || drag?.target === index
                  return <g key={index} role="button" tabIndex={0} aria-label={`Vertex ${vertexName(index)}`}
                    aria-description={fanIndex === index ? 'Selected fan vertex' : undefined}
                    aria-pressed={selected} className={`vertex${selected ? ' selected' : ''}${fanIndex === index ? ' fan-apex' : ''}`}
                    onKeyDown={(event) => vertexKey(event, index)}
                    onPointerDown={(event) => {
                      if (event.button !== 0 || !event.isPrimary) return
                      event.preventDefault()
                      event.currentTarget.focus()
                      svgRef.current!.setPointerCapture(event.pointerId)
                      setKeyboardStart(null)
                      setDrag({ start: index, point, target: index })
                    }}>
                    <circle cx={point.x} cy={point.y} r={count > 25 ? 10 : 14} className="vertex-hit" />
                    {fanIndex === index && <circle cx={point.x} cy={point.y} r="12" className="fan-apex-ring" />}
                    <circle cx={point.x} cy={point.y} r={selected ? 6.5 : 4.5} className="vertex-dot" />
                    <text x={label.x} y={label.y} className={`vertex-label${count > 26 ? ' small' : ''}`}>{vertexName(index)}</text>
                  </g>
                })}
              </svg>
            </div>
            <div className="drawing-footer">
              <div className="legend"><span><i className="legend-line" /> Polygon</span><span><i className="legend-line dashed" /> Diagonal</span><span><i className="legend-circle" /> Incircle</span></div>
              <span className="drag-hint">↗ Drag vertex to vertex</span>
            </div>
          </section>

          <aside className="controls" aria-label="Exploration controls">
            <div className="panel-heading"><span className="eyebrow">YOUR CONSTRUCTION</span><span className="tiny-cross">+</span></div>
            <Slider label="Vertices" value={count} min={3} max={40}
              onChange={(value) => changeConfiguration({ count: value })} description={`${count} vertices make ${count - 2} triangles.`} />
            <Slider label="Vertex placement" value={placementSeed} min={1} max={25}
              onChange={(value) => changeConfiguration({ placementSeed: value })} description="A new seed, a new cyclic polygon." />
            <Slider label="Triangulation" value={triangulationSeed} min={1} max={25}
              onChange={(value) => changeConfiguration({ triangulationSeed: value })} description="Same vertices. A different way to divide them." />
            <Slider label="Fan vertex" value={fanVertex} min={0} max={count}
              onChange={setFanVertex} formatValue={(value) => value === 0 ? '0' : vertexName(value - 1)}
              description="Shade triangles containing this vertex. 0 turns shading off." />

            <button className={`circle-toggle${showCircles ? ' on' : ''}`} aria-pressed={showCircles}
              onClick={() => setShowCircles(!showCircles)}>
              <span><span className="circle-icon" />{showCircles ? 'Hide incircles' : 'Show incircles'}</span>
              <span className="switch" aria-hidden="true"><span /></span>
            </button>

            <section className="forced-panel" aria-label="Forced diagonals">
              <div className="forced-heading"><h2>Make it your own</h2><span className="count-badge">{forced.length} forced</span></div>
              <p>Drag between two vertices to lock in a diagonal. Only crossing edges are replaced; all other edges stay put.</p>
              <p className="keyboard-hint">Keyboard: Tab to a vertex, Enter to select each end. Esc to cancel.</p>
              {forced.length > 0 && <div className="edge-chips">{forced.map((edge) => (
                <button key={edgeKey(edge)} aria-label={`Remove diagonal ${vertexName(edge[0])}-${vertexName(edge[1])}`}
                  onClick={() => {
                    setForced(forced.filter((item) => edgeKey(item) !== edgeKey(edge)))
                    setMessage('Forced diagonal removed.')
                  }}>{vertexName(edge[0])}–{vertexName(edge[1])}<span aria-hidden="true">×</span></button>
              ))}</div>}
              <button className="text-button" disabled={forced.length === 0}
                onClick={() => { setForced([]); setMessage('All forced diagonals cleared.') }}>↺ Clear forced diagonals</button>
            </section>
          </aside>
        </div>

        <section className="sum-card" aria-label="Sum of incircle radii">
          <div className="sum-main">
            <div className="sum-title"><span className="eyebrow">THE SUM OF THE INRADII</span><span className={`invariant-badge${invariant ? '' : ' error'}`}>{invariant ? '✓ Invariant preserved' : 'Calculation mismatch'}</span></div>
            <div className="sum-value"><span className="sigma">Σ r<sub>i</sub></span><span className="equals">=</span><output data-testid="radius-sum">{sum.toFixed(6)}</output><span className="sum-unit">R</span></div>
            <p>Change the triangulation, not the total.</p>
          </div>
          <div className="summands">
            <div className="summands-heading"><span>{circles.length} RADII, ONE CONSTANT</span><span>in units of R</span></div>
            <div className="terms" aria-label="Individual inradii">
              {visibleTerms.map((index) => index === -1
                ? <span className="ellipsis" key="ellipsis" title={`${circles.length - 18} more terms`}>+ ···</span>
                : <span className="term-wrapper" key={index}>
                    {index > 0 && <span className="plus">+</span>}
                    <button className={`term${activeTriangle === index ? ' highlighted' : ''}`}
                      style={{ '--term-color': COLORS[index % COLORS.length] } as React.CSSProperties}
                      aria-label={`Radius ${index + 1}: ${circles[index].radius.toFixed(6)}`}
                      onPointerEnter={() => setActiveTriangle(index)} onPointerLeave={() => setActiveTriangle(null)}
                      onFocus={() => setActiveTriangle(index)} onBlur={() => setActiveTriangle(null)}>
                      <span>r<sub>{index + 1}</sub></span>{circles[index].radius.toFixed(4)}
                    </button>
                  </span>)}
            </div>
            <p className="rounding-note">Terms rounded to 4 decimals; total calculated at full precision.</p>
          </div>
        </section>

        <div className="status-message" role="status" aria-label="Construction updates">{message}</div>
        <footer className="notebook-footer">
          <span className="footer-symbol" aria-hidden="true">∴</span>
          <p>For a fixed polygon inscribed in a circle, the sum of the triangles’ inradii is independent of its triangulation.<br /><span>New vertex placement changes the polygon, so it can change the sum. Incircle areas are not the invariant.</span></p>
          <span className="footer-tag">THE JAPANESE THEOREM</span>
        </footer>
    </>
  )
}

function App() {
  const [activeTab, setActiveTab] = useState(0)
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([])
  const tabs = ['Japanese Theorem', "Carnot's Theorem", 'Quadrilateral proof']
  return <div className="app-shell"><main>
    <nav className="tabs" role="tablist" aria-label="Explorations">
      {tabs.map((label, index) => (
        <button key={label} ref={(node) => { tabRefs.current[index] = node }}
          id={`tab-${index}`} role="tab" aria-selected={activeTab === index} aria-controls={`panel-${index}`}
          tabIndex={activeTab === index ? 0 : -1} className={`tab${activeTab === index ? ' active' : ''}`}
          onClick={() => setActiveTab(index)}
          onKeyDown={(event) => {
            if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return
            event.preventDefault()
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1
              : (index + (event.key === 'ArrowRight' ? 1 : -1) + tabs.length) % tabs.length
            setActiveTab(next)
            tabRefs.current[next]?.focus()
          }}><span>{String(index + 1).padStart(2, '0')}</span>{label}</button>
      ))}
    </nav>
    <section id="panel-0" role="tabpanel" aria-labelledby="tab-0" hidden={activeTab !== 0}><PolygonExplorer /></section>
    <section id="panel-1" role="tabpanel" aria-labelledby="tab-1" hidden={activeTab !== 1}><TriangleExplorer /></section>
    <section id="panel-2" role="tabpanel" aria-labelledby="tab-2" hidden={activeTab !== 2}><QuadrilateralExplorer /></section>
  </main></div>
}

export default App
