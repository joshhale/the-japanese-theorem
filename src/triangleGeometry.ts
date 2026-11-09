import { incircle, randomGenerator } from './geometry'
import type { Point } from './geometry'

export type TrianglePoints = readonly [Point, Point, Point]
export type View = { x: number; y: number; size: number }
export const INITIAL_VIEW: View = { x: 0, y: 0, size: 640 }
export const LENGTH_UNIT = 100

export function createFreeTriangle(seed: number): TrianglePoints {
  const random = randomGenerator(seed)
  return [
    { x: 250 + random() * 140, y: 125 + random() * 100 },
    { x: 120 + random() * 120, y: 390 + random() * 100 },
    { x: 410 + random() * 110, y: 350 + random() * 130 },
  ]
}

export function analyzeTriangle(points: TrianglePoints) {
  const [a, b, c] = points
  const bx = b.x - a.x
  const by = b.y - a.y
  const cx = c.x - a.x
  const cy = c.y - a.y
  const bSquared = bx * bx + by * by
  const cSquared = cx * cx + cy * cy
  const doubleArea = bx * cy - by * cx
  const longestSquared = Math.max(bSquared, cSquared, (b.x - c.x) ** 2 + (b.y - c.y) ** 2)
  if (Math.abs(doubleArea) <= longestSquared * 1e-8) {
    return { valid: false, reason: 'Points are collinear or overlapping. Move a vertex to form a triangle.' } as const
  }

  const ux = (cy * bSquared - by * cSquared) / (2 * doubleArea)
  const uy = (bx * cSquared - cx * bSquared) / (2 * doubleArea)
  const outer = { x: a.x + ux, y: a.y + uy, radius: Math.hypot(ux, uy) }
  const inner = incircle(points, [0, 1, 2])
  const sides = points.map((opposite, index) => {
    const start = points[(index + 1) % 3]
    const end = points[(index + 2) % 3]
    const dx = end.x - start.x
    const dy = end.y - start.y
    const length = Math.hypot(dx, dy)
    const t = ((outer.x - start.x) * dx + (outer.y - start.y) * dy) / (length * length)
    const foot = { x: start.x + t * dx, y: start.y + t * dy }
    const innerT = ((inner.x - start.x) * dx + (inner.y - start.y) * dy) / (length * length)
    const touch = { x: start.x + innerT * dx, y: start.y + innerT * dy }
    const toStart = Math.hypot(opposite.x - start.x, opposite.y - start.y)
    const toEnd = Math.hypot(opposite.x - end.x, opposite.y - end.y)
    const angleFoot = {
      x: (toEnd * start.x + toStart * end.x) / (toStart + toEnd),
      y: (toEnd * start.y + toStart * end.y) / (toStart + toEnd),
    }
    return {
      start, end, opposite, length, foot, touch, angleFoot,
      midpoint: { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 },
      normal: { x: -dy / length, y: dx / length },
      signedDistance: Math.sign(doubleArea) * (dx * (outer.y - start.y) - dy * (outer.x - start.x)) / length,
    }
  })
  return { valid: true, outer, inner, sides } as const
}

export function fitTriangleCircles(points: TrianglePoints): View {
  const geometry = analyzeTriangle(points)
  const bounds = [...points]
  if (geometry.valid) {
    bounds.push(
      { x: geometry.outer.x - geometry.outer.radius, y: geometry.outer.y - geometry.outer.radius },
      { x: geometry.outer.x + geometry.outer.radius, y: geometry.outer.y + geometry.outer.radius },
    )
  }
  const minX = Math.min(...bounds.map((point) => point.x))
  const maxX = Math.max(...bounds.map((point) => point.x))
  const minY = Math.min(...bounds.map((point) => point.y))
  const maxY = Math.max(...bounds.map((point) => point.y))
  const size = Math.max(maxX - minX, maxY - minY, 100) * 1.16
  return { x: (minX + maxX - size) / 2, y: (minY + maxY - size) / 2, size }
}
