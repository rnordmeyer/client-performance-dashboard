import type { TrafficRow, UptimeRow, CheckRow, WorkRow } from "./ReportsDemoData.tsx"
export interface MsSnap {
    id: string
    run_date: string
    overall: number | null
    grade: string | null
    seo: number | null
    performance: number | null
    accessibility: number | null
    best_practices: number | null
    onpage: number | null
    security: number | null
    issues_count: number | null
    response_ms: number | null
}
export interface MsRankRow {
    run_date: string
    keyword: string
    engine: string
    position: number | null
}
export interface MsRec {
    snapshot_id: string
    title: string
}
export type AnchorSource = "plan" | "launch" | "first-check"
export interface MsSource {
    snaps: MsSnap[]
    ranks: MsRankRow[]
    recs: MsRec[]
    traffic: TrafficRow[]
    uptime: UptimeRow[]
    checks: CheckRow[]
    work: WorkRow[]
    anchor: {
        date: string
        source: AnchorSource
    } | null
}
export function parseDay(s: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "")
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(NaN)
}
function pad(n: number) {
    return n < 10 ? `0${n}` : `${n}`
}
export function isoDay(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function addDays(d: Date, n: number) {
    return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
}
function addYears(d: Date, n: number) {
    return new Date(d.getFullYear() + n, d.getMonth(), d.getDate())
}
export function dayShort(s: string) {
    const d = parseDay(s)
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
export function dayFull(s: string) {
    const d = parseDay(s)
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}
export function monthLabel(key: string) {
    return parseDay(key).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}
function monthsBetween(start: string, end: string): string[] {
    const out: string[] = []
    const a = parseDay(start)
    let d = new Date(a.getFullYear(), a.getMonth(), 1)
    if (isoDay(d) < start) d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    while (isoDay(d) <= end) {
        out.push(isoDay(d))
        d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
    }
    return out
}
function daysInMonthKey(key: string) {
    const d = parseDay(key)
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}
function between(day: string, start: string, end: string) {
    return day >= start && day <= end
}
function num(v: any): number | null {
    if (v === null || v === undefined || v === "") return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}
export interface Period {
    id: string
    kind: "quarter" | "year" | "month"
    title: string
    name: string
    long: string
    availableOn: string
    fileTag: string
    dates: string
    start: string
    end: string
    closed: boolean
    daysLeft: number
    prevStart: string
    prevEnd: string
    prevName: string
}
const Q_NAMES = ["January to March", "April to June", "July to September", "October to December"]
function quarterOf(d: Date) {
    return { y: d.getFullYear(), q: Math.floor(d.getMonth() / 3) }
}
function quarterPeriod(y: number, q: number, today: string): Period {
    const s = new Date(y, q * 3, 1)
    const e = new Date(y, q * 3 + 3, 0)
    const ps = new Date(y, q * 3 - 3, 1)
    const pe = new Date(y, q * 3, 0)
    const start = isoDay(s)
    const end = isoDay(e)
    return {
        id: `q${y}-${q + 1}`,
        kind: "quarter",
        title: `Q${q + 1} ${y} report`,
        name: `Q${q + 1} ${y}`,
        long: `Q${q + 1} ${y}: ${Q_NAMES[q]}`,
        availableOn: isoDay(addDays(e, 1)),
        fileTag: `Q${q + 1}-${y}`,
        dates: `${dayShort(start)} to ${dayShort(end)}`,
        start,
        end,
        closed: today > end,
        daysLeft: Math.max(0, Math.round((e.getTime() - parseDay(today).getTime()) / 864e5)),
        prevStart: isoDay(ps),
        prevEnd: isoDay(pe),
        prevName: "the previous quarter",
    }
}
export function monthPeriod(y: number, m: number, today: string): Period {
    const s = new Date(y, m, 1)
    const e = new Date(y, m + 1, 0)
    const start = isoDay(s)
    const end = isoDay(e)
    const label = s.toLocaleDateString("en-US", { month: "long", year: "numeric" })
    return {
        id: `m${y}-${pad(m + 1)}`,
        kind: "month",
        title: `${label} report`,
        name: label,
        long: label,
        dates: `${dayShort(start)} to ${dayShort(end)}`,
        start,
        end,
        closed: today > end,
        daysLeft: Math.max(0, Math.round((e.getTime() - parseDay(today).getTime()) / 864e5)),
        prevStart: isoDay(new Date(y, m - 1, 1)),
        prevEnd: isoDay(new Date(y, m, 0)),
        prevName: "the previous month",
        availableOn: isoDay(addDays(e, 1)),
        fileTag: `${y}-${pad(m + 1)}`,
    }
}
function yearPeriod(anchor: Date, n: number, today: string): Period {
    const s = addYears(anchor, n - 1)
    const e = addDays(addYears(anchor, n), -1)
    const start = isoDay(s)
    const end = isoDay(e)
    return {
        id: `y${n}`,
        kind: "year",
        title: `Year ${n} report`,
        name: `Year ${n}`,
        long: `Year ${n} with Nordmeyer Creative`,
        availableOn: isoDay(addDays(e, 1)),
        fileTag: `Year-${n}`,
        dates: `${dayShort(start)} to ${dayShort(end)}`,
        start,
        end,
        closed: today > end,
        daysLeft: Math.max(0, Math.round((e.getTime() - parseDay(today).getTime()) / 864e5)),
        prevStart: isoDay(addYears(anchor, n - 2)),
        prevEnd: isoDay(addDays(addYears(anchor, n - 1), -1)),
        prevName: n === 1 ? "the year before you joined" : "the previous client year",
    }
}
export function pickAnchor(
    plans:
        | {
              kind: string
              starts_on: string | null
          }[]
        | null,
    launches: (string | null)[] | null,
    snaps: {
        run_date: string
    }[],
): {
    date: string
    source: AnchorSource
} | null {
    const subs = (plans || [])
        .filter((p) => p.kind === "subscription" && p.starts_on)
        .map((p) => p.starts_on as string)
        .sort()
    if (subs.length) return { date: subs[0], source: "plan" }
    const l = (launches || []).filter((x): x is string => !!x).sort()
    if (l.length) return { date: l[0], source: "launch" }
    const r = snaps
        .map((x) => x.run_date)
        .filter(Boolean)
        .sort()
    if (r.length) return { date: r[0], source: "first-check" }
    return null
}
export function firstDataDay(src: MsSource): string | null {
    const days: string[] = []
    if (src.snaps.length) days.push(src.snaps.map((x) => x.run_date).sort()[0])
    if (src.ranks.length) days.push(src.ranks.map((x) => x.run_date).sort()[0])
    src.traffic.forEach((t) => days.push(t.month))
    src.uptime.forEach((u) => days.push(u.month))
    if (src.checks.length) days.push(src.checks.map((c) => c.day).sort()[0])
    days.sort()
    return days[0] || null
}
export function buildPeriods(
    src: MsSource,
    now: Date,
): {
    years: Period[]
    quarters: Period[]
    months: Period[]
} {
    const today = isoDay(now)
    const first = firstDataDay(src)
    const quarters: Period[] = []
    const years: Period[] = []
    const months: Period[] = []
    if (first) {
        const a = parseDay(first)
        let d = new Date(a.getFullYear(), a.getMonth(), 1)
        while (d <= now) {
            const p = monthPeriod(d.getFullYear(), d.getMonth(), today)
            if (!p.closed || src.snaps.some((x) => between(x.run_date, p.start, p.end))) months.push(p)
            d = new Date(d.getFullYear(), d.getMonth() + 1, 1)
        }
    }
    if (first) {
        const a = quarterOf(parseDay(first))
        const b = quarterOf(now)
        let y = a.y
        let q = a.q
        while (y < b.y || (y === b.y && q <= b.q)) {
            quarters.push(quarterPeriod(y, q, today))
            q += 1
            if (q > 3) {
                q = 0
                y += 1
            }
        }
    }
    if (src.anchor) {
        const anchor = parseDay(src.anchor.date)
        if (!Number.isNaN(anchor.getTime())) {
            for (let n = 1; n < 100; n++) {
                const p = yearPeriod(anchor, n, today)
                if (p.start > today) break
                if (!first || p.end >= first) years.push(p)
            }
        }
    }
    return { years: years.reverse(), quarters: quarters.reverse(), months: months.reverse() }
}
export type Pos = number | null | undefined
export type EngineMap = Record<string, number | null>
const normEngine = (e: string) => (e || "").toLowerCase().replace(/[^a-z]/g, "")
export function googlePos(by: EngineMap | undefined): Pos {
    if (!by) return undefined
    if ("google" in by) return by.google
    const vals = Object.values(by).filter((v): v is number => typeof v === "number")
    if (!Object.keys(by).length) return undefined
    return vals.length ? Math.min(...vals) : null
}
export type MoveKind = "up" | "down" | "same" | "new" | "dropped" | "still-out" | "added" | "unknown"
export interface Move {
    kind: MoveKind
    n: number
}
export function moveOf(from: Pos, to: Pos): Move {
    if (to === undefined) return { kind: "unknown", n: 0 }
    if (from === undefined) return { kind: "added", n: 0 }
    if (from === null && to === null) return { kind: "still-out", n: 0 }
    if (from === null) return { kind: "new", n: 0 }
    if (to === null) return { kind: "dropped", n: 0 }
    if (from === to) return { kind: "same", n: 0 }
    return from > to ? { kind: "up", n: from - to } : { kind: "down", n: to - from }
}
export function posText(p: Pos) {
    return p === undefined ? "Not checked" : p === null ? "Not in top 50" : `${p}`
}
export function moveText(m: Move) {
    switch (m.kind) {
        case "up":
            return `Moved up ${m.n}`
        case "down":
            return `Moved down ${m.n}`
        case "same":
            return "Unchanged"
        case "new":
            return "Newly ranking"
        case "dropped":
            return "Dropped out"
        case "still-out":
            return "Unchanged, not in top 50"
        case "added":
            return "Added during this period"
        default:
            return "Not checked"
    }
}
export function moveTone(m: Move): "good" | "bad" | "flat" {
    return m.kind === "up" || m.kind === "new" ? "good" : m.kind === "down" || m.kind === "dropped" ? "bad" : "flat"
}
export const ENGINE_NAMES: [string, string][] = [
    ["google", "Google"],
    ["bing", "Bing"],
    ["duckduckgo", "DuckDuckGo"],
    ["yahoo", "Yahoo"],
]
export interface KwRow {
    keyword: string
    start: Pos
    now: Pos
    first: Pos
    startBy: EngineMap | undefined
    nowBy: EngineMap | undefined
    move: Move
    moveAll: Move
}
export interface MonthCell {
    key: string
    visits: number | null
    unique: number | null
    days: number
    total: number
}
export interface MsReport {
    period: Period
    health: {
        before: MsSnap | null
        start: MsSnap | null
        end: MsSnap | null
        checks: number
        series: {
            key: string
            date: string
            overall: number
        }[]
    }
    search: {
        tracked: boolean
        noRunInPeriod: boolean
        startRun: string | null
        nowRun: string | null
        firstRun: string | null
        rows: KwRow[]
        pageOne: {
            start: number | null
            now: number | null
            first: number | null
        }
        counts: {
            start: number
            now: number
            first: number
        }
    }
    traffic: {
        months: MonthCell[]
        visits: number | null
        unique: number | null
        days: number
        missing: string[]
        partial: MonthCell[]
        prev: {
            visits: number | null
            unique: number | null
            days: number
            months: number
        } | null
    }
    uptime: {
        pct: number | null
        outageDays: number
        daysChecked: number
        source: "daily" | "monthly" | "none"
        respStart: {
            ms: number
            date: string
        } | null
        respEnd: {
            ms: number
            date: string
        } | null
    }
    issues: {
        from: MsSnap | null
        to: MsSnap | null
        resolved: string[]
        open: string[]
        added: number
    }
    work: {
        done: (WorkRow & {
            done_on: string
        })[]
        groups: {
            category: string
            items: (WorkRow & {
                done_on: string
            })[]
        }[]
        carried: number | null
    }
    summary: string[]
}
const CATEGORY_ORDER = ["seo", "design", "security", "content", "maintenance", ""]
export const CATEGORY_NAMES: Record<string, string> = {
    seo: "Search",
    design: "Design",
    security: "Security",
    content: "Content",
    maintenance: "Care",
    "": "Other updates",
}
const isOpenWork = (w: WorkRow) => w.status === "in_progress" || w.status === "up_next"
export function buildReport(src: MsSource, p: Period, now: Date): MsReport {
    const today = isoDay(now)
    const snaps = src.snaps.slice().sort((a, b) => (a.run_date < b.run_date ? -1 : a.run_date > b.run_date ? 1 : 0))
    const inP = snaps.filter((s) => between(s.run_date, p.start, p.end))
    const before = snaps.filter((s) => s.run_date < p.start).pop() || null
    const lastByMonth = new Map<string, MsSnap>()
    inP.forEach((x) => lastByMonth.set(`${x.run_date.slice(0, 7)}-01`, x))
    const series = [...(before ? [before] : []), ...Array.from(lastByMonth.values())]
        .filter((x) => num(x.overall) !== null)
        .map((x) => ({ key: `${x.run_date.slice(0, 7)}-01`, date: x.run_date, overall: num(x.overall) as number }))
    const health = { before, start: inP[0] || null, end: inP[inP.length - 1] || null, checks: inP.length, series }
    const runs = new Map<string, Map<string, EngineMap>>()
    src.ranks.forEach((r) => {
        if (!r.run_date || !r.keyword) return
        if (!runs.has(r.run_date)) runs.set(r.run_date, new Map())
        const byKw = runs.get(r.run_date)!
        if (!byKw.has(r.keyword)) byKw.set(r.keyword, {})
        byKw.get(r.keyword)![normEngine(r.engine)] = num(r.position)
    })
    const runDates = Array.from(runs.keys()).sort()
    const inRuns = runDates.filter((d) => between(d, p.start, p.end))
    let startRun: string | null = null
    let nowRun: string | null = null
    const priorRun = runDates.filter((d) => d < p.start).pop() || null
    if (p.kind === "month") {
        nowRun = p.closed ? inRuns[inRuns.length - 1] || null : runDates[runDates.length - 1] || null
        startRun = nowRun ? priorRun || inRuns[0] || nowRun : null
    } else if (p.closed) {
        startRun = inRuns[0] || null
        nowRun = inRuns[inRuns.length - 1] || null
    } else {
        startRun = inRuns[0] || runDates[0] || null
        nowRun = runDates[runDates.length - 1] || null
    }
    const firstRun = runDates[0] || null
    const at = (d: string | null) => (d ? runs.get(d) : undefined)
    const kwSet = new Set<string>()
    at(startRun)?.forEach((_, k) => kwSet.add(k))
    at(nowRun)?.forEach((_, k) => kwSet.add(k))
    const rows: KwRow[] = Array.from(kwSet).map((keyword) => {
        const startBy = at(startRun)?.get(keyword)
        const nowBy = at(nowRun)?.get(keyword)
        const firstBy = at(firstRun)?.get(keyword)
        const start = googlePos(startBy)
        const nowP = googlePos(nowBy)
        const first = googlePos(firstBy)
        return { keyword, start, now: nowP, first, startBy, nowBy, move: moveOf(start, nowP), moveAll: moveOf(first, nowP) }
    })
    rows.sort((a, b) => {
        const av = typeof a.now === "number" ? a.now : 999
        const bv = typeof b.now === "number" ? b.now : 999
        return av - bv || a.keyword.localeCompare(b.keyword)
    })
    const pageOneOf = (d: string | null) => {
        const m = at(d)
        if (!m) return null
        let c = 0
        m.forEach((by) => {
            const g = googlePos(by)
            if (typeof g === "number" && g <= 10) c++
        })
        return c
    }
    const search = {
        tracked: runDates.length > 0,
        noRunInPeriod: p.closed ? inRuns.length === 0 : runDates.length === 0,
        startRun,
        nowRun,
        firstRun,
        rows,
        pageOne: { start: pageOneOf(startRun), now: pageOneOf(nowRun), first: pageOneOf(firstRun) },
        counts: { start: at(startRun)?.size || 0, now: at(nowRun)?.size || 0, first: at(firstRun)?.size || 0 },
    }
    const firstDay = firstDataDay(src) || p.start
    const firstMonth = `${firstDay.slice(0, 7)}-01`
    const thisMonth = `${today.slice(0, 7)}-01`
    const cells = (start: string, end: string): MonthCell[] =>
        monthsBetween(start, end).map((key) => {
            const r = src.traffic.find((t) => t.month === key)
            return {
                key,
                visits: r ? num(r.visits) : null,
                unique: r ? num(r.unique_visitors) : null,
                days: r ? r.days_reported || 0 : 0,
                total: daysInMonthKey(key),
            }
        })
    const months = cells(p.start, p.end)
    const withData = months.filter((m) => m.visits !== null)
    const sum = (list: MonthCell[], f: "visits" | "unique") =>
        list.some((m) => m[f] !== null) ? list.reduce((a, m) => a + (m[f] || 0), 0) : null
    const prevCells = cells(p.prevStart, p.prevEnd).filter((m) => m.visits !== null)
    const traffic = {
        months,
        visits: sum(withData, "visits"),
        unique: sum(withData, "unique"),
        days: withData.reduce((a, m) => a + m.days, 0),
        missing: months.filter((m) => m.visits === null && m.key >= firstMonth && m.key <= thisMonth).map((m) => m.key),
        partial: withData.filter((m) => m.days < m.total),
        prev: prevCells.length
            ? {
                  visits: sum(prevCells, "visits"),
                  unique: sum(prevCells, "unique"),
                  days: prevCells.reduce((a, m) => a + m.days, 0),
                  months: prevCells.length,
              }
            : null,
    }
    const dayRows = src.checks.filter((c) => between(c.day, p.start, p.end))
    let pct: number | null = null
    let outageDays = 0
    let source: "daily" | "monthly" | "none" = "none"
    if (dayRows.length) {
        let total = 0
        let missed = 0
        dayRows.forEach((c) => {
            const n = num(c.checks as any)
            const d = num(c.down_checks as any)
            const m = d !== null ? d : c.up ? 0 : 1
            total += n !== null ? n : 1
            missed += m
            if (m > 0) outageDays++
        })
        pct = total > 0 ? ((total - missed) / total) * 100 : null
        source = "daily"
    } else {
        const ups = src.uptime.filter((u) => between(u.month, p.start, p.end) && num(u.uptime_pct) !== null)
        if (ups.length) {
            const w = ups.reduce((a, u) => a + (num(u.checks) || 1), 0)
            pct = ups.reduce((a, u) => a + (num(u.uptime_pct) as number) * (num(u.checks) || 1), 0) / w
            outageDays = ups.reduce((a, u) => a + (num((u as any).days_with_outage) || 0), 0)
            source = "monthly"
        }
    }
    const withResp = inP.filter((s) => num(s.response_ms) !== null)
    const uptime = {
        pct,
        outageDays,
        daysChecked: dayRows.length,
        source,
        respStart: withResp.length ? { ms: num(withResp[0].response_ms) as number, date: withResp[0].run_date } : null,
        respEnd: withResp.length
            ? { ms: num(withResp[withResp.length - 1].response_ms) as number, date: withResp[withResp.length - 1].run_date }
            : null,
    }
    const from = inP.length > 1 ? inP[0] : inP.length === 1 ? before : null
    const to = inP.length ? inP[inP.length - 1] : null
    const titles = (s: MsSnap | null) => new Set(s ? src.recs.filter((r) => r.snapshot_id === s.id).map((r) => r.title) : [])
    const a = titles(from)
    const b = titles(to)
    const issues = {
        from,
        to,
        resolved: from && to ? Array.from(a).filter((t) => !b.has(t)) : [],
        open: from && to ? Array.from(a).filter((t) => b.has(t)) : [],
        added: from && to ? Array.from(b).filter((t) => !a.has(t)).length : 0,
    }
    const done = src.work
        .filter(
            (
                w,
            ): w is WorkRow & {
                done_on: string
            } => !isOpenWork(w) && !!w.done_on && between(w.done_on, p.start, p.end),
        )
        .sort((x, y) => (x.done_on < y.done_on ? -1 : 1))
    const groups = CATEGORY_ORDER.map((c) => ({
        category: c,
        items: done.filter((w) => (CATEGORY_ORDER.includes(w.category || "") ? w.category || "" : "") === c),
    })).filter((g) => g.items.length)
    const known = src.work.some((w) => !!w.created_at)
    let carried: number | null = null
    if (known) {
        carried = src.work.filter((w) => {
            const added = w.created_at ? w.created_at.slice(0, 10) : null
            if (!added || added > p.end) return false
            if (isOpenWork(w)) return true
            return !!w.done_on && w.done_on > p.end
        }).length
    } else if (!p.closed) {
        carried = src.work.filter(isOpenWork).length
    }
    const work = { done, groups, carried }
    const report: MsReport = { period: p, health, search, traffic, uptime, issues, work, summary: [] }
    report.summary = summarize(report)
    return report
}
export function fmtPct(p: number | null) {
    if (p === null) return "No data"
    if (p >= 100) return "100%"
    return `${(Math.floor(p * 100) / 100).toLocaleString("en-US", { maximumFractionDigits: 2 })}%`
}
const int = (n: number) => Math.round(n).toLocaleString("en-US")
export const scoreText = (s: MsSnap | null) => (s && num(s.overall) !== null ? `${s.overall}${s.grade ? ` (${s.grade})` : ""}` : "No data")
export function healthPair(r: MsReport): {
    from: MsSnap | null
    to: MsSnap | null
} {
    const h = r.health
    if (h.start && h.end && h.start.id !== h.end.id) return { from: h.start, to: h.end }
    return { from: h.before, to: h.end }
}
export function trafficChange(
    r: MsReport,
    f: "visits" | "unique",
): {
    pct: number
    perDay: boolean
} | null {
    const t = r.traffic
    const cur = t[f]
    const prev = t.prev ? t.prev[f] : null
    if (cur === null || prev === null || !t.prev || prev <= 0 || !t.days || !t.prev.days) return null
    const perDay = t.days !== t.prev.days
    const a = perDay ? cur / t.days : cur
    const b = perDay ? prev / t.prev.days : prev
    return { pct: Math.round(((a - b) / b) * 1000) / 10, perDay }
}
export function headlineMove(r: MsReport): KwRow | null {
    return (
        r.search.rows
            .filter((k) => (k.move.kind === "up" || k.move.kind === "new") && typeof k.now === "number")
            .sort((x, y) => (x.now as number) - (y.now as number) || y.move.n - x.move.n)[0] || null
    )
}
function summarize(r: MsReport): string[] {
    const out: string[] = []
    const kind = r.period.kind === "quarter" ? "quarter" : r.period.kind === "month" ? "month" : "client year"
    const so = r.period.closed ? "" : " so far"
    const { from, to } = healthPair(r)
    const fo = num(from?.overall)
    const tov = num(to?.overall)
    if (tov === null) out.push(`No site health check ran in this ${kind}${so}.`)
    else if (fo === null) out.push(`Overall health was ${scoreText(to)} at the only check in this ${kind}${so}.`)
    else {
        const since = from && r.health.before && from.id === r.health.before.id ? ` at the last check before this ${kind}` : ""
        if (tov > fo) out.push(`Overall health rose from ${scoreText(from)}${since} to ${scoreText(to)}.`)
        else if (tov < fo)
            out.push(`Overall health slipped from ${scoreText(from)}${since} to ${scoreText(to)}. The plan shows what comes next.`)
        else out.push(`Overall health held steady at ${scoreText(to)}.`)
    }
    const s = r.search
    if (!s.tracked) out.push("No keywords are being tracked for this site yet.")
    else if (s.noRunInPeriod) out.push(`No keyword checks ran in this ${kind}.`)
    else {
        const a = s.pageOne.start
        const b = s.pageOne.now
        const lead = (n: number) =>
            `${n} of ${s.counts.now} tracked ${s.counts.now === 1 ? "keyword" : "keywords"} ${n === 1 ? "is" : "are"} on Google page one`
        if (a !== null && b !== null && s.startRun !== s.nowRun) {
            out.push(b === a ? `${lead(b)}, the same as at the start.` : `${lead(b)}, ${b > a ? "up" : "down"} from ${a} at the start.`)
        } else if (b !== null) {
            out.push(`${lead(b)}. Only one keyword check ran, so there is no movement to report yet.`)
        }
        const best = headlineMove(r)
        if (best)
            out.push(
                `“${best.keyword}” moved from ${best.start === null ? "not in the top 50" : `position ${best.start}`} to position ${best.now} on Google.`,
            )
        else if (s.startRun !== s.nowRun && s.rows.length) out.push("No tracked keyword moved up on Google in this period.")
    }
    const t = r.traffic
    if (t.visits === null) out.push(`No traffic data was recorded for this ${kind}${so}.`)
    else {
        const ch = trafficChange(r, "visits")
        const base = `${int(t.visits)} visits${so}`
        const vs = ch
            ? ch.pct === 0
                ? `, level with ${r.period.prevName}${ch.perDay ? " per day" : ""}`
                : `, ${ch.pct > 0 ? "up" : "down"} ${Math.abs(ch.pct).toLocaleString("en-US", { maximumFractionDigits: 1 })}% on ${r.period.prevName}${ch.perDay ? " as a daily average" : ""}`
            : ""
        const gaps = t.missing.length ? ` Traffic data is missing for ${t.missing.map(monthLabel).join(", ")}.` : ""
        out.push(`${base}${vs}.${gaps}`)
    }
    const u = r.uptime
    if (u.pct === null) out.push(`No uptime checks were recorded for this ${kind}${so}.`)
    else
        out.push(
            u.outageDays
                ? `The site was up ${fmtPct(u.pct)} of the time, with missed checks on ${u.outageDays} ${u.outageDays === 1 ? "day" : "days"}.`
                : `The site was up ${fmtPct(u.pct)} of the time, with no outages.`,
        )
    const w = r.work.done.length
    const fixed = r.issues.resolved.length
    if (w || fixed) {
        const parts = [
            w ? `we finished ${w} ${w === 1 ? "improvement" : "improvements"}` : "",
            fixed ? `${fixed} ${fixed === 1 ? "item" : "items"} from the plan ${fixed === 1 ? "was" : "were"} resolved` : "",
        ].filter(Boolean)
        const line = parts.join(", and ")
        out.push(`${line.charAt(0).toUpperCase()}${line.slice(1)}.`)
    } else out.push(`No finished work was logged in this ${kind}${so}.`)
    return out.slice(0, 5)
}
function wrap(text: string, indent = "", width = 80): string {
    const words = text.split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let line = indent
    for (const w of words) {
        if (line.trim() && (line + " " + w).length > width) {
            lines.push(line)
            line = indent + w
        } else line = line.trim() ? `${line} ${w}` : indent + w
    }
    if (line.trim()) lines.push(line)
    return lines.join("\n")
}
export const PILLAR_ROWS: {
    key: keyof MsSnap
    label: string
}[] = [
    { key: "performance", label: "Performance" },
    { key: "accessibility", label: "Accessibility" },
    { key: "best_practices", label: "Best practices" },
    { key: "seo", label: "Search basics" },
    { key: "onpage", label: "On-page" },
    { key: "security", label: "Security" },
]
export function buildMilestoneText(
    r: MsReport,
    o: {
        businessName: string
        domain: string
        demo: boolean
        now: Date
    },
): {
    name: string
    text: string
} {
    const out: string[] = []
    const add = (t = "") => out.push(t)
    const para = (t: string, indent = "") => out.push(wrap(t, indent))
    const RULE = "=".repeat(72)
    const section = (title: string) => {
        add()
        add(RULE)
        add(title)
        add(RULE)
    }
    const p = r.period
    if (o.demo) add("SAMPLE: invented data for a demo business")
    add(`${p.kind === "quarter" ? "Quarterly report" : p.kind === "month" ? "Monthly report" : "Annual report"} from Nordmeyer Creative`)
    add(`Business: ${o.businessName}`)
    if (o.domain) add(`Website: ${o.domain}`)
    add(`Period: ${p.long} (${p.dates})`)
    add(`Status: ${p.closed ? "Closed" : `In progress, ${p.daysLeft} ${p.daysLeft === 1 ? "day" : "days"} left`}`)
    add(`Generated: ${o.now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`)
    section("IN SHORT")
    r.summary.forEach((s) => para(`* ${s}`, "  "))
    section("SITE HEALTH")
    const h = r.health
    if (!h.end) add("No complete site check ran in this period.")
    else {
        if (h.before) add(`Before this period (${dayShort(h.before.run_date)}): ${scoreText(h.before)}`)
        if (h.start) add(`Start of period (${dayShort(h.start.run_date)}): ${scoreText(h.start)}`)
        add(`End of period (${dayShort(h.end.run_date)}): ${scoreText(h.end)}`)
        add()
        add("Pillar scores, start to end:")
        PILLAR_ROWS.forEach(({ key, label }) => {
            const a = num(h.start?.[key])
            const b = num(h.end?.[key])
            add(`  ${label}: ${a === null ? "not measured" : a} to ${b === null ? "not measured" : b}`)
        })
        add()
        para(
            "The overall score combines search basics, speed, accessibility, best practices, on-page setup and security. It does not include rankings or traffic.",
        )
    }
    section("SEARCH ENGINES")
    const s = r.search
    if (!s.tracked) add("No keywords are being tracked for this site yet.")
    else if (s.noRunInPeriod) add("No keyword checks ran in this period.")
    else {
        para(
            `Google positions. Start: check on ${dayShort(s.startRun || "")}. Now: check on ${dayShort(s.nowRun || "")}. Position 1 is the top result; 1 to 10 is page one. We check the top 50 results.`,
        )
        add(`Keywords on Google page one: ${s.pageOne.start ?? "no data"} at the start, ${s.pageOne.now ?? "no data"} now.`)
        if (s.firstRun)
            add(
                `Since your first check (${dayShort(s.firstRun)}): ${s.pageOne.first ?? "no data"} on page one then, ${s.pageOne.now ?? "no data"} now.`,
            )
        add()
        s.rows.forEach((k) => {
            para(
                `* ${k.keyword}: ${posText(k.start)} to ${posText(k.now)} (${moveText(k.move).toLowerCase()}). Since your first check: ${posText(k.first)} to ${posText(k.now)}.`,
                "  ",
            )
            const eng = ENGINE_NAMES.map(([e, n]) => `${n} ${posText(k.nowBy ? k.nowBy[e] : undefined)}`).join(", ")
            para(`Now by engine: ${eng}.`, "    ")
        })
    }
    section("TRAFFIC")
    const t = r.traffic
    if (t.visits === null) add("No traffic data was recorded for this period.")
    else {
        add(`Visits: ${int(t.visits)}`)
        add(`Unique visitors: ${t.unique === null ? "no data" : int(t.unique)}`)
        if (t.prev)
            add(
                `${p.prevName.charAt(0).toUpperCase()}${p.prevName.slice(1)}: ${t.prev.visits === null ? "no data" : int(t.prev.visits)} visits, ${t.prev.unique === null ? "no data" : int(t.prev.unique)} unique visitors`,
            )
        else add(`No data for ${p.prevName} to compare.`)
        add()
        add("By month:")
        t.months.forEach((m) =>
            add(
                `  ${monthLabel(m.key)}: ${m.visits === null ? "no data" : `${int(m.visits)} visits${m.days < m.total ? ` (${m.days} of ${m.total} days counted)` : ""}`}`,
            ),
        )
    }
    section("UPTIME")
    const u = r.uptime
    if (u.pct === null) add("No uptime checks were recorded for this period.")
    else {
        add(`Uptime: ${fmtPct(u.pct)}`)
        add(`Days with an outage: ${u.outageDays}`)
    }
    if (u.respStart && u.respEnd)
        add(
            `Response time at monthly check: ${int(u.respStart.ms)} ms (${dayShort(u.respStart.date)}) to ${int(u.respEnd.ms)} ms (${dayShort(u.respEnd.date)})`,
        )
    section("ISSUES FIXED")
    const i = r.issues
    if (!i.from || !i.to) add("Only one site check, or none, so there is nothing to compare yet.")
    else {
        add(
            `Issues found: ${i.from.issues_count ?? "no data"} (${dayShort(i.from.run_date)}) to ${i.to.issues_count ?? "no data"} (${dayShort(i.to.run_date)})`,
        )
        add()
        add("Resolved:")
        if (!i.resolved.length) add("  None in this period.")
        i.resolved.forEach((x) => para(`* ${x}`, "  "))
        add()
        add("Still open:")
        if (!i.open.length) add("  None.")
        i.open.forEach((x) => para(`* ${x}`, "  "))
        if (i.added) para(`${i.added} new ${i.added === 1 ? "item was" : "items were"} added to the plan during the period.`)
    }
    section("WORK COMPLETED")
    if (!r.work.done.length) add("No finished work was logged in this period.")
    r.work.groups.forEach((g) => {
        add(`${CATEGORY_NAMES[g.category] || "Other updates"} (${g.items.length}):`)
        g.items.forEach((w) => para(`${dayShort(w.done_on)}: ${w.title}`, "  "))
        add()
    })
    if (r.work.carried !== null)
        add(`${p.closed ? "Carried into the next period" : "Open right now"}: ${r.work.carried} ${r.work.carried === 1 ? "item" : "items"}`)
    add()
    add(RULE)
    para(
        "Scores are point-in-time measurements from public testing tools such as Google Lighthouse. They are not a guarantee of security, accessibility, or search rankings.",
    )
    add("Questions: hello@nordmeyercreative.com")
    add()
    return { name: `${reportFileBase(r, o.businessName)}.txt`, text: out.join("\n") }
}
export function reportFileBase(r: MsReport, businessName: string) {
    const client =
        (businessName || "Client")
            .normalize("NFKD")
            .replace(/[^A-Za-z0-9]+/g, "-")
            .replace(/^-+|-+$/g, "") || "Client"
    return `Nordmeyer-Creative_${client}_${r.period.fileTag}_report`
}
export default function ReportsMilestones() {
    return null
}
