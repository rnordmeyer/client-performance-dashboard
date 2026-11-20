import * as React from "react"
import { useEffect, useId, useMemo, useRef, useState, type ReactNode, type KeyboardEvent as RKeyboardEvent } from "react"
import { authGet } from "./ReportsShared.tsx"
import { rpcCall, type Features } from "./ReportsTiers.tsx"
export type SeoKey =
    | "search_terms"
    | "index_coverage"
    | "change_alerts"
    | "quick_wins"
    | "geo_readiness"
    | "citability"
    | "brand_mentions"
    | "crux_trend"
    | "backlinks"
    | "map_grid"
    | "seo_detail"
type Status = "ok" | "setup_pending" | "no_data" | "first_run" | "error"
export interface SeoModule {
    status: Status
    message: string | null
    data: any
    updated_at?: string | null
}
export interface SeoOverview {
    month: string | null
    modules: Record<string, SeoModule>
}
interface ScRow {
    month: string
    engine: "google" | "bing"
    period_start: string | null
    period_end: string | null
    clicks: number | null
    impressions: number | null
    ctr: number | null
    position: number | null
    prev_clicks: number | null
    prev_impressions: number | null
    prev_ctr: number | null
    prev_position: number | null
    top_queries: any[]
    top_pages: any[]
    warnings: any[]
}
interface IcRow {
    month: string
    sitemap_pages: number | null
    indexed: number | null
    not_indexed: number | null
    pages: any[]
    sitemaps: any[]
    note: string | null
}
interface AlertRow {
    run_date: string
    previous_date: string | null
    path: string
    rule: string
    sev: "high" | "med" | "info" | "good"
    message: string
}
interface CruxRow {
    form_factor: "PHONE" | "DESKTOP" | "ALL"
    metric: "LCP" | "INP" | "CLS" | "FCP" | "TTFB"
    period_end: string
    p75: number | null
}
interface CitRow {
    month: string
    path: string
    present: number
    total: number
    signals: Record<string, any>
}
interface FixRow {
    path: string
    fixed_on: string
    note: string
}
interface OppRow {
    month: string
    kind: "quick_win" | "low_ctr"
    item: string
    page: string | null
    position: number | null
    impressions: number | null
    clicks: number | null
    ctr: number | null
    expected_ctr: number | null
}
interface SeoDetail {
    sc: ScRow[] | null
    ic: IcRow[] | null
    alerts: AlertRow[] | null
    opps: OppRow[] | null
    cit: CitRow[] | null
    fixes: FixRow[] | null
    crux: CruxRow[] | null
}
interface SecSpec {
    key: SeoKey
    modules: string[]
    title: string
    id: string
}
const SECTIONS: SecSpec[] = [
    { key: "search_terms", modules: ["search_console"], title: "Google Search", id: "gsc" },
    { key: "index_coverage", modules: ["index_coverage"], title: "Pages on Google", id: "idx" },
    { key: "change_alerts", modules: ["change_alerts"], title: "Change alerts", id: "chg" },
    { key: "geo_readiness", modules: ["geo"], title: "AI search readiness", id: "geo" },
    { key: "citability", modules: ["citability"], title: "How quotable each page is", id: "cit" },
    { key: "brand_mentions", modules: ["brand"], title: "Mentions of your business", id: "brand" },
    { key: "quick_wins", modules: ["quick_wins"], title: "Quick wins", id: "qw" },
    { key: "crux_trend", modules: ["crux"], title: "Real-visitor speed trend", id: "crux" },
    { key: "backlinks", modules: ["backlinks"], title: "Links from other sites", id: "links" },
    { key: "map_grid", modules: ["map_grid"], title: "Local map ranking", id: "map" },
    { key: "seo_detail", modules: ["schema", "local", "technical"], title: "Site details", id: "detail" },
]
export const SEO_KEYS: SeoKey[] = SECTIONS.map((s) => s.key)
export function seoAny(f: Features): boolean {
    return SECTIONS.some((s) => !!(f as any)[s.key])
}
const NOT_YET = "Not available yet. This appears after the next monthly report."
const READ_FAIL = "This part could not be loaded just now. Refresh the page to try again."
const STATUS_TEXT: Record<Status, string> = {
    ok: "",
    setup_pending: "Not available yet. The Google setup for this site is not finished.",
    no_data: "There is not enough data for this site yet.",
    first_run: "Change alerts start next month, once there is a first check to compare with.",
    error: "This could not be checked this month. It will be checked again next month.",
}
function num(v: any): number | null {
    if (v === null || v === undefined || v === "") return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}
function fmtInt(v: any): string {
    const n = num(v)
    return n === null ? "No data" : Math.round(n).toLocaleString("en-US")
}
function fmtPos(v: any): string {
    const n = num(v)
    return n === null ? "No data" : n.toFixed(1)
}
function fmtRate(v: any): string {
    const n = num(v)
    return n === null ? "No data" : (n * 100).toFixed(1) + "%"
}
function parseDay(s: string | null | undefined): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "")
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(NaN)
}
function dayShort(s: string | null | undefined): string {
    const d = parseDay(s)
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function monthKey(d: Date) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-01"
}
function addMonths(key: string, n: number) {
    const d = parseDay(key)
    return monthKey(new Date(d.getFullYear(), d.getMonth() + n, 1))
}
function monthShort(key: string) {
    return parseDay(key).toLocaleDateString("en-US", { month: "short", year: "numeric" })
}
function monthLong(key: string) {
    return parseDay(key).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}
function plural(n: number, one: string, many: string) {
    return n === 1 ? one : many
}
function truthy(v: any): boolean {
    return v === true || v === "true" || (!!v && typeof v === "object" && (v.present === true || v.ok === true))
}
function emptyText(mod: SeoModule | undefined): string | null {
    if (!mod) return NOT_YET
    if (mod.status !== "ok") return mod.message || STATUS_TEXT[mod.status] || NOT_YET
    return null
}
type Tone = "good" | "bad" | "flat" | "none"
interface Change {
    tone: Tone
    text: string
}
const WINDOW = "the 28 days before"
function change(cur: number | null, prev: number | null, kind: "count" | "position" | "points"): Change {
    if (cur === null || prev === null) return { tone: "none", text: "No earlier figures to compare" }
    if (kind === "position") {
        const d = prev - cur
        if (Math.abs(d) < 0.05) return { tone: "flat", text: "About the same as " + WINDOW }
        return {
            tone: d > 0 ? "good" : "bad",
            text:
                Math.abs(d).toFixed(1) + " " + plural(Math.abs(d), "place", "places") + (d > 0 ? " higher" : " lower") + " than " + WINDOW,
        }
    }
    if (kind === "points") {
        const d = cur - prev
        if (Math.abs(d) < 0.05) return { tone: "flat", text: "About the same as " + WINDOW }
        return {
            tone: d > 0 ? "good" : "bad",
            text: (d > 0 ? "Up " : "Down ") + Math.abs(d).toFixed(1) + " " + plural(Math.abs(d), "point", "points") + " from " + WINDOW,
        }
    }
    const d = Math.round(cur - prev)
    if (d === 0) return { tone: "flat", text: "Same as " + WINDOW }
    return { tone: d > 0 ? "good" : "bad", text: (d > 0 ? "Up " : "Down ") + Math.abs(d).toLocaleString("en-US") + " from " + WINDOW }
}
function Glyph({ name }: { name: "up" | "down" | "flat" | "yes" | "no" | "alert" | "info" | "spark" }) {
    const p: Record<string, ReactNode> = {
        up: <path d="M12 19V5m0 0-6 6m6-6 6 6" />,
        down: <path d="M12 5v14m0 0-6-6m6 6 6-6" />,
        flat: <path d="M5 12h14" />,
        yes: <path d="m5 12.5 4.5 4.5L19 7.5" />,
        no: <path d="M6.5 6.5l11 11m0-11-11 11" />,
        alert: (
            <>
                <path d="M12 3.5 21.5 20h-19z" />
                <path d="M12 10v4.5M12 17.5h.01" />
            </>
        ),
        info: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 11v5.5M12 7.5h.01" />
            </>
        ),
        spark: <path d="M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6" />,
    }
    return (
        <svg
            className="ncr-seo-glyph"
            width={16}
            height={16}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            {p[name]}
        </svg>
    )
}
function ChangeLine({ c }: { c: Change }) {
    const g =
        c.tone === "none" ? null : c.tone === "flat" ? "flat" : c.text.startsWith("Down") || c.text.includes(" lower ") ? "down" : "up"
    return (
        <span className={"ncr-seo-ch is-" + c.tone}>
            {g ? <Glyph name={g as any} /> : null}
            <span>{c.text}</span>
        </span>
    )
}
function Mark({ yes, yesText = "Yes", noText = "No" }: { yes: boolean; yesText?: string; noText?: string }) {
    return (
        <span className={"ncr-seo-mark " + (yes ? "is-yes" : "is-no")}>
            <Glyph name={yes ? "yes" : "no"} />
            <span>{yes ? yesText : noText}</span>
        </span>
    )
}
function Empty({ text }: { text: string }) {
    return <p className="ncr-seo-empty">{text}</p>
}
function TableBox({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="ncr-table-wrap" role="region" aria-label={label} tabIndex={0}>
            {children}
        </div>
    )
}
interface Pt {
    key: string
    label: string
    value: number
}
function LineChart({ points, label, invert = false }: { points: Pt[]; label: string; invert?: boolean }) {
    const W = 600
    const H = 140
    const P = 10
    const vals = points.map((p) => p.value)
    let lo = Math.min(...vals)
    let hi = Math.max(...vals)
    if (lo === hi) {
        lo -= 1
        hi += 1
    }
    const x = (i: number) => P + (i * (W - 2 * P)) / Math.max(1, points.length - 1)
    const y = (v: number) => {
        const t = (v - lo) / (hi - lo)
        return invert ? P + t * (H - 2 * P) : H - P - t * (H - 2 * P)
    }
    const d = points.map((p, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(p.value).toFixed(1)).join(" ")
    return (
        <figure className="ncr-seo-chart">
            <svg viewBox={"0 0 " + W + " " + H} preserveAspectRatio="none" role="img" aria-label={label}>
                {[0.25, 0.5, 0.75].map((t) => (
                    <line key={t} className="ncr-seo-gridline" x1={0} x2={W} y1={H * t} y2={H * t} />
                ))}
                <path className="ncr-seo-line" d={d} />
            </svg>
            <figcaption className="ncr-seo-axis" aria-hidden="true">
                <span>{points[0].label}</span>
                <span>{points[points.length - 1].label}</span>
            </figcaption>
        </figure>
    )
}
function Trend({
    title,
    points,
    fmt,
    sentence,
    colLabel,
    invert,
    emptyLine,
    heading = true,
}: {
    title: string
    points: Pt[]
    fmt: (n: number) => string
    sentence: string
    colLabel: string
    invert?: boolean
    emptyLine: string
    heading?: boolean
}) {
    return (
        <div className="ncr-seo-trend">
            {heading ? <h3 className="ncr-h3">{title}</h3> : null}
            {points.length < 2 ? (
                <p className="ncr-small ncr-muted">{emptyLine}</p>
            ) : (
                <>
                    <p className="ncr-small">{sentence}</p>
                    <LineChart points={points} label={title + ". " + sentence} invert={invert} />
                    <details className="ncr-details">
                        <summary>Show as a table</summary>
                        <TableBox label={title}>
                            <table className="ncr-table">
                                <thead>
                                    <tr>
                                        <th scope="col">When</th>
                                        <th scope="col">{colLabel}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {points
                                        .slice()
                                        .reverse()
                                        .map((p) => (
                                            <tr key={p.key}>
                                                <th scope="row">{p.label}</th>
                                                <td>{fmt(p.value)}</td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </TableBox>
                    </details>
                </>
            )}
        </div>
    )
}
function movedWords(first: number, last: number, lowerIsBetter: boolean, fmt: (n: number) => string, what: string, span: string): string {
    if (first === last) return what + " held at " + fmt(last) + " " + span + "."
    const better = lowerIsBetter ? last < first : last > first
    return what + " went from " + fmt(first) + " to " + fmt(last) + " " + span + (better ? ", an improvement." : ".")
}
function GoogleSearch({ mod, rows, month }: { mod?: SeoModule; rows: ScRow[] | null; month: string }) {
    const e = emptyText(mod)
    if (e) return <Empty text={e} />
    if (rows === null) return <Empty text={READ_FAIL} />
    const g = rows.find((r) => r.month === month && r.engine === "google")
    const b = rows.find((r) => r.month === month && r.engine === "bing")
    if (!g) return <Empty text={(mod && mod.message) || "No Google Search figures were recorded for " + monthLong(month) + "."} />
    const ctr = num(g.ctr)
    const pctr = num(g.prev_ctr)
    const tiles = [
        { label: "Clicks from Google", value: fmtInt(g.clicks), ch: change(num(g.clicks), num(g.prev_clicks), "count") },
        { label: "Times shown in Google", value: fmtInt(g.impressions), ch: change(num(g.impressions), num(g.prev_impressions), "count") },
        { label: "Average position", value: fmtPos(g.position), ch: change(num(g.position), num(g.prev_position), "position") },
        {
            label: "Click rate",
            value: fmtRate(ctr),
            ch: change(ctr === null ? null : ctr * 100, pctr === null ? null : pctr * 100, "points"),
        },
    ]
    const warnings = (g.warnings || [])
        .map((w: any) => (typeof w === "string" ? w : w && (w.message || w.text)))
        .filter(Boolean) as string[]
    const queries = (g.top_queries || []).slice(0, 10)
    const pages = (g.top_pages || []).slice(0, 10)
    const series = rows
        .filter((r) => r.engine === "google" && r.month <= month && num(r.clicks) !== null)
        .sort((a, b2) => (a.month < b2.month ? -1 : 1))
        .slice(-12)
        .map((r) => ({ key: r.month, label: monthShort(r.month), value: num(r.clicks) as number }))
    return (
        <>
            {g.period_start && g.period_end ? (
                <p className="ncr-small ncr-muted">
                    Google’s figures for {dayShort(g.period_start)} to {dayShort(g.period_end)}, compared with {WINDOW}.
                </p>
            ) : null}
            <ul className="ncr-seo-tiles" role="list">
                {tiles.map((t) => (
                    <li key={t.label} className="ncr-seo-tile">
                        <span className="ncr-kpi-label">{t.label}</span>
                        <span className="ncr-figure">{t.value}</span>
                        <ChangeLine c={t.ch} />
                    </li>
                ))}
            </ul>
            {warnings.length ? (
                <ul className="ncr-seo-notes" role="list">
                    {warnings.map((w) => (
                        <li key={w}>
                            <Glyph name="info" />
                            <span>{w}</span>
                        </li>
                    ))}
                </ul>
            ) : null}
            {b ? (
                <p className="ncr-small">
                    Bing: {fmtInt(b.clicks)} {plural(num(b.clicks) || 0, "click", "clicks")} and {fmtInt(b.impressions)}{" "}
                    {plural(num(b.impressions) || 0, "time", "times")} shown in the same period.
                </p>
            ) : null}
            <div className="ncr-seo-two">
                <div className="ncr-seo-col">
                    <h3 className="ncr-h3">Top searches</h3>
                    {queries.length ? (
                        <TableBox label="Top searches">
                            <table className="ncr-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Search</th>
                                        <th scope="col">Clicks</th>
                                        <th scope="col">Shown</th>
                                        <th scope="col">Position</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {queries.map((q: any, i: number) => (
                                        <tr key={String(q.query) + i}>
                                            <th scope="row" className="ncr-seo-cellwrap">
                                                {String(q.query || "")}
                                            </th>
                                            <td>{fmtInt(q.clicks)}</td>
                                            <td>{fmtInt(q.impressions)}</td>
                                            <td>{fmtPos(q.position)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </TableBox>
                    ) : (
                        <p className="ncr-small ncr-muted">No searches were recorded in this period.</p>
                    )}
                </div>
                <div className="ncr-seo-col">
                    <h3 className="ncr-h3">Top pages</h3>
                    {pages.length ? (
                        <TableBox label="Top pages from Google">
                            <table className="ncr-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Page</th>
                                        <th scope="col">Clicks</th>
                                        <th scope="col">Shown</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pages.map((q: any, i: number) => (
                                        <tr key={String(q.page) + i}>
                                            <th scope="row" className="ncr-seo-cellwrap ncr-seo-path">
                                                {String(q.page || "")}
                                            </th>
                                            <td>{fmtInt(q.clicks)}</td>
                                            <td>{fmtInt(q.impressions)}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </TableBox>
                    ) : (
                        <p className="ncr-small ncr-muted">No pages were recorded in this period.</p>
                    )}
                </div>
            </div>
            <Trend
                title="Clicks from Google by month"
                points={series}
                fmt={(n) => Math.round(n).toLocaleString("en-US")}
                colLabel="Clicks"
                sentence={
                    series.length >= 2
                        ? movedWords(
                              series[0].value,
                              series[series.length - 1].value,
                              false,
                              (n) => Math.round(n).toLocaleString("en-US") + " clicks",
                              "Clicks",
                              "from " + series[0].label + " to " + series[series.length - 1].label,
                          )
                        : ""
                }
                emptyLine="The monthly line starts once two months are recorded."
            />
        </>
    )
}
function PagesOnGoogle({ mod, rows, month }: { mod?: SeoModule; rows: IcRow[] | null; month: string }) {
    const e = emptyText(mod)
    if (e) return <Empty text={e} />
    if (rows === null) return <Empty text={READ_FAIL} />
    const r = rows.find((x) => x.month === month)
    if (!r) return <Empty text={(mod && mod.message) || "No page check was recorded for " + monthLong(month) + "."} />
    const indexed = num(r.indexed)
    const total = num(r.sitemap_pages)
    const pages = (r.pages || [])
        .slice()
        .sort((a: any, b: any) => Number(truthy(a.indexed)) - Number(truthy(b.indexed)) || String(a.path).localeCompare(String(b.path)))
    const series = rows
        .filter((x) => x.month <= month && num(x.indexed) !== null)
        .sort((a, b) => (a.month < b.month ? -1 : 1))
        .slice(-12)
        .map((x) => ({ key: x.month, label: monthShort(x.month), value: num(x.indexed) as number }))
    return (
        <>
            <p className="ncr-seo-headline">
                {indexed !== null && total !== null ? (
                    <>
                        <strong>{fmtInt(indexed)}</strong> of <strong>{fmtInt(total)}</strong> {plural(total, "page is", "pages are")} on
                        Google
                    </>
                ) : (
                    "Google’s count of your pages is not complete yet"
                )}
            </p>
            {pages.length ? (
                <TableBox label="Each page and whether it is on Google">
                    <table className="ncr-table">
                        <thead>
                            <tr>
                                <th scope="col">Page</th>
                                <th scope="col">On Google</th>
                                <th scope="col">Why</th>
                            </tr>
                        </thead>
                        <tbody>
                            {pages.map((p: any) => (
                                <tr key={String(p.path)}>
                                    <th scope="row" className="ncr-seo-cellwrap ncr-seo-path">
                                        {String(p.path || "")}
                                    </th>
                                    <td>
                                        <Mark yes={truthy(p.indexed)} />
                                    </td>
                                    <td className="ncr-seo-cellwrap">
                                        {p.reason
                                            ? String(p.reason)
                                            : truthy(p.indexed)
                                              ? "Shown in Google results"
                                              : "No reason given yet"}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableBox>
            ) : null}
            {r.note ? <p className="ncr-small ncr-muted">{r.note}</p> : null}
            {(r.sitemaps || []).length ? (
                <ul className="ncr-seo-fine" role="list">
                    {(r.sitemaps || []).map((s: any) => {
                        const errs = num(s.errors) || 0
                        return (
                            <li key={String(s.path)}>
                                Sitemap {String(s.path)}
                                {s.last_downloaded ? ", last read by Google on " + dayShort(s.last_downloaded) : ""}
                                {errs ? ", with " + errs + " " + plural(errs, "error", "errors") : ", no errors"}.
                            </li>
                        )
                    })}
                </ul>
            ) : null}
            <Trend
                title="Pages on Google by month"
                points={series}
                fmt={(n) => Math.round(n).toLocaleString("en-US")}
                colLabel="Pages on Google"
                sentence={
                    series.length >= 2
                        ? movedWords(
                              series[0].value,
                              series[series.length - 1].value,
                              false,
                              (n) => Math.round(n) + " " + plural(n, "page", "pages"),
                              "Pages on Google",
                              "from " + series[0].label + " to " + series[series.length - 1].label,
                          )
                        : ""
                }
                emptyLine="The monthly line starts once two months are recorded."
            />
        </>
    )
}
const SEV: {
    sev: AlertRow["sev"]
    label: string
    glyph: "alert" | "info" | "spark" | "yes"
}[] = [
    { sev: "high", label: "Needs a look", glyph: "alert" },
    { sev: "med", label: "Worth checking", glyph: "info" },
    { sev: "info", label: "Changed", glyph: "spark" },
    { sev: "good", label: "Improved", glyph: "yes" },
]
function ChangeAlerts({ mod, rows }: { mod?: SeoModule; rows: AlertRow[] | null }) {
    const e = emptyText(mod)
    if (e) return <Empty text={e} />
    if (rows === null) return <Empty text={READ_FAIL} />
    if (!rows.length) return <Empty text={(mod && mod.message) || "Nothing changed on the pages we track this month."} />
    const latest = rows.reduce((m, r) => (r.run_date > m ? r.run_date : m), rows[0].run_date)
    const list = rows.filter((r) => r.run_date === latest)
    const prev = list.find((r) => r.previous_date)?.previous_date || null
    return (
        <>
            <p className="ncr-small ncr-muted">
                {prev ? "Since your last check on " + dayShort(prev) : "From the check on " + dayShort(latest)}. {list.length}{" "}
                {plural(list.length, "change", "changes")} found.
            </p>
            {SEV.map((s) => {
                const items = list.filter((r) => r.sev === s.sev)
                if (!items.length) return null
                return (
                    <div key={s.sev} className={"ncr-seo-sevgroup is-" + s.sev}>
                        <h3 className="ncr-h3 ncr-seo-sev">
                            <Glyph name={s.glyph} />
                            <span>
                                {s.label} ({items.length})
                            </span>
                        </h3>
                        <ul className="ncr-seo-rows" role="list">
                            {items.map((r) => (
                                <li key={r.path + r.rule}>
                                    <span className="ncr-seo-path">{r.path}</span>
                                    <span className="ncr-small">{r.message}</span>
                                </li>
                            ))}
                        </ul>
                    </div>
                )
            })}
        </>
    )
}
const BOT_TEXT: Record<string, string> = {
    googlebot: "Google Search, which also feeds Google’s AI answers",
    bingbot: "Bing search, which also feeds Copilot answers",
}
const JOB_TEXT: Record<string, string> = {
    search: "Finds pages for AI search answers",
    user: "Opens a page when someone asks about it",
    training: "Collects pages to train AI models",
}
function AiReadiness({ mod }: { mod?: SeoModule }) {
    const e = emptyText(mod)
    if (e) return <Empty text={e} />
    const d = (mod && mod.data) || {}
    const crawlers: any[] = Array.isArray(d.crawlers) ? d.crawlers.slice() : []
    crawlers.sort((a, b) => Number(a.job === "training") - Number(b.job === "training") || String(a.bot).localeCompare(String(b.bot)))
    const searchBlocked = num(d.search_blocked) ?? crawlers.filter((c) => c.job !== "training" && !truthy(c.allowed)).length
    const trainingBlocked = num(d.training_blocked) ?? crawlers.filter((c) => c.job === "training" && !truthy(c.allowed)).length
    const js: string[] = Array.isArray(d.pages_needing_javascript)
        ? d.pages_needing_javascript.map((x: any) => String(typeof x === "string" ? x : x.path || "")).filter(Boolean)
        : []
    const llms = d.llms_txt
    const llmsPresent = llms === undefined || llms === null ? null : typeof llms === "object" ? truthy(llms) : !!llms
    if (!crawlers.length && !js.length) return <Empty text={(mod && mod.message) || STATUS_TEXT.no_data} />
    return (
        <>
            <p className="ncr-seo-headline">
                {searchBlocked === 0 ? (
                    "Every AI search assistant we check can read your site."
                ) : (
                    <>
                        <strong>{searchBlocked}</strong> AI search {plural(searchBlocked, "assistant cannot", "assistants cannot")} read
                        your site, which can keep you out of their answers.
                    </>
                )}
            </p>
            {crawlers.length ? (
                <TableBox label="Search and AI crawlers">
                    <table className="ncr-table">
                        <thead>
                            <tr>
                                <th scope="col">Crawler</th>
                                <th scope="col">Company</th>
                                <th scope="col">What it does</th>
                                <th scope="col">Can read your site</th>
                            </tr>
                        </thead>
                        <tbody>
                            {crawlers.map((c) => (
                                <tr key={String(c.bot)}>
                                    <th scope="row">{String(c.bot)}</th>
                                    <td>{String(c.owner || "")}</td>
                                    <td className="ncr-seo-cellwrap">
                                        {BOT_TEXT[String(c.bot).toLowerCase()] || JOB_TEXT[String(c.job)] || String(c.job || "")}
                                    </td>
                                    <td>
                                        <Mark yes={truthy(c.allowed)} yesText="Allowed" noText="Blocked" />
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableBox>
            ) : null}
            <p className="ncr-small ncr-muted">
                Training crawlers are your choice; blocking them does not hide you from AI answers.
                {trainingBlocked ? " You block " + trainingBlocked + " today." : ""}
            </p>
            {js.length ? (
                <>
                    <h3 className="ncr-h3">Pages that need JavaScript to show their text</h3>
                    <p className="ncr-small">
                        Some AI assistants read a page without running JavaScript, so they may miss the text on these:
                    </p>
                    <ul className="ncr-seo-rows" role="list">
                        {js.map((p) => (
                            <li key={p}>
                                <span className="ncr-seo-path">{p}</span>
                            </li>
                        ))}
                    </ul>
                </>
            ) : null}
            {llmsPresent !== null ? (
                <p className="ncr-seo-fine">
                    Footnote: your site {llmsPresent ? "has" : "does not have"} an llms.txt file. It is optional, and AI assistants do not
                    rely on it.
                </p>
            ) : null}
        </>
    )
}
const SIGNALS: {
    key: string
    label: string
}[] = [
    { key: "answer_first", label: "Opens with a direct answer" },
    { key: "question_headings", label: "Headings phrased as questions" },
    { key: "lists_or_tables", label: "Lists or tables" },
    { key: "quotable_passages", label: "Quotable passages" },
    { key: "fresh_date", label: "Shows a recent date" },
]
function Quotable({ mod, rows, fixes }: { mod?: SeoModule; rows: CitRow[] | null; fixes: FixRow[] | null }) {
    const e = emptyText(mod)
    if (e) return <Empty text={e} />
    if (rows === null) return <Empty text={READ_FAIL} />
    if (!rows.length) return <Empty text={(mod && mod.message) || STATUS_TEXT.no_data} />
    const list = rows
        .slice()
        .sort((a, b) => a.present / Math.max(1, a.total) - b.present / Math.max(1, b.total) || a.path.localeCompare(b.path))
    return (
        <>
            <p className="ncr-small ncr-muted">
                AI assistants quote pages that answer clearly. Each page is checked for five signals; the pages with the fewest come first.
            </p>
            <ul className="ncr-seo-cit" role="list">
                {list.map((r) => {
                    const fx = (fixes || []).filter((f) => f.path === r.path).sort((a, b) => (a.fixed_on < b.fixed_on ? 1 : -1))
                    return (
                        <li key={r.path} className="ncr-seo-cit-page">
                            <h3 className="ncr-h3 ncr-seo-cit-h">
                                <span className="ncr-seo-path">{r.path}</span>
                                <span className="ncr-seo-count">
                                    {r.present} of {r.total} signals
                                </span>
                            </h3>
                            <ul className="ncr-seo-checks" role="list">
                                {SIGNALS.map((s) => (
                                    <li key={s.key}>
                                        <Mark
                                            yes={truthy(r.signals ? r.signals[s.key] : false)}
                                            yesText={s.label}
                                            noText={s.label + ": not yet"}
                                        />
                                    </li>
                                ))}
                            </ul>
                            {fx.length ? (
                                <div className="ncr-seo-fixes">
                                    <p className="ncr-kpi-label">What we changed</p>
                                    <ul className="ncr-seo-rows" role="list">
                                        {fx.map((f, i) => (
                                            <li key={f.fixed_on + i}>
                                                <span className="ncr-small ncr-muted">{dayShort(f.fixed_on)}</span>
                                                <span className="ncr-small">{f.note}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            ) : null}
                        </li>
                    )
                })}
            </ul>
        </>
    )
}
const SOURCE_NAME: Record<string, string> = {
    wikipedia: "Wikipedia",
    wikidata: "Wikidata",
    reddit: "Reddit",
    youtube: "YouTube",
    linkedin: "LinkedIn",
}
const SOURCE_STATUS: Record<
    string,
    {
        text: string
        yes: boolean | null
    }
> = {
    found: { text: "Found", yes: true },
    mentioned: { text: "Mentioned", yes: true },
    not_found: { text: "Not found", yes: false },
    not_checked: { text: "Not checked this month", yes: null },
}
function Mentions({ mod }: { mod?: SeoModule }) {
    const e = emptyText(mod)
    if (e) return <Empty text={e} />
    const raw = mod && mod.data ? mod.data.sources : null
    const sources: any[] = Array.isArray(raw)
        ? raw
        : raw && typeof raw === "object"
          ? Object.keys(raw).map((k) => ({ source: k, ...(raw[k] || {}) }))
          : []
    if (!sources.length) return <Empty text={(mod && mod.message) || STATUS_TEXT.no_data} />
    return (
        <>
            <p className="ncr-small ncr-muted">
                AI assistants lean on well-known sources when they describe a business. This is where yours shows up.
            </p>
            <TableBox label="Where your business is mentioned">
                <table className="ncr-table">
                    <thead>
                        <tr>
                            <th scope="col">Source</th>
                            <th scope="col">Status</th>
                            <th scope="col">Detail</th>
                        </tr>
                    </thead>
                    <tbody>
                        {sources.map((s) => {
                            const key = String(s.source || s.name || "")
                            const st = SOURCE_STATUS[String(s.status)] || { text: String(s.status || ""), yes: null }
                            return (
                                <tr key={key}>
                                    <th scope="row">{SOURCE_NAME[key] || key}</th>
                                    <td>
                                        {st.yes === null ? (
                                            <span className="ncr-seo-mark is-skip">{st.text}</span>
                                        ) : (
                                            <Mark yes={st.yes} yesText={st.text} noText={st.text} />
                                        )}
                                    </td>
                                    <td className="ncr-seo-cellwrap">{s.detail ? String(s.detail) : ""}</td>
                                </tr>
                            )
                        })}
                    </tbody>
                </table>
            </TableBox>
        </>
    )
}
function QuickWins({ mod, rows }: { mod?: SeoModule; rows: OppRow[] | null }) {
    const e = emptyText(mod)
    if (e) return <Empty text={e} />
    if (rows === null) return <Empty text={READ_FAIL} />
    const wins = rows.filter((r) => r.kind === "quick_win").sort((a, b) => (num(a.position) ?? 99) - (num(b.position) ?? 99))
    const low = rows.filter((r) => r.kind === "low_ctr").sort((a, b) => (num(b.impressions) ?? 0) - (num(a.impressions) ?? 0))
    if (!wins.length && !low.length)
        return <Empty text={(mod && mod.message) || "No quick wins this month. Nothing is sitting just below page one."} />
    return (
        <>
            {wins.length ? (
                <div>
                    <h3 className="ncr-h3">Searches close to page one</h3>
                    <p className="ncr-small ncr-muted">
                        Google already shows your site for these, just below the first page. A small push can move them up.
                    </p>
                    <TableBox label="Searches close to page one">
                        <table className="ncr-table">
                            <thead>
                                <tr>
                                    <th scope="col">Search</th>
                                    <th scope="col">Position</th>
                                    <th scope="col">Times shown</th>
                                    <th scope="col">Page</th>
                                </tr>
                            </thead>
                            <tbody>
                                {wins.map((r) => (
                                    <tr key={r.item}>
                                        <th scope="row" className="ncr-seo-cellwrap">
                                            {r.item}
                                        </th>
                                        <td>{fmtPos(r.position)}</td>
                                        <td>{fmtInt(r.impressions)}</td>
                                        <td className="ncr-seo-path">{r.page || ""}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </TableBox>
                </div>
            ) : null}
            {low.length ? (
                <div>
                    <h3 className="ncr-h3">Pages people see but skip</h3>
                    <p className="ncr-small ncr-muted">
                        These pages show up often but get fewer clicks than is typical at their position. A clearer title and description
                        usually helps.
                    </p>
                    <TableBox label="Pages people see but skip">
                        <table className="ncr-table">
                            <thead>
                                <tr>
                                    <th scope="col">Page</th>
                                    <th scope="col">Click rate</th>
                                    <th scope="col">Typical at that position</th>
                                    <th scope="col">Times shown</th>
                                </tr>
                            </thead>
                            <tbody>
                                {low.map((r) => (
                                    <tr key={r.item}>
                                        <th scope="row" className="ncr-seo-path">
                                            {r.item}
                                        </th>
                                        <td>{fmtRate(r.ctr)}</td>
                                        <td>{fmtRate(r.expected_ctr)}</td>
                                        <td>{fmtInt(r.impressions)}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </TableBox>
                </div>
            ) : null}
        </>
    )
}
const METRICS: {
    key: CruxRow["metric"]
    label: string
    ms: boolean
    good: number
    poor: number
    optional?: boolean
}[] = [
    { key: "LCP", label: "Main content load", ms: true, good: 2500, poor: 4000 },
    { key: "INP", label: "Response to taps and clicks", ms: true, good: 200, poor: 500 },
    { key: "CLS", label: "Layout stability", ms: false, good: 0.1, poor: 0.25 },
    { key: "FCP", label: "First content on screen", ms: true, good: 1800, poor: 3000, optional: true },
    { key: "TTFB", label: "Server response", ms: true, good: 800, poor: 1800, optional: true },
]
const FORM_TEXT: Record<string, string> = { PHONE: "on phones", DESKTOP: "on computers", ALL: "on all devices" }
function fmtMetric(key: string, v: number): string {
    if (key === "CLS") return v.toFixed(2)
    if (key === "INP") return Math.round(v) + " ms"
    return v >= 1000 ? (v / 1000).toFixed(1) + " s" : Math.round(v) + " ms"
}
function SpeedTrend({ mod, rows }: { mod?: SeoModule; rows: CruxRow[] | null }) {
    const e = emptyText(mod)
    if (e) return <Empty text={e} />
    if (rows === null) return <Empty text={READ_FAIL} />
    const ok = rows.filter((r) => num(r.p75) !== null)
    if (!ok.length) return <Empty text={(mod && mod.message) || STATUS_TEXT.no_data} />
    const lastEnd = ok.reduce((m, r) => (r.period_end > m ? r.period_end : m), ok[0].period_end)
    const atLast = ok.filter((r) => r.period_end === lastEnd).map((r) => r.form_factor)
    const ff = (["PHONE", "ALL", "DESKTOP"] as const).find((f) => atLast.includes(f)) || ok[0].form_factor
    const th = (mod && mod.data && mod.data.metrics) || {}
    const blocks = METRICS.map((m) => {
        const series = ok.filter((r) => r.form_factor === ff && r.metric === m.key).sort((a, b) => (a.period_end < b.period_end ? -1 : 1))
        if (!series.length) return null
        const good = num(th[m.key] && th[m.key].good) ?? m.good
        const poor = num(th[m.key] && th[m.key].poor) ?? m.poor
        const last = series[series.length - 1]
        const v = num(last.p75) as number
        const rating = v <= good ? "good" : v > poor ? "poor" : "needs work"
        const backDate = new Date(parseDay(last.period_end).getTime() - 28 * 86400000)
        const back = series.filter((r) => parseDay(r.period_end) <= backDate).pop() || series[0]
        const bv = num(back.p75) as number
        const rel = bv ? (v - bv) / bv : 0
        const dir =
            series.length < 2 || Math.abs(rel) < 0.05
                ? "holding steady"
                : rel < 0
                  ? "improving"
                  : m.key === "CLS"
                    ? "getting less stable"
                    : "getting slower"
        return { m, series, v, rating, dir, good, poor }
    }).filter(Boolean) as {
        m: (typeof METRICS)[number]
        series: CruxRow[]
        v: number
        rating: string
        dir: string
        good: number
        poor: number
    }[]
    const weeks = Math.max(...blocks.map((b) => b.series.length))
    return (
        <>
            <p className="ncr-small ncr-muted">
                Measured from real Chrome visitors {FORM_TEXT[ff] || ""}, one point a week, each covering the 28 days before it. {weeks}{" "}
                {plural(weeks, "week", "weeks")} recorded so far.
            </p>
            <ul className="ncr-seo-metrics" role="list">
                {blocks.map((b) => {
                    const sentence =
                        b.m.label +
                        (b.rating === "needs work" ? " needs work" : " is " + b.rating) +
                        " (" +
                        fmtMetric(b.m.key, b.v) +
                        ") and " +
                        b.dir +
                        "."
                    const pts = b.series.map((r) => ({
                        key: r.period_end,
                        label: "Week ending " + dayShort(r.period_end),
                        value: num(r.p75) as number,
                    }))
                    return (
                        <li key={b.m.key} className="ncr-seo-metric">
                            <h3 className="ncr-h3">{b.m.label}</h3>
                            <p className="ncr-seo-metric-v">
                                <span className="ncr-figure-sm">{fmtMetric(b.m.key, b.v)}</span>
                                <Mark yes={b.rating === "good"} yesText="Good" noText={b.rating === "poor" ? "Poor" : "Needs work"} />
                            </p>
                            <Trend
                                title={b.m.label + ", week by week"}
                                points={pts}
                                fmt={(n) => fmtMetric(b.m.key, n)}
                                colLabel={b.m.label}
                                sentence={
                                    sentence +
                                    " Good is " +
                                    fmtMetric(b.m.key, b.good) +
                                    " or less; poor is over " +
                                    fmtMetric(b.m.key, b.poor) +
                                    ". Lower is better."
                                }
                                heading={false}
                                emptyLine={sentence + " The weekly line starts once two weeks are recorded."}
                            />
                        </li>
                    )
                })}
            </ul>
        </>
    )
}
function pick(o: any, keys: string[]): number | null {
    if (!o || typeof o !== "object") return null
    for (const k of keys) {
        const n = num(o[k])
        if (n !== null) return n
    }
    return null
}
function Links({ mod }: { mod?: SeoModule }) {
    const e = emptyText(mod)
    if (e) return <Empty text={e} />
    const d = (mod && mod.data) || {}
    const items: {
        label: string
        value: string
        note: string
    }[] = []
    if (d.common_crawl) {
        const inCrawl = d.common_crawl.in_crawl ?? d.common_crawl.found ?? d.common_crawl.present
        const seen = pick(d.common_crawl, ["pages_seen", "pages", "count"])
        items.push({
            label: "In the open web crawl",
            value: truthy(inCrawl) || (seen || 0) > 0 ? "Yes" : "Not yet",
            note: seen !== null ? fmtInt(seen) + " " + plural(seen, "page", "pages") + " of your site seen" : "",
        })
    }
    if (d.moz) {
        const da = pick(d.moz, ["domain_authority", "da"])
        const ls = pick(d.moz, ["linking_sites", "linking_domains", "linking_root_domains"])
        if (da !== null)
            items.push({
                label: "Domain authority",
                value: String(Math.round(da)),
                note: "A Moz score from 1 to 100 that estimates how strong the links to your site are. It is not a Google score.",
            })
        if (ls !== null)
            items.push({ label: "Sites that link to you", value: fmtInt(ls), note: "Different websites with at least one link to yours." })
    }
    if (d.bing) {
        const pw = pick(d.bing, ["pages_with_links", "pages"])
        const tot = pick(d.bing, ["total", "total_links", "links"])
        if (pw !== null) items.push({ label: "Your pages with outside links", value: fmtInt(pw), note: "As counted by Bing." })
        if (tot !== null) items.push({ label: "Outside links in total", value: fmtInt(tot), note: "As counted by Bing." })
    }
    if (!items.length) return <Empty text={(mod && mod.message) || STATUS_TEXT.no_data} />
    return (
        <dl className="ncr-seo-dl">
            {items.map((i) => (
                <div key={i.label} className="ncr-seo-tile">
                    <dt className="ncr-kpi-label">{i.label}</dt>
                    <dd className="ncr-figure">{i.value}</dd>
                    {i.note ? <dd className="ncr-small ncr-muted">{i.note}</dd> : null}
                </div>
            ))}
        </dl>
    )
}
function MapGrid({ kw, k, gridAll }: { kw: string; k: any; gridAll?: any }) {
    const uid = useId()
    const cells: any[] = Array.isArray(k.cells) ? k.cells : Array.isArray(k.results) ? k.results : []
    const n = Math.max(1, Math.round(num(k.grid) ?? num(gridAll) ?? Math.sqrt(cells.length)))
    const [active, setActive] = useState(Math.floor((n * n) / 2))
    const [shown, setShown] = useState<number | null>(null)
    const refs = useRef<(HTMLButtonElement | null)[]>([])
    const found = num(k.found_in)
    const points = num(k.points) ?? n * n
    const avg = num(k.average_position)
    const summary =
        (found !== null ? "Found in " + found + " of " + points + " spots on the map" : "Checked at " + points + " spots on the map") +
        (avg !== null ? ", average position " + avg.toFixed(1) + "." : ".")
    const move = (e: RKeyboardEvent, i: number) => {
        const r = Math.floor(i / n)
        const c = i % n
        let t = i
        if (e.key === "ArrowRight") t = r * n + Math.min(n - 1, c + 1)
        else if (e.key === "ArrowLeft") t = r * n + Math.max(0, c - 1)
        else if (e.key === "ArrowDown") t = Math.min(n - 1, r + 1) * n + c
        else if (e.key === "ArrowUp") t = Math.max(0, r - 1) * n + c
        else if (e.key === "Home") t = r * n
        else if (e.key === "End") t = r * n + n - 1
        else return
        e.preventDefault()
        setActive(t)
        setShown(t)
        refs.current[t]?.focus()
    }
    const sel = shown !== null ? cells[shown] : null
    const top3: string[] =
        sel && Array.isArray(sel.top3) ? sel.top3.map((x: any) => String(typeof x === "string" ? x : x.name || "")).filter(Boolean) : []
    return (
        <div className="ncr-seo-map-kw">
            <h3 className="ncr-h3">“{kw}”</h3>
            <p className="ncr-small">{summary}</p>
            {cells.length === n * n ? (
                <>
                    <div
                        className="ncr-seo-map"
                        role="group"
                        aria-label={"Map grid for " + kw + ". " + summary + " Use the arrow keys to move between spots."}
                        style={{ gridTemplateColumns: "repeat(" + n + ", minmax(0, 1fr))" }}
                    >
                        {cells.map((c, i) => {
                            const pos = num(c && c.position)
                            const tone = pos === null ? "is-out" : pos <= 3 ? "is-top" : pos <= 10 ? "is-mid" : "is-low"
                            const r = Math.floor(i / n) + 1
                            const col = (i % n) + 1
                            return (
                                <button
                                    key={i}
                                    type="button"
                                    ref={(el) => {
                                        refs.current[i] = el
                                    }}
                                    className={"ncr-seo-cell " + tone + (shown === i ? " is-on" : "")}
                                    tabIndex={i === active ? 0 : -1}
                                    aria-pressed={shown === i}
                                    aria-describedby={uid + "-sel"}
                                    aria-label={
                                        "Row " +
                                        r +
                                        ", column " +
                                        col +
                                        ": " +
                                        (pos === null ? "not in the top results" : "position " + pos)
                                    }
                                    onFocus={() => {
                                        setActive(i)
                                        setShown(i)
                                    }}
                                    onClick={() => setShown(i)}
                                    onKeyDown={(e) => move(e, i)}
                                >
                                    <span aria-hidden="true">{pos === null ? "None" : pos}</span>
                                </button>
                            )
                        })}
                    </div>
                    <p id={uid + "-sel"} className="ncr-small ncr-seo-map-sel" aria-live="polite">
                        {shown === null
                            ? "Select a spot to see the top three businesses there. The center is your location; None means not in the top results."
                            : "Row " +
                              (Math.floor(shown / n) + 1) +
                              ", column " +
                              ((shown % n) + 1) +
                              ": " +
                              (top3.length ? "top three are " + top3.join(", ") + "." : "no top three recorded.")}
                    </p>
                </>
            ) : null}
        </div>
    )
}
function MapRanking({ mod }: { mod?: SeoModule }) {
    const e = emptyText(mod)
    if (e) return <Empty text={e} />
    const kws = mod && mod.data && mod.data.keywords && typeof mod.data.keywords === "object" ? mod.data.keywords : {}
    const names = Object.keys(kws)
    if (!names.length) return <Empty text={(mod && mod.message) || "The local map check has not been run for this site yet."} />
    return (
        <>
            <p className="ncr-small ncr-muted">
                Google Maps results change street by street. Each spot is a point around your location; the number is where you appear
                there.
            </p>
            <div className="ncr-seo-two">
                {names.map((kw) => (
                    <MapGrid key={kw} kw={kw} k={kws[kw] || {}} gridAll={mod && mod.data ? mod.data.grid : undefined} />
                ))}
            </div>
        </>
    )
}
function humanKey(k: string) {
    const s = k.replace(/_/g, " ")
    return s.charAt(0).toUpperCase() + s.slice(1)
}
function showVal(v: any): string {
    if (v === null || v === undefined) return ""
    if (typeof v === "boolean") return v ? "Yes" : "No"
    if (Array.isArray(v)) return v.map((x) => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ")
    if (typeof v === "object") return JSON.stringify(v)
    return String(v)
}
const DETAIL_TITLE: Record<string, string> = { schema: "Structured data", local: "Local listing", technical: "Technical" }
function SiteDetails({ mods }: { mods: Record<string, SeoModule> }) {
    return (
        <div className="ncr-seo-two">
            {["schema", "local", "technical"].map((m) => {
                const mod = mods[m]
                const e = emptyText(mod)
                const entries =
                    !e && mod && mod.data && typeof mod.data === "object"
                        ? Object.keys(mod.data).filter((k) => showVal(mod.data[k]) !== "")
                        : []
                return (
                    <div key={m} className="ncr-seo-col">
                        <h3 className="ncr-h3">{DETAIL_TITLE[m]}</h3>
                        {e ? (
                            <p className="ncr-small ncr-muted">{e}</p>
                        ) : entries.length ? (
                            <dl className="ncr-seo-kv">
                                {entries.map((k) => (
                                    <div key={k}>
                                        <dt>{humanKey(k)}</dt>
                                        <dd>{showVal(mod!.data[k])}</dd>
                                    </div>
                                ))}
                            </dl>
                        ) : (
                            <p className="ncr-small ncr-muted">{(mod && mod.message) || "Nothing recorded."}</p>
                        )}
                    </div>
                )
            })}
        </div>
    )
}
let seoMissLogged = false
function logSeoMiss(why: unknown) {
    if (seoMissLogged) return
    seoMissLogged = true
    console.info(
        "[Reports] seo_overview is not available, so the search sections stay hidden (run migrations_2026-11-08_seo_upgrade.sql).",
        why,
    )
}
function parseOverview(j: any): SeoOverview | null {
    const o = Array.isArray(j) ? j[0] : j
    if (!o || typeof o !== "object") return null
    const mods: Record<string, SeoModule> = {}
    const raw = o.modules && typeof o.modules === "object" ? o.modules : {}
    Object.keys(raw).forEach((k) => {
        const m = raw[k] || {}
        const st = ["ok", "setup_pending", "no_data", "first_run", "error"].includes(m.status) ? m.status : "error"
        mods[k] = {
            status: st,
            message: typeof m.message === "string" ? m.message : null,
            data: m.data && typeof m.data === "object" ? m.data : {},
            updated_at: m.updated_at || null,
        }
    })
    return { month: typeof o.month === "string" ? o.month : null, modules: mods }
}
async function loadLiveSeo(
    url: string,
    key: string,
    sid: string,
    month: string,
    on: Set<SeoKey>,
): Promise<{
    ov: SeoOverview
    d: SeoDetail
} | null> {
    let ov: SeoOverview | null = null
    try {
        ov = parseOverview(await rpcCall(url, key, "seo_overview", { sid, m: month }))
    } catch (e: any) {
        logSeoMiss(e && e.message ? e.message : e)
        return null
    }
    if (!ov) return null
    const s = encodeURIComponent(sid)
    const next = addMonths(month, 1)
    const has = (m: string) => !!ov!.modules[m] && ov!.modules[m].status === "ok"
    const opt = async <T,>(need: boolean, path: string): Promise<T[] | null> => {
        if (!need) return []
        try {
            const r = await authGet<T[]>(url, key, path)
            return Array.isArray(r) ? r : []
        } catch (e) {
            return null
        }
    }
    const [sc, ic, alerts, opps, cit, fixes, crux] = await Promise.all([
        opt<ScRow>(
            on.has("search_terms") && has("search_console"),
            "/rest/v1/search_console_monthly?site_id=eq." + s + "&order=month.asc&limit=120",
        ),
        opt<IcRow>(
            on.has("index_coverage") && has("index_coverage"),
            "/rest/v1/index_coverage_monthly?site_id=eq." + s + "&order=month.asc&limit=60",
        ),
        opt<AlertRow>(
            on.has("change_alerts") && has("change_alerts"),
            "/rest/v1/change_alerts?site_id=eq." + s + "&run_date=gte." + month + "&run_date=lt." + next + "&order=run_date.desc&limit=500",
        ),
        opt<OppRow>(
            on.has("quick_wins") && has("quick_wins"),
            "/rest/v1/seo_opportunities?site_id=eq." + s + "&month=eq." + month + "&limit=500",
        ),
        opt<CitRow>(
            on.has("citability") && has("citability"),
            "/rest/v1/page_citability?site_id=eq." + s + "&month=eq." + month + "&order=path.asc&limit=500",
        ),
        opt<FixRow>(
            on.has("citability") && has("citability"),
            "/rest/v1/citability_fixes?site_id=eq." + s + "&select=path,fixed_on,note&order=fixed_on.desc&limit=500",
        ),
        opt<CruxRow>(on.has("crux_trend") && has("crux"), "/rest/v1/crux_weekly?site_id=eq." + s + "&order=period_end.asc&limit=2000"),
    ])
    return { ov, d: { sc, ic, alerts, opps, cit, fixes, crux } }
}
export interface SeoProps {
    features: Features
    clientFeatures: Features | null
    month: string
    siteId: string
    demo: boolean
    url: string
    apiKey: string
    refreshKey: number
}
export function SeoSections(p: SeoProps) {
    const on = SECTIONS.filter((s) => !!(p.features as any)[s.key])
    const onKeys = on.map((s) => s.key).join(",")
    const k = [p.siteId, p.month, p.refreshKey, onKeys].join("|")
    const [st, setSt] = useState<{
        k: string
        site: string
        phase: "loading" | "ready" | "off"
        ov: SeoOverview | null
        d: SeoDetail | null
    } | null>(null)
    const demoData = useMemo(() => (p.demo && p.siteId && p.month ? demoSeo(p.siteId, p.month) : null), [p.demo, p.siteId, p.month])
    useEffect(() => {
        if (p.demo || !onKeys || !p.siteId || !p.month || !p.url || !p.apiKey) return
        let cancelled = false
        setSt((prev) =>
            prev && prev.site === p.siteId + p.month && prev.phase === "ready"
                ? prev
                : { k, site: p.siteId + p.month, phase: "loading", ov: null, d: null },
        )
        loadLiveSeo(p.url, p.apiKey, p.siteId, p.month, new Set(onKeys.split(",") as SeoKey[])).then((r) => {
            if (cancelled) return
            setSt(
                r
                    ? { k, site: p.siteId + p.month, phase: "ready", ov: r.ov, d: r.d }
                    : { k, site: p.siteId + p.month, phase: "off", ov: null, d: null },
            )
        })
        return () => {
            cancelled = true
        }
    }, [k, p.demo, p.url, p.apiKey])
    if (!on.length) return null
    const cur = p.demo
        ? demoData
            ? { phase: "ready" as const, ov: demoData.ov, d: demoData.d }
            : null
        : st && st.site === p.siteId + p.month
          ? st
          : null
    if (!cur || cur.phase !== "ready" || !cur.ov || !cur.d) return null
    const mods = cur.ov.modules
    const d = cur.d
    const staff = (key: SeoKey) =>
        p.clientFeatures && !(p.clientFeatures as any)[key] ? (
            <span className="ncr-tier-chip" title="Not in this client's plan">
                Not in plan<span className="ncr-sr">. Staff note: this client does not see this section.</span>
            </span>
        ) : null
    const anyRow = on.some((s) => s.modules.some((m) => !!mods[m]))
    if (!anyRow) {
        return (
            <div className="ncr-seo">
                <section className="ncr-card ncr-panel" aria-labelledby="ncr-seo-soon-h">
                    <h2 id="ncr-seo-soon-h" className="ncr-h2">
                        Google Search and AI search
                    </h2>
                    <Empty text={NOT_YET} />
                    <p className="ncr-small ncr-muted">Coming to this page: {on.map((s) => s.title).join(", ")}.</p>
                </section>
            </div>
        )
    }
    const body = (s: SecSpec): ReactNode => {
        const mod = mods[s.modules[0]]
        switch (s.key) {
            case "search_terms":
                return <GoogleSearch mod={mod} rows={d.sc} month={p.month} />
            case "index_coverage":
                return <PagesOnGoogle mod={mod} rows={d.ic} month={p.month} />
            case "change_alerts":
                return <ChangeAlerts mod={mod} rows={d.alerts} />
            case "geo_readiness":
                return <AiReadiness mod={mod} />
            case "citability":
                return <Quotable mod={mod} rows={d.cit} fixes={d.fixes} />
            case "brand_mentions":
                return <Mentions mod={mod} />
            case "quick_wins":
                return <QuickWins mod={mod} rows={d.opps} />
            case "crux_trend":
                return <SpeedTrend mod={mod} rows={d.crux} />
            case "backlinks":
                return <Links mod={mod} />
            case "map_grid":
                return <MapRanking mod={mod} />
            case "seo_detail":
                return <SiteDetails mods={mods} />
        }
        return null
    }
    return (
        <div className="ncr-seo">
            {on.map((s) => {
                const hid = "ncr-seo-" + s.id + "-h"
                return (
                    <section key={s.key} className="ncr-card ncr-panel ncr-seo-card" aria-labelledby={hid} data-seo={s.id}>
                        <h2 id={hid} className="ncr-h2">
                            {s.title}
                            {s.key === "seo_detail" ? <span className="ncr-tier-chip">Staff only</span> : staff(s.key)}
                        </h2>
                        {body(s)}
                    </section>
                )
            })}
        </div>
    )
}
function hash(s: string) {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return (h >>> 0) / 4294967295
}
function isoDay(d: Date) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0")
}
export function demoSeo(
    siteId: string,
    month: string,
): {
    ov: SeoOverview
    d: SeoDetail
} {
    const months: string[] = []
    for (let i = 11; i >= 0; i--) months.push(addMonths(month, -i))
    const j = (s: string, a = 0.9, b = 0.2) => a + hash(siteId + s) * b
    const QUERIES = [
        "harbor and pine bakery",
        "sourdough bread near me",
        "custom birthday cakes",
        "croissants near me",
        "wedding cake tasting",
        "bakery open sunday",
        "gluten free bread",
        "cinnamon rolls",
        "pastry trays for meetings",
        "fresh bagels",
    ]
    const PAGES = ["/", "/menu", "/cakes", "/catering", "/visit", "/about", "/blog/sourdough-starter-tips", "/contact"]
    const sc: ScRow[] = []
    months.forEach((m, i) => {
        const clicks = Math.round((180 + i * 14) * j(m + "c"))
        const imp = Math.round((5200 + i * 260) * j(m + "i"))
        const pclicks = Math.round(clicks * j(m + "pc", 0.82, 0.16))
        const pimp = Math.round(imp * j(m + "pi", 0.85, 0.14))
        const pos = +(14.2 - i * 0.35 + hash(m + "p") * 0.8).toFixed(1)
        const end = new Date(parseDay(m).getFullYear(), parseDay(m).getMonth(), 2)
        const start = new Date(end.getTime() - 27 * 86400000)
        sc.push({
            month: m,
            engine: "google",
            period_start: isoDay(start),
            period_end: isoDay(end),
            clicks,
            impressions: imp,
            ctr: clicks / imp,
            position: pos,
            prev_clicks: pclicks,
            prev_impressions: pimp,
            prev_ctr: pclicks / pimp,
            prev_position: +(pos + 0.4).toFixed(1),
            top_queries: QUERIES.map((q, qi) => {
                const c = Math.max(1, Math.round(clicks * (0.3 / (qi + 1)) * j(m + q)))
                const im = Math.round(c * (14 + qi * 6) * j(m + q + "i"))
                return { query: q, clicks: c, impressions: im, ctr: c / im, position: +(1.4 + qi * 1.3 + hash(m + q) * 2).toFixed(1) }
            }),
            top_pages: PAGES.slice(0, 7).map((pg, pi) => {
                const c = Math.max(1, Math.round(clicks * (0.42 / (pi + 1)) * j(m + pg)))
                return { page: pg, clicks: c, impressions: Math.round(c * (20 + pi * 5)), ctr: 0, position: +(3 + pi * 1.6).toFixed(1) }
            }),
            warnings: [],
        })
    })
    const last = sc[sc.length - 1]
    sc.push({
        ...last,
        engine: "bing",
        clicks: Math.round((last.clicks || 0) * 0.11),
        impressions: Math.round((last.impressions || 0) * 0.13),
        prev_clicks: null,
        prev_impressions: null,
        prev_ctr: null,
        prev_position: null,
        top_queries: [],
        top_pages: [],
    })
    const ALL_PAGES = [
        "/",
        "/menu",
        "/cakes",
        "/catering",
        "/visit",
        "/about",
        "/contact",
        "/blog",
        "/blog/sourdough-starter-tips",
        "/blog/how-we-proof-overnight",
        "/gift-cards",
        "/careers",
        "/privacy",
        "/accessibility",
    ]
    const ic: IcRow[] = months.map((m, i) => {
        const indexed = Math.min(ALL_PAGES.length, 8 + Math.floor(i / 2))
        return {
            month: m,
            sitemap_pages: ALL_PAGES.length,
            indexed,
            not_indexed: ALL_PAGES.length - indexed,
            pages: ALL_PAGES.map((pg, pi) => {
                const yes = pi < indexed
                return {
                    path: pg,
                    indexed: yes,
                    reason: yes
                        ? "Shown in Google results"
                        : pi % 2
                          ? "Google found this page but has not added it yet. New pages often take a few weeks."
                          : "Kept out of Google on purpose (legal pages are not meant to rank).",
                }
            }),
            sitemaps: [{ path: "/sitemap.xml", last_downloaded: isoDay(new Date(parseDay(m).getTime() + 86400000)), errors: 0 }],
            note: null,
        }
    })
    const run = isoDay(new Date(parseDay(month).getFullYear(), parseDay(month).getMonth(), 2))
    const prevRun = isoDay(new Date(parseDay(month).getFullYear(), parseDay(month).getMonth() - 1, 2))
    const alerts: AlertRow[] = [
        {
            run_date: run,
            previous_date: prevRun,
            path: "/catering",
            rule: "title_changed",
            sev: "med",
            message: "The page title changed. The new title no longer mentions catering, which can make the page harder to find.",
        },
        {
            run_date: run,
            previous_date: prevRun,
            path: "/menu",
            rule: "description_removed",
            sev: "med",
            message: "The short description Google shows under the page title was removed.",
        },
        { run_date: run, previous_date: prevRun, path: "/about", rule: "h1_changed", sev: "info", message: "The main heading changed." },
        {
            run_date: run,
            previous_date: prevRun,
            path: "/cakes",
            rule: "speed_improved",
            sev: "good",
            message: "This page now loads its main content in under two and a half seconds on phones.",
        },
    ]
    const opps: OppRow[] = [
        {
            month,
            kind: "quick_win",
            item: "wedding cake tasting",
            page: "/cakes",
            position: 9.4,
            impressions: 410,
            clicks: 6,
            ctr: 0.015,
            expected_ctr: null,
        },
        {
            month,
            kind: "quick_win",
            item: "pastry trays for meetings",
            page: "/catering",
            position: 11.8,
            impressions: 260,
            clicks: 2,
            ctr: 0.008,
            expected_ctr: null,
        },
        {
            month,
            kind: "quick_win",
            item: "bakery open sunday",
            page: "/visit",
            position: 13.1,
            impressions: 520,
            clicks: 4,
            ctr: 0.008,
            expected_ctr: null,
        },
        {
            month,
            kind: "low_ctr",
            item: "/menu",
            page: "/menu",
            position: 3.2,
            impressions: 1880,
            clicks: 41,
            ctr: 0.022,
            expected_ctr: 0.081,
        },
        {
            month,
            kind: "low_ctr",
            item: "/blog/sourdough-starter-tips",
            page: null,
            position: 5.6,
            impressions: 940,
            clicks: 12,
            ctr: 0.013,
            expected_ctr: 0.05,
        },
    ]
    const sig = (a: boolean, b: boolean, c: boolean, dd: boolean, e: boolean) => ({
        answer_first: a,
        question_headings: b,
        lists_or_tables: c,
        quotable_passages: dd,
        fresh_date: e,
    })
    const citRaw: [string, ReturnType<typeof sig>][] = [
        ["/", sig(true, false, true, true, false)],
        ["/menu", sig(false, false, true, false, false)],
        ["/cakes", sig(true, true, true, true, false)],
        ["/catering", sig(true, false, false, true, false)],
        ["/blog/sourdough-starter-tips", sig(true, true, true, true, true)],
    ]
    const cit: CitRow[] = citRaw.map(([path, s]) => ({
        month,
        path,
        signals: s,
        total: 5,
        present: Object.values(s).filter(Boolean).length,
    }))
    const fixes: FixRow[] = [
        {
            path: "/cakes",
            fixed_on: isoDay(new Date(parseDay(month).getFullYear(), parseDay(month).getMonth() - 1, 18)),
            note: "Added a short answer at the top: what a custom cake costs and how far ahead to order.",
        },
        {
            path: "/cakes",
            fixed_on: isoDay(new Date(parseDay(month).getFullYear(), parseDay(month).getMonth() - 2, 9)),
            note: "Turned the flavor list into a table people and AI assistants can read at a glance.",
        },
        {
            path: "/blog/sourdough-starter-tips",
            fixed_on: isoDay(new Date(parseDay(month).getFullYear(), parseDay(month).getMonth() - 1, 4)),
            note: "Rewrote the headings as the questions customers ask.",
        },
    ]
    const crux: CruxRow[] = []
    const endDay = parseDay(run)
    const span: Record<string, [number, number]> = {
        LCP: [3150, 2280],
        INP: [260, 170],
        CLS: [0.15, 0.06],
        FCP: [2100, 1500],
        TTFB: [900, 640],
    }
    for (let w = 25; w >= 0; w--) {
        const dte = isoDay(new Date(endDay.getTime() - w * 7 * 86400000))
        const t = (25 - w) / 25
        ;(Object.keys(span) as CruxRow["metric"][]).forEach((m) => {
            const [a, b] = span[m]
            const v = a + (b - a) * t + (hash(siteId + m + dte) - 0.5) * (a - b) * 0.12
            crux.push({ form_factor: "PHONE", metric: m, period_end: dte, p75: m === "CLS" ? +v.toFixed(3) : Math.round(v) })
        })
    }
    const RIVALS = ["Rolling Pin Co.", "Crumb and Kettle", "Northside Loaves", "Larkspur Pastry", "Two Ovens Bakehouse"]
    const ME = "Harbor & Pine Bakery"
    const gridFor = (kw: string, n: number) => {
        const cells: any[] = []
        const c = (n - 1) / 2
        let found = 0
        let sum = 0
        for (let r = 0; r < n; r++)
            for (let q = 0; q < n; q++) {
                const dist = Math.hypot(r - c, q - c)
                const raw = Math.round(1 + dist * 2.6 + hash(kw + r + "x" + q) * 3)
                const pos = raw > 14 ? null : raw
                if (pos !== null) {
                    found++
                    sum += pos
                }
                const others = RIVALS.slice().sort((a, b) => hash(kw + r + q + a) - hash(kw + r + q + b))
                const top3 = others.slice(0, 3)
                if (pos !== null && pos <= 3) top3.splice(pos - 1, 1, ME)
                cells.push({ position: pos, top3 })
            }
        return { grid: n, points: n * n, found_in: found, average_position: found ? +(sum / found).toFixed(1) : null, cells }
    }
    const ok = (data: any = {}): SeoModule => ({ status: "ok", message: null, data, updated_at: run })
    const modules: Record<string, SeoModule> = {
        search_console: ok(),
        index_coverage: ok(),
        change_alerts: ok(),
        quick_wins: ok(),
        citability: ok(),
        geo: ok({
            crawlers: [
                { bot: "Googlebot", owner: "Google", job: "search", allowed: true },
                { bot: "Bingbot", owner: "Microsoft", job: "search", allowed: true },
                { bot: "OAI-SearchBot", owner: "OpenAI", job: "search", allowed: true },
                { bot: "ChatGPT-User", owner: "OpenAI", job: "user", allowed: true },
                { bot: "PerplexityBot", owner: "Perplexity", job: "search", allowed: true },
                { bot: "Claude-SearchBot", owner: "Anthropic", job: "search", allowed: true },
                { bot: "GPTBot", owner: "OpenAI", job: "training", allowed: false },
                { bot: "ClaudeBot", owner: "Anthropic", job: "training", allowed: true },
                { bot: "Google-Extended", owner: "Google", job: "training", allowed: true },
                { bot: "CCBot", owner: "Common Crawl", job: "training", allowed: true },
            ],
            search_blocked: 0,
            training_blocked: 1,
            pages_needing_javascript: [],
            llms_txt: { present: true },
        }),
        brand: ok({
            sources: [
                { source: "wikipedia", status: "not_found", detail: "No article. That is normal for a local business." },
                { source: "wikidata", status: "not_found", detail: "No entry yet. One can be added with the address and hours." },
                { source: "reddit", status: "mentioned", detail: "Named in two local threads asking where to buy sourdough." },
                { source: "youtube", status: "not_checked", detail: "" },
                { source: "linkedin", status: "found", detail: "Company page found, with the website linked." },
            ],
        }),
        crux: ok({ metrics: { LCP: { good: 2500, poor: 4000 }, INP: { good: 200, poor: 500 }, CLS: { good: 0.1, poor: 0.25 } } }),
        backlinks: ok({
            common_crawl: { in_crawl: true, pages_seen: 11 },
            moz: { domain_authority: 14, linking_sites: 23 },
            bing: { pages_with_links: 6, total: 41 },
        }),
        map_grid: ok({ keywords: { "bakery near me": gridFor("bakery near me", 5), "custom cakes": gridFor("custom cakes", 5) } }),
        schema: ok({ types_found: ["Bakery", "LocalBusiness", "WebSite"], errors: 0 }),
        local: ok({ name_address_phone_match: true, hours_listed: true }),
        technical: ok({ https: true, sitemap: "/sitemap.xml", robots_txt: true }),
    }
    return { ov: { month, modules }, d: { sc, ic, alerts, opps, cit, fixes, crux } }
}
export const SEO_CSS = [
    "",
    ".ncr-seo{display:flex;flex-direction:column;gap:20px}",
    ".ncr-seo-card .ncr-h2{display:flex;align-items:center;flex-wrap:wrap;gap:4px 8px}",
    ".ncr-seo-card .ncr-h2 .ncr-tier-chip{margin-left:0}",
    ".ncr-seo-empty{margin:0;padding:16px 18px;border-radius:14px;background:var(--ncr-surface-2);font-size:14px;line-height:1.55;color:var(--ncr-body);max-width:68ch;text-wrap:pretty}",
    ".ncr-seo-headline{margin:0;font-size:16px;line-height:1.45;color:var(--ncr-ink);text-wrap:pretty}",
    ".ncr-seo-headline strong{font-weight:600;font-variant-numeric:tabular-nums}",
    ".ncr-seo-tiles,.ncr-seo-dl{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}",
    ".ncr-seo-dl{grid-template-columns:repeat(auto-fit,minmax(180px,1fr))}",
    ".ncr-seo-dl dd{margin:0}",
    ".ncr-seo-tile{display:flex;flex-direction:column;gap:6px;padding:16px 18px;border-radius:16px;background:var(--ncr-surface-2);min-width:0}",
    ".ncr-seo-ch{display:inline-flex;align-items:flex-start;gap:5px;font-size:13px;line-height:1.4;font-weight:500;color:var(--ncr-body)}",
    ".ncr-seo-glyph{flex:none;margin-top:1px}",
    ".ncr-seo-ch.is-good .ncr-seo-glyph,.ncr-seo-mark.is-yes .ncr-seo-glyph{color:var(--ncr-good)}",
    ".ncr-seo-ch.is-bad .ncr-seo-glyph,.ncr-seo-mark.is-no .ncr-seo-glyph{color:var(--ncr-bad)}",
    ".ncr-seo-ch.is-flat .ncr-seo-glyph,.ncr-seo-ch.is-none{color:var(--ncr-muted)}",
    ".ncr-seo-mark{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:500;color:var(--ncr-ink)}",
    ".ncr-seo-mark.is-skip{color:var(--ncr-muted)}",
    ".ncr-seo-notes,.ncr-seo-rows,.ncr-seo-checks,.ncr-seo-cit,.ncr-seo-metrics,.ncr-seo-fine{list-style:none;margin:0;padding:0}",
    ".ncr-seo-notes li{display:flex;gap:8px;align-items:flex-start;font-size:13.5px;line-height:1.5;color:var(--ncr-body)}",
    ".ncr-seo-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 28px}",
    ".ncr-seo-col{display:flex;flex-direction:column;gap:10px;min-width:0}",
    ".ncr-seo-col .ncr-h3,.ncr-seo-trend .ncr-h3{margin:0}",
    ".ncr-seo-trend{display:flex;flex-direction:column;gap:8px;min-width:0}",
    ".ncr-seo-chart{margin:0}",
    ".ncr-seo-chart svg{display:block;width:100%;height:120px;overflow:visible}",
    ".ncr-seo-line{fill:none;stroke:var(--ncr-accent);stroke-width:2.5;vector-effect:non-scaling-stroke;stroke-linejoin:round;stroke-linecap:round}",
    ".ncr-seo-gridline{stroke:var(--ncr-grid);stroke-width:1;vector-effect:non-scaling-stroke}",
    ".ncr-seo-axis{display:flex;justify-content:space-between;gap:12px;margin-top:6px;font-size:12.5px;color:var(--ncr-muted)}",
    ".ncr-table th.ncr-seo-cellwrap,.ncr-table td.ncr-seo-cellwrap{white-space:normal;min-width:180px;max-width:420px;overflow-wrap:anywhere}",
    ".ncr-seo-path{font-variant-numeric:tabular-nums;overflow-wrap:anywhere;color:var(--ncr-ink);font-weight:500}",
    ".ncr-seo-fine{display:flex;flex-direction:column;gap:2px;margin:0;font-size:12.5px;line-height:1.5;color:var(--ncr-muted)}",
    ".ncr-seo-sevgroup{display:flex;flex-direction:column;gap:6px}",
    ".ncr-seo-sev{display:flex;align-items:center;gap:8px;margin:0}",
    ".ncr-seo-sevgroup.is-high .ncr-seo-sev .ncr-seo-glyph{color:var(--ncr-bad)}",
    ".ncr-seo-sevgroup.is-med .ncr-seo-sev .ncr-seo-glyph{color:var(--ncr-warn)}",
    ".ncr-seo-sevgroup.is-good .ncr-seo-sev .ncr-seo-glyph{color:var(--ncr-good)}",
    ".ncr-seo-sevgroup.is-info .ncr-seo-sev .ncr-seo-glyph{color:var(--ncr-muted)}",
    ".ncr-seo-rows li{display:flex;flex-direction:column;gap:2px;padding:10px 0;border-top:1px solid var(--ncr-border);min-width:0}",
    ".ncr-seo-cit{display:flex;flex-direction:column}",
    ".ncr-seo-cit-page{display:flex;flex-direction:column;gap:10px;padding:16px 0;border-top:1px solid var(--ncr-border)}",
    ".ncr-seo-cit-h{display:flex;align-items:baseline;justify-content:space-between;gap:6px 16px;flex-wrap:wrap;margin:0}",
    ".ncr-seo-count{font-size:13px;font-weight:500;color:var(--ncr-muted);font-variant-numeric:tabular-nums}",
    ".ncr-seo-checks{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:6px 16px}",
    ".ncr-seo-fixes{display:flex;flex-direction:column;gap:4px}",
    ".ncr-seo-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:16px}",
    ".ncr-seo-metric{display:flex;flex-direction:column;gap:6px;padding:16px 18px;border-radius:16px;background:var(--ncr-surface-2);min-width:0}",
    ".ncr-seo-metric p{margin:0}",
    ".ncr-seo-metric-v{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}",
    ".ncr-seo-map-kw{display:flex;flex-direction:column;gap:8px;min-width:0}",
    ".ncr-seo-map-kw .ncr-h3{margin:0}",
    ".ncr-seo-map{display:grid;gap:4px;width:100%;max-width:340px}",
    ".ncr-seo-cell{aspect-ratio:1;min-width:0;min-height:28px;border:0;border-radius:8px;font-family:inherit;font-size:12.5px;font-weight:600;font-variant-numeric:tabular-nums;cursor:pointer;touch-action:manipulation;color:var(--ncr-ink);background:var(--ncr-surface-2);transition:background-color 180ms ease,box-shadow 180ms ease,transform 100ms ease-out;-webkit-tap-highlight-color:transparent}",
    ".ncr-seo-cell.is-top{background:var(--ncr-accent-wash);box-shadow:inset 0 0 0 1.5px var(--ncr-accent)}",
    ".ncr-seo-cell.is-low{color:var(--ncr-body)}",
    ".ncr-seo-cell.is-out{background:transparent;box-shadow:inset 0 0 0 1px var(--ncr-border);color:var(--ncr-muted);font-weight:500;font-size:11px}",
    ".ncr-seo-cell.is-on{box-shadow:inset 0 0 0 2px var(--ncr-ink)}",
    ".ncr-seo-cell:hover{background:var(--ncr-accent-wash)}",
    ".ncr-seo-cell:active{transform:scale(0.96)}",
    ".ncr-seo-cell:focus-visible{outline:2px solid var(--ncr-accent);outline-offset:2px}",
    ".ncr-seo-map-sel{min-height:40px;margin:0}",
    ".ncr-seo-kv{display:flex;flex-direction:column;margin:0}",
    ".ncr-seo-kv div{display:flex;justify-content:space-between;gap:12px;padding:8px 0;border-top:1px solid var(--ncr-border);font-size:13.5px}",
    ".ncr-seo-kv dt{color:var(--ncr-muted)}",
    ".ncr-seo-kv dd{margin:0;color:var(--ncr-ink);text-align:right;overflow-wrap:anywhere}",
    "@media (max-width: 1023.98px){.ncr-seo-tiles{grid-template-columns:repeat(2,minmax(0,1fr))}}",
    "@media (max-width: 719.98px){.ncr-seo-two{grid-template-columns:minmax(0,1fr)}.ncr-seo-tile{padding:14px}.ncr-seo-tiles .ncr-figure{font-size:24px}}",
    "@media (max-width: 379.98px){.ncr-seo-tiles{grid-template-columns:minmax(0,1fr)}}",
    "@media (prefers-reduced-motion: reduce){.ncr-seo-cell{transition:none}.ncr-seo-cell:active{transform:none}}",
    "@media (prefers-contrast: more){.ncr-seo-cell,.ncr-seo-tile,.ncr-seo-metric,.ncr-seo-empty{box-shadow:inset 0 0 0 1px var(--ncr-field)}}",
].join("\n")
export default function ReportsSeo() {
    return null
}
