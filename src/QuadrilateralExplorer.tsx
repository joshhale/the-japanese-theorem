import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import { analyzeQuadrilateral, createQuadrilateral, moveQuadrilateralVertex } from './quadrilateralGeometry'
import type { ProofTerm, ProofTriangle, QuadrilateralPoints } from './quadrilateralGeometry'
import type { Point } from './geometry'
import './QuadrilateralExplorer.css'

const RADIUS_COLORS = ['#d47352', '#af6384', '#487d82', '#64815c']
const EDGE_COLORS: Record<string, string> = {
  '0-1': '#487d82', '1-2': '#9c8644', '2-3': '#8476a5', '0-3': '#64815c',
  '0-2': '#b66b4b', '1-3': '#b66b4b',
}
const STEPS = [
  { title: 'Apply Carnot', text: 'All four triangles share the same circumcenter O and circumradius R. Apply Carnot to each triangle.' },
  { title: 'Add each pair', text: 'Add the two equations for each diagonal. Each boundary distance appears once; the diagonal appears twice.' },
  { title: 'Cancel the diagonal', text: 'The opposite vertices lie on opposite sides of the diagonal. Its signed contributions are equal and opposite.' },
  { title: 'Compare the sums', text: 'The same four boundary distances remain in both cases. Subtract the same 2R to obtain equal inradius sums.' },
]
const screen = (point: Point) => ({ x: 320 + point.x * 247, y: 320 + point.y * 247 })
const number = (value: number) => (Math.abs(value) < 0.0000005 ? 0 : value).toFixed(6)
const negative = (value: number) => value < -1e-8
type Highlight = (key: string | null) => void

function Radius({ index }: { index: number }) {
  return <span className="proof-radius" style={{ color: RADIUS_COLORS[index - 1] }}>r<sub>{index}</sub></span>
}

function Distance({ term, highlight, cancelled = false }: {
  term: ProofTerm; highlight: Highlight; cancelled?: boolean
}) {
  return <button className={`proof-term${cancelled ? ' cancelled' : ''}`}
    style={{ color: EDGE_COLORS[term.key] }}
    title={`${term.diagonal ? 'Signed diagonal distance' : 'Signed boundary distance'} ${term.label}: ${number(term.value)}`}
    aria-label={`Distance ${term.label}: ${number(term.value)}`}
    onPointerEnter={() => highlight(term.key)} onPointerLeave={() => highlight(null)}
    onFocus={() => highlight(term.key)} onBlur={() => highlight(null)}>
    {term.diagonal ? 'δ' : 'd'}<sub>{term.label}</sub>
  </button>
}

function BoundarySum({ terms, highlight }: { terms: ProofTerm[]; highlight: Highlight }) {
  return <span className="proof-expression">{terms.map((term, index) => <span key={term.key}>
    {index > 0 && <span className="proof-operator"> + </span>}<Distance term={term} highlight={highlight} />
  </span>)}</span>
}

function SumBars({ triangles }: { triangles: ProofTriangle[] }) {
  const radii = triangles.map((triangle) => triangle.geometry.inner.radius)
  const sums = [radii[0] + radii[1], radii[2] + radii[3]]
  const scale = 82 / Math.max(...sums)
  return <svg className="proof-sum-bars" role="img" aria-label="Independent inradius sums on the same scale" height="128">
    <line x1="8%" x2="8%" y1="15" y2="116" stroke="#bcc7ba" strokeDasharray="3 4" />
    {sums.map((sum, row) => {
      const start = row * 2
      const y = 40 + row * 55
      return <g key={row}>
        <line x1="8%" x2={`${8 + sum * scale}%`} y1={y} y2={y} stroke="#d7ddce" strokeWidth="8" />
        {[0, 1].map((offset) => {
          const index = start + offset
          const x = 8 + (offset === 0 ? 0 : radii[start]) * scale
          return <g key={index}>
            <line data-testid="proof-radius-segment" x1={`${x}%`} x2={`${x + radii[index] * scale}%`}
              y1={y} y2={y} stroke={RADIUS_COLORS[index]} strokeWidth="5" />
            <text x={`${x + radii[index] * scale / 2}%`} y={y - 12} fill={RADIUS_COLORS[index]}>r<tspan baselineShift="sub" fontSize="10">{index + 1}</tspan></text>
            <line x1={`${x}%`} x2={`${x}%`} y1={y - 5} y2={y + 5} stroke={RADIUS_COLORS[index]} />
          </g>
        })}
        <line x1={`${8 + sum * scale}%`} x2={`${8 + sum * scale}%`} y1={y - 5} y2={y + 5} stroke="#526952" />
      </g>
    })}
  </svg>
}

function ProofDiagram({ diagonal, points, triangles, boundary, step, layers, active, highlight, onMove, onRestore }: {
  diagonal: 'AC' | 'BD'; points: QuadrilateralPoints; triangles: ProofTriangle[]; boundary: ProofTerm[]
  step: number; layers: { incircles: boolean; distances: boolean; diagonal: boolean; radius: boolean }
  active: string | null; highlight: Highlight
  onMove: (index: number, angle: number) => void; onRestore: (points: QuadrilateralPoints) => void
}) {
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ index: number; original: QuadrilateralPoints } | null>(null)
  const diagonalTerm = triangles[0].terms.find((term) => term.diagonal)!
  const a = screen(points[diagonalTerm.edge[0]])
  const b = screen(points[diagonalTerm.edge[1]])
  const sum = triangles.reduce((total, triangle) => total + triangle.geometry.inner.radius, 0)

  function move(event: PointerEvent<SVGSVGElement>) {
    if (!drag.current || !svgRef.current) return
    const matrix = svgRef.current.getScreenCTM()
    if (!matrix) return
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    onMove(drag.current.index, Math.atan2(point.y - 320, point.x - 320))
  }

  function keyboard(event: KeyboardEvent<SVGGElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1
    onMove(index, Math.atan2(points[index].y, points[index].x) + direction * Math.PI / 180 * (event.shiftKey ? 5 : 1))
  }

  return <div className="proof-diagram-card" data-testid={`proof-${diagonal}`}>
    <h2>Diagonal {diagonal} <span>{triangles.map((triangle) => triangle.label).join(' + ')}</span></h2>
    <svg ref={svgRef} viewBox="0 0 640 640" className="geometry proof-diagram"
      aria-label={`Cyclic quadrilateral with diagonal ${diagonal}`}
      onPointerMove={move}
      onPointerUp={() => { drag.current = null }}
      onPointerCancel={() => {
        if (drag.current) onRestore(drag.current.original)
        drag.current = null
      }}
      onKeyDown={(event) => {
        if (event.key === 'Escape' && drag.current) {
          onRestore(drag.current.original)
          drag.current = null
        }
      }}>
      <defs><pattern id={`proof-dots-${diagonal}`} width="20" height="20" patternUnits="userSpaceOnUse">
        <circle cx="2" cy="2" r="0.7" fill="#d9ded3" />
      </pattern></defs>
      <rect width="640" height="640" fill={`url(#proof-dots-${diagonal})`} />
      <circle cx="320" cy="320" r="247" className="circumcircle" />
      {triangles.map((triangle) => <polygon key={triangle.label}
        points={triangle.indices.map((index) => { const p = screen(points[index]); return `${p.x},${p.y}` }).join(' ')}
        fill={RADIUS_COLORS[triangle.radiusIndex - 1]}
        fillOpacity={active && triangle.terms.some((term) => term.key === active) ? 0.2 : 0.055} />)}
      <polygon className="polygon-boundary" points={points.map((point) => { const p = screen(point); return `${p.x},${p.y}` }).join(' ')} />
      <line className="proof-diagonal" x1={a.x} y1={a.y} x2={b.x} y2={b.y} />
      {layers.radius && <g className="proof-outer-radius">
        <line x1="320" y1="320" x2={screen(points[0]).x} y2={screen(points[0]).y} stroke="#487d82" strokeWidth="2" />
        <text x={(320 + screen(points[0]).x) / 2 + 12} y={(320 + screen(points[0]).y) / 2} fill="#487d82">R</text>
      </g>}
      {layers.incircles && triangles.map((triangle) => {
        const inner = triangle.geometry.inner
        const center = screen(inner)
        const touch = screen(triangle.terms.find((term) => term.diagonal)!.touch)
        const color = RADIUS_COLORS[triangle.radiusIndex - 1]
        return <g key={triangle.label} data-testid="proof-incircle">
          <circle cx={center.x} cy={center.y} r={inner.radius * 247} fill={color} fillOpacity="0.08" stroke={color} strokeWidth="1.8" />
          <line x1={center.x} y1={center.y} x2={touch.x} y2={touch.y} stroke={color} strokeWidth="1.8" />
          <circle cx={center.x} cy={center.y} r="2" fill={color} />
          <text x={center.x + 10} y={center.y - 9} fill={color}>r<tspan baselineShift="sub" fontSize="13">{triangle.radiusIndex}</tspan></text>
        </g>
      })}
      {layers.distances && boundary.map((term) => {
        const foot = screen(term.foot)
        return <g key={term.key} className={`proof-distance${negative(term.value) ? ' negative' : ''}`}
          data-testid="proof-boundary-distance" data-edge={term.key} data-value={term.value}
          style={{ color: EDGE_COLORS[term.key], opacity: active && active !== term.key ? 0.28 : 1 }}
          onPointerEnter={() => highlight(term.key)} onPointerLeave={() => highlight(null)}>
          <line x1="320" y1="320" x2={foot.x} y2={foot.y} stroke="currentColor"
            strokeWidth={active === term.key ? 4 : 2} strokeDasharray={negative(term.value) ? '5 4' : undefined} />
          <text x={(320 + foot.x) / 2 + 9} y={(320 + foot.y) / 2 - 9} fill="currentColor">
            d<tspan baselineShift="sub" fontSize="12">{term.label}</tspan>
          </text>
        </g>
      })}
      {layers.diagonal && <g className={`proof-diagonal-distances${step >= 3 ? ' cancelled' : ''}`}
        data-testid="proof-diagonal-contributions">
        {triangles.map((triangle, index) => {
          const term = triangle.terms.find((item) => item.diagonal)!
          const foot = screen(term.foot)
          const length = Math.hypot(foot.x - 320, foot.y - 320)
          const nx = length > 1e-8 ? -(foot.y - 320) / length : 1
          const ny = length > 1e-8 ? (foot.x - 320) / length : 0
          const offset = index === 0 ? 6 : -6
          return <g key={triangle.label} data-value={term.value} data-testid="proof-diagonal-distance">
            <line x1={320 + nx * offset} y1={320 + ny * offset} x2={foot.x + nx * offset} y2={foot.y + ny * offset}
              stroke="#b66b4b" strokeWidth="2.5" strokeDasharray={negative(term.value) ? '5 4' : undefined} />
            <text x={(320 + foot.x) / 2 + nx * (index === 0 ? 25 : -30)}
              y={(320 + foot.y) / 2 + ny * (index === 0 ? 25 : -30)} fill="#b66b4b" textAnchor="middle">
              {index === 0 ? '+' : '−'}δ
            </text>
          </g>
        })}
        {step >= 3 && <g className="proof-cancel-mark" stroke="#b65341" strokeWidth="3">
          <line x1={(320 + screen(diagonalTerm.foot).x) / 2 - 9} y1={(320 + screen(diagonalTerm.foot).y) / 2 - 9}
            x2={(320 + screen(diagonalTerm.foot).x) / 2 + 9} y2={(320 + screen(diagonalTerm.foot).y) / 2 + 9} />
          <line x1={(320 + screen(diagonalTerm.foot).x) / 2 - 9} y1={(320 + screen(diagonalTerm.foot).y) / 2 + 9}
            x2={(320 + screen(diagonalTerm.foot).x) / 2 + 9} y2={(320 + screen(diagonalTerm.foot).y) / 2 - 9} />
        </g>}
      </g>}
      <circle cx="320" cy="320" r="3" fill="#487d82" />
      <text x="311" y="302" fill="#487d82">O</text>
      {points.map((point, index) => {
        const p = screen(point)
        const name = String.fromCharCode(65 + index)
        return <g key={name} role="button" aria-label={`Quadrilateral ${diagonal} vertex ${name}`} tabIndex={0} className="vertex"
          onKeyDown={(event) => keyboard(event, index)}
          onPointerDown={(event) => {
            if (event.button !== 0 || !svgRef.current) return
            event.currentTarget.focus()
            drag.current = { index, original: points }
            svgRef.current.setPointerCapture(event.pointerId)
          }}>
          <circle className="vertex-hit" cx={p.x} cy={p.y} r="20" />
          <circle className="vertex-dot proof-vertex-dot" cx={p.x} cy={p.y} r="4" />
          <text className="vertex-label" x={320 + point.x * 272} y={320 + point.y * 272}>{name}</text>
        </g>
      })}
    </svg>
    <div className="proof-live-sum"><Radius index={triangles[0].radiusIndex} /> + <Radius index={triangles[1].radiusIndex} />
      <span>=</span><output data-testid={`proof-sum-${diagonal}`}>{number(sum)}</output></div>
  </div>
}

export default function QuadrilateralExplorer() {
  const [seed, setSeed] = useState(5)
  const [points, setPoints] = useState<QuadrilateralPoints>(() => createQuadrilateral(5))
  const [step, setStep] = useState(1)
  const [view, setView] = useState('Both')
  const [active, setActive] = useState<string | null>(null)
  const [layers, setLayers] = useState({ incircles: true, distances: true, diagonal: true, radius: false })
  const geometry = analyzeQuadrilateral(points)
  if (!geometry.valid) return <p role="alert">{geometry.reason}</p>
  const pairs = [
    { diagonal: 'AC' as const, triangles: geometry.triangles.slice(0, 2) },
    { diagonal: 'BD' as const, triangles: geometry.triangles.slice(2, 4) },
  ]
  const verified = Math.max(Math.abs(geometry.sumAC - geometry.sumBD), Math.abs(geometry.sumAC - geometry.derivedSum)) < 1e-10

  return <>
    <div className="exploration-layout">
      <section className="drawing-card">
        <div className="drawing-header"><span className="diagram-title"><strong>Quadrilateral ABCD</strong></span>
          <span className="unit-label">COMMON CIRCUMRADIUS <strong>R = 1</strong></span></div>
        <div className={`quadrilateral-diagrams${view !== 'Both' ? ' single' : ''}`}>
          {pairs.filter((pair) => view === 'Both' || view === pair.diagonal).map((pair) =>
            <ProofDiagram key={pair.diagonal} {...pair} points={points} boundary={geometry.boundary} step={step} layers={layers}
              active={active} highlight={setActive} onRestore={setPoints}
              onMove={(index, angle) => setPoints((current) => moveQuadrilateralVertex(current, index, angle))} />)}
        </div>
        <div className="drawing-footer"><span className="diagram-title">Drag vertices around the circle. Both views stay linked.</span>
          <span className="diagram-title">Dashed distances are negative.</span></div>
      </section>
      <aside className="controls proof-controls" aria-label="Quadrilateral proof settings">
        <div className="panel-heading"><span className="eyebrow">QUADRILATERAL PROOF</span><span className="tiny-cross">+</span></div>
        <div className="slider-control"><label>
          <span className="control-heading"><span>Quadrilateral seed</span><output>{seed.toString().padStart(2, '0')}</output></span>
          <input type="range" min="1" max="25" value={seed} aria-label="Quadrilateral seed"
            style={{ '--progress': `${(seed - 1) / 24 * 100}%` } as React.CSSProperties}
            onChange={(event) => {
              const next = Number(event.target.value)
              setSeed(next)
              setPoints(createQuadrilateral(next))
              setActive(null)
            }} />
        </label><div className="range-endpoints"><span>1</span><span>25</span></div></div>
        <div className="proof-steps" role="group" aria-label="Proof steps">
          {STEPS.map((item, index) => <button key={item.title} aria-pressed={step === index + 1}
            onClick={() => setStep(index + 1)}><span>{index + 1}</span>{item.title}</button>)}
        </div>
        <p className="proof-step-description" aria-live="polite">{STEPS[step - 1].text}</p>
        <fieldset className="proof-view"><legend>Triangulation view</legend>
          {['AC', 'BD', 'Both'].map((option) => <label key={option}>
            <input type="radio" name="quadrilateral-view" value={option} checked={view === option} onChange={() => setView(option)} />{option}
          </label>)}
        </fieldset>
        <div className="proof-layer-controls">
          {([
            ['incircles', 'Incircles and inradii'], ['distances', 'Boundary distances'],
            ['diagonal', 'Diagonal contributions'], ['radius', 'Circumradius R'],
          ] as const).map(([key, label]) => <button key={key} type="button" aria-pressed={layers[key]}
            className={`circle-toggle${layers[key] ? ' on' : ''}`} onClick={() => setLayers((current) => ({ ...current, [key]: !current[key] }))}>
            <span>{label}</span><span className="switch" aria-hidden="true"><span /></span>
          </button>)}
        </div>
        <p className="proof-keyboard-hint">Focus a vertex and use arrow keys to move it. Shift moves faster; Escape cancels a drag.</p>
        <button className="text-button" onClick={() => setPoints(createQuadrilateral(seed))}>Reset quadrilateral</button>
      </aside>
    </div>

    <section className="proof-algebra" aria-label="Carnot cancellation proof">
      <div className="proof-algebra-heading"><h2>{step}. {STEPS[step - 1].title}</h2>
        <span className={`invariant-badge${verified ? '' : ' error'}`}>{verified ? 'Live geometry agrees' : 'Numerical check failed'}</span></div>
      <div className="proof-equation-grid">
        {pairs.map(({ diagonal, triangles }) => {
          const firstDiagonal = triangles[0].terms.find((term) => term.diagonal)!
          const secondDiagonal = triangles[1].terms.find((term) => term.diagonal)!
          return <div className="proof-equation-card" key={diagonal}>
            <h3>Diagonal {diagonal}</h3>
            {step === 1 ? triangles.map((triangle, index) => <div className="proof-equation" key={triangle.label}>
              <span className="proof-triangle-name">{triangle.label}</span>
              <span>R + <Radius index={triangle.radiusIndex} /> = </span>
              <BoundarySum terms={triangle.terms.filter((term) => !term.diagonal)} highlight={setActive} />
              <span className="proof-expression"><span className="proof-operator">{index === 0 ? ' + ' : ' − '}</span>
                <Distance term={firstDiagonal} highlight={setActive} /></span>
            </div>) : <>
              <div className="proof-equation"><span>2R + <Radius index={triangles[0].radiusIndex} /> + <Radius index={triangles[1].radiusIndex} /> =</span></div>
              <div className="proof-equation"><BoundarySum terms={geometry.boundary} highlight={setActive} /></div>
              <div className="proof-equation proof-cancellation" data-testid={`proof-cancellation-${diagonal}`}>
                <span> + </span><Distance term={firstDiagonal} highlight={setActive} cancelled={step >= 3} />
                <span> − </span><Distance term={firstDiagonal} highlight={setActive} cancelled={step >= 3} />
                {step >= 3 && <strong> = 0</strong>}
              </div>
            </>}
            <div className="proof-diagonal-readout">
              δ<sub>{diagonal}</sub> = {number(firstDiagonal.value)}
              <span>{step >= 2 ? `Diagonal contributions: ${number(firstDiagonal.value)} + (${number(secondDiagonal.value)}) = ${number(firstDiagonal.value + secondDiagonal.value)}` : `Signed toward ${triangles[0].label}; the other triangle has the opposite sign.`}</span>
            </div>
          </div>
        })}
      </div>
      <p className="proof-sign-note">Each d is signed toward the quadrilateral’s interior. Each δ is signed toward the first triangle in its pair. Hover or focus a term to highlight its distance in both diagrams.</p>
      {step === 4 && <div className="proof-conclusion" data-testid="proof-conclusion">
        <div className="proof-conclusion-equation"><span><Radius index={1} /> + <Radius index={2} /></span>
          <span>=</span><span><BoundarySum terms={geometry.boundary} highlight={setActive} /> − 2R</span>
          <span>=</span><span><Radius index={3} /> + <Radius index={4} /></span></div>
        <div className="proof-final-values">
          <output data-testid="proof-final-AC">{number(geometry.sumAC)}</output><span>=</span>
          <output data-testid="proof-boundary-result">{number(geometry.derivedSum)}</output><span>=</span>
          <output data-testid="proof-final-BD">{number(geometry.sumBD)}</output>
        </div>
        <SumBars triangles={geometry.triangles} />
        <p>Each total is computed independently from the current geometry. Displayed values are rounded to six decimals.</p>
      </div>}
    </section>
  </>
}
