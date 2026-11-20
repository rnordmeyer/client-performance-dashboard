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
 * Small SVG line chart. Screen readers get a real data table instead of the
 * drawing, and the latest value is labeled directly on the chart.
 */
export function TrendChart({ title, points, domain, unit = "" }: Props) {
  const id = useId()
  const W = 560
  const H = 200
  const pad = { top: 16, right: 44, bottom: 28, left: 40 }
  const values = points.map((p) => p.value)
  const lo = domain ? domain[0] : 0
  const hi = domain ? domain[1] : Math.max(1, Math.ceil((Math.max(...values) * 1.15) / 10) * 10)
  const x = (i: number) => pad.left + (i / Math.max(1, points.length - 1)) * (W - pad.left - pad.right)
  const y = (v: number) => pad.top + (1 - (v - lo) / (hi - lo)) * (H - pad.top - pad.bottom)
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(" ")
  const area = `${line} L${x(points.length - 1)},${y(lo)} L${x(0)},${y(lo)} Z`
  const ticks = [lo, lo + (hi - lo) / 2, hi]
  const last = points[points.length - 1]

  return (
    <figure className="chart" aria-labelledby={`${id}-title`}>
      <figcaption id={`${id}-title`} className="chart-title">
        {title}
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-hidden="true" preserveAspectRatio="none">
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.22" />
            <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.left} x2={W - pad.right} y1={y(t)} y2={y(t)} stroke="var(--grid)" />
            <text x={pad.left - 8} y={y(t) + 4} textAnchor="end" className="axis">
              {num(Math.round(t))}
            </text>
          </g>
        ))}
        <path d={area} fill={`url(#${id}-fill)`} />
        <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) =>
          i % 2 === points.length % 2 || i === points.length - 1 ? (
            <text key={p.month} x={x(i)} y={H - 8} textAnchor="middle" className="axis">
              {shortMonth(p.month)}
            </text>
          ) : null,
        )}
        {last && (
          <>
            <circle cx={x(points.length - 1)} cy={y(last.value)} r="4.5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
            <text x={x(points.length - 1) + 8} y={y(last.value) + 4} className="axis axis-strong">
              {num(last.value)}
              {unit}
            </text>
          </>
        )}
      </svg>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            <th scope="col">Value</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p) => (
            <tr key={p.month}>
              <th scope="row">{shortMonth(p.month)}</th>
              <td>
                {num(p.value)}
                {unit}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  )
}
