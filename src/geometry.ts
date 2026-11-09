export type Point = { x: number; y: number }
export type Edge = readonly [number, number]
export type Triangle = readonly [number, number, number]

function randomGenerator(seed: number) {
  let state = seed
  return () => {
    state += 0x6d2b79f5
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function createVertices(count: number, seed: number): Point[] {
  const random = randomGenerator(seed)
  const gaps = Array.from({ length: count }, () => 0.35 + random() ** 2 * 2)
  const total = gaps.reduce((sum, gap) => sum + gap, 0)
  let angle = -Math.PI / 2 + (random() - 0.5) * 0.3
  return gaps.map((gap) => {
    const point = { x: Math.cos(angle), y: Math.sin(angle) }
    angle += (gap / total) * Math.PI * 2
    return point
  })
}

export function edgeKey([a, b]: Edge): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

export function isBoundary([a, b]: Edge, count: number): boolean {
  return Math.abs(a - b) === 1 || Math.abs(a - b) === count - 1
}

export function edgesCross([a, b]: Edge, [c, d]: Edge): boolean {
  if (a === c || a === d || b === c || b === d) return false
  const low = Math.min(a, b)
  const high = Math.max(a, b)
  return (c > low && c < high) !== (d > low && d < high)
}

export function forceEdge(edges: readonly Edge[], edge: Edge): Edge[] {
  return [
    ...edges.filter(
      (existing) => !edgesCross(existing, edge) && edgeKey(existing) !== edgeKey(edge),
    ),
    edge,
  ]
}

export function triangulate(count: number, seed: number, forced: readonly Edge[] = []): Triangle[] {
  const random = randomGenerator(seed)
  let faces = [Array.from({ length: count }, (_, index) => index)]

  for (const [a, b] of forced) {
    const faceIndex = faces.findIndex((face) => face.includes(a) && face.includes(b))
    if (faceIndex < 0) throw new Error('Forced diagonals must not cross.')
    const face = faces[faceIndex]
    const [start, end] = [face.indexOf(a), face.indexOf(b)].sort((x, y) => x - y)
    if (end - start === 1 || (start === 0 && end === face.length - 1)) continue
    faces = [
      ...faces.slice(0, faceIndex),
      face.slice(start, end + 1),
      [...face.slice(end), ...face.slice(0, start + 1)],
      ...faces.slice(faceIndex + 1),
    ]
  }

  const triangles: Triangle[] = []
  for (const face of faces) {
    const remaining = [...face]
    while (remaining.length > 3) {
      const ear = Math.floor(random() * remaining.length)
      triangles.push([
        remaining[(ear + remaining.length - 1) % remaining.length],
        remaining[ear],
        remaining[(ear + 1) % remaining.length],
      ])
      remaining.splice(ear, 1)
    }
    triangles.push([remaining[0], remaining[1], remaining[2]])
  }
  return triangles
}

export function triangleEdges(triangles: readonly Triangle[]): Edge[] {
  const edges = new Map<string, Edge>()
  for (const [a, b, c] of triangles) {
    for (const edge of [[a, b], [b, c], [c, a]] as Edge[]) {
      edges.set(edgeKey(edge), edge)
    }
  }
  return [...edges.values()]
}

export function insertDiagonal(count: number, seed: number, triangles: readonly Triangle[], edge: Edge): Triangle[] {
  const retained = triangleEdges(triangles).filter((item) => !isBoundary(item, count) && !edgesCross(item, edge))
  if (retained.some((item) => edgeKey(item) === edgeKey(edge))) return [...triangles]

  const rebuilt = triangulate(count, seed, [...retained, edge])
  const triangleKey = (triangle: Triangle) => [...triangle].sort((a, b) => a - b).join('-')
  const previousKeys = new Set(triangles.map(triangleKey))
  const rebuiltKeys = new Set(rebuilt.map(triangleKey))
  const replacements = rebuilt.filter((triangle) => !previousKeys.has(triangleKey(triangle)))
  let replacementIndex = 0

  // Keep untouched triangles in their slots so their colors and radius labels stay put.
  return triangles.map((triangle) => rebuiltKeys.has(triangleKey(triangle))
    ? triangle
    : replacements[replacementIndex++])
}

export function incircle(points: readonly Point[], [a, b, c]: Triangle) {
  const A = points[a]
  const B = points[b]
  const C = points[c]
  const sideA = Math.hypot(B.x - C.x, B.y - C.y)
  const sideB = Math.hypot(A.x - C.x, A.y - C.y)
  const sideC = Math.hypot(A.x - B.x, A.y - B.y)
  const perimeter = sideA + sideB + sideC
  const doubleArea = Math.abs((B.x - A.x) * (C.y - A.y) - (B.y - A.y) * (C.x - A.x))
  return {
    x: (sideA * A.x + sideB * B.x + sideC * C.x) / perimeter,
    y: (sideA * A.y + sideB * B.y + sideC * C.y) / perimeter,
    radius: doubleArea / perimeter,
  }
}

export function referenceSum(points: readonly Point[]): number {
  let total = 0
  for (let index = 1; index < points.length - 1; index++) {
    total += incircle(points, [0, index, index + 1]).radius
  }
  return total
}
