export type AivEngine = "google_ai_overview" | "chatgpt" | "perplexity" | "gemini"
export const AIV_ENGINES: AivEngine[] = ["google_ai_overview", "chatgpt", "perplexity", "gemini"]
export const AIV_ENGINE_LABEL: Record<AivEngine, string> = {
    google_ai_overview: "Google AI Overviews",
    chatgpt: "ChatGPT",
    perplexity: "Perplexity",
    gemini: "Gemini",
}
export interface AivRow {
    site_id: string
    month: string
    engine: AivEngine
    question: string
    mentioned: boolean
    cited: boolean
    position: number | null
    others: {
        name: string
        url?: string | null
    }[]
    excerpt: string | null
    checked_at: string | null
}
export function normalizeAiv(raw: any): AivRow[] {
    if (!Array.isArray(raw)) return []
    const out: AivRow[] = []
    for (const r of raw) {
        if (!r || typeof r !== "object") continue
        const engine = String(r.engine || "") as AivEngine
        if (!AIV_ENGINES.includes(engine)) continue
        const m = /^(\d{4})-(\d{2})/.exec(String(r.month || ""))
        if (!m || !r.question) continue
        let others: any = r.others
        if (typeof others === "string") {
            try {
                others = JSON.parse(others)
            } catch (e) {
                others = []
            }
        }
        const pos = Number(r.position)
        out.push({
            site_id: String(r.site_id || ""),
            month: m[1] + "-" + m[2] + "-01",
            engine,
            question: String(r.question),
            mentioned: r.mentioned === true || r.mentioned === "true",
            cited: r.cited === true || r.cited === "true",
            position: r.position === null || r.position === undefined || !Number.isFinite(pos) ? null : Math.round(pos),
            others: Array.isArray(others)
                ? others.filter((o: any) => o && o.name).map((o: any) => ({ name: String(o.name), url: o.url ? String(o.url) : null }))
                : [],
            excerpt: r.excerpt ? String(r.excerpt) : null,
            checked_at: r.checked_at ? String(r.checked_at) : null,
        })
    }
    return out
}
export function aivMonths(rows: AivRow[]): string[] {
    return Array.from(new Set(rows.map((r) => r.month))).sort()
}
export function aivScore(
    rows: AivRow[],
    month: string,
): {
    score: number
    mentioned: number
    total: number
} | null {
    const inMonth = rows.filter((r) => r.month === month)
    if (!inMonth.length) return null
    const mentioned = inMonth.filter((r) => r.mentioned).length
    return { score: Math.round((mentioned / inMonth.length) * 100), mentioned, total: inMonth.length }
}
export function aivByEngine(
    rows: AivRow[],
    month: string,
): {
    engine: AivEngine
    label: string
    mentioned: number
    total: number
}[] {
    const inMonth = rows.filter((r) => r.month === month)
    return AIV_ENGINES.map((engine) => {
        const e = inMonth.filter((r) => r.engine === engine)
        return { engine, label: AIV_ENGINE_LABEL[engine], mentioned: e.filter((r) => r.mentioned).length, total: e.length }
    }).filter((x) => x.total > 0)
}
export interface AivQuestion {
    question: string
    cells: {
        engine: AivEngine
        label: string
        row: AivRow | null
    }[]
    named: string[]
    mentioned: number
    total: number
}
export function aivQuestions(rows: AivRow[], month: string): AivQuestion[] {
    const inMonth = rows.filter((r) => r.month === month)
    const engines = AIV_ENGINES.filter((e) => inMonth.some((r) => r.engine === e))
    const qs = Array.from(new Set(inMonth.map((r) => r.question)))
    return qs
        .map((question) => {
            const qRows = inMonth.filter((r) => r.question === question)
            const counts = new Map<string, number>()
            qRows.forEach((r) => {
                const seen = new Set<string>()
                r.others.forEach((o) => {
                    const k = o.name.trim()
                    if (!k || seen.has(k.toLowerCase())) return
                    seen.add(k.toLowerCase())
                    counts.set(k, (counts.get(k) || 0) + 1)
                })
            })
            const named = Array.from(counts.entries())
                .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
                .slice(0, 3)
                .map(([n]) => n)
            return {
                question,
                cells: engines.map((engine) => ({
                    engine,
                    label: AIV_ENGINE_LABEL[engine],
                    row: qRows.find((r) => r.engine === engine) || null,
                })),
                named,
                mentioned: qRows.filter((r) => r.mentioned).length,
                total: qRows.length,
            }
        })
        .sort((a, b) => a.mentioned / Math.max(1, a.total) - b.mentioned / Math.max(1, b.total) || a.question.localeCompare(b.question))
}
export function ordinal(n: number): string {
    const s = ["th", "st", "nd", "rd"]
    const v = n % 100
    return n + (s[(v - 20) % 10] || s[v] || s[0])
}
export type TrendKind = "pct" | "pts" | "count"
export interface TrendMetric {
    key: string
    label: string
    fmt: (n: number) => string
    kind: TrendKind
    values: Record<string, number>
    days?: Record<
        string,
        {
            counted: number
            total: number
        }
    >
    yMax?: number
}
export interface TrendCompare {
    cur: number | null
    ref: number | null
    perDay: boolean
    diff: number | null
    fromZero: boolean
}
function round1(n: number) {
    return Math.round(n * 10) / 10
}
export function compareMonths(m: TrendMetric, month: string, ref: string): TrendCompare {
    let cur = m.values[month]
    let prev = m.values[ref]
    if (cur === undefined || prev === undefined || cur === null || prev === null)
        return { cur: cur ?? null, ref: prev ?? null, perDay: false, diff: null, fromZero: false }
    let perDay = false
    const dc = m.days && m.days[month]
    const dr = m.days && m.days[ref]
    if (dc && dr && (dc.counted < dc.total || dr.counted < dr.total)) {
        perDay = true
        cur = cur / Math.max(1, dc.counted)
        prev = prev / Math.max(1, dr.counted)
    }
    if (m.kind === "pct") {
        if (prev === 0) return { cur, ref: prev, perDay, diff: cur === 0 ? 0 : null, fromZero: cur !== 0 }
        return { cur, ref: prev, perDay, diff: round1(((cur - prev) / prev) * 100), fromZero: false }
    }
    if (m.kind === "pts") return { cur, ref: prev, perDay, diff: round1(cur - prev), fromZero: false }
    return { cur, ref: prev, perDay, diff: Math.round(cur - prev), fromZero: false }
}
export function changeWords(kind: TrendKind, diff: number): string {
    const a = Math.abs(diff)
    const n = a.toLocaleString("en-US", { maximumFractionDigits: 1 })
    if (kind === "pct") return n + "%"
    if (kind === "pts") return n + (a === 1 ? " point" : " points")
    return n
}
export function whatChanged(
    metrics: TrendMetric[],
    month: string,
    prev: string,
    yoy: string,
    name: (k: string) => string,
    long: (k: string) => string,
): {
    dir: "up" | "down"
    text: string
}[] {
    const cands: {
        size: number
        dir: "up" | "down"
        text: string
    }[] = []
    const add = (m: TrendMetric, ref: string, refWords: string) => {
        const c = compareMonths(m, month, ref)
        if (c.cur === null || c.ref === null) return
        const subject = c.perDay ? m.label + " per day" : m.label
        if (c.fromZero) {
            cands.push({ size: 100, dir: "up", text: subject + " " + m.fmt(m.values[month]) + ", up from none " + refWords + "." })
            return
        }
        if (c.diff === null || c.diff === 0) return
        const dir = c.diff > 0 ? "up" : "down"
        let text = subject + " " + dir + " " + changeWords(m.kind, c.diff) + " " + refWords
        if (m.kind === "count") text += ", from " + m.fmt(m.values[ref]) + " to " + m.fmt(m.values[month])
        const size =
            m.kind === "pct" ? Math.abs(c.diff) : m.kind === "pts" ? Math.abs(c.diff) * 2 : (Math.abs(c.diff) / Math.max(1, c.ref)) * 100
        cands.push({ size, dir, text: text + "." })
    }
    metrics.forEach((m) => {
        add(m, prev, "on " + name(prev))
        add(m, yoy, "on " + long(yoy))
    })
    return cands
        .sort((a, b) => b.size - a.size)
        .slice(0, 5)
        .map((c) => ({ dir: c.dir, text: c.text }))
}
function hash(s: string) {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return (h >>> 0) / 4294967295
}
const DEMO_QUESTIONS = [
    "Where can I order a custom birthday cake nearby?",
    "What is the best sourdough bakery near me?",
    "Which local bakery makes wedding cakes?",
    "Is there a bakery open early on Sunday near me?",
    "Who caters office breakfasts in town?",
    "Where can I buy gluten free bread locally?",
]
const DEMO_OTHERS = ["Sample Rye Bakehouse", "Example Crumb Co.", "Demo Street Bakery", "Sample Sugar Studio", "Example Oven Cafe"]
const DEMO_EXCERPT_YES = [
    "Several local bakeries are well reviewed for this. Harbor & Pine Bakery comes up often for its sourdough and custom orders, and Sample Rye Bakehouse is another option.",
    "Popular choices nearby include Harbor & Pine Bakery, which takes custom orders online, and Example Crumb Co.",
]
const DEMO_EXCERPT_NO = [
    "Options nearby include Sample Rye Bakehouse and Example Crumb Co., both of which list custom orders on their websites.",
    "Demo Street Bakery and Sample Sugar Studio are frequently recommended for this in reviews.",
]
export function demoAiVisibility(siteId: string, months: string[]): AivRow[] {
    const ms = months.slice().sort().slice(-7)
    const out: AivRow[] = []
    ms.forEach((month, mi) => {
        const lift = ms.length > 1 ? mi / (ms.length - 1) : 1
        DEMO_QUESTIONS.forEach((question, qi) => {
            AIV_ENGINES.forEach((engine, ei) => {
                const seed = hash(siteId + month + question + engine)
                const base = [0.42, 0.3, 0.36, 0.26][ei] - qi * 0.03
                const mentioned = seed < base + lift * 0.3
                const nOthers = 1 + Math.floor(hash(month + question + engine + "n") * 3)
                const start = Math.floor(hash(question + engine + "o") * DEMO_OTHERS.length)
                const others = Array.from({ length: nOthers }, (_, k) => ({
                    name: DEMO_OTHERS[(start + k) % DEMO_OTHERS.length],
                    url: null,
                }))
                const ex = mentioned ? DEMO_EXCERPT_YES : DEMO_EXCERPT_NO
                out.push({
                    site_id: siteId,
                    month,
                    engine,
                    question,
                    mentioned,
                    cited: mentioned && seed < base,
                    position: mentioned ? 1 + Math.floor(hash(month + question + engine + "p") * 3) : null,
                    others,
                    excerpt: ex[Math.floor(seed * ex.length) % ex.length],
                    checked_at: month,
                })
            })
        })
    })
    return out
}
export const MEISTER_CSS = [
    "",
    ".ncr-aiv-top{display:flex;align-items:flex-end;justify-content:space-between;gap:16px 28px;flex-wrap:wrap}",
    ".ncr-aiv-score{display:flex;flex-direction:column;gap:6px;min-width:0}",
    ".ncr-aiv-score .ncr-figure{font-size:40px}",
    ".ncr-aiv-engines{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:0 28px}",
    ".ncr-aiv-engine{display:grid;grid-template-columns:minmax(0,1fr) minmax(60px,34%) auto;align-items:center;gap:12px;padding:10px 0;border-top:1px solid var(--ncr-border);font-size:14px;min-width:0}",
    ".ncr-aiv-engine-name{color:var(--ncr-ink);font-weight:500;overflow-wrap:anywhere}",
    ".ncr-aiv-bar{height:6px;border-radius:999px;background:var(--ncr-surface-2);overflow:hidden}",
    ".ncr-aiv-bar span{display:block;height:100%;border-radius:999px;background:var(--ncr-accent)}",
    ".ncr-aiv-engine-num{font-variant-numeric:tabular-nums;color:var(--ncr-body);white-space:nowrap}",
    ".ncr-aiv-qs{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}",
    ".ncr-aiv-q{display:flex;flex-direction:column;gap:10px;padding:16px 0;border-top:1px solid var(--ncr-border);min-width:0}",
    ".ncr-aiv-q-h{margin:0;font-size:15px;font-weight:600;line-height:1.4;color:var(--ncr-ink);overflow-wrap:anywhere}",
    ".ncr-aiv-cells{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:8px}",
    ".ncr-aiv-cell{display:flex;flex-direction:column;gap:3px;padding:10px 12px;border-radius:12px;background:var(--ncr-surface-2);min-width:0}",
    ".ncr-aiv-cell-e{font-size:12.5px;color:var(--ncr-muted);font-weight:500}",
    ".ncr-aiv-mark{display:inline-flex;align-items:center;gap:6px;font-size:14px;font-weight:600}",
    ".ncr-aiv-mark.is-yes{color:var(--ncr-good)}",
    ".ncr-aiv-mark.is-no{color:var(--ncr-body)}",
    ".ncr-aiv-pos{font-size:12.5px;color:var(--ncr-body);font-variant-numeric:tabular-nums}",
    ".ncr-aiv-named{margin:0;font-size:13px;line-height:1.5;color:var(--ncr-body);overflow-wrap:anywhere}",
    ".ncr-aiv-named strong{font-weight:600;color:var(--ncr-ink)}",
    ".ncr-aiv-ex{display:flex;flex-direction:column;gap:8px;margin:0;padding:0;list-style:none}",
    ".ncr-aiv-ex li{padding:10px 14px;border-radius:12px;box-shadow:inset 0 0 0 1px var(--ncr-border);font-size:13.5px;line-height:1.55;color:var(--ncr-body);overflow-wrap:anywhere}",
    ".ncr-aiv-ex li strong{display:block;margin-bottom:2px;font-size:12.5px;font-weight:600;color:var(--ncr-ink)}",
    ".ncr-aiv-toggle{align-self:flex-start;display:inline-flex;align-items:center;gap:6px}",
    ".ncr-aiv-toggle svg{transition:transform 180ms ease}",
    '.ncr-aiv-toggle[aria-expanded="true"] svg{transform:rotate(90deg)}',
    ".ncr-aiv-sub{margin:4px 0 0}",
    ".ncr-textbtn:focus-visible{outline:2px solid var(--ncr-accent);outline-offset:2px;border-radius:6px}",
    ".ncr-trend-changes{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}",
    ".ncr-trend-changes li{display:flex;align-items:flex-start;gap:10px;padding:10px 0;border-top:1px solid var(--ncr-border);font-size:14.5px;line-height:1.45;color:var(--ncr-ink)}",
    ".ncr-trend-changes li svg{margin-top:2px;color:var(--ncr-muted)}",
    ".ncr-trend-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(min(100%,320px),1fr));gap:16px}",
    ".ncr-trend-metric{display:flex;flex-direction:column;gap:10px;min-width:0;padding:18px;border-radius:16px;box-shadow:inset 0 0 0 1px var(--ncr-border)}",
    ".ncr-trend-metric .ncr-figure{font-size:26px}",
    ".ncr-trend-cmp{display:grid;grid-template-columns:auto minmax(0,1fr);align-items:center;gap:6px 12px;margin:0;font-size:13px}",
    ".ncr-trend-cmp dt{color:var(--ncr-muted)}",
    ".ncr-trend-cmp dd{margin:0;min-width:0}",
    ".ncr-trend-cmp .ncr-delta{padding:2px 8px 2px 6px;min-height:0}",
    "@media (max-width: 719.98px){.ncr-aiv-engines{grid-template-columns:minmax(0,1fr)}.ncr-aiv-score .ncr-figure{font-size:34px}.ncr-trend-metric{padding:14px}}",
    "@media (prefers-reduced-motion: reduce){.ncr-aiv-toggle svg{transition:none}}",
].join("\n")
