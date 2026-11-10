import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent, ReactNode } from 'react'
import { analyzeCarnotProof, carnotPreset, createCarnotTriangle, moveCarnotVertex } from './carnotProofGeometry'
import { CarnotSegments } from './TriangleExplorer'
import type { Point } from './geometry'
import type { TrianglePoints } from './triangleGeometry'
import './CarnotProofExplorer.css'

type Proof = Extract<ReturnType<typeof analyzeCarnotProof>, { valid: true }>
type Layers = { circle: boolean; incircle: boolean; distances: boolean; construction: boolean }
const COLORS = ['#487d82', '#8476a5', '#9c8644']
const RADIUS = 205
const screen = (point: Point) => ({ x: 320 + point.x * RADIUS, y: 320 + point.y * RADIUS })
const format = (value: number) => (Math.abs(value) < 0.0000005 ? 0 : value).toFixed(6)
const negative = (value: number) => value < -1e-8
const STEP = { angles: 1, cosine: 2, side: 3, area: 4, algebra: 5 }
const STEPS = [
  { title: 'Halve the central angle', text: 'The angle at the center is twice the angle at the circumference. Equal radii make an isosceles triangle; its perpendicular to the chord bisects the central angle.' },
  { title: 'Read the cosine', text: 'Keep just one of the right triangles from Step 1. Its hypotenuse is a radius R; its adjacent leg is OM. This is where cos A = d_a / R comes from.' },
  { title: 'Project a side', text: 'Drop an altitude to split a side into two signed projections. Replace each cosine using Step 2, then multiply by R. Repeat for all three sides.' },
  { title: 'Measure area twice', text: 'Hide the incircle to join O to the vertices; show it to join I instead. Both constructions measure the same triangle. Double the areas to remove the factor ½.' },
  { title: 'Collect the terms', text: 'Expand the product into nine terms. Step 4 collects the three diagonal terms; Step 3 collects the other six in pairs. Factor out the perimeter, then cancel it.' },
]

function termGroup({ row, col }: { row: number; col: number }): 'r' | number {
  return row === col ? 'r' : 3 - row - col
}

function Ratio({ top, bottom }: { top: ReactNode; bottom: ReactNode }) {
  return <span className="carnot-fraction"><span>{top}</span><span>{bottom}</span></span>
}

function D({ index }: { index: number }) {
  return <span style={{ color: COLORS[index] }}>d<sub>{'abc'[index]}</sub></span>
}

function Angle({ at, from, to, label, radius = 25, color, through, testId }: {
  at: Point; from: Point; to: Point; label?: string; radius?: number; color: string; through?: Point; testId?: string
}) {
  const start = Math.atan2(from.y - at.y, from.x - at.x)
  const cross = (from.x - at.x) * (to.y - at.y) - (from.y - at.y) * (to.x - at.x)
  const dot = (from.x - at.x) * (to.x - at.x) + (from.y - at.y) * (to.y - at.y)
  let sweep = Math.atan2(cross, dot)
  if (through) {
    const turn = 2 * Math.PI
    const positive = (angle: number) => (angle % turn + turn) % turn
    const toAngle = positive(Math.atan2(to.y - at.y, to.x - at.x) - start)
    const throughAngle = positive(Math.atan2(through.y - at.y, through.x - at.x) - start)
    sweep = throughAngle <= toAngle ? toAngle : toAngle - turn
  }
  const end = start + sweep
  const middle = start + sweep / 2
  return <g stroke={color} fill="none" data-testid={testId}>
    <path d={`M${at.x + radius * Math.cos(start)},${at.y + radius * Math.sin(start)} A${radius},${radius} 0 ${Math.abs(sweep) > Math.PI ? 1 : 0} ${sweep > 0 ? 1 : 0} ${at.x + radius * Math.cos(end)},${at.y + radius * Math.sin(end)}`} />
    {label && <text x={at.x + (radius + 14) * Math.cos(middle)} y={at.y + (radius + 14) * Math.sin(middle)}
      fill={color} textAnchor="middle" dominantBaseline="middle">{label}</text>}
  </g>
}

function TrianglePicture({ points, proof, step, focus, center, layers, activeTile, onMove, onRestore }: {
  points: TrianglePoints; proof: Proof; step: number; focus: number; center: 'O' | 'I'; layers: Layers
  activeTile: { row: number; col: number } | null
  onMove: (index: number, angle: number) => void; onRestore: (points: TrianglePoints) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ index: number; original: TrianglePoints } | null>(null)
  const { geometry } = proof
  const o = screen(geometry.outer)
  const inner = screen(geometry.inner)
  const side = geometry.sides[focus]
  const projection = proof.projections[focus]
  const foot = screen(side.foot)
  const radiusEnd = screen(side.start)
  const axis = screen({ x: geometry.outer.x + projection.outward.x * 1.14, y: geometry.outer.y + projection.outward.y * 1.14 })
  const altitude = screen(projection.foot)
  const areaCenter = center === 'O' ? geometry.outer : geometry.inner
  const rightAngle = Math.abs(side.signedDistance) < 1e-8
  const obtuseAngle = negative(side.signedDistance)
  const bisector = rightAngle ? axis : foot
  const halfLabel = rightAngle ? '90°' : obtuseAngle ? 'θ' : 'ABC'[focus]

  function move(event: PointerEvent<SVGSVGElement>) {
    const matrix = svgRef.current?.getScreenCTM()
    if (!drag.current || !matrix) return
    const p = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    onMove(drag.current.index, Math.atan2(p.y - 320, p.x - 320))
  }

  function vertexKey(event: KeyboardEvent<SVGGElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1
    onMove(index, Math.atan2(points[index].y, points[index].x) + direction * (event.shiftKey ? 5 : 1) * Math.PI / 180)
  }

  function cancel() {
    if (drag.current) onRestore(drag.current.original)
    drag.current = null
  }

  return <svg ref={svgRef} viewBox="0 0 640 640" className="geometry carnot-proof-diagram"
    aria-label="Interactive triangle for the Carnot proof" onPointerMove={move}
    onPointerUp={() => { drag.current = null }} onPointerCancel={cancel}
    onKeyDown={(event) => { if (event.key === 'Escape') cancel() }}>
    <defs>
      <pattern id="carnot-proof-grid" width="24" height="24" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="0.7" fill="#d9ded3" /></pattern>
      <pattern id="carnot-proof-negative" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="8" height="8" fill="#f3ddd4" /><line x1="0" x2="0" y1="0" y2="8" stroke="#b65341" strokeWidth="2" />
      </pattern>
      <marker id="carnot-proof-axis-arrow" viewBox="0 -4 8 8" refX="7" refY="0" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M0,-3 L7,0 L0,3" fill="none" stroke="#7d9183" strokeWidth="1.5" />
      </marker>
    </defs>
    <rect width="640" height="640" fill="url(#carnot-proof-grid)" />
    {layers.circle && <circle cx="320" cy="320" r={RADIUS} className="circumcircle" />}
    {step === STEP.area && geometry.sides.map((item, index) => {
      const signed = center === 'O' && negative(item.signedDistance)
      return <polygon key={index} data-testid="carnot-proof-area" data-signed={signed ? 'negative' : 'positive'}
        points={[areaCenter, item.start, item.end].map((p) => { const s = screen(p); return `${s.x},${s.y}` }).join(' ')}
        fill={signed ? 'url(#carnot-proof-negative)' : COLORS[index]} fillOpacity={signed ? 0.7 : 0.16} stroke={COLORS[index]} strokeWidth="1" />
    })}
    {step <= STEP.cosine && layers.construction && <polygon points={[o, radiusEnd, foot].map((p) => `${p.x},${p.y}`).join(' ')}
      fill={COLORS[focus]} fillOpacity="0.1" />}
    {step === STEP.angles && layers.construction && <polygon points={[o, foot, screen(side.end)].map((p) => `${p.x},${p.y}`).join(' ')}
      fill={COLORS[focus]} fillOpacity="0.17" />}
    <polygon className="polygon-boundary" opacity={step === STEP.cosine ? 0.4 : 1}
      points={points.map((point) => { const p = screen(point); return `${p.x},${p.y}` }).join(' ')} />
    {geometry.sides.map((item, index) => {
      const middle = screen(item.midpoint)
      const outward = proof.projections[index].outward
      const labelOffset = layers.construction && step <= STEP.cosine && index === focus ? (rightAngle ? 80 : 50) : 19
      return <g key={index}>
        {activeTile?.col === index && <line x1={screen(item.start).x} y1={screen(item.start).y}
          x2={screen(item.end).x} y2={screen(item.end).y} stroke="#bd6b4d" strokeWidth="5" />}
        <text data-testid="carnot-proof-side-label" x={middle.x + outward.x * labelOffset} y={middle.y + outward.y * labelOffset}
          textAnchor="middle" dominantBaseline="middle" fill={COLORS[index]}>{'abc'[index]}</text>
      </g>
    })}
    {layers.incircle && step >= STEP.side && <g data-testid="carnot-proof-incircle">
      <circle cx={inner.x} cy={inner.y} r={geometry.inner.radius * RADIUS} fill="#bd6b4d" fillOpacity="0.04" stroke="#bd6b4d" strokeWidth="1.7" />
      <circle cx={inner.x} cy={inner.y} r="2.5" fill="#bd6b4d" />
      <text x={inner.x + 10} y={inner.y - 10} fill="#bd6b4d">I</text>
    </g>}
    {layers.distances && step >= STEP.cosine && geometry.sides.map((item, index) => {
      if (step === STEP.cosine && index !== focus) return null
      const target = screen(item.foot)
      // The chord points away from the shaded half-triangle and is perpendicular to OM.
      const labelOffset = { x: (item.end.x - item.start.x) / item.length * 18, y: (item.end.y - item.start.y) / item.length * 18 }
      const active = activeTile ? activeTile.row === index : step >= STEP.side || index === focus
      return <g key={index} data-testid="carnot-proof-distance" data-value={item.signedDistance}
        opacity={active ? 1 : 0.22} style={{ color: negative(item.signedDistance) ? '#b65341' : COLORS[index] }}>
        <line x1={o.x} y1={o.y} x2={target.x} y2={target.y} stroke="currentColor"
          strokeWidth={activeTile?.row === index ? 4 : 2.5} strokeDasharray={negative(item.signedDistance) ? '6 4' : undefined} />
        <text x={(o.x + target.x) / 2 + labelOffset.x} y={(o.y + target.y) / 2 + labelOffset.y}
          textAnchor="middle" dominantBaseline="middle" fill="currentColor">
          d<tspan baselineShift="sub" fontSize="12">{'abc'[index]}</tspan>
        </text>
      </g>
    })}
    {layers.construction && step === STEP.angles && <g data-testid="carnot-central-construction">
      {[side.start, side.end].map((point, index) => {
        const end = screen(point)
        const dx = (end.x - o.x) / (geometry.outer.radius * RADIUS)
        const dy = (end.y - o.y) / (geometry.outer.radius * RADIUS)
        const mid = { x: (end.x + o.x) / 2, y: (end.y + o.y) / 2 }
        return <g key={index} data-testid="carnot-equal-radius">
          <line x1={o.x} y1={o.y} x2={end.x} y2={end.y} stroke="#487d82" strokeWidth="2" />
          <line x1={mid.x - dy * 5} y1={mid.y + dx * 5} x2={mid.x + dy * 5} y2={mid.y - dx * 5} stroke="#487d82" strokeWidth="2" />
          <text x={mid.x - dy * 15} y={mid.y + dx * 15} fill="#487d82">R</text>
        </g>
      })}
      <line x1={o.x} y1={o.y} x2={bisector.x} y2={bisector.y} stroke={COLORS[focus]} strokeWidth="2"
        strokeDasharray={rightAngle ? '4 5' : undefined} />
      <Angle at={o} from={radiusEnd} to={screen(side.end)} radius={72}
        color={COLORS[focus]} through={axis} testId="carnot-central-angle" />
      <Angle at={o} from={radiusEnd} to={bisector} label={halfLabel} radius={35} color={COLORS[focus]} testId="carnot-half-angle-first" />
      <Angle at={o} from={bisector} to={screen(side.end)} label={halfLabel} radius={35} color={COLORS[focus]} testId="carnot-half-angle-second" />
      <Angle at={screen(points[focus])} from={screen(side.start)} to={screen(side.end)} label={'ABC'[focus]} color={COLORS[focus]} testId="carnot-inscribed-angle" />
    </g>}
    {layers.construction && step === STEP.cosine && <g data-testid="carnot-radius-projection">
      {obtuseAngle && <>
        <line x1={o.x} y1={o.y} x2={axis.x} y2={axis.y} stroke="#7d9183" strokeDasharray="3 5" markerEnd="url(#carnot-proof-axis-arrow)" />
        <text x={axis.x + 8} y={axis.y - 8} fill="#7d9183">+</text>
      </>}
      <line x1={o.x} y1={o.y} x2={radiusEnd.x} y2={radiusEnd.y} stroke="#487d82" strokeWidth="2" />
      <line x1={radiusEnd.x} y1={radiusEnd.y} x2={foot.x} y2={foot.y} stroke={COLORS[focus]} strokeWidth="2" />
      <text x={(o.x + radiusEnd.x) / 2 - 12} y={(o.y + radiusEnd.y) / 2 - 9} fill="#487d82">R</text>
      {!rightAngle && <Angle at={o} from={foot} to={radiusEnd} label={halfLabel} radius={36} color={COLORS[focus]} />}
    </g>}
    {layers.construction && step <= STEP.cosine && <g data-testid="carnot-chord-midpoint">
      <circle cx={foot.x} cy={foot.y} r="3" fill={COLORS[focus]} />
      <text x={rightAngle ? foot.x + 10 : foot.x + projection.outward.x * 20}
        y={rightAngle ? foot.y + 18 : foot.y + projection.outward.y * 20} textAnchor={rightAngle ? 'start' : 'middle'}
        dominantBaseline="middle" fill={COLORS[focus]}>{rightAngle ? 'M = O' : 'M'}</text>
      {Math.abs(side.signedDistance) > 1e-5 && (() => {
        const u = { x: (radiusEnd.x - foot.x) / (side.length * RADIUS / 2), y: (radiusEnd.y - foot.y) / (side.length * RADIUS / 2) }
        const length = Math.hypot(o.x - foot.x, o.y - foot.y)
        const v = { x: (o.x - foot.x) / length, y: (o.y - foot.y) / length }
        const size = Math.min(10, length / 3, side.length * RADIUS / 6)
        return <path d={`M${foot.x + u.x * size},${foot.y + u.y * size} l${v.x * size},${v.y * size} l${-u.x * size},${-u.y * size}`}
          fill="none" stroke={COLORS[focus]} />
      })()}
    </g>}
    {layers.construction && step === STEP.side && <g data-testid="carnot-side-projection">
      <line x1={screen(side.opposite).x} y1={screen(side.opposite).y} x2={altitude.x} y2={altitude.y}
        stroke="#839486" strokeDasharray="4 5" />
      {[{ from: screen(side.start), to: altitude, value: projection.first, color: COLORS[(focus + 1) % 3] },
        { from: altitude, to: screen(side.end), value: projection.second, color: COLORS[(focus + 2) % 3] }]
        .sort((a, b) => Number(negative(a.value)) - Number(negative(b.value))).map((part, index) =>
        <line key={index} data-testid="carnot-side-part" data-value={part.value}
          x1={part.from.x} y1={part.from.y} x2={part.to.x} y2={part.to.y}
          stroke={part.color} strokeWidth="4" strokeDasharray={negative(part.value) ? '5 4' : undefined} />)}
      <circle cx={altitude.x} cy={altitude.y} r="3" fill="#657f6e" />
      <text x={altitude.x + 10} y={altitude.y + 17} fill="#657f6e">H</text>
      {(() => {
        const opposite = screen(side.opposite)
        const length = Math.hypot(opposite.x - altitude.x, opposite.y - altitude.y)
        const u = { x: (side.end.x - side.start.x) / side.length, y: (side.end.y - side.start.y) / side.length }
        const v = { x: (opposite.x - altitude.x) / length, y: (opposite.y - altitude.y) / length }
        const size = Math.min(9, length / 4, side.length * RADIUS / 6)
        return <path d={`M${altitude.x + u.x * size},${altitude.y + u.y * size} l${v.x * size},${v.y * size} l${-u.x * size},${-u.y * size}`}
          fill="none" stroke="#657f6e" />
      })()}
      {points.map((point, index) => <Angle key={index} at={screen(point)}
        from={screen(points[(index + 1) % 3])} to={screen(points[(index + 2) % 3])} label={'ABC'[index]} color={COLORS[index]} />)}
    </g>}
    {layers.construction && step === STEP.area && center === 'I' && geometry.sides.map((item, index) => {
      const touch = screen(item.touch)
      return <g key={index} data-testid="carnot-inradius-height"><line x1={inner.x} y1={inner.y} x2={touch.x} y2={touch.y} stroke="#bd6b4d" strokeWidth="2" strokeDasharray="4 5" />
        <text x={(inner.x + touch.x) / 2 + 9} y={(inner.y + touch.y) / 2 - 6} fill="#bd6b4d">r</text></g>
    })}
    {(step <= STEP.cosine || layers.circle) && <g data-testid="carnot-proof-circumcenter">
      <circle cx={o.x} cy={o.y} r="3" fill="#487d82" /><text x={o.x + 10} y={o.y - 12} fill="#487d82">O</text>
    </g>}
    {points.map((point, index) => {
      const p = screen(point)
      return <g key={index} role="button" className="vertex" tabIndex={0} aria-label={`Carnot proof vertex ${'ABC'[index]}`}
        onKeyDown={(event) => vertexKey(event, index)}
        onPointerDown={(event) => {
          if (event.button !== 0 || !svgRef.current) return
          event.currentTarget.focus()
          drag.current = { index, original: points }
          svgRef.current.setPointerCapture(event.pointerId)
        }}>
        <circle className="vertex-hit" cx={p.x} cy={p.y} r="20" />
        <circle className="vertex-dot carnot-proof-vertex" cx={p.x} cy={p.y} r="4" />
        <text className="vertex-label" x={320 + point.x * 237} y={320 + point.y * 237}>{'ABC'[index]}</text>
      </g>
    })}
  </svg>
}

function ProjectionChart({ proof, focus }: { proof: Proof; focus: number }) {
  const projection = proof.projections[focus]
  const length = proof.geometry.sides[focus].length
  const ends = [0, projection.first, length]
  const min = Math.min(...ends)
  const max = Math.max(...ends)
  const x = (value: number) => `${10 + (value - min) / (max - min) * 80}%`
  const staggered = negative(projection.first) || negative(projection.second)
  return <svg className="carnot-projection-chart" height={staggered ? 152 : 120} role="img" aria-label="Signed side projections add to the whole side">
    <line x1={x(0)} x2={x(length)} y1="30" y2="30" stroke={COLORS[focus]} strokeWidth="4" />
    <text x={x(length / 2)} y="17" fill={COLORS[focus]}>{'abc'[focus]}</text>
    {[projection.first, projection.second].map((value, index) => {
      const y = 85 + (staggered ? index * 36 : 0)
      const color = negative(value) ? '#b65341' : COLORS[(focus + index + 1) % 3]
      return <g key={index}>
        <line data-testid="carnot-projection-part" x1={x(ends[index])} x2={x(ends[index + 1])} y1={y} y2={y}
          stroke={color} strokeWidth="3" strokeDasharray={negative(value) ? '5 4' : undefined} />
        <text x={x((ends[index] + ends[index + 1]) / 2)} y={y - 12} fill={color}>
          {'abc'[(focus + (index === 0 ? 2 : 1)) % 3]} cos {'ABC'[(focus + index + 1) % 3]}{negative(value) ? ' < 0' : ''}
        </text>
        {staggered && index === 0 && <line x1={x(ends[1])} x2={x(ends[1])} y1={y} y2={y + 36} stroke="#c6cebf" strokeDasharray="3 4" />}
      </g>
    })}
  </svg>
}

export default function CarnotProofExplorer() {
  const [seed, setSeed] = useState(11)
  const [points, setPoints] = useState<TrianglePoints>(() => createCarnotTriangle(11))
  const [preset, setPreset] = useState<string | null>(null)
  const [step, setStep] = useState(STEP.angles)
  const [focus, setFocus] = useState(0)
  const [activeTile, setActiveTile] = useState<{ row: number; col: number } | null>(null)
  const [layers, setLayers] = useState<Layers>({ circle: true, incircle: true, distances: true, construction: true })
  const proof = analyzeCarnotProof(points)
  if (!proof.valid) return <p role="alert">{proof.reason}</p>
  const { geometry } = proof
  const j = (focus + 1) % 3
  const k = (focus + 2) % 3
  const angleName = 'ABC'[focus]
  const startName = 'ABC'[j]
  const endName = 'ABC'[k]
  const obtuseAngle = negative(geometry.sides[focus].signedDistance)
  const rightAngle = Math.abs(geometry.sides[focus].signedDistance) < 1e-8
  const degrees = proof.angles[focus] * 180 / Math.PI
  const halfDegrees = obtuseAngle ? 180 - degrees : degrees
  const verified = Math.max(Math.abs(proof.innerArea - proof.inradiusArea), Math.abs(proof.outerArea - proof.circumradiusArea),
    Math.abs(proof.sumDistances - geometry.outer.radius - geometry.inner.radius)) < 1e-9
  const weighted = <span>a<D index={0} /> + b<D index={1} /> + c<D index={2} /></span>
  const collection = activeTile ? termGroup(activeTile) : null

  function reset(nextSeed: number) {
    setSeed(nextSeed)
    setPoints(createCarnotTriangle(nextSeed))
    setPreset(null)
    setActiveTile(null)
  }

  return <>
    <div className="exploration-layout">
      <section className="drawing-card" aria-label="Carnot proof construction">
        <div className="drawing-header"><span className="diagram-title"><strong>Triangle ABC</strong></span>
          <span className="unit-label">CIRCUMRADIUS <strong>R = 1</strong></span></div>
        <TrianglePicture points={points} proof={proof} step={step} focus={focus} center={layers.incircle ? 'I' : 'O'} layers={layers} activeTile={activeTile}
          onRestore={setPoints} onMove={(index, angle) => { setPoints((current) => moveCarnotVertex(current, index, angle)); setPreset(null) }} />
        <div className="drawing-footer"><span className="diagram-title">Drag the vertices around the circle.</span>
          <span className="diagram-title">{'ABC'[focus]} = {(proof.angles[focus] * 180 / Math.PI).toFixed(1)}° · <D index={focus} /> = {format(geometry.sides[focus].signedDistance)}</span></div>
      </section>
      <aside className="controls proof-controls" aria-label="Carnot proof settings">
        <div className="panel-heading"><span className="eyebrow">CARNOT PROOF</span><span className="tiny-cross">+</span></div>
        <div className="slider-control"><label><span className="control-heading"><span>Proof triangle seed</span><output>{seed.toString().padStart(2, '0')}</output></span>
          <input type="range" min="1" max="25" value={seed} aria-label="Proof triangle seed"
            style={{ '--progress': `${(seed - 1) / 24 * 100}%` } as React.CSSProperties} onChange={(event) => reset(Number(event.target.value))} />
        </label><div className="range-endpoints"><span>1</span><span>25</span></div></div>
        <div className="carnot-presets" role="group" aria-label="Triangle examples">
          {(['Acute', 'Right', 'Obtuse'] as const).map((kind) => <button key={kind} aria-pressed={preset === kind}
            onClick={() => { setPoints(carnotPreset(kind)); setPreset(kind); setFocus(kind === 'Acute' ? 0 : 1); setActiveTile(null) }}>{kind}</button>)}
        </div>
        <div className="proof-steps" role="group" aria-label="Carnot proof steps">
          {STEPS.map((item, index) => <button key={item.title} aria-pressed={step === index + 1}
            onClick={() => { setStep(index + 1); setActiveTile(null) }}><span>{index + 1}</span>{item.title}</button>)}
        </div>
        <p className="proof-step-description">{STEPS[step - 1].text}</p>
        <fieldset className="proof-view"><legend>Focus side / opposite angle</legend>
          {['a / A', 'b / B', 'c / C'].map((label, index) => <label key={label}>
            <input type="radio" name="carnot-proof-focus" checked={focus === index} onChange={() => setFocus(index)} />{label}</label>)}
        </fieldset>
        <div className="proof-layer-controls">
          {([['circle', 'Circumcircle'], ['incircle', 'Incircle'], ['distances', 'Signed distances'], ['construction', 'Construction lines']] as const)
            .filter(([key]) => step >= STEP.side || key === 'circle' || key === 'construction' || step === STEP.cosine && key === 'distances')
            .map(([key, label]) => <button key={key} className={`circle-toggle${layers[key] ? ' on' : ''}`} aria-pressed={layers[key]}
              onClick={() => setLayers((current) => ({ ...current, [key]: !current[key] }))}>
              <span>{label}</span><span className="switch" aria-hidden="true"><span /></span></button>)}
        </div>
        <p className="proof-keyboard-hint">Arrow keys move a focused vertex; Shift moves faster. Escape cancels a drag.</p>
        <button className="text-button" onClick={() => reset(seed)}>Reset to seed</button>
      </aside>
    </div>
    <section className="proof-algebra carnot-proof-algebra" aria-label="Proof of Carnot's theorem">
      <div className="proof-algebra-heading"><h2>{step}. {STEPS[step - 1].title}</h2>
        <span className={`invariant-badge${verified ? '' : ' error'}`}>{verified ? 'Live geometry agrees' : 'Numerical check failed'}</span></div>
      <div className="carnot-proof-explanation">
        {step === STEP.angles && <>
          <div className="carnot-main-equation">{obtuseAngle ? 'Reflex ' : ''}∠{startName}O{endName} = 2{angleName}</div>
          {rightAngle ? <p>The chord {startName}{endName} is a diameter: its central angle is 180°. M coincides with O, and the perpendicular axis makes 90° on each side. The distance <D index={focus} /> is zero.</p>
            : <ol className="carnot-angle-reasoning">
              <li>The angle-at-the-center theorem gives {obtuseAngle ? 'the reflex angle ' : ''}∠{startName}O{endName} = 2{angleName}.</li>
              <li>O{startName} = O{endName} = R, so triangle O{startName}{endName} is isosceles. The matching radius ticks mark its equal sides.</li>
              <li>OM is perpendicular to {startName}{endName}, so it also bisects {obtuseAngle ? 'the smaller central angle' : 'the central angle'}.
                {obtuseAngle ? <> That smaller angle is 360° − 2{angleName}, so each half is θ = 180° − {angleName}.</>
                  : <> Therefore ∠{startName}OM = ∠MO{endName} = {angleName}.</>}</li>
            </ol>}
          <div className="carnot-numeric-equation" data-testid="carnot-angle-halves">
            {obtuseAngle ? `360° − ${(2 * degrees).toFixed(2)}°` : `${(2 * degrees).toFixed(2)}°`}
            {' = '}{halfDegrees.toFixed(2)}° + {halfDegrees.toFixed(2)}°
          </div>
          <p>No trigonometry yet: first establish which angle belongs in the right triangle.</p>
        </>}
        {step === STEP.cosine && <>
          <div className="carnot-main-equation carnot-cosine-equation">cos {angleName} = {rightAngle ? '0 =' : obtuseAngle ? <>
            −cos θ = −<Ratio top="OM" bottom={`O${startName}`} /> =
          </> : <>
            <Ratio top="adjacent" bottom="hypotenuse" /> = <Ratio top="OM" bottom={`O${startName}`} /> =
          </>} <Ratio top={<D index={focus} />} bottom="R" /></div>
          <div className="carnot-area-explanations">
            <div><h3>Hypotenuse of triangle O{startName}M</h3><div className="carnot-small-equation">O{startName} = R</div><p>It runs from the center to a vertex on the circle.</p></div>
            <div><h3>Adjacent leg at O</h3><div className="carnot-small-equation">OM = {obtuseAngle ? '−' : ''}<D index={focus} />{rightAngle ? ' = 0' : ''}</div>
              <p>{rightAngle ? 'M and O coincide, so this leg has zero length.' : obtuseAngle
                ? `The right-triangle angle is θ = 180° − ${angleName}. OM is a positive length, but the signed distance is negative.`
                : `Step 1 established ∠${startName}OM = ${angleName}. The leg next to that angle is the perpendicular distance to the side.`}</p></div>
          </div>
          {rightAngle && <p>The right triangle has collapsed to a line. Use cos 90° = 0; the same signed-distance identity still holds.</p>}
          <div className="carnot-numeric-equation">cos {degrees.toFixed(2)}° = {format(geometry.sides[focus].signedDistance)} / {format(geometry.outer.radius)}</div>
          <p>The same construction works at every vertex: cos A = <D index={0} /> / R, cos B = <D index={1} /> / R, and cos C = <D index={2} /> / R.</p>
        </>}
        {step === STEP.side && <>
          <div className="carnot-main-equation">{'abc'[focus]} = {'abc'[k]} cos {'ABC'[j]} + {'abc'[j]} cos {'ABC'[k]}</div>
          <ProjectionChart proof={proof} focus={focus} />
          <p>{startName}H + H{endName} = {startName}{endName}, with directed lengths if H falls beyond an endpoint.
            Step 2 gives each cosine as adjacent leg / hypotenuse. Inspect either substitution in its own right-triangle diagram:</p>
          <div className="carnot-substitutions">
            {[j, k].map((index) => <button key={index} aria-label={`Explain cos ${'ABC'[index]}`}
              onClick={() => { setFocus(index); setStep(STEP.cosine) }}>
              cos {'ABC'[index]} = <Ratio top={<D index={index} />} bottom="R" />
            </button>)}
          </div>
          <p>Substitute these two ratios into the side equation above, then multiply by R:</p>
          <div className="carnot-main-equation">{'abc'[focus]}R = {'abc'[k]}<D index={j} /> + {'abc'[j]}<D index={k} /></div>
          <div className="carnot-numeric-equation">{format(proof.projections[focus].leftArea)} = {format(proof.projections[focus].rightArea)}</div>
          <p>Choose each focus side to obtain the three identities needed for the six R pieces.</p>
        </>}
        {step === STEP.area && <>
          <div className="carnot-main-equation">{weighted} = 2Δ = <span className="carnot-r-color">(a + b + c)r</span></div>
          <div className="carnot-area-explanations"><div><h3>Center O: signed areas</h3>
            <p>Each triangle has area ½ × side × signed distance. A hatched triangle is subtracted; overlaps cancel.</p>
            <output data-testid="carnot-weighted-area">{format(proof.innerArea)}</output></div>
            <div><h3>Center I: all heights equal r</h3><p>The incircle touches every side, so all three perpendicular heights are r. Adding the doubled triangle areas gives ar + br + cr = (a + b + c)r.</p>
              <output data-testid="carnot-inradius-area">{format(proof.inradiusArea)}</output></div></div>
          <p>Δ denotes the triangle’s area. Hide the incircle for the O dissection; show it for the I dissection.</p>
        </>}
        {step === STEP.algebra && <>
          <div className="carnot-main-equation" data-testid="carnot-expanded-product">
            <span>(a + b + c)</span><span>(<D index={0} /> + <D index={1} /> + <D index={2} />)</span>
          </div>
          <p id="carnot-expansion-help">Expand the product. Hover over a term to see its group.</p>
          <div className="carnot-expansion" role="group" aria-label="Nine-term expansion">
            {proof.tiles.map((tile, index) => {
              const termCollection = termGroup(tile)
              return <div key={`${tile.row}-${tile.col}`} className="carnot-expansion-cell">
                <span className="carnot-expansion-plus">{index === 0 ? '=' : '+'}</span>
                <span className="carnot-expanded-term" data-testid="carnot-expansion-term" role="math"
                  data-row={tile.row} data-col={tile.col} data-value={tile.area}
                  data-highlighted={collection === termCollection}
                  data-dimmed={collection !== null && collection !== termCollection}
                  style={{ color: termCollection === 'r' ? '#bd6b4d' : COLORS[termCollection] }}
                  aria-label={`${'abc'[tile.col]} times d_${'abc'[tile.row]}`}
                  aria-describedby="carnot-expansion-help"
                  onPointerEnter={() => setActiveTile(tile)}
                  onPointerLeave={() => setActiveTile(null)}>
                  {'abc'[tile.col]}<D index={tile.row} />
                </span>
              </div>
            })}
          </div>
          <div className="carnot-collection carnot-r-color" data-testid="carnot-r-collection"
            data-highlighted={collection === 'r'} data-dimmed={collection !== null && collection !== 'r'}>
            <h3>Three diagonal terms, from Step 4</h3>
            <div className="carnot-small-equation">{weighted} = r(a + b + c)</div>
          </div>
          <h3 className="carnot-pairs-heading">Three pairs, from Step 3</h3>
          <div className="carnot-pair-identities">
            {geometry.sides.map((_, index) => <div key={index} className="carnot-projection-identity"
              data-testid="carnot-projection-pair" style={{ color: COLORS[index] }}
              data-highlighted={collection === index} data-dimmed={collection !== null && collection !== index}>
              {'abc'[(index + 2) % 3]}<D index={(index + 1) % 3} /> + {'abc'[(index + 1) % 3]}<D index={(index + 2) % 3} /> = {'abc'[index]}R
            </div>)}
          </div>
          <p>Collect these four groups, then factor the three R terms:</p>
          <div className="carnot-main-equation" data-testid="carnot-collected-groups">
            = <span className="carnot-r-color">r(a + b + c)</span>
            {geometry.sides.map((_, index) => <span key={index}> + <span style={{ color: COLORS[index] }}>{'abc'[index]}R</span></span>)}
          </div>
          <div className="carnot-main-equation" data-testid="carnot-collected-sum">
            = <span className="carnot-r-color">(a + b + c)r</span> + <span className="carnot-R-color">(a + b + c)R</span>
          </div>
          <div className="carnot-proof-conclusion" data-testid="carnot-proof-conclusion">
            <div className="carnot-main-equation" data-testid="carnot-factored-equality">
              <span>(a + b + c)(<D index={0} /> + <D index={1} /> + <D index={2} />)</span>
              = <span>(a + b + c)(r + R)</span>
            </div>
            <p>The perimeter a + b + c is positive, so divide both sides by it.</p>
            <div className="carnot-main-equation" data-testid="carnot-final-identity"><D index={0} /> + <D index={1} /> + <D index={2} /> = r + R</div>
            <div className="carnot-numeric-equation"><output data-testid="carnot-proof-sum">{format(proof.sumDistances)}</output> = <output data-testid="carnot-proof-radii">{format(geometry.outer.radius + geometry.inner.radius)}</output></div>
            <CarnotSegments outerRadius={geometry.outer.radius} innerRadius={geometry.inner.radius}
              distances={geometry.sides.map((item) => item.signedDistance)} lengthUnit={1} />
            <p>Both sides are calculated independently from the current triangle, at full precision.</p>
          </div>
        </>}
      </div>
      <div className="carnot-proof-source">Proof approach: <a href="https://www.cut-the-knot.org/proofs/carnot.shtml" target="_blank" rel="noreferrer">Alexander Bogomolny, Carnot’s Theorem, Proof 1</a>. The expansion uses the same projection-and-area argument.</div>
    </section>
  </>
}
