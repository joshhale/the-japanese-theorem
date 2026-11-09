import { describe, expect, it } from 'vitest'
import { analyzeTriangle, createFreeTriangle, fitTriangleCircles } from './triangleGeometry'
import type { TrianglePoints } from './triangleGeometry'

describe('free triangle geometry', () => {
  it('finds the known incenter and circumcenter of a 3-4-5 triangle', () => {
    const result = analyzeTriangle([{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }])
    if (!result.valid) throw new Error(result.reason)
    expect(result.outer).toEqual({ x: 2, y: 1.5, radius: 2.5 })
    expect(result.inner).toEqual({ x: 1, y: 1, radius: 1 })
    expect(result.sides[0].signedDistance).toBeCloseTo(0, 12)
    expect(result.sides.reduce((sum, side) => sum + side.signedDistance, 0)).toBeCloseTo(3.5, 12)
  })

  it('constructs bisectors, tangent incircles, and circumcircles for every seed', () => {
    for (let seed = 1; seed <= 25; seed++) {
      const points = createFreeTriangle(seed)
      const result = analyzeTriangle(points)
      if (!result.valid) throw new Error(result.reason)
      for (const point of points) {
        expect(Math.hypot(point.x - result.outer.x, point.y - result.outer.y)).toBeCloseTo(result.outer.radius, 9)
      }
      for (const side of result.sides) {
        expect(Math.hypot(side.touch.x - result.inner.x, side.touch.y - result.inner.y)).toBeCloseTo(result.inner.radius, 9)
        const toI = { x: result.inner.x - side.opposite.x, y: result.inner.y - side.opposite.y }
        const toFoot = { x: side.angleFoot.x - side.opposite.x, y: side.angleFoot.y - side.opposite.y }
        expect(toI.x * toFoot.y - toI.y * toFoot.x).toBeCloseTo(0, 8)
        const dx = result.outer.x - side.midpoint.x
        const dy = result.outer.y - side.midpoint.y
        expect(dx * (side.end.x - side.start.x) + dy * (side.end.y - side.start.y)).toBeCloseTo(0, 8)
        expect(side.foot.x).toBeCloseTo(side.midpoint.x, 9)
        expect(side.foot.y).toBeCloseTo(side.midpoint.y, 9)
      }
    }
  })

  it('uses the correct Carnot signs for acute, right, and obtuse triangles in either orientation', () => {
    const cases: { points: TrianglePoints; negatives: number }[] = [
      { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 2, y: 3 }], negatives: 0 },
      { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 0, y: 3 }], negatives: 0 },
      { points: [{ x: 0, y: 0 }, { x: 4, y: 0 }, { x: 1, y: 0.5 }], negatives: 1 },
    ]
    for (const { points, negatives } of cases) {
      for (const order of [points, [points[2], points[1], points[0]] as TrianglePoints]) {
        const result = analyzeTriangle(order)
        if (!result.valid) throw new Error(result.reason)
        expect(result.sides.filter((side) => side.signedDistance < -1e-10)).toHaveLength(negatives)
        const actual = result.sides.reduce((sum, side) => sum + side.signedDistance, 0)
        expect(actual).toBeCloseTo(result.outer.radius + result.inner.radius, 11)
      }
    }
  })

  it('reports coincident and collinear points instead of producing invalid circles', () => {
    for (const points of [
      [{ x: 0, y: 0 }, { x: 1, y: 1 }, { x: 2, y: 2 }],
      [{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 1, y: 1 }],
      [{ x: 1, y: 1 }, { x: 1, y: 1 }, { x: 1, y: 1 }],
    ] as TrianglePoints[]) {
      expect(analyzeTriangle(points).valid).toBe(false)
    }
  })

  it('fits a large external circumcircle without moving vertices or changing lengths', () => {
    const points: TrianglePoints = [{ x: 100, y: 400 }, { x: 500, y: 400 }, { x: 250, y: 380 }]
    const result = analyzeTriangle(points)
    if (!result.valid) throw new Error(result.reason)
    const view = fitTriangleCircles(points)
    expect(result.outer.x - result.outer.radius).toBeGreaterThan(view.x)
    expect(result.outer.y - result.outer.radius).toBeGreaterThan(view.y)
    expect(result.outer.x + result.outer.radius).toBeLessThan(view.x + view.size)
    expect(result.outer.y + result.outer.radius).toBeLessThan(view.y + view.size)
    expect(analyzeTriangle(points)).toEqual(result)
  })
})
