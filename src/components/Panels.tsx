import type { MonthlyRank, Pillar, Recommendation, WorkItem } from "../data/types"
import { dayLabel } from "../lib/format"

export function MetricTile(props: { label: string; value: string; change: { text: string; tone: "good" | "bad" | "neutral" } }) {
  return (
    <div className="tile">
      <p className="tile-label">{props.label}</p>
      <p className="tile-value">{props.value}</p>
      <p className={`tile-change tone-${props.change.tone}`}>{props.change.text}</p>
    </div>
  )
}

export function CategoryBars(props: { items: { label: string; value: number }[] }) {
  return (
    <ul className="bars">
      {props.items.map((it) => (
        <li key={it.label}>
          <span className="bar-label">{it.label}</span>
          <span className="bar-track" aria-hidden="true">
            <span className="bar-fill" style={{ width: `${it.value}%` }} />
          </span>
          <span className="bar-value">{it.value}</span>
        </li>
      ))}
    </ul>
  )
}

const PILLARS: Record<Pillar, string> = {
  found: "Getting found",
  speed: "Speed",
  trust: "Trust and security",
}

export function ActionPlan(props: { items: Recommendation[] }) {
  if (!props.items.length) return <p className="empty">Nothing open. Every item in the plan is done.</p>
  const groups = (Object.keys(PILLARS) as Pillar[])
    .map((p) => ({ pillar: p, items: props.items.filter((r) => r.pillar === p) }))
    .filter((g) => g.items.length)

  return (
    <div className="plan">
      {groups.map((g) => (
        <section key={g.pillar} aria-labelledby={`pillar-${g.pillar}`}>
          <h3 id={`pillar-${g.pillar}`} className="plan-pillar">
            {PILLARS[g.pillar]}
          </h3>
          <ol className="plan-list">
            {g.items.map((r) => (
              <li key={r.position} className="plan-item">
                <div className="plan-head">
                  <span className={`chip sev-${r.severity}`}>{r.kind === "fix" ? `Fix, ${r.severity} priority` : "Opportunity"}</span>
                  <p className="plan-title">{r.title}</p>
                </div>
                <p className="plan-why">{r.why}</p>
                <p className="plan-found">
                  <span>What we found:</span> {r.found}
                </p>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  )
}

export function KeywordTable(props: { latest: MonthlyRank[]; previous: MonthlyRank[] }) {
  const prev = new Map(props.previous.map((r) => [r.keyword, r.best_position]))
  const rows = [...props.latest].sort((a, b) => (a.best_position ?? 99) - (b.best_position ?? 99))

  return (
    <table className="table">
      <caption className="sr-only">Search positions this month, best first</caption>
      <thead>
        <tr>
          <th scope="col">Search</th>
          <th scope="col" className="num">Position</th>
          <th scope="col" className="num">Change</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const before = prev.get(r.keyword)
          let change = "New"
          let tone = "neutral"
          if (r.best_position === null) change = "—"
          else if (before !== undefined && before !== null) {
            const d = before - r.best_position
            change = d === 0 ? "Same" : `${d > 0 ? "Up" : "Down"} ${Math.abs(d)}`
            tone = d > 0 ? "good" : d < 0 ? "bad" : "neutral"
          }
          return (
            <tr key={r.keyword}>
              <th scope="row">{r.keyword}</th>
              <td className="num">{r.best_position === null ? "Not in top 50" : `#${r.best_position}`}</td>
              <td className={`num tone-${tone}`}>{change}</td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}

const CATEGORY: Record<WorkItem["category"], string> = {
  seo: "Search",
  design: "Design",
  security: "Security",
  content: "Content",
  maintenance: "Care",
}

export function WorkLog(props: { items: WorkItem[] }) {
  if (!props.items.length) return <p className="empty">No work logged this month yet.</p>
  return (
    <ol className="work">
      {props.items.map((w) => (
        <li key={w.id}>
          <time dateTime={w.done_on}>{dayLabel(w.done_on)}</time>
          <div>
            <p className="work-title">
              {w.title} <span className="chip">{CATEGORY[w.category]}</span>
            </p>
            <p className="work-detail">{w.detail}</p>
          </div>
        </li>
      ))}
    </ol>
  )
}
