import { useId } from "react"
import { num, shortMonth } from "../lib/format"

interface Point {
  month: string
  value: number
}

interface Props {
  title: string
  points: Point[]
  /** Fixed y range for scores (0 to 100); omit for counts, which scale to the data. */
  domain?: [number, number]
  unit?: string
}

/**
 * SVG line chart with a "Show as a table" disclosure, so the same numbers are
 * available to everyone, including screen reader users, without a tooltip hunt.
 */
export function TrendChart({ title, points, domain, unit = "" }: Props) {
  const id = useId()
  const W = 1000
  const H = 230
  const pad = { top: 12, right: 24, bottom: 30, left: 44 }
  const values = points.map((p) => p.value)
  const lo = domain ? domain[0] : 0
  const hi = domain ? domain[1] : Math.max(4, Math.ceil((Math.max(...values) * 1.15) / 4) * 4)
  const x = (i: number) => pad.left + 24 + (i / Math.max(1, points.length - 1)) * (W - pad.left - pad.right - 48)
  const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * (H - pad.top - pad.bottom)
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => lo + f * (hi - lo))
  const last = points[points.length - 1]

  return (
    <figure className="chart">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. Expand "Show as a table" below for the values.`}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={pad.left - 12} y={y(t) + 4} textAnchor="end" className="axis">
              {num(Math.round(t))}
            </text>
          </g>
        ))}
        {points.map((p, i) => (
          <text key={p.month} x={x(i)} y={H - 6} textAnchor="middle" className="axis">
            {shortMonth(p.month)}
          </text>
        ))}
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        {last && <circle cx={x(points.length - 1)} cy={y(last.value)} r="4" fill="var(--accent)" />}
      </svg>
      <details className="as-table">
        <summary>Show as a table</summary>
        <table className="table compact" id={`${id}-table`}>
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr>
              <th scope="col">Month</th>
              <th scope="col" className="num">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {points.map((p) => (
              <tr key={p.month}>
                <th scope="row">{shortMonth(p.month)}</th>
                <td className="num">
                  {num(p.value)}
                  {unit}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </figure>
  )
}

/** Tiny trend line for stat cards. Decorative; the card text carries the meaning. */
export function Sparkline({ values }: { values: number[] }) {
  const W = 120
  const H = 28
  const lo = Math.min(...values)
  const hi = Math.max(...values)
  const pts = values.map((v, i) => [(i / Math.max(1, values.length - 1)) * (W - 6) + 3, H - 4 - ((v - lo) / Math.max(1, hi - lo)) * (H - 8)])
  const d = pts.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ")
  const [lx, ly] = pts[pts.length - 1]
  return (
    <svg className="spark" width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path d={d} fill="none" stroke="var(--muted)" strokeWidth="1.5" strokeLinecap="round" />
      <circle cx={lx} cy={ly} r="3" fill="var(--accent)" />
    </svg>
  )
}
