import { useEffect, useMemo, useState } from "react"
import { ScoreRing } from "./components/ScoreRing"
import { TrendChart } from "./components/TrendChart"
import { ActionPlan, CategoryBars, KeywordTable, MetricTile, WorkLog } from "./components/Panels"
import { demoSource, type DataSource } from "./data/source"
import type { DashboardData } from "./data/types"
import { delta, monthLabel, num } from "./lib/format"

type Theme = "light" | "dark"

/** Daily average, so a month in progress compares fairly with a finished one. */
const perDay = (t: { visits: number; days_reported: number }) => Math.round(t.visits / Math.max(1, t.days_reported))

export default function App({ source = demoSource }: { source?: DataSource }) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [monthIndex, setMonthIndex] = useState<number | null>(null)
  const [theme, setTheme] = useState<Theme>(() =>
    window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light",
  )

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
    const i = monthIndex ?? months.length - 1
    const month = months[i]
    const prevMonth = months[i - 1]
    const pick = <T extends { site_id: string; month: string }>(rows: T[], m?: string) =>
      rows.find((r) => r.site_id === site.id && r.month === m)
    return {
      months,
      i,
      month,
      score: scores[i],
      prevScore: scores[i - 1],
      traffic: pick(data.traffic, month),
      prevTraffic: pick(data.traffic, prevMonth),
      uptime: pick(data.uptime, month),
      prevUptime: pick(data.uptime, prevMonth),
      ranks: data.ranks.filter((r) => r.site_id === site.id && r.month === month),
      prevRanks: data.ranks.filter((r) => r.site_id === site.id && r.month === prevMonth),
      plan: data.recommendations.filter((r) => r.site_id === site.id && r.month === months[months.length - 1]),
      work: data.work.filter((w) => w.done_on.startsWith(month.slice(0, 7))).sort((a, b) => b.done_on.localeCompare(a.done_on)),
      scoreTrend: scores.slice(0, i + 1).map((s) => ({ month: s.month, value: s.overall })),
      trafficTrend: data.traffic
        .filter((t) => t.site_id === site.id && t.month <= month)
        .map((t) => ({ month: t.month, value: perDay(t) })),
    }
  }, [data, site, monthIndex])

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

  const { score, prevScore, traffic, prevTraffic, uptime, prevUptime } = view
  const isLatest = view.i === view.months.length - 1

  return (
    <div className="app">
      <a className="skip" href="#content">
        Skip to the report
      </a>

      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true" />
          <div>
            <p className="brand-client">{client.name}</p>
            <p className="brand-site">{site.domain}</p>
          </div>
        </div>
        <div className="topbar-actions">
          {source.mode === "demo" && <span className="badge">Demo data</span>}
          <button
            className="btn-ghost"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
          >
            {theme === "dark" ? "Light mode" : "Dark mode"}
          </button>
        </div>
      </header>

      <main id="content" tabIndex={-1}>
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <p className="eyebrow">Monthly website report</p>
            <h1 id="hero-title">{monthLabel(view.month)}</h1>
            <p className="lede">
              {prevScore
                ? score.overall >= prevScore.overall
                  ? `Your site's health score is ${score.overall}, ${score.overall - prevScore.overall === 0 ? "holding steady" : `up ${score.overall - prevScore.overall} from last month`}.`
                  : `Your site's health score is ${score.overall}, down ${prevScore.overall - score.overall} from last month. The plan below covers what to fix first.`
                : `Your site's first health score is ${score.overall}. Next month's report will show the trend.`}
            </p>
            <nav className="month-nav" aria-label="Choose a month">
              <button className="btn-ghost" disabled={view.i === 0} onClick={() => setMonthIndex(view.i - 1)}>
                Previous month
              </button>
              <button className="btn-ghost" disabled={isLatest} onClick={() => setMonthIndex(view.i + 1)}>
                Next month
              </button>
              {!isLatest && (
                <button className="btn-link" onClick={() => setMonthIndex(null)}>
                  Back to latest
                </button>
              )}
            </nav>
          </div>
          <ScoreRing score={score.overall} label="Overall health score" />
        </section>

        <section className="tiles" aria-label="Key numbers">
          <MetricTile
            label="Visits per day"
            value={traffic ? num(perDay(traffic)) : "No data"}
            change={traffic ? delta(perDay(traffic), prevTraffic && perDay(prevTraffic)) : { text: "", tone: "neutral" }}
          />
          <MetricTile
            label="Uptime"
            value={uptime ? `${uptime.uptime_pct}%` : "No data"}
            change={uptime ? delta(uptime.uptime_pct, prevUptime?.uptime_pct, " pts") : { text: "", tone: "neutral" }}
          />
          <MetricTile
            label="Response time"
            value={`${num(score.response_ms)} ms`}
            change={delta(score.response_ms, prevScore?.response_ms, " ms", false)}
          />
          <MetricTile
            label="Open issues"
            value={num(score.issues_count)}
            change={delta(score.issues_count, prevScore?.issues_count, "", false)}
          />
        </section>

        <div className="grid-2">
          <section className="card" aria-labelledby="cat-title">
            <h2 id="cat-title">Score by category</h2>
            <CategoryBars
              items={[
                { label: "Search (SEO)", value: score.seo },
                { label: "Performance", value: score.performance },
                { label: "Accessibility", value: score.accessibility },
                { label: "Best practices", value: score.best_practices },
                { label: "Security", value: score.security },
              ]}
            />
            <p className="card-note bars-note">
              The overall score combines these five categories. Each comes from automated checks run at the start of
              the month; the action plan below lists what would raise them most.
            </p>
          </section>
          <section className="card" aria-labelledby="trend-title">
            <h2 id="trend-title">Trends</h2>
            <TrendChart title="Overall health score" points={view.scoreTrend} domain={[0, 100]} />
            <TrendChart title="Average visits per day" points={view.trafficTrend} />
          </section>
        </div>

        <section className="card" aria-labelledby="plan-title">
          <div className="card-head">
            <h2 id="plan-title">Action plan</h2>
            <p className="card-note">From the latest audit, in plain English. Fixes first, then opportunities.</p>
          </div>
          <ActionPlan items={view.plan} />
        </section>

        <div className="grid-2">
          <section className="card" aria-labelledby="kw-title">
            <h2 id="kw-title">Search positions</h2>
            <KeywordTable latest={view.ranks} previous={view.prevRanks} />
          </section>
          <section className="card" aria-labelledby="work-title">
            <h2 id="work-title">Work done this month</h2>
            <WorkLog items={view.work} />
          </section>
        </div>
      </main>

      <footer className="footer">
        <p>
          Demo build with invented data. "Lakeshore Coffee Roasters" is not a real business. Scores are
          estimates from automated checks, not a certification.
        </p>
      </footer>
    </div>
  )
}
