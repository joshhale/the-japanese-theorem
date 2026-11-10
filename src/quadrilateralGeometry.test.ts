import { describe, expect, it } from 'vitest'
import { analyzeQuadrilateral, createQuadrilateral, moveQuadrilateralVertex } from './quadrilateralGeometry'
import type { QuadrilateralPoints } from './quadrilateralGeometry'

const onCircle = (angles: readonly [number, number, number, number]): QuadrilateralPoints => {
  const point = (angle: number) => ({ x: Math.cos(angle), y: Math.sin(angle) })
  return [point(angles[0]), point(angles[1]), point(angles[2]), point(angles[3])]
}

function expectCancellation(points: QuadrilateralPoints) {
  const geometry = analyzeQuadrilateral(points)
  if (!geometry.valid) throw new Error(geometry.reason)
  for (const triangle of geometry.triangles) {
    expect(triangle.geometry.outer.radius).toBeCloseTo(1, 10)
    expect(triangle.terms.reduce((sum, term) => sum + term.value, 0))
      .toBeCloseTo(1 + triangle.geometry.inner.radius, 10)
    for (const term of triangle.terms.filter((term) => !term.diagonal)) {
      expect(term.value).toBeCloseTo(geometry.boundary.find((boundary) => boundary.key === term.key)!.value, 10)
    }
  }
  for (const start of [0, 2]) {
    const first = geometry.triangles[start].terms.find((term) => term.diagonal)!
    const second = geometry.triangles[start + 1].terms.find((term) => term.diagonal)!
    expect(first.value + second.value).toBeCloseTo(0, 10)
  }
  expect(new Set(geometry.boundary.map((term) => term.key)).size).toBe(4)
  expect(geometry.sumAC).toBeCloseTo(geometry.sumBD, 10)
  expect(geometry.sumAC).toBeCloseTo(geometry.boundarySum - 2, 10)
  return geometry
}

describe('quadrilateral Carnot cancellation', () => {
  it('cancels the diagonals independently in every seeded quadrilateral', () => {
    for (let seed = 1; seed <= 25; seed++) expectCancellation(createQuadrilateral(seed))
  })

  it('keeps signed boundary terms when O lies outside and handles a diameter diagonal', () => {
    const external = expectCancellation(onCircle([0.1, 0.6, 1.3, 2.4]))
    expect(external.boundary.some((term) => term.value < 0)).toBe(true)
    const square = expectCancellation(onCircle([0, Math.PI / 2, Math.PI, 3 * Math.PI / 2]))
    expect(square.triangles.every((triangle) => Math.abs(triangle.terms.find((term) => term.diagonal)!.value) < 1e-10)).toBe(true)
    expectCancellation(onCircle([2.4, 1.3, 0.6, 0.1]))
  })

  it('projects vertex movement onto the circle without crossing either neighbor', () => {
    const points = onCircle([0, 1, 2, 4])
    for (const angle of [-3, -1, 0.7, 1.5, 3, 5]) {
      const moved = moveQuadrilateralVertex(points, 1, angle)
      expect(Math.hypot(moved[1].x, moved[1].y)).toBeCloseTo(1, 12)
      const result = Math.atan2(moved[1].y, moved[1].x)
      expect(result).toBeGreaterThanOrEqual(0.06 - 1e-12)
      expect(result).toBeLessThanOrEqual(2 - 0.06 + 1e-12)
      expect(moved[0]).toBe(points[0])
      expect(moved[2]).toBe(points[2])
      expect(moved[3]).toBe(points[3])
      expectCancellation(moved)
    }
    let evolving = createQuadrilateral(7)
    for (let iteration = 0; iteration < 60; iteration++) {
      const index = iteration % 4
      evolving = moveQuadrilateralVertex(evolving, index, Math.atan2(evolving[index].y, evolving[index].x) + 0.27)
      expectCancellation(evolving)
    }
  })

  it('reports a degenerate triangle rather than producing a fictitious identity', () => {
    const points = createQuadrilateral(1)
    expect(analyzeQuadrilateral([points[0], points[0], points[2], points[3]]).valid).toBe(false)
  })
})
