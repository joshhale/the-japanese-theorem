import { createVertices, edgeKey, isBoundary, moveCyclicVertex } from './geometry'
import type { Edge, Point, Triangle } from './geometry'
import { analyzeTriangle } from './triangleGeometry'

export type QuadrilateralPoints = readonly [Point, Point, Point, Point]
type ValidTriangle = Extract<ReturnType<typeof analyzeTriangle>, { valid: true }>
export type ProofTerm = {
  key: string
  label: string
  edge: Edge
  value: number
  foot: Point
  touch: Point
  diagonal: boolean
}
export type ProofTriangle = {
  label: string
  indices: Triangle
  radiusIndex: number
  geometry: ValidTriangle
  terms: ProofTerm[]
}

export function createQuadrilateral(seed: number): QuadrilateralPoints {
  const [a, b, c, d] = createVertices(4, seed)
  return [a, b, c, d]
}

export function moveQuadrilateralVertex(points: QuadrilateralPoints, index: number, angle: number): QuadrilateralPoints {
  const [a, b, c, d] = moveCyclicVertex(points, index, angle)
  return [a, b, c, d]
}

// Vertices are in cyclic order on the unit circle.
export function analyzeQuadrilateral(points: QuadrilateralPoints) {
  const definitions: { label: string; indices: Triangle }[] = [
    { label: 'ABC', indices: [0, 1, 2] },
    { label: 'ACD', indices: [0, 2, 3] },
    { label: 'ABD', indices: [0, 1, 3] },
    { label: 'BCD', indices: [1, 2, 3] },
  ]
  const triangles: ProofTriangle[] = []
  for (const [index, definition] of definitions.entries()) {
    const { indices } = definition
    const geometry = analyzeTriangle([points[indices[0]], points[indices[1]], points[indices[2]]])
    if (!geometry.valid) return { valid: false, reason: geometry.reason } as const
    const terms = geometry.sides.map((side, sideIndex): ProofTerm => {
      const edge: Edge = [indices[(sideIndex + 1) % 3], indices[(sideIndex + 2) % 3]]
      const ordered = [...edge].sort((a, b) => a - b)
      return {
        key: edgeKey(edge),
        label: ordered.map((vertex) => String.fromCharCode(65 + vertex)).join(''),
        edge,
        value: side.signedDistance,
        foot: side.foot,
        touch: side.touch,
        diagonal: !isBoundary(edge, 4),
      }
    }).sort((a, b) => Number(a.diagonal) - Number(b.diagonal) || a.key.localeCompare(b.key))
    triangles.push({ ...definition, radiusIndex: index + 1, geometry, terms })
  }
  const boundary = triangles.slice(0, 2).flatMap((triangle) => triangle.terms.filter((term) => !term.diagonal))
    .sort((a, b) => a.label.localeCompare(b.label))
  const boundarySum = boundary.reduce((sum, term) => sum + term.value, 0)
  const sumAC = triangles[0].geometry.inner.radius + triangles[1].geometry.inner.radius
  const sumBD = triangles[2].geometry.inner.radius + triangles[3].geometry.inner.radius
  return { valid: true, triangles, boundary, boundarySum, sumAC, sumBD, derivedSum: boundarySum - 2 } as const
}
