import type { ReactNode } from "react"
import type { MonthlyRank, Pillar, Recommendation, WorkItem } from "../data/types"
import { dayLabel, num } from "../lib/format"
import { Icon } from "./Icon"

export type Tone = "good" | "bad" | "neutral"

/** Change pill: arrow + words, so meaning never depends on color alone. */
export function DeltaPill({ text, tone, direction }: { text: string; tone: Tone; direction?: "up" | "down" }) {
  return (
    <span className={`pill pill-${tone}`}>
      {direction && <Icon name={direction} size={13} />}
      {text}
    </span>
  )
}

export function Card(props: {
  id?: string
  title: string
  action?: ReactNode
  className?: string
  children: ReactNode
}) {
  const headingId = props.id ? `${props.id}-title` : undefined
  return (
    <section id={props.id} className={`card ${props.className ?? ""}`} aria-labelledby={headingId}>
      <div className="card-head">
        <h2 id={headingId}>{props.title}</h2>
        {props.action}
      </div>
      {props.children}
    </section>
  )
}

export function ViewLink({ href, label = "View" }: { href: string; label?: string }) {
  return (
    <a className="view-link" href={href}>
      {label}
      <Icon name="chevron" size={14} />
    </a>
  )
}

export function StatCard(props: {
  label: string
  sublabel?: string
  value: string
  delta: { text: string; tone: Tone; direction?: "up" | "down" }
  href: string
  featured?: boolean
}) {
  return (
    <div className={`stat ${props.featured ? "stat-featured" : ""}`}>
      <div className="stat-top">
        <p className="stat-label">
          {props.label}
          {props.sublabel && <span>{props.sublabel}</span>}
        </p>
        <ViewLink href={props.href} />
      </div>
      <p className="stat-value">{props.value}</p>
      <DeltaPill {...props.delta} />
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
  found: "Get found on Google",
  speed: "Speed & experience",
  trust: "Trust & security",
}

function Priority({ severity }: { severity: Recommendation["severity"] }) {
  const level = severity === "high" ? 3 : severity === "medium" ? 2 : 1
  return (
    <span className={`priority priority-${severity}`}>
      <span className="priority-bars" aria-hidden="true">
        {[1, 2, 3].map((b) => (
          <i key={b} className={b <= level ? "on" : ""} style={{ height: 4 + b * 3 }} />
        ))}
      </span>
      {severity[0].toUpperCase() + severity.slice(1)} priority
    </span>
  )
}

/** Compact list: category / kind, title, priority. */
export function PlanSummary(props: { items: Recommendation[] }) {
  return (
    <ul className="plan-rows">
      {props.items.map((r) => (
        <li key={r.position}>
          <div>
            <p className="plan-meta">
              {PILLARS[r.pillar]} / {r.kind === "fix" ? "Fix" : "Opportunity"}
            </p>
            <p className="plan-title">{r.title}</p>
          </div>
          <Priority severity={r.severity} />
        </li>
      ))}
    </ul>
  )
}

/** Full plan with the why and what was found. */
export function PlanDetail(props: { items: Recommendation[] }) {
  if (!props.items.length) return <p className="empty">Nothing open. Every item in the plan is done.</p>
  return (
    <ol className="plan-cards">
      {props.items.map((r) => (
        <li key={r.position} className="plan-card">
          <div className="plan-card-head">
            <p className="plan-meta">
              {PILLARS[r.pillar]} / {r.kind === "fix" ? "Fix" : "Opportunity"}
            </p>
            <Priority severity={r.severity} />
          </div>
          <p className="plan-title">{r.title}</p>
          <p className="plan-why">{r.why}</p>
          <p className="plan-found">
            <span>What we found:</span> {r.found}
          </p>
        </li>
      ))}
    </ol>
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
          let cell = <span className="muted">New</span>
          if (r.best_position === null) cell = <span className="muted">Not yet</span>
          else if (before !== undefined && before !== null) {
            const d = before - r.best_position
            cell =
              d === 0 ? (
                <span className="muted">Same</span>
              ) : (
                <DeltaPill text={`${Math.abs(d)} ${d > 0 ? "up" : "down"}`} tone={d > 0 ? "good" : "bad"} direction={d > 0 ? "up" : "down"} />
              )
          }
          return (
            <tr key={r.keyword}>
              <th scope="row">{r.keyword}</th>
              <td className="num">{r.best_position === null ? "Not in top 50" : `#${num(r.best_position)}`}</td>
              <td className="num">{cell}</td>
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
          <span className="work-dot" aria-hidden="true">
            <Icon name="check" size={13} />
          </span>
          <div>
            <p className="work-title">{w.title}</p>
            <p className="work-detail">{w.detail}</p>
            <p className="work-meta">
              <time dateTime={w.done_on}>{dayLabel(w.done_on)}</time> · {CATEGORY[w.category]}
            </p>
          </div>
        </li>
      ))}
    </ol>
  )
}
