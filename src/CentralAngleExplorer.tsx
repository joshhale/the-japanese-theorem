import { useRef, useState } from 'react'
import type { KeyboardEvent, PointerEvent } from 'react'
import Angle from './Angle'
import { analyzeCentralAngle, centralPreset, CENTRAL_PRESETS, createCentralTriangle } from './centralAngleGeometry'
import type { CentralPreset } from './centralAngleGeometry'
import { moveCyclicVertex } from './geometry'
import type { Point } from './geometry'
import type { TrianglePoints } from './triangleGeometry'
import './CentralAngleExplorer.css'

const RADIUS = 205
const O = { x: 320, y: 320 }
const COLORS = ['#487d82', '#bd6b4d']
const screen = (point: Point) => ({ x: 320 + point.x * RADIUS, y: 320 + point.y * RADIUS })
const degrees = (angle: number) => `${(angle * 180 / Math.PI).toFixed(6)}°`
const STEPS = ['Compare the angles', 'Draw a diameter', 'Double each piece', 'Combine the pieces']

export default function CentralAngleExplorer() {
  const [seed, setSeed] = useState(7)
  const [points, setPoints] = useState<TrianglePoints>(() => createCentralTriangle(7))
  const [preset, setPreset] = useState<CentralPreset | null>(null)
  const [step, setStep] = useState(0)
  const [focus, setFocus] = useState(0)
  const svgRef = useRef<SVGSVGElement>(null)
  const drag = useRef<{ index: number; original: TrianglePoints; preset: CentralPreset | null } | null>(null)
  const proof = analyzeCentralAngle(points)

  function moveVertex(index: number, angle: number) {
    setPoints((current) => {
      const [a, b, c] = moveCyclicVertex(current, index, angle)
      return [a, b, c]
    })
    setPreset(null)
  }

  function move(event: PointerEvent<SVGSVGElement>) {
    const matrix = svgRef.current?.getScreenCTM()
    if (!drag.current || !matrix) return
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse())
    moveVertex(drag.current.index, Math.atan2(point.y - 320, point.x - 320))
  }

  function cancel() {
    if (drag.current) {
      setPoints(drag.current.original)
      setPreset(drag.current.preset)
    }
    drag.current = null
  }

  function vertexKey(event: KeyboardEvent<SVGGElement>, index: number) {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const direction = ['ArrowLeft', 'ArrowUp'].includes(event.key) ? -1 : 1
    moveVertex(index, Math.atan2(points[index].y, points[index].x) + direction * (event.shiftKey ? 5 : 1) * Math.PI / 180)
  }

  function reset(nextSeed: number) {
    setSeed(nextSeed)
    setPoints(createCentralTriangle(nextSeed))
    setPreset(null)
  }

  if (!proof.valid) return <p role="alert">{proof.reason}</p>
  const [a, b, c] = points.map(screen)
  const d = screen(proof.d)
  const selected = focus === 0 ? a : b
  const piece = focus === 0 ? proof.alpha : proof.beta
  const symbol = focus === 0 ? 'α' : 'β'
  const endpoint = focus === 0 ? 'A' : 'B'
  const mergedD = points.findIndex((point) => Math.hypot(point.x - proof.d.x, point.y - proof.d.y) < 1e-8)
  const combination = proof.add ? 'α + β' : proof.alpha >= proof.beta ? 'α − β' : 'β − α'
  const centralCombination = proof.add ? '2α + 2β' : proof.alpha >= proof.beta ? '2α − 2β' : '2β − 2α'
  const verified = Math.abs(proof.central - 2 * proof.inscribed) < 1e-9
  const reflex = proof.central > Math.PI + 1e-9

  return <>
    <div className="exploration-layout">
      <section className="drawing-card" aria-label="Angle-at-the-center construction">
        <div className="drawing-header"><span className="diagram-title">Circle <strong>ABC</strong></span>
          <span className="unit-label">CENTER <strong>O</strong></span></div>
        <svg ref={svgRef} viewBox="0 0 640 640" className="geometry central-angle-diagram"
          aria-label="Draggable circle for the angle-at-the-center theorem"
          onPointerMove={move} onPointerUp={() => { drag.current = null }}
          onPointerCancel={cancel} onLostPointerCapture={cancel}
          onKeyDown={(event) => { if (event.key === 'Escape') cancel() }}>
          <circle cx="320" cy="320" r={RADIUS} className="circumcircle" />
          <Angle at={O} from={a} to={b} through={screen(proof.through)} radius={RADIUS}
            color={COLORS[0]} testId="central-intercepted-arc" />
          {step > 0 && [a, b].map((point, index) => step !== 2 || index === focus
            ? <polygon key={index} points={[O, point, c].map((p) => `${p.x},${p.y}`).join(' ')}
              fill={COLORS[index]} fillOpacity="0.08" data-testid="central-proof-triangle" /> : null)}
          <path d={`M${a.x},${a.y} L${c.x},${c.y} L${b.x},${b.y}`}
            fill="none" stroke="#364d50" strokeWidth="1.8" />
          <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke="#b7c1bc" strokeDasharray="4 5" />
          {[a, b].map((point, index) => <line key={index} x1={O.x} y1={O.y} x2={point.x} y2={point.y}
            stroke={COLORS[index]} strokeWidth="1.8" />)}
          {step > 0 && <>
            <line data-testid="central-diameter" x1={c.x} y1={c.y} x2={d.x} y2={d.y}
              stroke="#839486" strokeWidth="1.6" strokeDasharray="5 5" />
            {(step === 2 ? [selected, c] : [a, b, c]).map((point, index) => {
              const mid = { x: (point.x + 320) / 2, y: (point.y + 320) / 2 }
              const dx = (point.x - 320) / RADIUS
              const dy = (point.y - 320) / RADIUS
              return <line key={index} x1={mid.x - dy * 5} y1={mid.y + dx * 5}
                x2={mid.x + dy * 5} y2={mid.y - dx * 5} stroke="#657f6e" strokeWidth="2" />
            })}
            {mergedD === -1 && <g><circle cx={d.x} cy={d.y} r="3" fill="#657f6e" />
              <text x={320 + proof.d.x * 237} y={320 + proof.d.y * 237} textAnchor="middle" dominantBaseline="middle">D</text></g>}
          </>}
          {step !== 2 && <>
            <Angle at={O} from={a} to={b} through={screen(proof.through)} radius={step === 3 ? 95 : 65}
              label="φ" color={COLORS[0]} testId="central-main-angle" />
            <Angle at={c} from={a} to={b} radius={step === 3 ? 75 : 28} label="θ"
              color={COLORS[1]} testId="central-inscribed-angle" />
          </>}
          {(step === 1 || step === 3) && <>
            {proof.alpha > 1e-8 && <Angle at={c} from={a} to={d} label="α" radius={36} color={COLORS[0]} />}
            {proof.beta > 1e-8 && <Angle at={c} from={d} to={b} label="β" radius={54} color={COLORS[1]} />}
          </>}
          {step === 2 && piece > 1e-8 && <>
            <Angle at={c} from={selected} to={d} label={symbol} radius={35} color={COLORS[focus]} />
            <Angle at={selected} from={c} to={O} label={symbol} radius={30} color={COLORS[focus]} />
            <Angle at={O} from={selected} to={d} label={`2${symbol}`} radius={60}
              color={COLORS[focus]} testId="central-exterior-angle" />
          </>}
          {step === 3 && <>
            {proof.firstCentral > 1e-8 && <Angle at={O} from={a} to={d} label="2α" radius={30} color={COLORS[0]} />}
            {proof.secondCentral > 1e-8 && <Angle at={O} from={d} to={b} label="2β" radius={52} color={COLORS[1]} />}
          </>}
          <circle cx="320" cy="320" r="3" fill="#487d82" /><text x="329" y="307">O</text>
          {points.map((point, index) => {
            const p = screen(point)
            return <g key={index} role="button" className="vertex" tabIndex={0} aria-label={`Angle vertex ${'ABC'[index]}`}
              onKeyDown={(event) => vertexKey(event, index)} onPointerDown={(event) => {
                if (event.button !== 0 || !svgRef.current) return
                event.currentTarget.focus()
                drag.current = { index, original: points, preset }
                svgRef.current.setPointerCapture(event.pointerId)
              }}>
              <circle className="vertex-hit" cx={p.x} cy={p.y} r="20" />
              <circle className="vertex-dot" data-testid="central-vertex" cx={p.x} cy={p.y} r="4" />
              <text className="vertex-label" x={320 + point.x * 237} y={320 + point.y * 237}>
                {'ABC'[index]}{step > 0 && mergedD === index ? ' = D' : ''}
              </text>
            </g>
          })}
        </svg>
        <div className="drawing-footer"><span className="diagram-title">Drag A, B, or C around the circle.</span></div>
      </section>
      <aside className="controls proof-controls" aria-label="Central angle settings">
        <div className="panel-heading"><span className="eyebrow">ANGLE AT THE CENTER</span><span className="tiny-cross">+</span></div>
        <div className="slider-control"><label><span className="control-heading"><span>Angle triangle seed</span><output>{seed.toString().padStart(2, '0')}</output></span>
          <input type="range" min="1" max="25" value={seed} aria-label="Angle triangle seed"
            style={{ '--progress': `${(seed - 1) / 24 * 100}%` } as React.CSSProperties}
            onChange={(event) => reset(Number(event.target.value))} />
        </label><div className="range-endpoints"><span>1</span><span>25</span></div></div>
        <div className="central-angle-presets" role="group" aria-label="Central angle examples">
          {CENTRAL_PRESETS.map((kind) => <button key={kind} aria-pressed={preset === kind}
            onClick={() => { setPoints(centralPreset(kind)); setPreset(kind) }}>{kind}</button>)}
        </div>
        <div className="proof-steps" role="group" aria-label="Central angle proof steps">
          {STEPS.map((title, index) => <button key={title} aria-pressed={step === index}
            onClick={() => setStep(index)}><span>{index + 1}</span>{title}</button>)}
        </div>
        {step === 2 && <fieldset className="proof-view"><legend>Isosceles triangle</legend>
          {['OCA', 'OCB'].map((name, index) => <label key={name}><input type="radio" name="central-proof-focus"
            checked={focus === index} onChange={() => setFocus(index)} />Triangle {name}</label>)}
        </fieldset>}
        <div className="central-angle-readout" aria-label="Live angle measurements">
          <span>At the center, φ</span><output data-testid="central-angle-value">{degrees(proof.central)}</output>
          <span>At C, θ</span><output data-testid="inscribed-angle-value">{degrees(proof.inscribed)}</output>
        </div>
        <p className="proof-keyboard-hint">Arrow keys move a focused vertex. Shift moves faster; Escape cancels a drag.</p>
        <button className="text-button" onClick={() => reset(seed)}>Reset to seed</button>
      </aside>
    </div>
    <section className="proof-algebra central-angle-proof" aria-label="Proof of the angle-at-the-center theorem">
      <div className="proof-algebra-heading"><h2>{step + 1}. {STEPS[step]}</h2>
        <span className={`invariant-badge${verified ? '' : ' error'}`}>{verified ? 'Live geometry agrees' : 'Numerical check failed'}</span></div>
      <div className="central-angle-explanation">
        {step === 0 && <>
          <div className="central-angle-equation">∠AOB = 2∠ACB</div>
          <p>Both angles stand on the highlighted arc AB, the arc that does not contain C.
            {reflex ? ' Here that is the major arc, so φ is the reflex angle, not the smaller angle between the radii.'
              : Math.abs(proof.central - Math.PI) < 1e-9 ? ' AB is a diameter: φ = 180° and θ = 90°.' : ' Keep A and B fixed and move C: neither angle changes while C stays on the same arc.'}</p>
        </>}
        {step === 1 && <>
          <div className="central-angle-equation">OA = OC = OB</div>
          <p>Extend CO to the opposite point D. The triangles OCA and OCB have two equal radii, so their base angles are equal.</p>
          <p>Call ∠ACD = α and ∠DCB = β. {proof.add ? 'CD lies between CA and CB, so θ = α + β.'
            : `CD lies outside angle ACB, so θ = ${combination}.`}</p>
          {mergedD !== -1 && <p>D coincides with {'ABC'[mergedD]}; the corresponding piece is zero.</p>}
        </>}
        {step === 2 && (piece < 1e-8 ? <p>{endpoint} coincides with D, so {symbol} = 0. This piece contributes 0°; use the other triangle for the nonzero piece.</p> : <>
          <div className="central-angle-equation">∠{endpoint}OD = {symbol} + {symbol} = 2{symbol}</div>
          <p>In triangle OC{endpoint}, OC = O{endpoint}, so the angles at C and {endpoint} both equal {symbol}.
            Since C, O, D lie on a straight line, ∠{endpoint}OD is its exterior angle.</p>
          <div className="central-angle-equation">∠CO{endpoint} = 180° − 2{symbol}</div>
          <div className="central-angle-equation">∠{endpoint}OD = 180° − (180° − 2{symbol}) = 2{symbol}</div>
          <p>Repeat with the other isosceles triangle.</p>
        </>)}
        {step === 3 && <>
          <div className="central-angle-equation">θ = {combination}</div>
          <div className="central-angle-equation">φ = {centralCombination} = 2({combination}) = 2θ</div>
          <p>{proof.add ? 'Add the two pieces at C, and add their doubles at O.'
            : 'Subtract the smaller piece from the larger at both C and O.'}
            {reflex ? ' The two central pieces make the reflex angle around the highlighted major arc.' : ''}
            {' '}The same addition or subtraction happens at both points.</p>
        </>}
        <div className="central-angle-equation central-angle-numbers" data-testid="central-angle-comparison">
          {degrees(proof.central)} = 2 × {degrees(proof.inscribed)}
        </div>
      </div>
    </section>
  </>
}
