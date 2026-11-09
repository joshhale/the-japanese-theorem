import { describe, expect, it } from 'vitest'
import {
  createVertices, edgeKey, edgesCross, forceEdge, incircle,
  isBoundary, referenceSum, triangleEdges, triangulate,
} from './geometry'
import type { Edge, Point } from './geometry'

describe('incircle geometry', () => {
  it('finds the center and radius of a 3-4-5 triangle', () => {
    const circle = incircle([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }], [0, 1, 2])
    expect(circle.x).toBeCloseTo(1, 12)
    expect(circle.y).toBeCloseTo(1, 12)
    expect(circle.radius).toBeCloseTo(1, 12)
  })

  it('gives the known sum for both diagonals of an inscribed square', () => {
    const square: Point[] = [{ x: 1, y: 0 }, { x: 0, y: 1 }, { x: -1, y: 0 }, { x: 0, y: -1 }]
    for (const forced of [[[0, 2]], [[1, 3]]] as Edge[][]) {
      const total = triangulate(4, 1, forced).reduce((sum, triangle) => sum + incircle(square, triangle).radius, 0)
      expect(total).toBeCloseTo(2 * (Math.SQRT2 - 1), 12)
    }
  })
})

describe('seeded cyclic triangulations', () => {
  it('is reproducible and varies both placement and triangulation', () => {
    expect(createVertices(8, 7)).toEqual(createVertices(8, 7))
    expect(createVertices(8, 7)).not.toEqual(createVertices(8, 8))
    expect(triangulate(8, 1)).toEqual(triangulate(8, 1))
    const variations = new Set(Array.from({ length: 25 }, (_, seed) => JSON.stringify(triangulate(8, seed + 1))))
    expect(variations.size).toBeGreaterThan(15)
  })

  it('preserves the calculated inradius sum for all supported counts and seed pairs', () => {
    for (let count = 3; count <= 40; count++) {
      for (let placement = 1; placement <= 25; placement++) {
        const points = createVertices(count, placement)
        const expected = referenceSum(points)
        for (let seed = 1; seed <= 25; seed++) {
          const triangles = triangulate(count, seed)
          expect(triangles).toHaveLength(count - 2)
          const total = triangles.reduce((sum, triangle) => sum + incircle(points, triangle).radius, 0)
          expect(Math.abs(total - expected)).toBeLessThan(1e-10)
        }
      }
    }
  })

  it('creates a complete non-overlapping triangulation and tangent incircles', () => {
    for (const count of [3, 4, 8, 22, 40]) {
      const points = createVertices(count, 11)
      const triangles = triangulate(count, 17)
      const diagonals = triangleEdges(triangles).filter((edge) => !isBoundary(edge, count))
      expect(diagonals).toHaveLength(count - 3)
      for (const a of diagonals) {
        for (const b of diagonals) expect(edgesCross(a, b)).toBe(false)
      }
      let triangleArea = 0
      for (const triangle of triangles) {
        const [a, b, c] = triangle.map((index) => points[index])
        triangleArea += Math.abs((b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x)) / 2
        const center = incircle(points, triangle)
        for (const [start, end] of [[a, b], [b, c], [c, a]]) {
          const distance = Math.abs(
            (end.x - start.x) * (start.y - center.y) - (start.x - center.x) * (end.y - start.y),
          ) / Math.hypot(end.x - start.x, end.y - start.y)
          expect(distance).toBeCloseTo(center.radius, 11)
          expect(center.radius).toBeGreaterThan(0)
        }
      }
      const polygonArea = Math.abs(points.reduce((sum, point, index) => {
        const next = points[(index + 1) % count]
        return sum + point.x * next.y - next.x * point.y
      }, 0)) / 2
      expect(triangleArea).toBeCloseTo(polygonArea, 11)
    }
  })
})

describe('forced diagonals', () => {
  it('replaces only crossing constraints and does not duplicate reversed edges', () => {
    const edges: Edge[] = [[0, 3], [0, 5], [5, 7]]
    const updated = forceEdge(edges, [1, 4])
    expect(updated).toEqual([[0, 5], [5, 7], [1, 4]])
    expect(forceEdge(updated, [4, 1])).toHaveLength(3)
    expect(edgesCross([0, 3], [3, 5])).toBe(false)
  })

  it('honors evolving constraints, including complete fans, without changing the sum', () => {
    for (const count of [4, 8, 25, 40]) {
      let forced: Edge[] = []
      const points = createVertices(count, 5)
      for (let step = 0; step < 100; step++) {
        const edge: Edge = [step % count, (step * 7 + 2) % count]
        if (edge[0] === edge[1] || isBoundary(edge, count)) continue
        forced = forceEdge(forced, edge)
        const triangles = triangulate(count, step % 25 + 1, forced)
        const actual = triangleEdges(triangles).map(edgeKey)
        expect(triangles).toHaveLength(count - 2)
        for (const item of forced) expect(actual).toContain(edgeKey(item))
        const diagonals = triangleEdges(triangles).filter((item) => !isBoundary(item, count))
        for (const a of diagonals) {
          for (const b of diagonals) expect(edgesCross(a, b)).toBe(false)
        }
        const sum = triangles.reduce((total, triangle) => total + incircle(points, triangle).radius, 0)
        expect(sum).toBeCloseTo(referenceSum(points), 11)
      }
      forced = Array.from({ length: count - 3 }, (_, index) => [0, index + 2] as Edge)
      expect(triangleEdges(triangulate(count, 1, forced)).filter((edge) => !isBoundary(edge, count)).map(edgeKey).sort())
        .toEqual(forced.map(edgeKey).sort())
    }
  })
})
