import { describe, expect, it } from 'vitest'
import { analyzeCarnotProof, carnotPreset, createCarnotTriangle, moveCarnotVertex } from './carnotProofGeometry'
import type { TrianglePoints } from './triangleGeometry'

function expectProof(points: TrianglePoints) {
  const proof = analyzeCarnotProof(points)
  if (!proof.valid) throw new Error(proof.reason)
  const { geometry } = proof
  for (const [index, side] of geometry.sides.entries()) {
    expect(side.signedDistance).toBeCloseTo(geometry.outer.radius * Math.cos(proof.angles[index]), 9)
    const projection = proof.projections[index]
    expect(projection.first + projection.second).toBeCloseTo(side.length, 10)
    expect(projection.leftArea).toBeCloseTo(projection.rightArea, 9)
    const j = (index + 1) % 3
    const k = (index + 2) % 3
    expect(projection.first).toBeCloseTo(geometry.sides[k].length * geometry.sides[j].signedDistance / geometry.outer.radius, 9)
    expect(projection.second).toBeCloseTo(geometry.sides[j].length * geometry.sides[k].signedDistance / geometry.outer.radius, 9)
  }
  expect(proof.innerArea).toBeCloseTo(proof.twiceArea, 9)
  expect(proof.innerArea).toBeCloseTo(proof.inradiusArea, 9)
  expect(proof.outerArea).toBeCloseTo(proof.circumradiusArea, 9)
  expect(proof.tileArea).toBeCloseTo(proof.perimeter * proof.sumDistances, 9)
  expect(proof.tileArea).toBeCloseTo(proof.inradiusArea + proof.circumradiusArea, 9)
  expect(proof.sumDistances).toBeCloseTo(geometry.outer.radius + geometry.inner.radius, 9)
  return proof
}

describe('Carnot proof by projections and signed areas', () => {
  it('verifies every intermediate identity for all 25 seeds', () => {
    for (let seed = 1; seed <= 25; seed++) expectProof(createCarnotTriangle(seed))
  })

  it('handles acute, right, and obtuse examples in either orientation and at other scales', () => {
    for (const kind of ['Acute', 'Right', 'Obtuse'] as const) {
      const points = carnotPreset(kind)
      const proof = expectProof(points)
      expectProof([points[2], points[1], points[0]])
      const transformed = points.map((point) => ({ x: point.x * 2.7 + 4, y: point.y * 2.7 - 3 }))
      expectProof([transformed[0], transformed[1], transformed[2]])
      if (kind === 'Acute') expect(proof.tiles.every((tile) => tile.area > 0)).toBe(true)
      if (kind === 'Right') expect(Math.min(...proof.geometry.sides.map((side) => Math.abs(side.signedDistance)))).toBeLessThan(1e-10)
      if (kind === 'Obtuse') {
        expect(proof.tiles.filter((tile) => tile.area < 0)).toHaveLength(3)
        expect(proof.projections.some((projection) => projection.first < 0 || projection.second < 0)).toBe(true)
      }
    }
  })

  it('preserves the proof while cyclic vertex dragging changes the triangle', () => {
    let points = createCarnotTriangle(5)
    for (let iteration = 0; iteration < 45; iteration++) {
      const index = iteration % 3
      points = moveCarnotVertex(points, index, Math.atan2(points[index].y, points[index].x) + 0.24)
      points.forEach((point) => expect(Math.hypot(point.x, point.y)).toBeCloseTo(1, 12))
      expectProof(points)
    }
  })

  it('reports overlapping vertices explicitly', () => {
    const points = createCarnotTriangle(5)
    expect(analyzeCarnotProof([points[0], points[0], points[2]]).valid).toBe(false)
  })
})
