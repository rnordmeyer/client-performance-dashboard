import * as React from "react"
import { useCallback, useEffect, useId, useMemo, useState } from "react"
import { liveSession, ReportsError } from "./ReportsShared.tsx"
export type Tier = "core" | "klarwerk" | "grundwerk" | "kraftmarke" | "meisterwerk"
export type ViewerRole = "staff" | "owner" | "member" | "service"
export type Level = "none" | "quarterly" | "monthly"
export type Breakdown = "none" | "basic" | "full"
export interface Features {
    traffic_months: number | null
    traffic_breakdown: Breakdown
    ranks: boolean
    ranks_keywords: number | null
    ranks_cadence: Level
    competitors: boolean
    leads: boolean
    conversion: boolean
    store: boolean
    search_terms: boolean
    ai_visibility: Level
    trend_reports: boolean
    growth_plan: boolean
    reports_quarterly: boolean
    reports_monthly: boolean
    index_coverage: boolean
    change_alerts: boolean
    geo_readiness: boolean
    citability: boolean
    brand_mentions: boolean
    quick_wins: boolean
    crux_trend: boolean
    backlinks: boolean
    map_grid: boolean
    seo_detail: boolean
    custom_goals: boolean
    fresh_pull: boolean
    logins: number | null
    export: boolean
}
export type FeatureKey = keyof Features
export interface Entitlements {
    tier: Tier
    features: Features
    viewer_role: ViewerRole
}
export interface ViewMode {
    staff: boolean
    viewAs: boolean
}
export type Matrices = Partial<Record<Tier, Features>>
export const LOCKED_MODE: "line" | "hide" = "line"
export const TIERS: Exclude<Tier, "core">[] = ["klarwerk", "grundwerk", "kraftmarke", "meisterwerk"]
export const SOLD_TIERS: Exclude<Tier, "core">[] = TIERS.filter((t) => t !== "kraftmarke")
export const TIER_LABEL: Record<Tier, string> = {
    core: "Core",
    klarwerk: "Klarwerk",
    grundwerk: "Grundwerk",
    kraftmarke: "Kraftmarke",
    meisterwerk: "Meisterwerk",
}
export const ALL_ON: Features = {
    traffic_months: null,
    traffic_breakdown: "full",
    ranks: true,
    ranks_keywords: null,
    ranks_cadence: "monthly",
    competitors: true,
    leads: true,
    conversion: true,
    store: true,
    search_terms: true,
    ai_visibility: "monthly",
    trend_reports: true,
    growth_plan: true,
    reports_quarterly: true,
    reports_monthly: true,
    index_coverage: true,
    change_alerts: true,
    geo_readiness: true,
    citability: true,
    brand_mentions: true,
    quick_wins: true,
    crux_trend: true,
    backlinks: true,
    map_grid: true,
    seo_detail: true,
    custom_goals: true,
    fresh_pull: true,
    logins: null,
    export: true,
}
export const NOT_BUILT: ReadonlySet<FeatureKey> = new Set<FeatureKey>(["store", "competitors", "custom_goals"])
export const LOCKED_RENDER_NOTHING: ReadonlySet<FeatureKey> = new Set<FeatureKey>([
    "search_terms",
    "index_coverage",
    "change_alerts",
    "geo_readiness",
    "citability",
    "brand_mentions",
    "quick_wins",
    "crux_trend",
    "backlinks",
    "map_grid",
    "seo_detail",
])
const SEO_TIER_DEFAULTS: Record<Tier, Partial<Record<FeatureKey, boolean>>> = (() => {
    const off = {
        search_terms: false,
        index_coverage: false,
        change_alerts: false,
        geo_readiness: false,
        citability: false,
        brand_mentions: false,
        quick_wins: false,
        crux_trend: false,
        backlinks: false,
        map_grid: false,
        seo_detail: false,
    }
    const grund = { ...off, search_terms: true, index_coverage: true, change_alerts: true }
    return {
        core: off,
        klarwerk: off,
        grundwerk: grund,
        kraftmarke: { ...grund, quick_wins: true, crux_trend: true },
        meisterwerk: {
            ...grund,
            geo_readiness: true,
            citability: true,
            brand_mentions: true,
            quick_wins: true,
            crux_trend: true,
            backlinks: true,
            map_grid: true,
        },
    }
})()
const BOOL_KEYS: FeatureKey[] = [
    "ranks",
    "competitors",
    "leads",
    "conversion",
    "store",
    "search_terms",
    "trend_reports",
    "growth_plan",
    "reports_quarterly",
    "custom_goals",
    "fresh_pull",
    "export",
    "reports_monthly",
    "index_coverage",
    "change_alerts",
    "geo_readiness",
    "citability",
    "brand_mentions",
    "quick_wins",
    "crux_trend",
    "backlinks",
    "map_grid",
    "seo_detail",
]
const NUM_KEYS: FeatureKey[] = ["traffic_months", "ranks_keywords", "logins"]
export const ENUM_OPTIONS: Partial<
    Record<
        FeatureKey,
        {
            value: string
            label: string
        }[]
    >
> = {
    traffic_breakdown: [
        { value: "none", label: "None" },
        { value: "basic", label: "Top pages and sources" },
        { value: "full", label: "Pages, sources, devices and countries" },
    ],
    ranks_cadence: [
        { value: "none", label: "None" },
        { value: "quarterly", label: "Quarterly" },
        { value: "monthly", label: "Monthly" },
    ],
    ai_visibility: [
        { value: "none", label: "None" },
        { value: "quarterly", label: "Quarterly" },
        { value: "monthly", label: "Monthly" },
    ],
}
export const FEATURE_LABEL: Record<FeatureKey, string> = {
    traffic_months: "Traffic history (months)",
    traffic_breakdown: "Traffic breakdown",
    ranks: "Keyword rankings",
    ranks_keywords: "Keywords tracked",
    ranks_cadence: "Ranking checks",
    leads: "Lead inquiries",
    conversion: "Visits to inquiry rate",
    growth_plan: "Growth opportunities in the plan",
    reports_quarterly: "Quarterly reports",
    reports_monthly: "Monthly reports",
    fresh_pull: "Fresh data pull on Refresh",
    logins: "Logins",
    export: "CSV download",
    competitors: "Competitor comparison",
    store: "Store orders and revenue",
    search_terms: "Google Search (clicks, searches, pages)",
    ai_visibility: "AI visibility checks",
    index_coverage: "Pages on Google",
    change_alerts: "Change alerts",
    quick_wins: "Quick wins",
    crux_trend: "Real-visitor speed trend",
    geo_readiness: "AI search readiness",
    citability: "How quotable each page is",
    brand_mentions: "Mentions of the business",
    backlinks: "Links from other sites",
    map_grid: "Local map ranking",
    seo_detail: "Site details (structured data, local, technical)",
    trend_reports: "Trend reports",
    custom_goals: "Custom goals",
}
export const FEATURE_ORDER = Object.keys(FEATURE_LABEL) as FeatureKey[]
export function kindOf(k: FeatureKey): "bool" | "num" | "enum" {
    return BOOL_KEYS.includes(k) ? "bool" : NUM_KEYS.includes(k) ? "num" : "enum"
}
function asBool(v: unknown) {
    return v === true || v === "true"
}
function asNum(v: unknown): number | null {
    if (v === null || v === undefined || v === "") return null
    const n = Number(v)
    return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null
}
function asEnum<T extends string>(v: unknown, allowed: readonly T[], fallback: T): T {
    return allowed.includes(v as T) ? (v as T) : fallback
}
export function normalizeFeatures(raw: any, tierHint?: Tier): Features {
    const f = raw && typeof raw === "object" ? raw : {}
    const out: any = {}
    for (const k of FEATURE_ORDER) {
        const kind = kindOf(k)
        if (kind === "bool") out[k] = asBool(f[k])
        else if (kind === "num") out[k] = asNum(f[k])
        else if (k === "traffic_breakdown") out[k] = asEnum(f[k], ["none", "basic", "full"] as const, "none")
        else out[k] = asEnum(f[k], ["none", "quarterly", "monthly"] as const, "none")
    }
    const has = (k: string) => Object.prototype.hasOwnProperty.call(f, k)
    if (!has("reports_monthly")) {
        out.reports_monthly = tierHint !== "klarwerk"
        if (tierHint === "klarwerk") out.reports_quarterly = true
    }
    if (tierHint) {
        const d = SEO_TIER_DEFAULTS[tierHint]
        for (const k of Object.keys(d)) if (!has(k)) out[k] = !!(d as any)[k]
    }
    return out as Features
}
export function parseEntitlements(json: any): Entitlements | null {
    const j = Array.isArray(json) ? json[0] : json
    if (!j || typeof j !== "object" || !j.features) return null
    const tier: Tier = (["core", "klarwerk", "grundwerk", "kraftmarke", "meisterwerk"] as Tier[]).includes(j.tier) ? j.tier : "core"
    const role: ViewerRole = (["staff", "owner", "member", "service"] as ViewerRole[]).includes(j.viewer_role) ? j.viewer_role : "member"
    return { tier, features: normalizeFeatures(j.features), viewer_role: role }
}
export function featuresFor(entitlements: Entitlements | null, viewMode: ViewMode): Features {
    if (viewMode.staff && !viewMode.viewAs) return ALL_ON
    if (!entitlements) return ALL_ON
    return entitlements.features
}
export function roleFor(entitlements: Entitlements | null, viewMode: ViewMode, viewAsRole?: "owner" | "member" | null): ViewerRole {
    if (viewMode.staff && !viewMode.viewAs) return "staff"
    if (viewMode.staff && viewMode.viewAs) return viewAsRole || "owner"
    return entitlements ? entitlements.viewer_role : "owner"
}
export type Gate =
    | "ranks"
    | "breakdown"
    | "breakdown_full"
    | "leads"
    | "conversion"
    | "growth"
    | "quarterly"
    | "monthly"
    | "export"
    | "fresh_pull"
    | "ai_visibility"
    | "trends"
interface GateSpec {
    on: (f: Features) => boolean
    what: string
    are?: boolean
    min: Exclude<Tier, "core">
}
export const GATES: Record<Gate, GateSpec> = {
    ranks: { on: (f) => f.ranks, what: "Keyword rankings", are: true, min: "grundwerk" },
    breakdown: { on: (f) => f.traffic_breakdown !== "none", what: "Top pages and where visitors came from", are: true, min: "grundwerk" },
    breakdown_full: { on: (f) => f.traffic_breakdown === "full", what: "Devices and countries", are: true, min: "meisterwerk" },
    leads: { on: (f) => f.leads, what: "Lead inquiries", are: true, min: "grundwerk" },
    conversion: { on: (f) => f.conversion, what: "The visits to inquiry rate", min: "meisterwerk" },
    growth: { on: (f) => f.growth_plan, what: "Search growth opportunities", are: true, min: "grundwerk" },
    quarterly: { on: (f) => f.reports_quarterly, what: "Quarterly reports", are: true, min: "klarwerk" },
    monthly: { on: (f) => f.reports_monthly, what: "Monthly reports", are: true, min: "grundwerk" },
    export: { on: (f) => f.export, what: "CSV downloads", are: true, min: "meisterwerk" },
    fresh_pull: { on: (f) => f.fresh_pull, what: "A fresh data pull on Refresh", min: "meisterwerk" },
    ai_visibility: { on: (f) => f.ai_visibility !== "none", what: "AI visibility reports", are: true, min: "meisterwerk" },
    trends: { on: (f) => f.trend_reports, what: "Trend reports", are: true, min: "meisterwerk" },
}
export function allows(f: Features, gate: Gate): boolean {
    return GATES[gate].on(f)
}
export function minTier(gate: Gate, matrices?: Matrices | null): Exclude<Tier, "core"> {
    if (matrices) {
        const hit = SOLD_TIERS.find((t) => matrices[t] && GATES[gate].on(matrices[t] as Features))
        if (hit) return hit
    }
    return GATES[gate].min
}
function tierPhrase(t: Exclude<Tier, "core">) {
    return t === "meisterwerk" ? `part of ${TIER_LABEL[t]}` : `part of ${TIER_LABEL[t]} and up`
}
export function lockedText(gate: Gate, matrices?: Matrices | null): string {
    const g = GATES[gate]
    return `${g.what} ${g.are ? "are" : "is"} ${tierPhrase(minTier(gate, matrices))}.`
}
export function trafficMonthsText(f: Features, matrices?: Matrices | null): string | null {
    const n = f.traffic_months
    if (n === null) return null
    const more = (m: Features | undefined) => !!m && (m.traffic_months === null || m.traffic_months > n)
    let t: Exclude<Tier, "core"> | undefined = matrices ? SOLD_TIERS.find((x) => more(matrices[x])) : undefined
    if (!t) t = n < 12 ? "grundwerk" : "meisterwerk"
    return `Traffic history beyond ${n} ${n === 1 ? "month" : "months"} is ${tierPhrase(t)}.`
}
export function chipText(gate: Gate, matrices?: Matrices | null) {
    const t = minTier(gate, matrices)
    return t === "meisterwerk" ? TIER_LABEL[t] : `${TIER_LABEL[t]}+`
}
export function LockedLine({ gate, matrices, text }: { gate?: Gate; matrices?: Matrices | null; text?: string | null }) {
    if (LOCKED_MODE === "hide") return null
    const t = text ?? (gate ? lockedText(gate, matrices) : "")
    if (!t) return null
    return <p className="ncr-locked">{t}</p>
}
export function TierChip({ gate, matrices }: { gate: Gate; matrices?: Matrices | null }) {
    const label = chipText(gate, matrices)
    return (
        <span className="ncr-tier-chip" title="Not in this client's plan">
            <span aria-hidden="true">{label}</span>
            <span className="ncr-sr">Staff note: not in this client’s plan. {lockedText(gate, matrices)}</span>
        </span>
    )
}
export interface BreakdownRow {
    site_id: string
    month: string
    dimension: "page" | "source" | "device" | "country"
    value: string
    views: number
    visitors: number
}
function monthStart(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}
export function trafficFrom(f: Features, now = new Date()): string | null {
    if (f.traffic_months === null) return null
    const n = Math.max(1, f.traffic_months)
    return monthStart(new Date(now.getFullYear(), now.getMonth() - (n - 1), 1))
}
export function breakdownAllowed(rows: BreakdownRow[] | null, f: Features, now = new Date()): BreakdownRow[] | null {
    if (!rows) return rows
    if (f.traffic_breakdown === "none") return []
    const from = trafficFrom(f, now)
    return rows.filter(
        (r) => (f.traffic_breakdown === "full" || r.dimension === "page" || r.dimension === "source") && (!from || r.month >= from),
    )
}
export const READ_ONLY_MSG = "Read-only while viewing as client"
export function readOnlyBackend<B extends object>(b: B, writes: (keyof B)[]): B {
    const out: any = { ...b }
    for (const w of writes) if (typeof out[w] === "function") out[w] = () => Promise.reject(new Error(READ_ONLY_MSG))
    if ("inject" in out) out.inject = undefined
    return out as B
}
export function useSessionValue<T>(key: string, initial: T): [T, (v: T) => void] {
    const [v, setV] = useState<T>(initial)
    useEffect(() => {
        try {
            const raw = window.sessionStorage.getItem(key)
            if (raw !== null) setV(JSON.parse(raw))
        } catch (e) {}
    }, [key])
    const set = useCallback(
        (n: T) => {
            setV(n)
            try {
                if (n === initial || n === null || n === undefined) window.sessionStorage.removeItem(key)
                else window.sessionStorage.setItem(key, JSON.stringify(n))
            } catch (e) {}
        },
        [key],
    )
    return [v, set]
}
function EyeGlyph() {
    return (
        <svg
            width={18}
            height={18}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" />
            <circle cx="12" cy="12" r="3" />
        </svg>
    )
}
export function ViewAsToggle({ on, onChange }: { on: boolean; onChange: (on: boolean) => void }) {
    return (
        <button type="button" className={`ncr-viewas-btn${on ? " is-on" : ""}`} aria-pressed={on} onClick={() => onChange(!on)}>
            <EyeGlyph />
            <span className="ncr-viewas-btn-t">View as client</span>
        </button>
    )
}
export interface MemberRow {
    email: string
    role: "owner" | "member"
    last_sign_in_at: string | null
}
export function ViewAsBanner({
    client,
    tier,
    members,
    login,
    onLogin,
    onExit,
}: {
    client: string
    tier: Tier | null
    members: MemberRow[] | null
    login: string
    onLogin: (email: string) => void
    onExit: () => void
}) {
    const uid = useId()
    const tierName = tier ? TIER_LABEL[tier] : "tier unknown"
    return (
        <div className="ncr-viewas" role="region" aria-label="Viewing as client">
            <p className="ncr-viewas-t">
                <strong>
                    Viewing as {client} ({tierName})
                </strong>
                <span className="ncr-viewas-ro">Read-only</span>
            </p>
            <div className="ncr-viewas-end">
                {members && members.length ? (
                    <label className="ncr-viewas-login" htmlFor={`${uid}-login`}>
                        <span>Login</span>
                        <select id={`${uid}-login`} value={login} onChange={(e) => onLogin(e.target.value)}>
                            <option value="">Any owner</option>
                            {members.map((m) => (
                                <option key={m.email} value={m.email}>
                                    {m.email} ({m.role === "member" ? "Member" : "Owner"})
                                </option>
                            ))}
                        </select>
                    </label>
                ) : null}
                <span className="ncr-viewas-exitgrp">
                    <span aria-hidden="true" className="ncr-viewas-dot">
                        ·
                    </span>
                    <button type="button" className="ncr-viewas-exit" onClick={onExit}>
                        Exit<span className="ncr-sr"> view as client</span>
                    </button>
                </span>
            </div>
        </div>
    )
}
export function ReadOnlyNote() {
    return <p className="ncr-ro-note">{READ_ONLY_MSG}. Changes are switched off.</p>
}
export async function rpcCall<T = any>(url: string, key: string, fn: string, body: Record<string, unknown>): Promise<T> {
    const s = await liveSession(url, key)
    if (!s) throw new ReportsError("Your session has ended. Please sign in again.", 401)
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
    })
    if (!res.ok) {
        let msg = ""
        try {
            const j = await res.json()
            msg = (j && (j.message || j.error_description || j.error)) || ""
        } catch (e) {}
        throw new ReportsError(msg || `Request failed (${res.status})`, res.status)
    }
    const text = await res.text()
    return (text ? JSON.parse(text) : null) as T
}
export async function fetchMatrices(call: (t: Tier) => Promise<any>): Promise<Matrices | null> {
    try {
        const rows = await Promise.all(TIERS.map((t) => call(t)))
        const out: Matrices = {}
        TIERS.forEach((t, i) => {
            const r = Array.isArray(rows[i]) ? rows[i][0] : rows[i]
            if (r && typeof r === "object") out[t] = normalizeFeatures(r, t)
        })
        return Object.keys(out).length === TIERS.length ? out : null
    } catch (e) {
        return null
    }
}
export interface PermData {
    tier: Tier
    features: Features
    overrides: Record<string, any>
    tier_defaults: Features
    members: MemberRow[]
    log: {
        changed_at: string
        changed_by: string | null
        change: any
    }[]
}
export function parsePermData(json: any): PermData | null {
    const j = Array.isArray(json) ? json[0] : json
    if (!j || typeof j !== "object" || !j.tier_defaults) return null
    return {
        tier: (["core", "klarwerk", "grundwerk", "kraftmarke", "meisterwerk"] as Tier[]).includes(j.tier) ? j.tier : "core",
        features: normalizeFeatures(j.features),
        overrides: j.overrides && typeof j.overrides === "object" ? j.overrides : {},
        tier_defaults: normalizeFeatures(j.tier_defaults),
        members: Array.isArray(j.members)
            ? j.members.map((m: any) => ({
                  email: String(m.email || ""),
                  role: m.role === "member" ? "member" : "owner",
                  last_sign_in_at: m.last_sign_in_at || null,
              }))
            : [],
        log: Array.isArray(j.log) ? j.log.slice(0, 20) : [],
    }
}
export type Override =
    | {
          mode: "default"
      }
    | {
          mode: "set"
          value: any
      }
export type Draft = Partial<Record<FeatureKey, Override>>
export function draftFrom(overrides: Record<string, any>): Draft {
    const d: Draft = {}
    for (const k of FEATURE_ORDER)
        d[k] = Object.prototype.hasOwnProperty.call(overrides, k) ? { mode: "set", value: overrides[k] } : { mode: "default" }
    return d
}
export function buildPatch(overrides: Record<string, any>, draft: Draft): Record<string, any> {
    const patch: Record<string, any> = {}
    for (const k of FEATURE_ORDER) {
        const d = draft[k] || { mode: "default" }
        const had = Object.prototype.hasOwnProperty.call(overrides, k)
        if (d.mode === "default") {
            if (had) patch[k] = "__default"
        } else if (!had || JSON.stringify(overrides[k]) !== JSON.stringify(d.value)) {
            patch[k] = d.value
        }
    }
    return patch
}
export function draftError(k: FeatureKey, d: Override | undefined): string {
    if (!d || d.mode !== "set" || kindOf(k) !== "num" || d.value === null) return ""
    const n = Number(d.value)
    if (d.value === "" || !Number.isFinite(n) || n < 0 || Math.round(n) !== n) return "Enter a whole number, 0 or more, or tick Unlimited."
    return ""
}
export function formatValue(k: FeatureKey, v: any): string {
    const kind = kindOf(k)
    if (kind === "bool") return v ? "On" : "Off"
    if (kind === "num") return v === null || v === undefined ? "Unlimited" : String(v)
    const opt = (ENUM_OPTIONS[k] || []).find((o) => o.value === v)
    return opt ? opt.label : String(v ?? "None")
}
function changeSummary(change: any): string {
    if (!change || typeof change !== "object") return "Changed"
    if (change.member) return `${change.member} set to ${change.role === "member" ? "Member" : "Owner"}`
    const f = change.features && typeof change.features === "object" ? change.features : {}
    const parts = Object.keys(f).map((k) => {
        const label = FEATURE_LABEL[k as FeatureKey] || k
        return `${label}: ${f[k] === "__default" ? "back to default" : formatValue(k as FeatureKey, f[k])}`
    })
    return parts.length ? parts.join("; ") : "No change"
}
function when(iso: string | null) {
    if (!iso) return "Never"
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return ""
    return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}, ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
}
export interface PermApi {
    load: (cid: string) => Promise<PermData | null>
    save: (cid: string, patch: Record<string, any>) => Promise<unknown>
    setRole: (cid: string, email: string, role: "owner" | "member") => Promise<unknown>
}
export function PermissionsPanel({
    clientId,
    clientName,
    api,
    onViewAs,
    onChanged,
}: {
    clientId: string
    clientName: string
    api: PermApi
    onViewAs: () => void
    onChanged: () => void
}) {
    const uid = useId()
    const [state, setState] = useState<{
        status: "loading" | "ready" | "error"
        data: PermData | null
        error: string
    }>({ status: "loading", data: null, error: "" })
    const [draft, setDraft] = useState<Draft>({})
    const [busy, setBusy] = useState(false)
    const [toast, setToast] = useState<{
        ok: boolean
        text: string
    } | null>(null)
    const [roleMsg, setRoleMsg] = useState("")
    const [attempt, setAttempt] = useState(0)
    useEffect(() => {
        let cancelled = false
        setState({ status: "loading", data: null, error: "" })
        api.load(clientId)
            .then((d) => {
                if (cancelled) return
                if (!d) {
                    setState({ status: "error", data: null, error: "The permissions answer was empty." })
                    return
                }
                setState({ status: "ready", data: d, error: "" })
                setDraft(draftFrom(d.overrides))
            })
            .catch((e: any) => {
                if (!cancelled) setState({ status: "error", data: null, error: String((e && e.message) || "Request failed") })
            })
        return () => {
            cancelled = true
        }
    }, [clientId, attempt])
    const data = state.data
    const patch = useMemo(() => (data ? buildPatch(data.overrides, draft) : {}), [data, draft])
    const changed = Object.keys(patch).length
    const errors = useMemo(() => {
        const out: Partial<Record<FeatureKey, string>> = {}
        for (const k of FEATURE_ORDER) {
            const m = draftError(k, draft[k])
            if (m) out[k] = m
        }
        return out
    }, [draft])
    const setKey = (k: FeatureKey, o: Override) => {
        setToast(null)
        setDraft((d) => ({ ...d, [k]: o }))
    }
    const save = async () => {
        if (!data || busy || !changed) return
        const bad = FEATURE_ORDER.find((k) => errors[k])
        if (bad) {
            const el = document.getElementById(`${uid}-n-${bad}`) as HTMLInputElement | null
            el?.focus()
            setToast({ ok: false, text: `Not saved: ${FEATURE_LABEL[bad]}. ${errors[bad]}` })
            return
        }
        setBusy(true)
        setToast(null)
        try {
            const body: Record<string, any> = {}
            Object.keys(patch).forEach((k) => {
                const v = patch[k]
                body[k] = kindOf(k as FeatureKey) === "num" && v !== null && v !== "__default" ? Number(v) : v
            })
            await api.save(clientId, body)
            setToast({ ok: true, text: `Saved ${changed} ${changed === 1 ? "change" : "changes"} for ${clientName}.` })
            setAttempt((a) => a + 1)
            onChanged()
        } catch (e: any) {
            setToast({ ok: false, text: `That did not save, so nothing changed. ${String((e && e.message) || "")}`.trim() })
        } finally {
            setBusy(false)
        }
    }
    const changeRole = async (email: string, role: "owner" | "member") => {
        setRoleMsg("")
        try {
            await api.setRole(clientId, email, role)
            setRoleMsg(`${email} is now ${role === "member" ? "a member" : "an owner"}.`)
            setAttempt((a) => a + 1)
            onChanged()
        } catch (e: any) {
            setRoleMsg(`That did not save. ${String((e && e.message) || "")}`.trim())
        }
    }
    if (state.status === "loading") {
        return (
            <div className="ncr-loading" role="status">
                <span className="ncr-spinner" aria-hidden="true" />
                Loading permissions…
            </div>
        )
    }
    if (state.status === "error" || !data) {
        return (
            <div className="ncr-card ncr-panel">
                <p className="ncr-h3">The permissions could not be loaded.</p>
                <p className="ncr-small">
                    The panel needs the tier migration (migrations_2026-11-04_tier_entitlements.sql) to have run. Nothing was changed.{" "}
                    {state.error ? `(${state.error})` : ""}
                </p>
                <div className="ncr-problem-action">
                    <button type="button" className="ncr-btn" onClick={() => setAttempt((a) => a + 1)}>
                        Try again
                    </button>
                </div>
            </div>
        )
    }
    const groups: {
        title: string
        keys: FeatureKey[]
    }[] = [
        { title: "Features", keys: FEATURE_ORDER.filter((k) => !NOT_BUILT.has(k)) },
        { title: "Not built yet (saved, not shown)", keys: FEATURE_ORDER.filter((k) => NOT_BUILT.has(k)) },
    ]
    const control = (k: FeatureKey) => {
        const d = draft[k] || { mode: "default" }
        const label = FEATURE_LABEL[k]
        const kind = kindOf(k)
        if (kind === "bool") {
            const v = d.mode === "default" ? "default" : d.value ? "on" : "off"
            return (
                <select
                    className="ncr-select ncr-perm-select"
                    aria-label={`${label}: override`}
                    value={v}
                    onChange={(e) =>
                        setKey(k, e.target.value === "default" ? { mode: "default" } : { mode: "set", value: e.target.value === "on" })
                    }
                >
                    <option value="default">Default</option>
                    <option value="on">On</option>
                    <option value="off">Off</option>
                </select>
            )
        }
        if (kind === "enum") {
            const v = d.mode === "default" ? "__default" : String(d.value)
            return (
                <select
                    className="ncr-select ncr-perm-select"
                    aria-label={`${label}: override`}
                    value={v}
                    onChange={(e) =>
                        setKey(k, e.target.value === "__default" ? { mode: "default" } : { mode: "set", value: e.target.value })
                    }
                >
                    <option value="__default">Default</option>
                    {(ENUM_OPTIONS[k] || []).map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            )
        }
        const custom = d.mode === "set"
        const unlimited = custom && d.value === null
        const err = errors[k]
        return (
            <div className="ncr-perm-num">
                <select
                    className="ncr-select ncr-perm-select"
                    aria-label={`${label}: override`}
                    value={custom ? "set" : "default"}
                    onChange={(e) =>
                        setKey(
                            k,
                            e.target.value === "default" ? { mode: "default" } : { mode: "set", value: data.tier_defaults[k] ?? null },
                        )
                    }
                >
                    <option value="default">Default</option>
                    <option value="set">Custom</option>
                </select>
                {custom ? (
                    <div className="ncr-perm-num-row">
                        <input
                            id={`${uid}-n-${k}`}
                            className="ncr-input ncr-perm-input"
                            type="number"
                            inputMode="numeric"
                            min={0}
                            step={1}
                            aria-label={`${label}: number`}
                            aria-invalid={err ? true : undefined}
                            aria-describedby={err ? `${uid}-e-${k}` : undefined}
                            disabled={unlimited}
                            value={unlimited ? "" : String(d.value ?? "")}
                            onChange={(e) => setKey(k, { mode: "set", value: e.target.value === "" ? "" : e.target.value })}
                        />
                        <label className="ncr-perm-check">
                            <input
                                type="checkbox"
                                checked={unlimited}
                                onChange={(e) => setKey(k, { mode: "set", value: e.target.checked ? null : (data.tier_defaults[k] ?? 0) })}
                            />
                            <span>Unlimited</span>
                        </label>
                        {err ? (
                            <span id={`${uid}-e-${k}`} className="ncr-perm-err">
                                {err}
                            </span>
                        ) : null}
                    </div>
                ) : null}
            </div>
        )
    }
    const effective = (k: FeatureKey) => {
        const d = draft[k] || { mode: "default" }
        return d.mode === "set" ? d.value : data.tier_defaults[k]
    }
    return (
        <div className="ncr-perm">
            <section className="ncr-card ncr-panel" aria-labelledby={`${uid}-h`}>
                <div className="ncr-panel-head">
                    <h2 id={`${uid}-h`} className="ncr-h2">
                        {clientName}
                    </h2>
                    <button type="button" className="ncr-btn ncr-btn-quiet" onClick={onViewAs}>
                        View as this client
                    </button>
                </div>
                <p className="ncr-small ncr-muted">
                    Tier <strong className="ncr-strong">{TIER_LABEL[data.tier]}</strong>, from the client’s active plan. Change the plan to
                    change the tier. Overrides below win over the tier and are logged.
                </p>
                <div className="ncr-table-wrap" role="region" aria-label="Feature permissions" tabIndex={0}>
                    <table className="ncr-table ncr-perm-table">
                        <thead>
                            <tr>
                                <th scope="col">Feature</th>
                                <th scope="col">Tier default</th>
                                <th scope="col">Override</th>
                                <th scope="col">Effective</th>
                            </tr>
                        </thead>
                        {groups.map((g) => (
                            <tbody key={g.title}>
                                <tr className="ncr-perm-group">
                                    <th scope="colgroup" colSpan={4}>
                                        {g.title}
                                    </th>
                                </tr>
                                {g.keys.map((k) => {
                                    const isChanged = Object.prototype.hasOwnProperty.call(patch, k)
                                    return (
                                        <tr key={k} className={isChanged ? "is-changed" : undefined}>
                                            <th scope="row">
                                                {FEATURE_LABEL[k]}
                                                {isChanged ? <span className="ncr-perm-dirty"> (unsaved)</span> : null}
                                            </th>
                                            <td>{formatValue(k, data.tier_defaults[k])}</td>
                                            <td>{control(k)}</td>
                                            <td className="ncr-strong">{formatValue(k, effective(k))}</td>
                                        </tr>
                                    )
                                })}
                            </tbody>
                        ))}
                    </table>
                </div>
                <div className="ncr-perm-actions">
                    <button type="button" className="ncr-btn" onClick={save} disabled={busy || !changed} aria-describedby={`${uid}-toast`}>
                        {busy ? <span className="ncr-spinner ncr-spinner-sm" aria-hidden="true" /> : null}
                        {busy ? "Saving…" : changed ? `Save ${changed} ${changed === 1 ? "change" : "changes"}` : "Save changes"}
                    </button>
                    {changed ? (
                        <button type="button" className="ncr-textbtn" onClick={() => setDraft(draftFrom(data.overrides))} disabled={busy}>
                            Discard changes
                        </button>
                    ) : null}
                </div>
                <p
                    id={`${uid}-toast`}
                    className={`ncr-perm-toast${toast ? (toast.ok ? " is-ok" : " is-bad") : ""}`}
                    role="status"
                    aria-live="polite"
                >
                    {toast ? toast.text : ""}
                </p>
            </section>

            <section className="ncr-card ncr-panel" aria-labelledby={`${uid}-m`}>
                <h2 id={`${uid}-m`} className="ncr-h2">
                    Logins
                </h2>
                <p className="ncr-small ncr-muted">
                    Owners see everything the tier allows. Members see the same, without the plan, billing and login management.
                </p>
                {data.members.length ? (
                    <ul className="ncr-perm-members" role="list">
                        {data.members.map((m) => (
                            <li key={m.email}>
                                <span className="ncr-perm-member">
                                    <span className="ncr-strong ncr-clamp-any">{m.email}</span>
                                    <span className="ncr-small ncr-muted">
                                        {m.last_sign_in_at ? `Last signed in ${when(m.last_sign_in_at)}` : "Has not signed in yet"}
                                    </span>
                                </span>
                                <select
                                    className="ncr-select ncr-perm-select"
                                    aria-label={`Role for ${m.email}`}
                                    value={m.role}
                                    onChange={(e) => changeRole(m.email, e.target.value === "member" ? "member" : "owner")}
                                >
                                    <option value="owner">Owner</option>
                                    <option value="member">Member</option>
                                </select>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="ncr-small">No logins are linked to this client yet.</p>
                )}
                <p className="ncr-small" role="status" aria-live="polite">
                    {roleMsg}
                </p>
            </section>

            <section className="ncr-card ncr-panel" aria-labelledby={`${uid}-l`}>
                <h2 id={`${uid}-l`} className="ncr-h2">
                    Recent changes
                </h2>
                {data.log.length ? (
                    <ol className="ncr-perm-log" role="list">
                        {data.log.map((x, i) => (
                            <li key={`${x.changed_at}-${i}`}>
                                <span className="ncr-small ncr-muted">
                                    {when(x.changed_at)}
                                    {x.changed_by ? `, ${x.changed_by}` : ""}
                                </span>
                                <span className="ncr-small">{changeSummary(x.change)}</span>
                            </li>
                        ))}
                    </ol>
                ) : (
                    <p className="ncr-small">No changes yet. This client sees exactly what the tier includes.</p>
                )}
            </section>
        </div>
    )
}
export function DemoTierPicker({ value, onChange, ready }: { value: Tier | ""; onChange: (t: Tier | "") => void; ready: boolean }) {
    const uid = useId()
    return (
        <span className="ncr-tierpick">
            <label className="ncr-field-label ncr-tierpick-l" htmlFor={`${uid}-t`}>
                <span>Preview tier</span>
                <select
                    id={`${uid}-t`}
                    className="ncr-select"
                    value={value}
                    disabled={!ready}
                    aria-describedby={ready ? undefined : `${uid}-n`}
                    onChange={(e) => onChange((e.target.value || "") as Tier | "")}
                >
                    <option value="">Everything</option>
                    {SOLD_TIERS.map((t) => (
                        <option key={t} value={t}>
                            {TIER_LABEL[t]}
                        </option>
                    ))}
                </select>
            </label>
            {ready ? null : (
                <span id={`${uid}-n`} className="ncr-small ncr-muted">
                    Needs the tier migration
                </span>
            )}
        </span>
    )
}
const DIM_TITLE: Record<BreakdownRow["dimension"], string> = {
    page: "Top pages",
    source: "Where visitors came from",
    device: "Devices",
    country: "Countries",
}
const TOP_N = 8
function BreakdownList({ dim, rows }: { dim: BreakdownRow["dimension"]; rows: BreakdownRow[] }) {
    const uid = useId()
    const sorted = rows.slice().sort((a, b) => b.visitors - a.visitors || b.views - a.views || a.value.localeCompare(b.value))
    const max = Math.max(1, ...sorted.map((r) => r.visitors))
    const item = (r: BreakdownRow) => (
        <li key={r.value} className="ncr-bd-row">
            <span className="ncr-bd-name" title={r.value}>
                {r.value}
            </span>
            <span className="ncr-bd-bar" aria-hidden="true">
                <span style={{ width: `${Math.max(2, (r.visitors / max) * 100)}%` }} />
            </span>
            <span className="ncr-bd-num">
                <strong>{r.visitors.toLocaleString("en-US")}</strong>
                <span className="ncr-sr"> visitors, </span>
                <span className="ncr-bd-views">
                    {r.views.toLocaleString("en-US")} {r.views === 1 ? "view" : "views"}
                </span>
            </span>
        </li>
    )
    return (
        <section className="ncr-bd-tile" aria-labelledby={`${uid}-h`}>
            <h3 id={`${uid}-h`} className="ncr-h3">
                {DIM_TITLE[dim]}
            </h3>
            {sorted.length ? (
                <>
                    <ol className="ncr-bd-list" role="list">
                        {sorted.slice(0, TOP_N).map(item)}
                    </ol>
                    {sorted.length > TOP_N ? (
                        <details className="ncr-details ncr-bd-more">
                            <summary>Show {sorted.length - TOP_N} more</summary>
                            <ol className="ncr-bd-list" role="list" start={TOP_N + 1}>
                                {sorted.slice(TOP_N).map(item)}
                            </ol>
                        </details>
                    ) : null}
                </>
            ) : (
                <p className="ncr-small ncr-muted">Nothing recorded for this month.</p>
            )}
        </section>
    )
}
export function BreakdownTiles({
    rows,
    month,
    monthLabel,
    dims,
}: {
    rows: BreakdownRow[]
    month: string
    monthLabel: string
    dims: BreakdownRow["dimension"][]
}) {
    const inMonth = rows.filter((r) => r.month === month)
    if (!inMonth.length) return <p className="ncr-small ncr-muted">No breakdown was recorded for {monthLabel} yet.</p>
    return (
        <div className={`ncr-bd-grid${dims.length > 2 ? " is-four" : ""}`}>
            {dims.map((d) => (
                <BreakdownList key={d} dim={d} rows={inMonth.filter((r) => r.dimension === d)} />
            ))}
        </div>
    )
}
export function csvCell(v: string | number | null | undefined): string {
    if (v === null || v === undefined) return ""
    let s = String(v)
    if (typeof v === "string" && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
    if (/[",\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`
    return s
}
export function buildCsv(header: string[], rows: (string | number | null | undefined)[][]): string {
    return [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n"
}
export function CsvButton({
    make,
}: {
    make: () => {
        name: string
        text: string
    }
}) {
    const [msg, setMsg] = useState("")
    const uid = useId()
    const go = () => {
        try {
            const { name, text } = make()
            const href = URL.createObjectURL(new Blob(["﻿" + text], { type: "text/csv;charset=utf-8" }))
            const a = document.createElement("a")
            a.href = href
            a.download = name
            a.rel = "noopener"
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.setTimeout(() => URL.revokeObjectURL(href), 4000)
            setMsg("Your CSV is downloading.")
        } catch (e) {
            setMsg("We couldn’t build the CSV just now. Please try again.")
        }
    }
    return (
        <span className="ncr-csv">
            <button type="button" className="ncr-textbtn" onClick={go} aria-describedby={`${uid}-m`}>
                Download CSV
            </button>
            <span id={`${uid}-m`} className="ncr-sr" role="status" aria-live="polite">
                {msg}
            </span>
        </span>
    )
}
function hash(s: string) {
    let h = 2166136261
    for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
    return (h >>> 0) / 4294967295
}
const DEMO_SHARE: Record<BreakdownRow["dimension"], [string, number][]> = {
    page: [
        ["/", 0.38],
        ["/services", 0.17],
        ["/about", 0.1],
        ["/contact", 0.09],
        ["/gallery", 0.08],
        ["/faq", 0.06],
        ["/blog/spring-checklist", 0.05],
        ["/reviews", 0.04],
        ["/blog/first-visit", 0.02],
        ["/privacy", 0.01],
    ],
    source: [
        ["Google", 0.46],
        ["Direct or bookmarked", 0.24],
        ["Facebook", 0.09],
        ["Instagram", 0.07],
        ["Bing", 0.05],
        ["Google Maps", 0.04],
        ["Yelp", 0.03],
        ["DuckDuckGo", 0.02],
    ],
    device: [
        ["Mobile", 0.64],
        ["Desktop", 0.31],
        ["Tablet", 0.05],
    ],
    country: [
        ["United States", 0.91],
        ["Canada", 0.04],
        ["United Kingdom", 0.02],
        ["Germany", 0.01],
        ["India", 0.01],
        ["Mexico", 0.01],
    ],
}
export function demoBreakdown(
    siteId: string,
    traffic: {
        month: string
        visits: any
        unique_visitors: any
    }[],
): BreakdownRow[] {
    const out: BreakdownRow[] = []
    traffic.forEach((t) => {
        const visitors = Number(t.unique_visitors) || 0
        const views = Number(t.visits) || 0
        if (!visitors) return
        ;(Object.keys(DEMO_SHARE) as BreakdownRow["dimension"][]).forEach((dim) => {
            DEMO_SHARE[dim].forEach(([value, share]) => {
                const j = 0.85 + hash(`${siteId}${t.month}${dim}${value}`) * 0.3
                const v = Math.max(1, Math.round(visitors * share * j))
                const pv = dim === "page" ? Math.max(v, Math.round(views * share * j)) : Math.max(v, Math.round(views * share * j * 1.02))
                out.push({ site_id: siteId, month: t.month, dimension: dim, value, visitors: v, views: pv })
            })
        })
    })
    return out
}
export function demoInquiries(
    siteId: string,
    traffic: {
        month: string
        visits: any
    }[],
): Record<string, number> {
    const out: Record<string, number> = {}
    traffic.forEach((t) => {
        const v = Number(t.visits) || 0
        out[t.month] = Math.round(v * (0.009 + hash(`${siteId}${t.month}inq`) * 0.008))
    })
    return out
}
export const TIERS_CSS = [
    ".ncr-locked{margin:4px 0 0;padding:12px 2px;font-size:13.5px;line-height:1.45;color:var(--ncr-muted)}",
    ".ncr-tier-chip{display:inline-flex;align-items:center;height:22px;padding:0 9px;margin-left:8px;border-radius:999px;font-size:11.5px;font-weight:600;letter-spacing:0.02em;color:var(--ncr-muted);background:var(--ncr-surface-2);box-shadow:inset 0 0 0 1px var(--ncr-border);vertical-align:middle;white-space:nowrap}",
    ".ncr-staffnote{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin:0 0 4px;font-size:13px;color:var(--ncr-muted)}",
    ".ncr-staffnote .ncr-tier-chip{margin-left:0}",
    ".ncr-viewas-btn{display:inline-flex;align-items:center;gap:8px;height:52px;padding:0 18px;border:0;border-radius:999px;background:var(--ncr-surface);color:var(--ncr-ink);font-family:inherit;font-size:14px;font-weight:500;line-height:1;cursor:pointer;box-shadow:var(--ncr-v2-pill-shadow,none);white-space:nowrap;transition:background-color 180ms ease,color 180ms ease,transform 100ms ease-out;-webkit-tap-highlight-color:transparent}",
    ".ncr-viewas-btn:hover{background:var(--ncr-surface-2)}",
    ".ncr-viewas-btn:active{transform:scale(0.97)}",
    ".ncr-viewas-btn.is-on{background:#8b3dff;color:#ffffff}",
    ".ncr-viewas-btn.is-on:hover{background:#7a2ee6;color:#ffffff}",
    ".ncr-export-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap}",
    ".ncr-viewas-btn:focus-visible{outline:2px solid var(--ncr-accent);outline-offset:2px}",
    ".ncr-viewas{display:flex;align-items:center;justify-content:space-between;gap:10px 16px;flex-wrap:wrap;margin:0 var(--ncr-inset,16px) 12px;padding:10px 12px 10px 18px;border-radius:16px;background:#8b3dff;color:#ffffff;font-size:14px;line-height:1.35}",
    ".ncr-viewas-t{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin:0;min-width:0}",
    ".ncr-viewas-t strong{font-weight:600;overflow-wrap:anywhere}",
    ".ncr-viewas-exitgrp{display:inline-flex;align-items:center;gap:10px;white-space:nowrap}",
    ".ncr-viewas-ro{display:inline-flex;align-items:center;height:22px;padding:0 9px;border-radius:999px;font-size:12px;font-weight:600;box-shadow:inset 0 0 0 1px rgba(255,255,255,0.7)}",
    ".ncr-viewas-end{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
    ".ncr-viewas-login{display:flex;align-items:center;gap:8px;font-weight:500}",
    ".ncr-viewas-login select{min-height:44px;max-width:min(320px,70vw);padding:0 12px;border-radius:999px;border:0;background:#ffffff;color:#16181c;font-family:inherit;font-size:14px;font-weight:500}",
    ".ncr-viewas-exit{min-height:44px;min-width:44px;padding:0 16px;border:0;border-radius:999px;background:#ffffff;color:#5b1fc7;font-family:inherit;font-size:14px;font-weight:600;line-height:1;cursor:pointer;transition:background-color 180ms ease}",
    ".ncr-viewas-exit:hover{background:#f1eaff}",
    ".ncr-viewas :focus-visible{outline:2px solid #ffffff;outline-offset:2px}",
    ".ncr-ro-note{margin:0 0 12px;font-size:13px;color:var(--ncr-muted)}",
    ".ncr-ro-wrap button:disabled,.ncr-ro-wrap select:disabled,.ncr-ro-wrap input:disabled,.ncr-ro-wrap textarea:disabled{cursor:not-allowed}",
    "@media (max-width: 1023.98px){.ncr-viewas-btn{height:48px;padding:0 14px}}",
    "@media (max-width: 599.98px){.ncr-viewas-btn{width:48px;padding:0;justify-content:center}.ncr-viewas-btn-t{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}.ncr-viewas{padding:10px 12px}.ncr-viewas-dot{display:none}}",
    ".ncr-perm{display:flex;flex-direction:column;gap:20px}",
    ".ncr-perm .ncr-panel-head{align-items:center}",
    ".ncr-perm-table th[scope=row]{font-weight:500}",
    ".ncr-perm-table td,.ncr-perm-table th{vertical-align:middle}",
    ".ncr-perm-group th{padding-top:18px;font-size:12.5px;font-weight:600;letter-spacing:0.02em;color:var(--ncr-muted);text-align:left}",
    ".ncr-perm-table tr.is-changed th[scope=row]{color:var(--ncr-accent-text)}",
    ".ncr-perm-dirty{font-size:12px;font-weight:500}",
    ".ncr-perm-select{width:240px;max-width:100%;min-height:44px}",
    ".ncr-perm-num{display:flex;flex-direction:column;gap:8px}",
    ".ncr-perm-num-row{display:flex;align-items:center;gap:10px;flex-wrap:wrap}",
    ".ncr-perm-input{width:96px;min-height:44px}",
    ".ncr-perm-check{display:inline-flex;align-items:center;gap:8px;min-height:44px;font-size:14px;cursor:pointer}",
    ".ncr-perm-check input{width:20px;height:20px;accent-color:var(--ncr-accent)}",
    ".ncr-perm-err{flex-basis:100%;font-size:13px;color:var(--ncr-bad)}",
    ".ncr-perm-actions{display:flex;align-items:center;gap:16px;flex-wrap:wrap;margin-top:16px}",
    ".ncr-perm-actions .ncr-btn:disabled{opacity:0.55;cursor:not-allowed}",
    ".ncr-perm-toast{min-height:20px;margin:10px 0 0;font-size:14px;color:var(--ncr-body)}",
    ".ncr-perm-toast.is-ok{color:var(--ncr-good)}",
    ".ncr-perm-toast.is-bad{color:var(--ncr-bad)}",
    ".ncr-perm-members,.ncr-perm-log{list-style:none;margin:12px 0 0;padding:0;display:flex;flex-direction:column}",
    ".ncr-perm-members li{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 0;border-top:1px solid var(--ncr-border)}",
    ".ncr-perm-member{display:flex;flex-direction:column;gap:2px;min-width:0}",
    ".ncr-perm-log li{display:flex;flex-direction:column;gap:2px;padding:10px 0;border-top:1px solid var(--ncr-border)}",
    ".ncr-tierpick{display:inline-flex;align-items:center;gap:8px;flex-wrap:wrap}",
    ".ncr-tierpick-l{flex-direction:row!important;align-items:center;gap:8px}",
    ".ncr-tierpick .ncr-select{width:auto;min-width:160px}",
    ".ncr-bd-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px 28px;margin-top:14px}",
    ".ncr-bd-tile{min-width:0}",
    ".ncr-bd-tile .ncr-h3{margin:0 0 8px}",
    ".ncr-bd-list{list-style:none;margin:0;padding:0;display:flex;flex-direction:column}",
    ".ncr-bd-row{display:grid;grid-template-columns:minmax(0,1fr) minmax(48px,30%) 84px;align-items:center;gap:12px;padding:7px 0;border-top:1px solid var(--ncr-border);font-size:14px}",
    ".ncr-bd-name{overflow:hidden;text-overflow:ellipsis;white-space:nowrap;color:var(--ncr-ink)}",
    ".ncr-bd-bar{height:6px;border-radius:999px;background:var(--ncr-surface-2);overflow:hidden}",
    ".ncr-bd-bar span{display:block;height:100%;border-radius:999px;background:var(--ncr-accent)}",
    ".ncr-bd-num{display:flex;flex-direction:column;align-items:flex-end;font-variant-numeric:tabular-nums;line-height:1.2}",
    ".ncr-bd-num strong{font-weight:600;color:var(--ncr-ink)}",
    ".ncr-bd-views{font-size:12px;color:var(--ncr-muted)}",
    ".ncr-bd-more summary{margin-top:6px}",
    ".ncr-conv{display:flex;align-items:baseline;gap:10px;flex-wrap:wrap}",
    ".ncr-csv{display:inline-flex}",
    "@media (max-width: 719.98px){.ncr-bd-grid{grid-template-columns:minmax(0,1fr)}.ncr-perm-members li{flex-wrap:wrap}}",
    "@media (prefers-reduced-motion: reduce){.ncr-viewas-btn,.ncr-viewas-exit{transition:none}.ncr-viewas-btn:active{transform:none}}",
].join("\n")
