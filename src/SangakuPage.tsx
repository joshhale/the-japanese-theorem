import { useMemo, useState } from 'react'
import { edgeKey, incircle, isBoundary, triangleEdges, triangulate } from './geometry'
import type { Point, Triangle } from './geometry'
import './SangakuPage.css'

const CENTER = 320
const RADIUS = 278
const screen = (point: Point) => ({ x: CENTER + point.x * RADIUS, y: CENTER + point.y * RADIUS })

function triangulationKey(triangles: readonly Triangle[], count: number) {
  return triangleEdges(triangles).filter((edge) => !isBoundary(edge, count)).map(edgeKey).sort().join('|')
}

export default function SangakuPage({ vertices, onExplore }: {
  vertices: readonly Point[]; onExplore: () => void
}) {
  const options = useMemo(() => {
    const unique = new Map<string, Triangle[]>()
    for (let seed = 1; seed <= 25; seed++) {
      const triangles = triangulate(vertices.length, seed)
      unique.set(triangulationKey(triangles, vertices.length), triangles)
    }
    return [...unique.entries()].map(([key, triangles]) => ({ key, triangles }))
  }, [vertices.length])
  const [drawings, setDrawings] = useState(() => [options[0], options[options.length > 1 ? 1 : 0]])
  const [showLineup, setShowLineup] = useState(false)
  const circles = drawings.map((drawing) => drawing.triangles.map((triangle) => ({
    ...incircle(vertices, triangle), triangle,
  })))
  const rows = circles.map((drawingCircles, index) => {
    let end = 0
    return [...drawingCircles].sort((a, b) => index === 0 ? b.radius - a.radius : a.radius - b.radius)
      .map((circle) => {
        const radius = circle.radius * RADIUS
        const x = end + radius
        end += 2 * radius
        return { x, radius, triangle: circle.triangle }
      })
  })
  const lineupStart = (1280 - Math.max(...circles.map((drawingCircles) =>
    drawingCircles.reduce((sum, circle) => sum + 2 * circle.radius * RADIUS, 0)))) / 2
  // Only increase the row separation where circles overlap horizontally.
  const rowGap = Math.max(228, ...rows[0].flatMap((top) => rows[1].map((bottom) => {
    const radii = top.radius + bottom.radius
    const dx = top.x - bottom.x
    return Math.sqrt(Math.max(0, radii * radii - dx * dx)) + 12
  })))
  const lineupHeight = 302 + rowGap

  function handleRandomize(index: number, random: number) {
    setDrawings((current) => {
      const alternatives = options.filter((option) => option.key !== current[index].key)
      const differentFromBoth = alternatives.filter((option) => option.key !== current[1 - index].key)
      // Quadrilaterals have only two triangulations; triangles have just one.
      const candidates = differentFromBoth.length ? differentFromBoth : alternatives
      const next = candidates[Math.floor(random * candidates.length)]
      if (!next) throw new Error('No alternative triangulation is available.')
      return current.map((drawing, position) => position === index ? next : drawing)
    })
  }

  return <div className="sangaku-page">
    <div className="sangaku-comparison">
      <div className="sangaku-diagrams">
        {drawings.map((drawing, index) => <button key={index} className="sangaku-diagram"
          aria-label={`Retriangulate ${index === 0 ? 'left' : 'right'} polygon`}
          aria-description={options.length === 1 ? 'A triangle has only one triangulation.' : undefined}
          disabled={options.length === 1} onClick={() => handleRandomize(index, Math.random())}>
          <svg viewBox="0 0 640 640" role="img" aria-label={`${index === 0 ? 'Left' : 'Right'} cyclic polygon with incircles`}>
            <g fill="none" stroke="#000" strokeLinejoin="round">
              <circle data-testid="sangaku-circumcircle" cx={CENTER} cy={CENTER} r={RADIUS} strokeWidth="3.6" />
              <polygon data-testid="sangaku-polygon" strokeWidth="3"
                points={vertices.map((vertex) => { const p = screen(vertex); return `${p.x},${p.y}` }).join(' ')} />
              {triangleEdges(drawing.triangles).filter((edge) => !isBoundary(edge, vertices.length)).map((edge) => {
                const a = screen(vertices[edge[0]])
                const b = screen(vertices[edge[1]])
                return <line key={edgeKey(edge)} data-testid="sangaku-diagonal" data-edge={edgeKey(edge)}
                  x1={a.x} y1={a.y} x2={b.x} y2={b.y} strokeWidth="1.2" />
              })}
              {circles[index].map((circle) => {
                const p = screen(circle)
                return <circle key={circle.triangle.join('-')} data-testid="sangaku-incircle" data-triangle={circle.triangle.join('-')}
                  cx={p.x} cy={p.y} r={circle.radius * RADIUS} strokeWidth="1.2" />
              })}
            </g>
          </svg>
        </button>)}
      </div>
      <button className="sangaku-lineup-toggle" aria-label="Toggle incircle line-up"
        style={{ aspectRatio: `1280 / ${lineupHeight}` }}
        aria-pressed={showLineup} onClick={() => setShowLineup((visible) => !visible)}>
        {showLineup && <svg viewBox={`0 0 1280 ${lineupHeight}`} role="img" aria-label="Incircle line-ups">
          {rows.map((row, index) => <g key={index} data-testid={`sangaku-lineup-${index === 0 ? 'left' : 'right'}`}
            fill="none" stroke="#000" strokeWidth="1.2">
            {row.map((circle) => <circle key={circle.triangle.join('-')} data-testid="sangaku-lineup-circle"
              data-triangle={circle.triangle.join('-')} cx={lineupStart + circle.x}
              cy={151 + index * rowGap} r={circle.radius} />)}
          </g>)}
        </svg>}
      </button>
    </div>
    <button className="sangaku-explore" lang="ja" onClick={onExplore}>丸山良寛の定理</button>
  </div>
}
