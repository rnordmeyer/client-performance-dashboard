import { useEffect, useMemo, useState } from "react"
import { Icon } from "./components/Icon"
import {
  Card,
  CategoryBars,
  DeltaPill,
  KeywordTable,
  PlanDetail,
  PlanSummary,
  StatCard,
  ViewLink,
  WorkLog,
  type Tone,
} from "./components/Panels"
import { ScoreRing } from "./components/ScoreRing"
import { Sparkline, TrendChart } from "./components/TrendChart"
import { demoSource, type DataSource } from "./data/source"
import type { DashboardData } from "./data/types"
import { dayLabel, grade, monthLabel, num, parseDay, shortMonth } from "./lib/format"

type Theme = "light" | "dark"
type Tab = "all" | "health" | "numbers" | "work" | "plan"

const TABS: { id: Tab; label: string }[] = [
  { id: "all", label: "All" },
  { id: "health", label: "Health" },
  { id: "numbers", label: "Numbers" },
  { id: "work", label: "Work" },
  { id: "plan", label: "Plan" },
]

const RAIL: { href: string; label: string; icon: string }[] = [
  { href: "#overview", label: "Overview", icon: "overview" },
  { href: "#health", label: "Health", icon: "health" },
  { href: "#numbers", label: "Traffic", icon: "traffic" },
  { href: "#search", label: "Search", icon: "search" },
  { href: "#uptime", label: "Uptime", icon: "uptime" },
  { href: "#work", label: "Work log", icon: "work" },
  { href: "#plan", label: "Plan", icon: "plan" },
]

/** Daily average, so a month in progress compares fairly with a finished one. */
const perDay = (t: { visits: number; days_reported: number }) => t.visits / Math.max(1, t.days_reported)

function change(
  current: number,
  previous: number | undefined,
  prevMonth: string | undefined,
  opts: { unit: "pts" | "pct" | "ms" | "count"; lowerIsBetter?: boolean; perDay?: boolean },
): { text: string; tone: Tone; direction?: "up" | "down" } {
  if (previous === undefined || !prevMonth) return { text: "First month", tone: "neutral" }
  const vs = `vs ${shortMonth(prevMonth)}`
  let diff = current - previous
  let label: string
  if (opts.unit === "pct") {
    diff = previous ? ((current - previous) / previous) * 100 : 0
    label = `${Math.abs(diff).toFixed(1)}%${opts.perDay ? " per day" : ""}`
  } else {
    diff = Math.round(diff * 10) / 10
    label = `${num(Math.abs(diff))}${opts.unit === "pts" ? " pts" : opts.unit === "ms" ? " ms" : ""}`
  }
  if (Math.abs(diff) < 0.05) return { text: `No change ${vs}`, tone: "neutral" }
  const up = diff > 0
  return {
    text: `${up ? "+" : "−"}${label} ${vs}`,
    tone: up !== Boolean(opts.lowerIsBetter) ? "good" : "bad",
    direction: up ? "up" : "down",
  }
}

function greeting(d = new Date()) {
  const h = d.getHours()
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
}

export default function App({ source = demoSource }: { source?: DataSource }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [month, setMonth] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>("all")
  const [theme, setTheme] = useState<Theme>("dark")

  useEffect(() => {
    document.documentElement.dataset.theme = theme
  }, [theme])

  useEffect(() => {
    source.load().then(setData, (e: unknown) => setError(e instanceof Error ? e.message : String(e)))
  }, [source])

  const site = data?.sites[0]
  const client = data?.clients.find((c) => c.id === site?.client_id)

  const view = useMemo(() => {
    if (!data || !site) return null
    const scores = data.scores.filter((s) => s.site_id === site.id)
    const months = scores.map((s) => s.month)
    const i = month ? Math.max(0, months.indexOf(month)) : months.length - 1
    const m = months[i]
    const pm = months[i - 1]
    const pick = <T extends { site_id: string; month: string }>(rows: T[], when?: string) =>
      rows.find((r) => r.site_id === site.id && r.month === when)
    const rank = { high: 0, medium: 1, low: 2 }
    return {
      months,
      month: m,
      prevMonth: pm,
      score: scores[i],
      prevScore: scores[i - 1],
      traffic: pick(data.traffic, m),
      prevTraffic: pick(data.traffic, pm),
      uptime: pick(data.uptime, m),
      prevUptime: pick(data.uptime, pm),
      ranks: data.ranks.filter((r) => r.site_id === site.id && r.month === m),
      prevRanks: data.ranks.filter((r) => r.site_id === site.id && r.month === pm),
      plan: data.recommendations.filter((r) => r.site_id === site.id).sort((a, b) => rank[a.severity] - rank[b.severity]),
      work: data.work.filter((w) => w.done_on.startsWith(m.slice(0, 7))).sort((a, b) => b.done_on.localeCompare(a.done_on)),
      scoreTrend: scores.slice(Math.max(0, i - 11), i + 1).map((s) => ({ month: s.month, value: s.overall })),
      visitsPerDay: data.traffic
        .filter((t) => t.site_id === site.id && t.month <= m)
        .slice(-12)
        .map((t) => Math.round(perDay(t))),
    }
  }, [data, site, month])

  if (error) {
    return (
      <main className="state" role="alert">
        <h1>The report could not be loaded</h1>
        <p>{error}</p>
      </main>
    )
  }
  if (!view || !site || !client) {
    return (
      <main className="state" aria-busy="true">
        <p>Loading the report…</p>
      </main>
    )
  }

  const { score, prevScore, traffic, prevTraffic, uptime, prevUptime, prevMonth } = view
  const show = (...tabs: Tab[]) => tab === "all" || tabs.includes(tab)
  const initials = client.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
  const first = parseDay(view.month)
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const partial = traffic && traffic.days_reported < daysInMonth
  const checkedOn = `${first.getFullYear()}-${String(first.getMonth() + 1).padStart(2, "0")}-02`

  return (
    <div className="shell">
      <a className="skip" href="#main">
        Skip to main content
      </a>

      <aside className="rail" aria-label="Quick navigation">
        <span className="rail-mark" aria-hidden="true" />
        <div className="rail-group" role="group" aria-label="Appearance">
          <button className={`rail-btn ${theme === "light" ? "is-on" : ""}`} aria-pressed={theme === "light"} aria-label="Light mode" onClick={() => setTheme("light")}>
            <Icon name="sun" />
          </button>
          <button className={`rail-btn ${theme === "dark" ? "is-on" : ""}`} aria-pressed={theme === "dark"} aria-label="Dark mode" onClick={() => setTheme("dark")}>
            <Icon name="moon" />
          </button>
        </div>
        <nav className="rail-group" aria-label="Sections">
          <ul>
            {RAIL.map((r, k) => (
              <li key={r.href}>
                <a className={`rail-btn ${k === 0 ? "is-active" : ""}`} href={r.href} aria-label={r.label} title={r.label}>
                  <Icon name={r.icon} />
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="page">
        <header className="topbar">
          <nav className="tabs" aria-label="Overview parts">
            <span className="tabs-title">
              <Icon name="overview" size={16} /> Overview
            </span>
            <ul>
              {TABS.map((t) => (
                <li key={t.id}>
                  <button className={`tab ${tab === t.id ? "is-on" : ""}`} aria-pressed={tab === t.id} onClick={() => setTab(t.id)}>
                    {t.label}
                  </button>
                </li>
              ))}
            </ul>
          </nav>
          <div className="account">
            <span className="avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="account-text">
              <span className="account-name">{client.name}</span>
              <span className="account-sub">Example business</span>
            </span>
          </div>
        </header>

        <main id="main" tabIndex={-1}>
          <div className="notice" role="status">
            <span className="notice-icon" aria-hidden="true">
              <Icon name="overview" size={16} />
            </span>
            <div className="notice-text">
              <p className="notice-kicker">Good news</p>
              <p className="notice-title">Your {monthLabel(view.month).split(" ")[0]} report is ready</p>
              <p className="notice-sub">Here’s how your site did, compared with the month before.</p>
            </div>
            <ViewLink href="#health" />
          </div>

          <section id="overview" className="intro" aria-labelledby="hello">
            <div>
              <h1 id="hello">
                {greeting()},<br />
                {client.name}
              </h1>
              <p className="intro-sub">
                Here is how an example business is doing in {monthLabel(view.month)}. The numbers are invented.
              </p>
              <p className="intro-meta">
                Last checked {dayLabel(checkedOn)}, {first.getFullYear()}
              </p>
            </div>
            <div className="pickers">
              <label className="picker">
                <span>Website</span>
                <select disabled>
                  <option>{site.domain}</option>
                </select>
              </label>
              <label className="picker">
                <span className="sr-only">Month</span>
                <select value={view.month} onChange={(e) => setMonth(e.target.value)}>
                  {[...view.months].reverse().map((m) => (
                    <option key={m} value={m}>
                      {monthLabel(m)}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </section>

          {show("health", "numbers") && (
            <div className="hero-grid">
              {show("health") && (
                <section id="health" className="card card-glow" aria-labelledby="health-title">
                  <div className="card-head">
                    <h2 id="health-title">Overall health</h2>
                    <ViewLink href="#health-detail" />
                  </div>
                  <div className="health">
                    <ScoreRing score={score.overall} />
                    <div>
                      <p className="health-grade">
                        Grade <strong>{grade(score.overall)}</strong>
                      </p>
                      <DeltaPill {...change(score.overall, prevScore?.overall, prevMonth, { unit: "pts" })} />
                      <p className="health-note">
                        One score that combines search basics, speed, accessibility, best practices and security. It does
                        not include rankings or traffic.
                      </p>
                    </div>
                  </div>
                </section>
              )}
              {show("numbers") && traffic && (
                <section id="numbers" className="card" aria-labelledby="visits-title">
                  <div className="card-head">
                    <h2 id="visits-title" className="label-head">
                      Visits
                    </h2>
                    <ViewLink href="#traffic-detail" />
                  </div>
                  <p className="big-number">{num(traffic.visits)}</p>
                  <DeltaPill {...change(perDay(traffic), prevTraffic && perDay(prevTraffic), prevMonth, { unit: "pct", perDay: true })} />
                  {partial && (
                    <p className="card-note">
                      Partial month: traffic data for {traffic.days_reported} of {daysInMonth} days, so the change is a
                      daily average.
                    </p>
                  )}
                  <div className="spark-row">
                    <Sparkline values={view.visitsPerDay} />
                    <span className="card-note">Visits per day, last 12 months</span>
                  </div>
                </section>
              )}
            </div>
          )}

          {show("numbers") && (
            <div className="stats" id="uptime">
              <StatCard
                featured
                label="Unique visitors"
                value={traffic ? num(traffic.unique_visitors) : "No data"}
                delta={
                  traffic
                    ? change(
                        traffic.unique_visitors / traffic.days_reported,
                        prevTraffic && prevTraffic.unique_visitors / prevTraffic.days_reported,
                        prevMonth,
                        { unit: "pct", perDay: true },
                      )
                    : { text: "", tone: "neutral" }
                }
                href="#traffic-detail"
              />
              <StatCard
                label="Uptime"
                value={uptime ? `${uptime.uptime_pct}%` : "No data"}
                delta={uptime ? change(uptime.uptime_pct, prevUptime?.uptime_pct, prevMonth, { unit: "pts" }) : { text: "", tone: "neutral" }}
                href="#uptime"
              />
              <StatCard
                label="Response time"
                sublabel="at monthly check"
                value={`${num(score.response_ms)} ms`}
                delta={change(score.response_ms, prevScore?.response_ms, prevMonth, { unit: "ms", lowerIsBetter: true })}
                href="#health-detail"
              />
              <StatCard
                label="Open issues"
                value={num(score.issues_count)}
                delta={change(score.issues_count, prevScore?.issues_count, prevMonth, { unit: "count", lowerIsBetter: true })}
                href="#plan"
              />
            </div>
          )}

          {show("health") && (
            <div className="two-col wide-left" id="health-detail">
              <Card title="Overall health, last 12 months" action={<ViewLink href="#health" label="View health" />}>
                <TrendChart title="Overall health score by month" points={view.scoreTrend} domain={[0, 100]} />
              </Card>
              <Card title="Score by category">
                <CategoryBars
                  items={[
                    { label: "Search basics", value: score.seo },
                    { label: "Speed", value: score.performance },
                    { label: "Accessibility", value: score.accessibility },
                    { label: "Best practices", value: score.best_practices },
                    { label: "Security", value: score.security },
                  ]}
                />
              </Card>
            </div>
          )}

          {show("plan") && (
            <Card id="plan-top" title="Top of the plan" action={<ViewLink href="#plan" label="See the whole plan" />}>
              <PlanSummary items={view.plan.slice(0, 3)} />
            </Card>
          )}

          {show("numbers", "work") && (
            <div className={tab === "work" ? "" : "two-col"} id="traffic-detail">
              {show("numbers") && (
                <Card id="search" title="Search positions">
                  <KeywordTable latest={view.ranks} previous={view.prevRanks} />
                </Card>
              )}
              <Card id="work" title="Work log">
                <WorkLog items={view.work} />
              </Card>
            </div>
          )}

          {show("plan") && (
            <Card id="plan" title="The whole plan">
              <PlanDetail items={view.plan} />
            </Card>
          )}

          <footer className="footer">
            <p>
              Scores are point-in-time measurements from automated checks. They help find and fix problems, but they are
              not a guarantee of security, accessibility, or search rankings. Demo build: Lakeshore Coffee Roasters is not a
              real business.
            </p>
          </footer>
        </main>
      </div>
    </div>
  )
}
