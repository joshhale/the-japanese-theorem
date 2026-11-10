import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
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
const STEPS = [
  { title: 'Project a radius', text: 'A radius projects onto a perpendicular distance: d_a = R cos A. The marked angles agree by the inscribed-angle theorem. An obtuse angle gives a negative projection.' },
  { title: 'Project a side', text: 'Drop an altitude to split a side into two signed projections. Replace each cosine using Step 1, then multiply by R. Repeat for all three sides.' },
  { title: 'Measure area twice', text: 'Join O to the vertices, then try I instead. Both constructions measure the same triangle. Double the areas to remove the factor ½.' },
  { title: 'Collect the tiles', text: 'Make three strips of width P = a + b + c, with signed heights d_a, d_b, d_c. Three tiles give Pr; the other six give PR. Hatched tiles are subtracted.' },
  { title: 'Cancel the perimeter', text: 'The nine tiles have total signed area P(d_a + d_b + d_c) = Pr + PR. Divide by the positive perimeter P. What remains is Carnot’s theorem.' },
]

function D({ index }: { index: number }) {
  return <span style={{ color: COLORS[index] }}>d<sub>{'abc'[index]}</sub></span>
}

function Angle({ at, from, to, label, radius = 25, color }: {
  at: Point; from: Point; to: Point; label: string; radius?: number; color: string
}) {
  const start = Math.atan2(from.y - at.y, from.x - at.x)
  const cross = (from.x - at.x) * (to.y - at.y) - (from.y - at.y) * (to.x - at.x)
  const dot = (from.x - at.x) * (to.x - at.x) + (from.y - at.y) * (to.y - at.y)
  const sweep = Math.atan2(cross, dot)
  const end = start + sweep
  const middle = start + sweep / 2
  return <g stroke={color} fill="none">
    <path d={`M${at.x + radius * Math.cos(start)},${at.y + radius * Math.sin(start)} A${radius},${radius} 0 0 ${sweep > 0 ? 1 : 0} ${at.x + radius * Math.cos(end)},${at.y + radius * Math.sin(end)}`} />
    <text x={at.x + (radius + 14) * Math.cos(middle)} y={at.y + (radius + 14) * Math.sin(middle)}
      fill={color} textAnchor="middle" dominantBaseline="middle">{label}</text>
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
    {step === 3 && geometry.sides.map((item, index) => {
      const signed = center === 'O' && negative(item.signedDistance)
      return <polygon key={index} data-testid="carnot-proof-area" data-signed={signed ? 'negative' : 'positive'}
        points={[areaCenter, item.start, item.end].map((p) => { const s = screen(p); return `${s.x},${s.y}` }).join(' ')}
        fill={signed ? 'url(#carnot-proof-negative)' : COLORS[index]} fillOpacity={signed ? 0.7 : 0.16} stroke={COLORS[index]} strokeWidth="1" />
    })}
    {step === 1 && layers.construction && <polygon points={[o, radiusEnd, foot].map((p) => `${p.x},${p.y}`).join(' ')}
      fill={COLORS[focus]} fillOpacity="0.1" />}
    <polygon className="polygon-boundary" points={points.map((point) => { const p = screen(point); return `${p.x},${p.y}` }).join(' ')} />
    {geometry.sides.map((item, index) => {
      const middle = screen(item.midpoint)
      const outward = proof.projections[index].outward
      return <g key={index}>
        {activeTile?.col === index && <line x1={screen(item.start).x} y1={screen(item.start).y}
          x2={screen(item.end).x} y2={screen(item.end).y} stroke="#bd6b4d" strokeWidth="5" />}
        <text x={middle.x + outward.x * 19} y={middle.y + outward.y * 19} textAnchor="middle" dominantBaseline="middle" fill={COLORS[index]}>{'abc'[index]}</text>
      </g>
    })}
    {layers.incircle && <g data-testid="carnot-proof-incircle">
      <circle cx={inner.x} cy={inner.y} r={geometry.inner.radius * RADIUS} fill="#bd6b4d" fillOpacity="0.04" stroke="#bd6b4d" strokeWidth="1.7" />
      <circle cx={inner.x} cy={inner.y} r="2.5" fill="#bd6b4d" />
      <text x={inner.x + 10} y={inner.y - 10} fill="#bd6b4d">I</text>
    </g>}
    {layers.distances && geometry.sides.map((item, index) => {
      const target = screen(item.foot)
      const active = activeTile ? activeTile.row === index : step >= 3 || index === focus || step === 2
      return <g key={index} data-testid="carnot-proof-distance" data-value={item.signedDistance}
        opacity={active ? 1 : 0.22} style={{ color: negative(item.signedDistance) ? '#b65341' : COLORS[index] }}>
        <line x1={o.x} y1={o.y} x2={target.x} y2={target.y} stroke="currentColor"
          strokeWidth={activeTile?.row === index ? 4 : 2.5} strokeDasharray={negative(item.signedDistance) ? '6 4' : undefined} />
        <text x={(o.x + target.x) / 2 + 11} y={(o.y + target.y) / 2 - 9} fill="currentColor">
          d<tspan baselineShift="sub" fontSize="12">{'abc'[index]}</tspan>
        </text>
      </g>
    })}
    {layers.construction && step === 1 && <g data-testid="carnot-radius-projection">
      <line x1={o.x - projection.outward.x * RADIUS * 0.75} y1={o.y - projection.outward.y * RADIUS * 0.75}
        x2={axis.x} y2={axis.y} stroke="#7d9183" strokeDasharray="3 5" markerEnd="url(#carnot-proof-axis-arrow)" />
      <text x={axis.x + 8} y={axis.y - 8} fill="#7d9183">+</text>
      <line x1={o.x} y1={o.y} x2={radiusEnd.x} y2={radiusEnd.y} stroke="#487d82" strokeWidth="2" />
      <line x1={o.x} y1={o.y} x2={screen(side.end).x} y2={screen(side.end).y} stroke="#487d82" strokeOpacity="0.5" strokeDasharray="4 5" />
      <text x={(o.x + radiusEnd.x) / 2 - 12} y={(o.y + radiusEnd.y) / 2 - 9} fill="#487d82">R</text>
      <Angle at={o} from={axis} to={radiusEnd} label={'ABC'[focus]} radius={36} color={COLORS[focus]} />
      <Angle at={screen(points[focus])} from={screen(side.start)} to={screen(side.end)} label={'ABC'[focus]} color={COLORS[focus]} />
      {Math.abs(side.signedDistance) > 1e-5 && (() => {
        const u = { x: (radiusEnd.x - foot.x) / (side.length * RADIUS / 2), y: (radiusEnd.y - foot.y) / (side.length * RADIUS / 2) }
        const length = Math.hypot(o.x - foot.x, o.y - foot.y)
        const v = { x: (o.x - foot.x) / length, y: (o.y - foot.y) / length }
        const size = Math.min(10, length / 3, side.length * RADIUS / 6)
        return <path d={`M${foot.x + u.x * size},${foot.y + u.y * size} l${v.x * size},${v.y * size} l${-u.x * size},${-u.y * size}`}
          fill="none" stroke={COLORS[focus]} />
      })()}
    </g>}
    {layers.construction && step === 2 && <g data-testid="carnot-side-projection">
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
    {layers.construction && step === 3 && center === 'I' && geometry.sides.map((item, index) => {
      const touch = screen(item.touch)
      return <g key={index}><line x1={inner.x} y1={inner.y} x2={touch.x} y2={touch.y} stroke="#bd6b4d" strokeWidth="2" />
        <text x={(inner.x + touch.x) / 2 + 9} y={(inner.y + touch.y) / 2 - 6} fill="#bd6b4d">r</text></g>
    })}
    <circle cx={o.x} cy={o.y} r="3" fill="#487d82" /><text x={o.x + 10} y={o.y - 12} fill="#487d82">O</text>
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

function AreaLedger({ proof, focus, group, onHover }: {
  proof: Proof; focus: number; group: 'All' | 'r pieces' | 'R pieces'
  onHover: (tile: { row: number; col: number } | null) => void
}) {
  const totalHeight = proof.geometry.sides.reduce((sum, side) => sum + Math.abs(side.signedDistance), 0)
  const scale = Math.min(480 / proof.perimeter, 240 / totalHeight)
  const xs = [100]
  for (const side of proof.geometry.sides) xs.push(xs[xs.length - 1] + side.length * scale)
  const ys = [65]
  for (const side of proof.geometry.sides) ys.push(ys[ys.length - 1] + Math.abs(side.signedDistance) * scale + 43)
  return <svg className="carnot-area-ledger" viewBox={`0 0 640 ${ys[3] + 8}`} role="group" aria-label="Nine signed area tiles">
    <defs><pattern id="carnot-tile-negative" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <line x1="0" x2="0" y1="0" y2="7" stroke="#b65341" strokeWidth="2" />
    </pattern></defs>
    <text x={(xs[0] + xs[3]) / 2} y="18" className="carnot-tile-perimeter">P = a + b + c</text>
    {proof.geometry.sides.map((_, col) => <text key={col} x={(xs[col] + xs[col + 1]) / 2} y="45" textAnchor="middle">{'abc'[col]}</text>)}
    {proof.geometry.sides.map((side, row) => <text key={row} x="80" y={ys[row] + Math.abs(side.signedDistance) * scale / 2}
      textAnchor="end" dominantBaseline="middle" style={{ fill: COLORS[row] }}>d<tspan baselineShift="sub" fontSize="12">{'abc'[row]}</tspan>{negative(side.signedDistance) ? ' < 0' : ''}</text>)}
    {proof.tiles.map((tile) => {
      const highlighted = group === 'All' || (group === 'r pieces' ? tile.inner : !tile.inner && 3 - tile.row - tile.col === focus)
      const height = Math.abs(tile.height) * scale
      return <g key={`${tile.row}-${tile.col}`} role="button" tabIndex={0}
        aria-label={`${'abc'[tile.col]} times d_${'abc'[tile.row]}: ${format(tile.area)}, ${tile.inner ? 'inradius' : 'circumradius'} piece`}
        data-testid="carnot-area-tile" data-area={tile.area} data-inner={String(tile.inner)} opacity={highlighted ? 1 : 0.2}
        onPointerEnter={() => onHover(tile)} onPointerLeave={() => onHover(null)}
        onFocus={() => onHover(tile)} onBlur={() => onHover(null)}
        onKeyDown={(event) => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); onHover(tile) } }}>
        <title>{`${'abc'[tile.col]} × d_${'abc'[tile.row]} = ${format(tile.area)}${negative(tile.area) ? ' (subtract this area)' : ''}`}</title>
        <rect x={xs[tile.col]} y={ys[tile.row]} width={tile.width * scale} height={height}
          fill={tile.inner ? '#bd6b4d' : '#487d82'} fillOpacity="0.18" stroke={tile.inner ? '#bd6b4d' : '#487d82'} />
        {negative(tile.area) && <rect data-testid="carnot-negative-tile" x={xs[tile.col]} y={ys[tile.row]}
          width={tile.width * scale} height={height} fill="url(#carnot-tile-negative)" />}
        {height > 22 && tile.width * scale > 48 && <text x={(xs[tile.col] + xs[tile.col + 1]) / 2}
          y={ys[tile.row] + height / 2} dominantBaseline="middle" textAnchor="middle">
          {'abc'[tile.col]}d<tspan baselineShift="sub" fontSize="12">{'abc'[tile.row]}</tspan>
        </text>}
      </g>
    })}
  </svg>
}

export default function CarnotProofExplorer() {
  const [seed, setSeed] = useState(11)
  const [points, setPoints] = useState<TrianglePoints>(() => createCarnotTriangle(11))
  const [preset, setPreset] = useState<string | null>(null)
  const [step, setStep] = useState(1)
  const [focus, setFocus] = useState(0)
  const [center, setCenter] = useState<'O' | 'I'>('O')
  const [group, setGroup] = useState<'All' | 'r pieces' | 'R pieces'>('All')
  const [activeTile, setActiveTile] = useState<{ row: number; col: number } | null>(null)
  const [layers, setLayers] = useState<Layers>({ circle: true, incircle: true, distances: true, construction: true })
  const proof = analyzeCarnotProof(points)
  if (!proof.valid) return <p role="alert">{proof.reason}</p>
  const { geometry } = proof
  const j = (focus + 1) % 3
  const k = (focus + 2) % 3
  const verified = Math.max(Math.abs(proof.innerArea - proof.inradiusArea), Math.abs(proof.outerArea - proof.circumradiusArea),
    Math.abs(proof.sumDistances - geometry.outer.radius - geometry.inner.radius)) < 1e-9
  const weighted = <span>a<D index={0} /> + b<D index={1} /> + c<D index={2} /></span>

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
        <TrianglePicture points={points} proof={proof} step={step} focus={focus} center={center} layers={layers} activeTile={activeTile}
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
        {step === 3 && <fieldset className="proof-view"><legend>Area center</legend>
          {(['O', 'I'] as const).map((value) => <label key={value}><input type="radio" name="carnot-area-center"
            checked={center === value} onChange={() => setCenter(value)} />{value}</label>)}
        </fieldset>}
        <div className="proof-layer-controls">
          {([['circle', 'Circumcircle'], ['incircle', 'Incircle'], ['distances', 'Signed distances'], ['construction', 'Construction lines']] as const)
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
        {step === 1 && <>
          <div className="carnot-main-equation"><D index={focus} /> = R cos {'ABC'[focus]}</div>
          <p>The perpendicular to a chord passes through its midpoint. The two radii to its endpoints form an isosceles triangle, so the marked angle at O equals the opposite inscribed angle, using the directed axis when obtuse.</p>
          <p>The signed projection is measured along the axis marked +, not always along the visible ray to the side. Past 90°, it points the other way.</p>
          <div className="carnot-numeric-equation">{format(geometry.sides[focus].signedDistance)} = {format(geometry.outer.radius)} × cos {(proof.angles[focus] * 180 / Math.PI).toFixed(2)}°</div>
        </>}
        {step === 2 && <>
          <div className="carnot-main-equation">{'abc'[focus]} = {'abc'[k]} cos {'ABC'[j]} + {'abc'[j]} cos {'ABC'[k]}</div>
          <ProjectionChart proof={proof} focus={focus} />
          <p>{'ABC'[j]}H + H{'ABC'[k]} = {'ABC'[j]}{'ABC'[k]}, with directed lengths if H falls beyond an endpoint. Substitute cos {'ABC'[j]} = <D index={j} /> / R and cos {'ABC'[k]} = <D index={k} /> / R, then multiply by R:</p>
          <div className="carnot-main-equation">{'abc'[focus]}R = {'abc'[k]}<D index={j} /> + {'abc'[j]}<D index={k} /></div>
          <div className="carnot-numeric-equation">{format(proof.projections[focus].leftArea)} = {format(proof.projections[focus].rightArea)}</div>
          <p>Choose each focus side to obtain the three identities needed for the six R pieces.</p>
        </>}
        {step === 3 && <>
          <div className="carnot-main-equation">{weighted} = 2Δ = <span className="carnot-r-color">Pr</span></div>
          <div className="carnot-area-explanations"><div><h3>Center O: signed areas</h3>
            <p>Each triangle has area ½ × side × signed distance. A hatched triangle is subtracted; overlaps cancel.</p>
            <output data-testid="carnot-weighted-area">{format(proof.innerArea)}</output></div>
            <div><h3>Center I: all heights equal r</h3><p>The three heights are inradii: ar + br + cr = (a + b + c)r = Pr. Here P is the whole perimeter, not the semiperimeter.</p>
              <output data-testid="carnot-inradius-area">{format(proof.inradiusArea)}</output></div></div>
          <p>Δ denotes the triangle’s area. Use Area center O / I to compare the two dissections.</p>
        </>}
        {step >= 4 && <>
          <div className="carnot-main-equation">P(<D index={0} /> + <D index={1} /> + <D index={2} />) = <span className="carnot-r-color">Pr</span> + <span className="carnot-R-color">PR</span></div>
          <div className="carnot-ledger-controls" role="group" aria-label="Highlight area pieces">
            {(['All', 'r pieces', 'R pieces'] as const).map((value) => <button key={value} aria-pressed={group === value} onClick={() => setGroup(value)}>{value}</button>)}
          </div>
          <AreaLedger proof={proof} focus={focus} group={group} onHover={setActiveTile} />
          <p className="carnot-ledger-hint">Actual widths and signed areas, on one scale. Hatching means subtract. Hover or focus a tile to highlight its base and height. For R pieces, choose a focus side to inspect each pair.</p>
          <div className="carnot-area-explanations"><div className="carnot-r-color"><h3>Three r pieces</h3>
            <div className="carnot-small-equation">{weighted} = Pr</div>
            <output data-testid="carnot-inner-tiles">{format(proof.innerArea)}</output></div>
            <div className="carnot-R-color"><h3>Six R pieces, paired by side projection</h3>
              {geometry.sides.map((_, index) => <button key={index} className="carnot-projection-identity" aria-pressed={focus === index}
                onClick={() => { setFocus(index); setGroup('R pieces') }}>
                {'abc'[(index + 2) % 3]}<D index={(index + 1) % 3} /> + {'abc'[(index + 1) % 3]}<D index={(index + 2) % 3} /> = {'abc'[index]}R
              </button>)}
              <output data-testid="carnot-outer-tiles">{format(proof.outerArea)}</output></div></div>
        </>}
        {step === 5 && <div className="carnot-proof-conclusion" data-testid="carnot-proof-conclusion">
          <div className="carnot-main-equation"><span className="carnot-cancelled">P</span>(<D index={0} /> + <D index={1} /> + <D index={2} />) = <span className="carnot-cancelled">P</span>(r + R)</div>
          <p>P is positive, so dividing both sides by P is valid.</p>
          <div className="carnot-main-equation"><D index={0} /> + <D index={1} /> + <D index={2} /> = R + r</div>
          <div className="carnot-numeric-equation"><output data-testid="carnot-proof-sum">{format(proof.sumDistances)}</output> = <output data-testid="carnot-proof-radii">{format(geometry.outer.radius + geometry.inner.radius)}</output></div>
          <CarnotSegments outerRadius={geometry.outer.radius} innerRadius={geometry.inner.radius}
            distances={geometry.sides.map((item) => item.signedDistance)} lengthUnit={1} />
          <p>Both sides are calculated independently from the current triangle, at full precision.</p>
        </div>}
      </div>
      <div className="carnot-proof-source">Proof approach: <a href="https://www.cut-the-knot.org/proofs/carnot.shtml" target="_blank" rel="noreferrer">Alexander Bogomolny, Carnot’s Theorem, Proof 1</a>. The tile ledger visualizes the same projection-and-area argument.</div>
    </section>
  </>
}
