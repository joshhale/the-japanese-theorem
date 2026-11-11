import type { Point } from './geometry'

export default function Angle({ at, from, to, label, radius = 25, color, through, testId }: {
  at: Point; from: Point; to: Point; label?: string; radius?: number; color: string; through?: Point; testId?: string
}) {
  const start = Math.atan2(from.y - at.y, from.x - at.x)
  const cross = (from.x - at.x) * (to.y - at.y) - (from.y - at.y) * (to.x - at.x)
  const dot = (from.x - at.x) * (to.x - at.x) + (from.y - at.y) * (to.y - at.y)
  let sweep = Math.atan2(cross, dot)
  if (through) {
    const turn = 2 * Math.PI
    const positive = (angle: number) => (angle % turn + turn) % turn
    const toAngle = positive(Math.atan2(to.y - at.y, to.x - at.x) - start)
    const throughAngle = positive(Math.atan2(through.y - at.y, through.x - at.x) - start)
    sweep = throughAngle <= toAngle ? toAngle : toAngle - turn
  }
  const end = start + sweep
  const middle = start + sweep / 2
  return <g stroke={color} fill="none" data-testid={testId}>
    <path d={`M${at.x + radius * Math.cos(start)},${at.y + radius * Math.sin(start)} A${radius},${radius} 0 ${Math.abs(sweep) > Math.PI ? 1 : 0} ${sweep > 0 ? 1 : 0} ${at.x + radius * Math.cos(end)},${at.y + radius * Math.sin(end)}`} />
    {label && <text x={at.x + (radius + 14) * Math.cos(middle)} y={at.y + (radius + 14) * Math.sin(middle)}
      fill={color} textAnchor="middle" dominantBaseline="middle">{label}</text>}
  </g>
}
