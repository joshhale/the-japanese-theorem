import { createVertices } from './geometry'
import type { Point } from './geometry'
import type { TrianglePoints } from './triangleGeometry'

export const CENTRAL_PRESETS = ['Minor arc', 'Semicircle', 'Reflex angle', 'Subtract angles'] as const
export type CentralPreset = typeof CENTRAL_PRESETS[number]

const turn = 2 * Math.PI
const positive = (angle: number) => (angle % turn + turn) % turn

function angleAt(at: Point, from: Point, to: Point) {
  const u = { x: from.x - at.x, y: from.y - at.y }
  const v = { x: to.x - at.x, y: to.y - at.y }
  return Math.atan2(Math.abs(u.x * v.y - u.y * v.x), u.x * v.x + u.y * v.y)
}

export function createCentralTriangle(seed: number): TrianglePoints {
  const [a, b, c] = createVertices(3, seed)
  return [a, b, c]
}

export function centralPreset(kind: CentralPreset): TrianglePoints {
  const angles = kind === 'Minor arc' ? [30, 150, 260]
    : kind === 'Semicircle' ? [0, 180, 270]
      : kind === 'Reflex angle' ? [60, 300, 360] : [20, 80, 160]
  const [a, b, c] = angles.map((angle) => ({
    x: Math.cos(angle * Math.PI / 180), y: Math.sin(angle * Math.PI / 180),
  }))
  return [a, b, c]
}

export function analyzeCentralAngle(points: TrianglePoints) {
  if (points.some((point) => !Number.isFinite(point.x) || !Number.isFinite(point.y)
    || Math.abs(Math.hypot(point.x, point.y) - 1) > 1e-8)) {
    return { valid: false, reason: 'All three vertices must lie on the unit circle.' } as const
  }
  if (points.some((point, index) => Math.hypot(point.x - points[(index + 1) % 3].x,
    point.y - points[(index + 1) % 3].y) < 1e-9)) {
    return { valid: false, reason: 'The three vertices must be distinct.' } as const
  }
  const [a, b, c] = points
  const o = { x: 0, y: 0 }
  const d = { x: -c.x, y: -c.y }
  const start = Math.atan2(a.y, a.x)
  const toB = positive(Math.atan2(b.y, b.x) - start)
  const toC = positive(Math.atan2(c.y, c.x) - start)
  const sweep = toC < toB ? toB - turn : toB
  const middle = start + sweep / 2
  const ca = { x: a.x - c.x, y: a.y - c.y }
  const cb = { x: b.x - c.x, y: b.y - c.y }
  const cd = { x: d.x - c.x, y: d.y - c.y }
  const signed = (u: Point, v: Point) => Math.atan2(u.x * v.y - u.y * v.x, u.x * v.x + u.y * v.y)
  const wedge = signed(ca, cb)
  const diameter = signed(ca, cd)
  const add = wedge >= 0 ? diameter >= -1e-10 && diameter <= wedge + 1e-10
    : diameter <= 1e-10 && diameter >= wedge - 1e-10
  return {
    valid: true, d, sweep, through: { x: Math.cos(middle), y: Math.sin(middle) },
    central: Math.abs(sweep), inscribed: angleAt(c, a, b),
    alpha: angleAt(c, a, d), beta: angleAt(c, d, b),
    firstCentral: angleAt(o, a, d), secondCentral: angleAt(o, d, b), add,
  } as const
}
