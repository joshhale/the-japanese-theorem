import { createVertices, moveCyclicVertex } from './geometry'
import { analyzeTriangle } from './triangleGeometry'
import type { TrianglePoints } from './triangleGeometry'

export function createCarnotTriangle(seed: number): TrianglePoints {
  const [a, b, c] = createVertices(3, seed)
  return [a, b, c]
}

export function carnotPreset(kind: 'Acute' | 'Right' | 'Obtuse'): TrianglePoints {
  const angles = kind === 'Acute' ? [-1.6, 0.55, 2.65]
    : kind === 'Right' ? [-Math.PI / 2, 0.4, Math.PI / 2] : [-1.6, -0.5, 0.8]
  const [a, b, c] = angles.map((angle) => ({ x: Math.cos(angle), y: Math.sin(angle) }))
  return [a, b, c]
}

export function moveCarnotVertex(points: TrianglePoints, index: number, angle: number): TrianglePoints {
  const [a, b, c] = moveCyclicVertex(points, index, angle)
  return [a, b, c]
}

export function analyzeCarnotProof(points: TrianglePoints) {
  const geometry = analyzeTriangle(points)
  if (!geometry.valid) return geometry
  const doubleArea = (points[1].x - points[0].x) * (points[2].y - points[0].y)
    - (points[1].y - points[0].y) * (points[2].x - points[0].x)
  const orientation = Math.sign(doubleArea)
  const perimeter = geometry.sides.reduce((sum, side) => sum + side.length, 0)
  const angles = points.map((point, index) => {
    const u = { x: points[(index + 1) % 3].x - point.x, y: points[(index + 1) % 3].y - point.y }
    const v = { x: points[(index + 2) % 3].x - point.x, y: points[(index + 2) % 3].y - point.y }
    return Math.atan2(Math.abs(u.x * v.y - u.y * v.x), u.x * v.x + u.y * v.y)
  })
  const projections = geometry.sides.map((side, index) => {
    const unit = { x: (side.end.x - side.start.x) / side.length, y: (side.end.y - side.start.y) / side.length }
    const first = (side.opposite.x - side.start.x) * unit.x + (side.opposite.y - side.start.y) * unit.y
    const j = (index + 1) % 3
    const k = (index + 2) % 3
    return {
      first, second: side.length - first,
      foot: { x: side.start.x + first * unit.x, y: side.start.y + first * unit.y },
      outward: { x: -orientation * side.normal.x, y: -orientation * side.normal.y },
      leftArea: side.length * geometry.outer.radius,
      rightArea: geometry.sides[k].length * geometry.sides[j].signedDistance
        + geometry.sides[j].length * geometry.sides[k].signedDistance,
    }
  })
  const tiles = geometry.sides.flatMap((side, row) => geometry.sides.map((column, col) => ({
    row, col, width: column.length, height: side.signedDistance,
    area: column.length * side.signedDistance, inner: row === col,
  })))
  const innerArea = tiles.filter((tile) => tile.inner).reduce((sum, tile) => sum + tile.area, 0)
  const outerArea = tiles.filter((tile) => !tile.inner).reduce((sum, tile) => sum + tile.area, 0)
  const sumDistances = geometry.sides.reduce((sum, side) => sum + side.signedDistance, 0)
  return {
    valid: true, geometry, perimeter, angles, projections, tiles, innerArea, outerArea, sumDistances,
    twiceArea: Math.abs(doubleArea),
    inradiusArea: perimeter * geometry.inner.radius,
    circumradiusArea: perimeter * geometry.outer.radius,
    tileArea: tiles.reduce((sum, tile) => sum + tile.area, 0),
  } as const
}
