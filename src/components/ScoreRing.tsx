import { grade } from "../lib/format"

interface Props {
  score: number
  label: string
  size?: number
}

/** Circular 0 to 100 gauge. The number and letter grade are real text, not drawn. */
export function ScoreRing({ score, label, size = 168 }: Props) {
  const stroke = size * 0.08
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const filled = (Math.max(0, Math.min(100, score)) / 100) * c

  return (
    <figure className="ring" style={{ width: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--track)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="ring-arc"
        />
      </svg>
      <div className="ring-center">
        <span className="ring-score">{score}</span>
        <span className="ring-grade">Grade {grade(score)}</span>
      </div>
      <figcaption className="sr-only">
        {label}: {score} out of 100, grade {grade(score)}
      </figcaption>
    </figure>
  )
}
