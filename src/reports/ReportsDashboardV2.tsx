import { addPropertyControls, ControlType, useIsStaticRenderer } from "framer"
import { motion, AnimatePresence, useReducedMotion } from "framer-motion"
import {
    createContext,
    startTransition,
    useCallback,
    useContext,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
    type CSSProperties,
    type ReactNode,
    type PointerEvent as RPointerEvent,
    type KeyboardEvent as RKeyboardEvent,
    type FocusEvent as RFocusEvent,
    type FormEvent,
    type RefObject,
} from "react"
import {
    useNcTheme,
    authGet,
    liveSession,
    signOutRemote,
    cleanUrl,
    ReportsError,
    writeSession,
    readSession,
    FONT_CSS,
    THEME_CSS,
    F_HEAD,
    F_BODY,
    F_MONO,
} from "./ReportsShared.tsx"
import {
    buildDemo,
    type ClientRow,
    type SiteRow,
    type ScoreRow,
    type TrafficRow,
    type UptimeRow,
    type RankRow,
    type SnapshotRow,
    type RecRow,
    type WorkRow,
    type CheckRow,
    type PingRow,
    type PlanRow,
    type SiteMetaRow,
    type EventRow,
    type LoginRow,
} from "./ReportsDemoData.tsx"
import { buildReportPdf } from "./ReportsPdf.tsx"
import {
    buildPeriods,
    monthPeriod,
    isoDay,
    headlineMove,
    buildReport,
    buildMilestoneText,
    pickAnchor,
    healthPair,
    trafficChange,
    moveText,
    moveTone,
    posText,
    scoreText,
    fmtPct,
    ENGINE_NAMES,
    PILLAR_ROWS,
    CATEGORY_NAMES,
    type MsSnap,
    type MsRankRow,
    type MsRec,
    type MsSource,
    type MsReport,
    type Period,
    type Move,
} from "./ReportsMilestones.tsx"
import Nordy, { type NordyTourView, type NordyTourAction } from "./NordyWidget.tsx"
import { useDashboardRefresh, RefreshControl, REFRESH_CSS, type RefreshRow } from "./ReportsRefresh.tsx"
import {
    featuresFor,
    roleFor,
    parseEntitlements,
    parsePermData,
    fetchMatrices,
    rpcCall,
    breakdownAllowed,
    trafficFrom,
    allows,
    trafficMonthsText,
    readOnlyBackend,
    useSessionValue,
    buildCsv,
    demoBreakdown,
    demoInquiries,
    LockedLine,
    TierChip,
    ViewAsToggle,
    ViewAsBanner,
    ReadOnlyNote,
    PermissionsPanel,
    DemoTierPicker,
    BreakdownTiles,
    CsvButton,
    READ_ONLY_MSG,
    TIERS_CSS,
    type Entitlements,
    type Features,
    type Matrices,
    type Gate,
    type Tier,
    type BreakdownRow,
    type MemberRow,
    type PermApi,
} from "./ReportsTiers.tsx"
import {
    normalizeAiv,
    aivMonths,
    aivScore,
    aivByEngine,
    aivQuestions,
    ordinal,
    compareMonths,
    changeWords,
    whatChanged,
    demoAiVisibility,
    MEISTER_CSS,
    type AivRow,
    type AivQuestion,
    type TrendMetric,
    type TrendCompare,
    type TrendKind,
} from "./ReportsMeister.tsx"
import { SeoSections, seoAny, SEO_CSS } from "./ReportsSeo.tsx"
import {
    JagerScreen,
    liveJagerBackend,
    demoJagerBackend,
    liveProspectBackend,
    demoProspectBackend,
    liveCollectedBackend,
    demoCollectedBackend,
} from "./JagerDesk.tsx"
interface Props {
    supabaseUrl: string
    supabaseKey: string
    signInPath: string
    demoMode: boolean
    contactPath: string
    plansPath: string
    aboutPath: string
    portalUrl: string
    jagerPreview?: boolean
    style?: CSSProperties
}
interface StaffSiteRow {
    id: string
    client: string
    domain: string
    score: number | null
    grade: string | null
    scoreMonth: string | null
    uptime: number | null
    lastChecked: string | null
    flags: string[]
}
type SearchScope = "core" | "search"
const SEARCH_PLANS = /grundwerk|kraftmarke|meisterwerk|kraft|glanz/i
function searchScopeOf(
    plans: {
        name: string
        kind: string
        starts_on: string | null
        ends_on: string | null
    }[],
    today: string,
): SearchScope {
    const active = plans.filter(
        (p) => p.kind === "subscription" && (!p.starts_on || p.starts_on <= today) && (!p.ends_on || p.ends_on >= today),
    )
    return active.some((p) => SEARCH_PLANS.test(p.name)) ? "search" : "core"
}
const isGrowthRec = (r: RecRow) => r.pillar === "found" && r.kind !== "fix"
interface SiteData {
    scores: ScoreRow[]
    traffic: TrafficRow[]
    uptime: UptimeRow[]
    ranks: RankRow[]
    snapshots: SnapshotRow[]
    recs: RecRow[]
    work: WorkRow[]
    checks: CheckRow[]
    pings: PingRow[]
    searchScope: SearchScope
    hiddenRecs: number
    planScope?: SearchScope
    breakdown?: BreakdownRow[] | null
    leadsByMonth?: Record<string, number> | null
    aiv?: AivRow[] | null
}
type SectionId =
    "overview" | "health" | "traffic" | "search" | "uptime" | "work" | "plan" | "reports" | "account" | "sites" | "jager" | "permissions"
const PORTAL_URL = "https://www.portal.nordmeyercreative.com"
const ACCOUNT_SECTION: {
    id: SectionId
    label: string
} = { id: "account", label: "My account" }
const SECTIONS: {
    id: SectionId
    label: string
}[] = [
    { id: "overview", label: "Overview" },
    { id: "health", label: "Health" },
    { id: "traffic", label: "Traffic" },
    { id: "search", label: "Search" },
    { id: "uptime", label: "Uptime" },
    { id: "work", label: "Work log" },
    { id: "plan", label: "Plan" },
    { id: "reports", label: "Reports" },
]
const STAFF_SECTION: {
    id: SectionId
    label: string
} = { id: "sites", label: "All sites" }
const JAGER_SECTION: {
    id: SectionId
    label: string
} = { id: "jager", label: "Jager" }
const JAGER_ADMIN_EMAIL = ""
const JAGER_SITE_ID = ""
const JAGER_PLAN_GATE = true
const PERMISSIONS_SECTION: {
    id: SectionId
    label: string
} = { id: "permissions", label: "Permissions" }
const ALL_SECTIONS = [STAFF_SECTION, ...SECTIONS, JAGER_SECTION, PERMISSIONS_SECTION, ACCOUNT_SECTION]
const TAGLINES: Record<SectionId, string> = {
    overview: "",
    health: "Six pillars, one score. Where the site is strong and what we are fixing.",
    traffic: "Visits and unique visitors, month by month, for the last year.",
    search: "Where the site shows up for the searches that matter.",
    uptime: "Whether the site was reachable, checked every five minutes.",
    work: "Everything we did on the site, month by month.",
    plan: "What comes next, in priority order, and why it matters.",
    reports: "Monthly, quarterly and annual report cards, each with a PDF.",
    account: "Your plan, your sign-in details, and the client portal.",
    sites: "Every site we look after, on one page.",
    jager: "Not included in the public build.",
    permissions: "What this client can see: the tier from their plan, plus any overrides. Staff only.",
}
interface PartSpec {
    key: string
    label: string
    keep?: string[]
    rows?: {
        row: string
        match?: string
        exclude?: string
        text?: {
            in: string
            is: string
        }
        empty?: string
    }
    report?: "month" | "quarter" | "year"
}
const PART_TABS: Record<string, PartSpec[]> = {
    overview: [
        { key: "health", label: "Health", keep: [".ncr-overview-top"] },
        { key: "numbers", label: "Numbers", keep: ['.ncr-kpi-row[data-tour="deltas"]'] },
        { key: "work", label: "Work", keep: [".ncr-onlist"] },
        { key: "trend", label: "Trend", keep: ['[aria-labelledby="ncr-trend-h"]'] },
    ],
    health: [
        { key: "basics", label: "Basics", keep: [".ncr-score-grid > :nth-child(1)"] },
        { key: "speed", label: "Speed", keep: [".ncr-score-grid > :nth-child(2)"] },
        { key: "access", label: "Accessibility", keep: [".ncr-score-grid > :nth-child(3)"] },
        { key: "practices", label: "Practices", keep: [".ncr-score-grid > :nth-child(4)"] },
        { key: "onpage", label: "On-page", keep: [".ncr-score-grid > :nth-child(5)"] },
        { key: "security", label: "Security", keep: [".ncr-score-grid > :nth-child(6)"] },
        { key: "history", label: "History", keep: ['[aria-labelledby="ncr-health-table-h"]'] },
    ],
    traffic: [
        { key: "visits", label: "Visits", keep: [".ncr-kpi-pair > :nth-child(1)"] },
        { key: "visitors", label: "Visitors", keep: [".ncr-kpi-pair > :nth-child(2)"] },
        { key: "year", label: "Year", keep: ['[data-tour="traffic"]'] },
        { key: "sources", label: "Sources", keep: ['[aria-labelledby="ncr-bd-h"]'] },
        { key: "trends", label: "Trends", keep: ['[aria-labelledby="ncr-trends-h"]'] },
    ],
    search: [
        { key: "pageone", label: "Page one", keep: [".ncr-kpi-row > :nth-child(1)"] },
        { key: "movers", label: "Movers", keep: [".ncr-kpi-row > :nth-child(2)"] },
        { key: "best", label: "Best", keep: [".ncr-kpi-row > :nth-child(3)"] },
        { key: "rankings", label: "Rankings", keep: ['[data-tour="search"]'] },
        { key: "ai", label: "AI visibility", keep: ['[aria-labelledby="ncr-aiv-h"]'] },
        { key: "google", label: "Google", keep: [".ncr-seo"] },
    ],
    uptime: [
        { key: "uptime", label: "Uptime", keep: [".ncr-kpi-row > :nth-child(1)"] },
        { key: "response", label: "Response", keep: [".ncr-kpi-row > :nth-child(2)"] },
        { key: "checks", label: "Checks", keep: [".ncr-kpi-row > :nth-child(3)"] },
        { key: "year", label: "Year", keep: ['[aria-labelledby="ncr-uptime-h"]'] },
        { key: "daily", label: "Daily", keep: ['[aria-labelledby="ncr-checks-h"]'] },
    ],
    work: [
        {
            key: "doing",
            label: "In progress",
            keep: [".ncr-work-open"],
            rows: { row: ".ncr-open-item", match: ".is-doing", empty: "Nothing is in progress right now." },
        },
        {
            key: "next",
            label: "Recommended",
            keep: [".ncr-work-open"],
            rows: { row: ".ncr-open-item", match: ".is-next", empty: "Nothing is queued up right now." },
        },
        { key: "past", label: "Past", keep: [".ncr-work-finished-h", ".ncr-work-month:not(.ncr-work-open)"] },
    ],
    plan: [
        {
            key: "fixes",
            label: "Fixes",
            keep: [".ncr-plan-source", ".ncr-pillar"],
            rows: { row: ".ncr-plan-group", text: { in: ".ncr-plan-kind", is: "Fixes" } },
        },
        {
            key: "opps",
            label: "Opportunities",
            keep: [".ncr-plan-source", ".ncr-pillar"],
            rows: { row: ".ncr-plan-group", text: { in: ".ncr-plan-kind", is: "Opportunities" } },
        },
        { key: "found", label: "Search", keep: ['[aria-labelledby="ncr-pillar-found"]'] },
        { key: "speed", label: "Speed", keep: ['[aria-labelledby="ncr-pillar-speed"]'] },
        { key: "trust", label: "Trust", keep: ['[aria-labelledby="ncr-pillar-trust"]'] },
    ],
    reports: [
        { key: "month", label: "Monthly", report: "month" },
        { key: "quarter", label: "Quarterly", report: "quarter" },
        { key: "year", label: "Annual", report: "year" },
    ],
    report: [
        { key: "summary", label: "Summary", keep: [".ncr-ms-back", ".ncr-ms-head"] },
        { key: "health", label: "Health", keep: [".ncr-ms-back", '[aria-labelledby="ncr-ms-health-h"]'] },
        { key: "search", label: "Search", keep: [".ncr-ms-back", '[aria-labelledby="ncr-ms-search-h"]'] },
        { key: "traffic", label: "Traffic", keep: [".ncr-ms-back", '[aria-labelledby="ncr-ms-traffic-h"]'] },
        { key: "uptime", label: "Uptime", keep: [".ncr-ms-back", '[aria-labelledby="ncr-ms-up-h"]'] },
        { key: "issues", label: "Issues", keep: [".ncr-ms-back", '[aria-labelledby="ncr-ms-iss-h"]'] },
        { key: "work", label: "Work", keep: [".ncr-ms-back", '[aria-labelledby="ncr-ms-work-h"]'] },
    ],
    account: [
        { key: "plan", label: "Plan", keep: ['[aria-labelledby="ncr-plan-h"]'] },
        { key: "site", label: "Website", keep: ['[aria-labelledby="ncr-site-h"]'] },
        { key: "partner", label: "Partner", keep: ['[aria-labelledby="ncr-partner-h"]'] },
        { key: "access", label: "Access", keep: ['[aria-labelledby="ncr-access-h"]'] },
        { key: "data", label: "Data", keep: ['[aria-labelledby="ncr-data-h"]'] },
        { key: "security", label: "Security", keep: ['[aria-labelledby="ncr-signin-h"]'] },
    ],
    sites: [
        {
            key: "flagged",
            label: "Needs attention",
            keep: ['[aria-labelledby="ncr-sites-h"]'],
            rows: { row: ".ncr-sites-table tbody tr", match: ".ncr-flags li", empty: "Every site is clear right now." },
        },
        {
            key: "clear",
            label: "All clear",
            keep: ['[aria-labelledby="ncr-sites-h"]'],
            rows: { row: ".ncr-sites-table tbody tr", exclude: ".ncr-flags li", empty: "Every site needs a look right now." },
        },
    ],
}
function greetingFor(h: number) {
    return h < 5 ? "Good evening" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"
}
function sixMonthHistory(
    snaps: MsSnap[],
    endIso: string,
): {
    key: string
    date: string
    overall: number
}[] {
    const byMonth = new Map<string, MsSnap>()
    snaps
        .filter((x) => x.run_date <= endIso && num(x.overall) !== null)
        .sort((a, b) => (a.run_date < b.run_date ? -1 : a.run_date > b.run_date ? 1 : 0))
        .forEach((x) => byMonth.set(x.run_date.slice(0, 7), x))
    return Array.from(byMonth.values())
        .slice(-6)
        .map((x) => ({ key: `${x.run_date.slice(0, 7)}-01`, date: x.run_date, overall: num(x.overall) as number }))
}
function initialsOf(name: string) {
    const parts = name
        .replace(/[^A-Za-z0-9 ]/g, " ")
        .trim()
        .split(/\s+/)
        .filter(Boolean)
    const two = parts.length >= 2 ? parts[0][0] + parts[parts.length - 1][0] : (parts[0] || "?").slice(0, 2)
    return two.toUpperCase()
}
function ChevronGlyph() {
    return (
        <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <path d="m6 9 6 6 6-6" />
        </svg>
    )
}
function HelpGlyph() {
    return (
        <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <circle cx="12" cy="12" r="9" />
            <path d="M9.6 9.2a2.5 2.5 0 0 1 4.85.8c0 1.6-2.45 2-2.45 3.3M12 17h.01" />
        </svg>
    )
}
const RAIL_OPEN_MS = 120
const RAIL_CLOSE_MS = 1500
const NC_LOGO = "https://framerusercontent.com/images/Z7UUCOBAoIXLZghVYLEFS1OQqmw.svg"
const SPRING = { type: "spring" as const, bounce: 0, duration: 0.36 }
const KIND_RANK: Record<string, number> = { year: 0, quarter: 1, month: 2 }
const TOUR: {
    section: SectionId
    target: string
    title: string
    body: string
    report?: boolean
}[] = [
    {
        section: "overview",
        target: "notices",
        title: "What's new",
        body: "The top of the dashboard points out anything that needs attention, good news, and the work we finished. Each note links to the details, and you can dismiss it once you've read it.",
    },
    {
        section: "overview",
        target: "health",
        title: "Overall health",
        body: "One score out of 100 for the whole site, with a letter grade and the change since last month. It is the first number to look at each month.",
    },
    {
        section: "overview",
        target: "deltas",
        title: "Month over month",
        body: "Every figure is compared with the month before. Green means better and red means worse, whatever the direction, so a faster response time shows a green down arrow.",
    },
    {
        section: "traffic",
        target: "traffic",
        title: "Visits",
        body: "Visits and unique visitors for the last 12 months. A striped bar is a month still in progress, compared as a daily average so the change is fair.",
    },
    {
        section: "search",
        target: "search",
        title: "Search positions",
        body: "Where the site shows up for the searches that matter, on Google, Bing, Yahoo and DuckDuckGo. Position 1 is the top result.",
    },
    {
        section: "work",
        target: "work",
        title: "Work log",
        body: "Everything Nordmeyer Creative did on the site each month, so the care behind the numbers is on the record.",
    },
    {
        section: "plan",
        target: "plan",
        title: "The plan",
        body: "What comes next, in priority order, grouped into getting found, speed and trust. Each item says why it matters and what we found.",
    },
    {
        section: "reports",
        target: "reports",
        title: "Reports",
        body: "At the end of every month, every quarter and every year you are with us, a new report card appears here: monthly, quarterly and annual reports. Open one to see the whole stretch: health at the start and the end, traffic, uptime, the work we finished, and where each search started and where it is now.",
    },
    {
        section: "reports",
        target: "report-download",
        title: "Download PDF",
        body: "Every report has a Download PDF button. It gives you a Nordmeyer Creative branded copy with the same figures, laid out for paper, to keep or share.",
        report: true,
    },
    {
        section: "account",
        target: "account",
        title: "My account",
        body: "Your plan and where you are in it, your sign-in details, and a link to the client portal for invoices and messages.",
    },
]
const TOUR_OFFERED_KEY = "nc-reports-tour-offered"
const CHECKIN_MS = 120000
function parseDay(s: string): Date {
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "")
    return m ? new Date(+m[1], +m[2] - 1, +m[3]) : new Date(NaN)
}
function monthKey(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}
function addMonths(key: string, n: number) {
    const d = parseDay(key)
    return monthKey(new Date(d.getFullYear(), d.getMonth() + n, 1))
}
function monthLong(key: string) {
    return parseDay(key).toLocaleDateString("en-US", { month: "long", year: "numeric" })
}
function monthName(key: string) {
    return parseDay(key).toLocaleDateString("en-US", { month: "long" })
}
function monthShort(key: string) {
    return parseDay(key).toLocaleDateString("en-US", { month: "short" })
}
function dayLong(s: string) {
    const d = parseDay(s)
    return Number.isNaN(d.getTime()) ? "" : d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
}
function daysInMonth(key: string) {
    const d = parseDay(key)
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()
}
function num(v: any): number | null {
    if (v === null || v === undefined || v === "") return null
    const n = Number(v)
    return Number.isFinite(n) ? n : null
}
function fmtInt(n: number | null) {
    return n === null ? "No data" : Math.round(n).toLocaleString("en-US")
}
function compact(n: number) {
    if (Math.abs(n) >= 10000) return `${(n / 1000).toFixed(n >= 100000 ? 0 : 1)}K`
    return Math.round(n).toLocaleString("en-US")
}
function byMonth<
    T extends {
        month: string
    },
>(rows: T[], key: string) {
    return rows.find((r) => r.month === key) || null
}
function Icon({ name, size = 20 }: { name: string; size?: number }) {
    const p: Record<string, ReactNode> = {
        sites: (
            <>
                <rect x="4" y="4.5" width="16" height="4.5" rx="1.5" />
                <rect x="4" y="10.75" width="16" height="4.5" rx="1.5" />
                <rect x="4" y="17" width="10" height="3" rx="1.5" />
            </>
        ),
        permissions: (
            <>
                <path d="M12 3.5 5 6v5.5c0 4.2 2.9 7.6 7 9 4.1-1.4 7-4.8 7-9V6z" />
                <path d="m9 12 2.2 2.2L15.5 10" />
            </>
        ),
        jager: (
            <>
                <circle cx="12" cy="12" r="7.5" />
                <circle cx="12" cy="12" r="1.8" />
                <path d="M12 2.5v4.2M12 17.3v4.2M2.5 12h4.2M17.3 12h4.2" />
            </>
        ),
        overview: (
            <>
                <rect x="4" y="4" width="7" height="7" rx="1.5" />
                <rect x="13" y="4" width="7" height="5" rx="1.5" />
                <rect x="13" y="11" width="7" height="9" rx="1.5" />
                <rect x="4" y="13" width="7" height="7" rx="1.5" />
            </>
        ),
        health: <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />,
        traffic: (
            <>
                <path d="M5 20V12" />
                <path d="M12 20V6" />
                <path d="M19 20v-9" />
            </>
        ),
        search: (
            <>
                <circle cx="11" cy="11" r="6" />
                <path d="m20 20-4.3-4.3" />
            </>
        ),
        uptime: (
            <>
                <circle cx="12" cy="12" r="8" />
                <path d="M12 8v4l3 2" />
            </>
        ),
        work: (
            <>
                <rect x="5" y="4" width="14" height="17" rx="2" />
                <path d="M9 9h6M9 13h6M9 17h3" />
            </>
        ),
        reports: (
            <>
                <circle cx="12" cy="9" r="5.5" />
                <path d="M8.6 13.4 7 21l5-2.6 5 2.6-1.6-7.6" />
            </>
        ),
        plan: (
            <>
                <path d="M6 21V4" />
                <path d="M6 4h11l-2 4 2 4H6" />
            </>
        ),
        sun: (
            <>
                <circle cx="12" cy="12" r="4" />
                <path d="M12 3v1.5M12 19.5V21M4.9 4.9 6 6M18 18l1.1 1.1M3 12h1.5M19.5 12H21M6 18l-1.1 1.1M19.1 4.9 18 6" />
            </>
        ),
        moon: <path d="M20 13.5A8 8 0 1 1 10.5 4a6.5 6.5 0 0 0 9.5 9.5z" />,
        signout: (
            <>
                <path d="M14 4h4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-4" />
                <path d="M10 8l-4 4 4 4M6 12h10" />
            </>
        ),
        menu: <path d="M4 7h16M4 12h16M4 17h16" />,
        pause: <path d="M9 6v12M15 6v12" />,
        calendar: (
            <>
                <rect x="4" y="5" width="16" height="15" rx="2" />
                <path d="M4 10h16M9 3v4M15 3v4" />
            </>
        ),
        play: <path d="M8 5.5v13l10.5-6.5z" />,
        person: (
            <>
                <circle cx="12" cy="8.5" r="3.5" />
                <path d="M5 20c.8-3.4 3.6-5.5 7-5.5s6.2 2.1 7 5.5" />
            </>
        ),
        close: <path d="M6 6l12 12M18 6 6 18" />,
        collapse: <path d="M15 6l-6 6 6 6" />,
        expand: <path d="M9 6l6 6-6 6" />,
        back: <path d="M10 6l-6 6 6 6M4 12h16" />,
        up: <path d="M12 19V5M6 11l6-6 6 6" />,
        down: <path d="M12 5v14M6 13l6 6 6-6" />,
        flat: <path d="M5 12h14" />,
        alert: (
            <>
                <path d="M12 3 2.5 20h19z" />
                <path d="M12 10v4M12 17v.5" />
            </>
        ),
        ok: (
            <>
                <circle cx="12" cy="12" r="8.5" />
                <path d="m8.5 12 2.5 2.5 4.5-5" />
            </>
        ),
    }
    return (
        <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
            style={{ flex: "none", display: "block" }}
        >
            {p[name]}
        </svg>
    )
}
type Better = "up" | "down"
function Delta({
    cur,
    prev,
    better,
    kind,
    prevKey,
    compactText,
    perDay,
}: {
    cur: number | null
    prev: number | null
    better: Better
    kind: "pct" | "pts" | "ms" | "count" | "rank"
    prevKey: string
    compactText?: boolean
    perDay?: boolean
}) {
    if (cur === null) return null
    if (prev === null) {
        return <span className="ncr-delta ncr-delta-none">No {monthName(prevKey)} data to compare</span>
    }
    let diff = cur - prev
    let text = ""
    if (kind === "pct") {
        if (prev === 0) return <span className="ncr-delta ncr-delta-none">New since {monthName(prevKey)}</span>
        const pct = (diff / prev) * 100
        diff = Math.round(pct * 10) / 10
        text = `${Math.abs(diff).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`
    } else if (kind === "pts") {
        diff = Math.round(diff * 10) / 10
        text = `${Math.abs(diff).toLocaleString("en-US", { maximumFractionDigits: 1 })} ${Math.abs(diff) === 1 ? "pt" : "pts"}`
    } else if (kind === "ms") {
        diff = Math.round(diff)
        text = `${Math.abs(diff).toLocaleString("en-US")} ms`
    } else {
        diff = Math.round(diff)
        text = `${Math.abs(diff)}`
    }
    if (diff === 0) {
        return (
            <span className="ncr-delta ncr-delta-flat">
                <Icon name="flat" size={14} />
                No change from {monthName(prevKey)}
            </span>
        )
    }
    const up = diff > 0
    const good = better === "up" ? up : !up
    const sign = up ? "+" : "−"
    const spoken = `${perDay ? "Daily average " : ""}${up ? "up" : "down"} ${text} from ${monthName(prevKey)}, ${good ? "an improvement" : "worse than before"}.`
    return (
        <span className={`ncr-delta ${good ? "ncr-delta-good" : "ncr-delta-bad"}`}>
            <Icon name={up ? "up" : "down"} size={14} />
            <span aria-hidden="true">
                {sign}
                {text}
                {perDay ? " per day" : ""}
                {compactText ? "" : ` vs ${monthShort(prevKey)}`}
            </span>
            <span className="ncr-sr">{spoken}</span>
        </span>
    )
}
function gpos(r: RankRow): number | null {
    const by = (r.by_engine || {}) as Record<string, unknown>
    const k = Object.keys(by).find((x) => x.toLowerCase().replace(/[^a-z]/g, "") === "google")
    if (k) return num(by[k])
    return num(r.best_position)
}
function RankChange({ cur, prev }: { cur: number | null; prev: number | null }) {
    if (cur === null && prev === null) return <span className="ncr-muted">Not ranked</span>
    if (prev === null) return <span className="ncr-delta ncr-delta-good">New in top 50</span>
    if (cur === null) return <span className="ncr-delta ncr-delta-bad">Dropped out of top 50</span>
    const moved = prev - cur
    if (moved === 0) return <span className="ncr-delta ncr-delta-flat">No change</span>
    const good = moved > 0
    return (
        <span className={`ncr-delta ${good ? "ncr-delta-good" : "ncr-delta-bad"}`}>
            <Icon name={good ? "up" : "down"} size={14} />
            <span aria-hidden="true">
                {good ? "+" : "−"}
                {Math.abs(moved)}
            </span>
            <span className="ncr-sr">
                {good ? "Up" : "Down"} {Math.abs(moved)} {Math.abs(moved) === 1 ? "place" : "places"}
            </span>
        </span>
    )
}
function MsChange({
    from,
    to,
    unit,
    better = "up",
}: {
    from: number | null
    to: number | null
    unit: "pts" | "ms" | "count"
    better?: Better
}) {
    if (from === null || to === null) return <span className="ncr-delta ncr-delta-none">No earlier figure to compare</span>
    const diff = Math.round(to - from)
    if (diff === 0)
        return (
            <span className="ncr-delta ncr-delta-flat">
                <Icon name="flat" size={14} />
                No change
            </span>
        )
    const up = diff > 0
    const good = better === "up" ? up : !up
    const n = Math.abs(diff)
    const text = unit === "pts" ? `${n} ${n === 1 ? "pt" : "pts"}` : unit === "ms" ? `${n.toLocaleString("en-US")} ms` : `${n}`
    return (
        <span className={`ncr-delta ${good ? "ncr-delta-good" : "ncr-delta-bad"}`}>
            <Icon name={up ? "up" : "down"} size={14} />
            <span aria-hidden="true">
                {up ? "+" : "\u2212"}
                {text}
            </span>
            <span className="ncr-sr">
                {up ? "Up" : "Down"} {text}, {good ? "an improvement" : "worse than before"}.
            </span>
        </span>
    )
}
function MoveBadge({ m }: { m: Move }) {
    const tone = moveTone(m)
    const icon = m.kind === "up" || m.kind === "new" ? "up" : m.kind === "down" || m.kind === "dropped" ? "down" : "flat"
    return (
        <span className={`ncr-delta ${tone === "good" ? "ncr-delta-good" : tone === "bad" ? "ncr-delta-bad" : "ncr-delta-flat"}`}>
            <Icon name={icon} size={14} />
            {moveText(m)}
        </span>
    )
}
function sinceText(
    series: {
        date: string
        overall: number
    }[],
) {
    const a = series[0]
    const b = series[series.length - 1]
    const d = b.overall - a.overall
    const when = parseDay(a.date).toLocaleDateString("en-US", { month: "long", year: "numeric" })
    return d === 0
        ? `No change since ${when}`
        : `${d > 0 ? "Up" : "Down"} ${Math.abs(d)} ${Math.abs(d) === 1 ? "point" : "points"} since ${when}`
}
function MonthPdfLink({
    make,
}: {
    make: () => Promise<{
        name: string
        blob: Blob
    }>
}) {
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState("")
    const go = async () => {
        if (busy) return
        setBusy(true)
        setMsg("")
        try {
            const { name, blob } = await make()
            const href = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = href
            a.download = name
            a.rel = "noopener"
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.setTimeout(() => URL.revokeObjectURL(href), 4000)
            setMsg("Your PDF is downloading.")
        } catch (e) {
            setMsg("We couldn’t build the PDF just now. Please try again.")
        } finally {
            setBusy(false)
        }
    }
    return (
        <span className="ncr-month-pdf">
            <button type="button" className="ncr-textbtn" onClick={go} disabled={busy} aria-describedby="ncr-month-pdf-msg">
                {busy ? "Preparing PDF…" : "Download this month as PDF"}
            </button>
            <span id="ncr-month-pdf-msg" className="ncr-sr" role="status" aria-live="polite">
                {msg}
            </span>
        </span>
    )
}
function dayLongFull(s: string) {
    return parseDay(s).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}
function ReportDownloads({
    demo,
    buildPdf,
    buildText,
    tourClass = "",
}: {
    demo: boolean
    buildPdf: () => Promise<{
        name: string
        blob: Blob
    }>
    buildText: () => {
        name: string
        text: string
    }
    tourClass?: string
}) {
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState<{
        ok: boolean
        text: string
    } | null>(null)
    const uid = useId()
    const save = (name: string, blob: Blob) => {
        const href = URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = href
        a.download = name
        a.rel = "noopener"
        document.body.appendChild(a)
        a.click()
        a.remove()
        window.setTimeout(() => URL.revokeObjectURL(href), 4000)
    }
    const pdf = async () => {
        if (busy) return
        setBusy(true)
        setMsg(null)
        try {
            const { name, blob } = await buildPdf()
            save(name, blob)
            setMsg({ ok: true, text: "Your PDF is downloading." })
        } catch (e) {
            setMsg({ ok: false, text: "We couldn’t build the PDF just now. Please try again, or download the plain text version below." })
        } finally {
            setBusy(false)
        }
    }
    const txt = () => {
        try {
            const { name, text } = buildText()
            save(name, new Blob([text], { type: "text/plain;charset=utf-8" }))
            setMsg({ ok: true, text: "Your plain text file is downloading." })
        } catch (e) {
            setMsg({
                ok: false,
                text: "We couldn’t put the file together. Please try again, or write to hello@nordmeyercreative.com for a copy.",
            })
        }
    }
    return (
        <div className={`ncr-download ncr-ms-downloads${tourClass}`} data-tour="report-download">
            <p className="ncr-body-text">
                Everything in this report as a print-ready PDF{demo ? ", made from the demo’s invented data" : ""}.
            </p>
            <div className="ncr-ms-dl-row">
                <button type="button" className="ncr-btn" onClick={pdf} disabled={busy} aria-describedby={`${uid}-msg`}>
                    {busy ? <span className="ncr-spinner ncr-spinner-sm" aria-hidden="true" /> : null}
                    {busy ? "Preparing your PDF…" : "Download PDF"}
                </button>
                <button type="button" className="ncr-textbtn" onClick={txt}>
                    Plain text version
                </button>
            </div>
            <span
                id={`${uid}-msg`}
                className={`ncr-small ncr-switch-msg${msg && !msg.ok ? " ncr-bad-text" : ""}`}
                role="status"
                aria-live="polite"
            >
                {msg ? msg.text : ""}
            </span>
        </div>
    )
}
function addDayIso(s: string, n: number) {
    const d = parseDay(s)
    const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`
}
interface Slot {
    key: string
    a: number | null
    b?: number | null
    partial?: boolean
}
const IntroCtx = createContext<{
    go: boolean
    reduce: boolean
}>({ go: true, reduce: false })
const COUNT_MS = 1050
const CHART_DELAY_MS = 150
const CHART_MS = 1000
const BAR_STAGGER_MS = 45
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3)
const SETTLE_MS = 80
const LOAD_TIMEOUT_MS = 15000
const WORK_REFRESH_MS = 60000
const STALL_MESSAGE = "Your report is taking longer than it should to load. Check your connection and try again."
function useIntroProgress(): number {
    const { go, reduce } = useContext(IntroCtx)
    const [p, setP] = useState(0)
    const done = useRef(false)
    useEffect(() => {
        if (done.current || reduce) return
        if (!go) {
            setP(0)
            return
        }
        let raf = 0
        const wait = window.setTimeout(() => {
            const t0 = performance.now()
            const tick = (now: number) => {
                const t = Math.min(1, (now - t0) / COUNT_MS)
                setP(easeOut(t))
                if (t < 1) raf = requestAnimationFrame(tick)
                else done.current = true
            }
            raf = requestAnimationFrame(tick)
        }, SETTLE_MS)
        return () => {
            window.clearTimeout(wait)
            cancelAnimationFrame(raf)
        }
    }, [go, reduce])
    return reduce ? 1 : p
}
function useChartIntro(extraMs = 0): string {
    const { go, reduce } = useContext(IntroCtx)
    const [stage, setStage] = useState<"pre" | "play" | "done">("pre")
    useEffect(() => {
        if (reduce) {
            setStage("done")
            return
        }
        if (!go || stage !== "pre") return
        const wait = window.setTimeout(() => setStage("play"), SETTLE_MS)
        return () => window.clearTimeout(wait)
    }, [go, reduce, stage])
    useEffect(() => {
        if (stage !== "play") return
        const t = window.setTimeout(() => setStage("done"), CHART_DELAY_MS + CHART_MS + extraMs + 250)
        return () => window.clearTimeout(t)
    }, [stage, extraMs])
    if (reduce || stage === "done") return ""
    return stage === "play" ? " ncr-intro is-play" : " ncr-intro"
}
const NUM_RE = /-?\d[\d,]*(?:\.\d+)?/
function CountText({ text }: { text: ReactNode }) {
    if (typeof text !== "string" && typeof text !== "number") return <>{text}</>
    const s = String(text)
    const m = s.match(NUM_RE)
    if (!m || m.index === undefined) return <>{s}</>
    return <CountInner s={s} token={m[0]} at={m.index} />
}
function CountInner({ s, token, at }: { s: string; token: string; at: number }) {
    const p = useIntroProgress()
    const { go } = useContext(IntroCtx)
    if (p >= 1) return <>{s}</>
    if (!go && p === 0)
        return (
            <span className="ncr-count">
                <span className="ncr-count-final">{s}</span>
            </span>
        )
    const decimals = (token.split(".")[1] || "").length
    const target = parseFloat(token.replace(/,/g, ""))
    const v = target * p
    const shown =
        token.includes(",") || Math.abs(target) >= 1000
            ? v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
            : v.toFixed(decimals)
    return (
        <span className="ncr-count">
            <span className="ncr-count-final">{s}</span>
            <span className="ncr-count-live" aria-hidden="true">
                {s.slice(0, at)}
                {shown}
                {s.slice(at + token.length)}
            </span>
        </span>
    )
}
function HealthRing({ score }: { score: number }) {
    const p = useIntroProgress()
    const { go } = useContext(IntroCtx)
    const waiting = !go && p === 0
    return (
        <div className="ncr-ring">
            <ScoreRing score={score} progress={p} />
            <div className="ncr-ring-center">
                <span className="ncr-figure-xl">
                    {p >= 1 ? (
                        score
                    ) : (
                        <span className="ncr-count">
                            <span className="ncr-count-final">{score}</span>
                            {waiting ? null : (
                                <span className="ncr-count-live" aria-hidden="true">
                                    {Math.round(score * p)}
                                </span>
                            )}
                        </span>
                    )}
                </span>
                <span className="ncr-small ncr-muted">out of 100</span>
            </div>
        </div>
    )
}
function niceMax(v: number) {
    if (v <= 0) return 10
    const pow = Math.pow(10, Math.floor(Math.log10(v)))
    const n = v / pow
    const steps = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
    const step = steps.find((x) => n <= x) || 10
    return step * pow
}
function useWidth<T extends HTMLElement>() {
    const ref = useRef<T>(null)
    const [w, setW] = useState(640)
    useEffect(() => {
        const el = ref.current
        if (!el || typeof ResizeObserver === "undefined") return
        const ro = new ResizeObserver((entries) => {
            const next = Math.round(entries[0].contentRect.width)
            if (next > 0) startTransition(() => setW((prev) => (Math.abs(prev - next) > 1 ? next : prev)))
        })
        ro.observe(el)
        return () => ro.disconnect()
    }, [])
    return { ref, w }
}
function MonthChart({
    slots,
    mode,
    nameA,
    nameB,
    fmt,
    yMax,
    label,
    height = 240,
}: {
    slots: Slot[]
    mode: "line" | "barline"
    nameA: string
    nameB?: string
    fmt: (n: number) => string
    yMax?: number
    label: string
    height?: number
}) {
    const { ref, w } = useWidth<HTMLDivElement>()
    const intro = useChartIntro(mode === "barline" ? slots.length * BAR_STAGGER_MS : 0)
    const [active, setActive] = useState<number | null>(null)
    const [spoken, setSpoken] = useState("")
    const descId = useId()
    const patId = `ncr-hatch-${descId.replace(/[^a-zA-Z0-9]/g, "")}`
    const values = slots.flatMap((s) => [s.a, s.b ?? null]).filter((v): v is number => v !== null)
    const top = yMax ?? niceMax(Math.max(...values, 1) * 1.08)
    const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(top * f))
    const m = { l: 46, r: 14, t: 14, b: 30 }
    const iw = Math.max(80, w - m.l - m.r)
    const ih = height - m.t - m.b
    const band = iw / slots.length
    const x = (i: number) => m.l + band * i + band / 2
    const y = (v: number) => m.t + ih - (v / top) * ih
    const barW = Math.min(24, band * 0.5)
    const every = band < 34 ? 2 : 1
    const segments = (pick: (s: Slot) => number | null | undefined) => {
        const out: string[] = []
        let cur = ""
        slots.forEach((s, i) => {
            const v = pick(s)
            if (v === null || v === undefined) {
                if (cur) out.push(cur)
                cur = ""
                return
            }
            cur += `${cur ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`
        })
        if (cur) out.push(cur)
        return out
    }
    const lineA = mode === "line" ? segments((s) => s.a) : []
    const lineB = mode === "barline" ? segments((s) => s.b) : []
    const dataIdx = slots.map((s, i) => (s.a !== null || (s.b ?? null) !== null ? i : -1)).filter((i) => i >= 0)
    const readout = (i: number) => {
        const s = slots[i]
        const parts = [`${monthLong(s.key)}${s.partial ? " (partial month)" : ""}`]
        parts.push(`${nameA}: ${s.a === null ? "no data" : fmt(s.a)}`)
        if (nameB) parts.push(`${nameB}: ${s.b === null || s.b === undefined ? "no data" : fmt(s.b)}`)
        return parts.join(". ")
    }
    const onMove = (e: RPointerEvent<SVGSVGElement>) => {
        const r = (e.currentTarget as SVGSVGElement).getBoundingClientRect()
        const px = e.clientX - r.left
        let best = -1
        let dist = Infinity
        dataIdx.forEach((i) => {
            const d = Math.abs(x(i) - px)
            if (d < dist) {
                dist = d
                best = i
            }
        })
        if (best >= 0 && best !== active) setActive(best)
    }
    const onKey = (e: RKeyboardEvent) => {
        if (!dataIdx.length) return
        const pos = active === null ? -1 : dataIdx.indexOf(active)
        let next: number | null = null
        if (e.key === "ArrowRight") next = dataIdx[Math.min(dataIdx.length - 1, pos + 1)]
        else if (e.key === "ArrowLeft") next = dataIdx[Math.max(0, pos === -1 ? dataIdx.length - 1 : pos - 1)]
        else if (e.key === "Home") next = dataIdx[0]
        else if (e.key === "End") next = dataIdx[dataIdx.length - 1]
        else if (e.key === "Escape") {
            setActive(null)
            return
        } else return
        e.preventDefault()
        setActive(next)
        setSpoken(readout(next))
    }
    const tip = active !== null ? slots[active] : null
    const tipLeft = active !== null ? Math.min(Math.max(x(active), 90), w - 90) : 0
    return (
        <div
            ref={ref}
            className={`ncr-chart${intro}`}
            role="group"
            tabIndex={0}
            aria-label={`${label}. Use the left and right arrow keys to read each month.`}
            aria-describedby={descId}
            onKeyDown={onKey}
            onBlur={() => setActive(null)}
        >
            <span id={descId} className="ncr-sr">
                The same values are listed in the table that follows.
            </span>
            <span className="ncr-sr" aria-live="polite">
                {spoken}
            </span>
            <svg
                width={w}
                height={height}
                viewBox={`0 0 ${w} ${height}`}
                aria-hidden="true"
                focusable="false"
                onPointerMove={onMove}
                onPointerLeave={() => setActive(null)}
                style={{ display: "block", touchAction: "pan-y" }}
            >
                <defs>
                    <pattern id={patId} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
                        <rect width="6" height="6" fill="var(--ncr-accent-wash)" />
                        <rect width="2.5" height="6" fill="var(--ncr-accent)" />
                    </pattern>
                </defs>
                {ticks.map((t) => (
                    <g key={t}>
                        <line x1={m.l} x2={w - m.r} y1={y(t)} y2={y(t)} stroke="var(--ncr-grid)" strokeWidth={1} />
                        <text x={m.l - 8} y={y(t) + 4} textAnchor="end" className="ncr-axis">
                            {compact(t)}
                        </text>
                    </g>
                ))}
                {slots.map((s, i) =>
                    (slots.length - 1 - i) % every === 0 ? (
                        <text key={s.key} x={x(i)} y={height - 9} textAnchor="middle" className="ncr-axis">
                            {monthShort(s.key)}
                        </text>
                    ) : null,
                )}
                {active !== null ? (
                    <line x1={x(active)} x2={x(active)} y1={m.t} y2={m.t + ih} stroke="var(--ncr-muted)" strokeWidth={1} />
                ) : null}
                {mode === "barline"
                    ? slots.map((s, i) => {
                          if (s.a === null) return null
                          const h = Math.max(2, m.t + ih - y(s.a))
                          const bx = x(i) - barW / 2
                          const by = m.t + ih - h
                          const r = Math.min(4, h)
                          const d = `M${bx},${by + h}V${by + r}Q${bx},${by} ${bx + r},${by}H${bx + barW - r}Q${bx + barW},${by} ${bx + barW},${by + r}V${by + h}Z`
                          return (
                              <path
                                  key={s.key}
                                  d={d}
                                  className="ncr-grow"
                                  style={{ ["--i" as any]: i }}
                                  fill={s.partial ? `url(#${patId})` : "var(--ncr-accent)"}
                                  opacity={active === null || active === i ? 1 : 0.55}
                              />
                          )
                      })
                    : null}
                {lineA.map((d, i) => (
                    <path
                        key={`a${i}`}
                        d={d}
                        className="ncr-draw"
                        pathLength={1}
                        fill="none"
                        stroke="var(--ncr-accent)"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                ))}
                {lineB.map((d, i) => (
                    <path
                        key={`b${i}`}
                        d={d}
                        className="ncr-draw ncr-draw-late"
                        pathLength={1}
                        fill="none"
                        stroke="var(--ncr-series-2)"
                        strokeWidth={2}
                        strokeLinejoin="round"
                        strokeLinecap="round"
                    />
                ))}
                {slots.map((s, i) => {
                    const v = mode === "line" ? s.a : s.b
                    if (v === null || v === undefined) return null
                    const isLast = i === slots.length - 1 || slots.slice(i + 1).every((n) => (mode === "line" ? n.a : n.b) === null)
                    const show = active === i || isLast
                    if (!show) return null
                    return (
                        <circle
                            key={`d${s.key}`}
                            className="ncr-dot"
                            cx={x(i)}
                            cy={y(v)}
                            r={active === i ? 5 : 4}
                            fill={mode === "line" ? "var(--ncr-accent)" : "var(--ncr-series-2)"}
                            stroke="var(--ncr-surface)"
                            strokeWidth={2}
                        />
                    )
                })}
            </svg>
            {tip ? (
                <div className="ncr-tip" style={{ left: tipLeft }} aria-hidden="true">
                    <div className="ncr-tip-month">
                        {monthLong(tip.key)}
                        {tip.partial ? " (partial)" : ""}
                    </div>
                    <div className="ncr-tip-row">
                        <span className="ncr-key" style={{ background: "var(--ncr-accent)" }} />
                        <strong>{tip.a === null ? "No data" : fmt(tip.a)}</strong>
                        <span>{nameA}</span>
                    </div>
                    {nameB ? (
                        <div className="ncr-tip-row">
                            <span className="ncr-key" style={{ background: "var(--ncr-series-2)" }} />
                            <strong>{tip.b === null || tip.b === undefined ? "No data" : fmt(tip.b)}</strong>
                            <span>{nameB}</span>
                        </div>
                    ) : null}
                </div>
            ) : null}
        </div>
    )
}
function Sparkline({ values }: { values: (number | null)[] }) {
    const intro = useChartIntro()
    const w = 120
    const h = 32
    const nums = values.filter((v): v is number => v !== null)
    if (nums.length < 2) return null
    const lo = Math.min(...nums)
    const hi = Math.max(...nums)
    const span = hi - lo || 1
    const step = w / Math.max(1, values.length - 1)
    let d = ""
    let lastX = 0
    let lastY = 0
    values.forEach((v, i) => {
        if (v === null) return
        const px = i * step
        const py = h - 4 - ((v - lo) / span) * (h - 8)
        d += `${d ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`
        lastX = px
        lastY = py
    })
    return (
        <svg width={w} height={h} viewBox={`-4 0 ${w + 8} ${h}`} aria-hidden="true" focusable="false" className={`ncr-spark${intro}`}>
            <path
                d={d}
                className="ncr-draw"
                pathLength={1}
                fill="none"
                stroke="var(--ncr-series-2)"
                strokeWidth={1.5}
                strokeLinejoin="round"
                strokeLinecap="round"
            />
            <circle
                className="ncr-dot"
                cx={lastX}
                cy={lastY}
                r={3.5}
                fill="var(--ncr-accent)"
                stroke="var(--ncr-surface)"
                strokeWidth={2}
            />
        </svg>
    )
}
function ScoreRing({ score, size = 132, progress = 1 }: { score: number; size?: number; progress?: number }) {
    const r = (size - 12) / 2
    const c = 2 * Math.PI * r
    const f = (Math.max(0, Math.min(100, score)) / 100) * progress
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true" focusable="false">
            <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--ncr-surface-2)" strokeWidth={8} />
            <circle
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={score >= 80 ? "var(--ncr-good)" : score >= 60 ? "var(--ncr-warn)" : "var(--ncr-bad)"}
                strokeWidth={8}
                strokeLinecap="round"
                strokeDasharray={`${c * f} ${c}`}
                opacity={f > 0.002 ? 1 : 0}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
        </svg>
    )
}
function FirstMonth({ what }: { what: string }) {
    return (
        <div className="ncr-first">
            <p className="ncr-h3">Trends start next month</p>
            <p className="ncr-small">
                This is the first month we have measured {what}, so there is nothing to compare it with yet. Next month's report adds the
                first trend line.
            </p>
        </div>
    )
}
function TableRegion({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="ncr-table-wrap" role="region" aria-label={label} tabIndex={0}>
            {children}
        </div>
    )
}
function TrendChange({ c, kind, refWords }: { c: TrendCompare; kind: TrendKind; refWords: string }) {
    if (c.cur === null || c.ref === null) return <span className="ncr-delta ncr-delta-none">Not enough history yet</span>
    if (c.fromZero)
        return (
            <span className="ncr-delta ncr-delta-good">
                <Icon name="up" size={14} />
                <span>New since {refWords.replace(/^on /, "")}</span>
            </span>
        )
    if (c.diff === null) return <span className="ncr-delta ncr-delta-none">Not enough history yet</span>
    if (c.diff === 0)
        return (
            <span className="ncr-delta ncr-delta-flat">
                <Icon name="flat" size={14} />
                No change
            </span>
        )
    const up = c.diff > 0
    const words = changeWords(kind, c.diff)
    return (
        <span className={`ncr-delta ${up ? "ncr-delta-good" : "ncr-delta-bad"}`}>
            <Icon name={up ? "up" : "down"} size={14} />
            <span aria-hidden="true">
                {up ? "+" : "−"}
                {words}
                {c.perDay ? " per day" : ""}
            </span>
            <span className="ncr-sr">
                {up ? "Up" : "Down"} {words}
                {c.perDay ? " per day" : ""} {refWords}, {up ? "an improvement" : "lower than before"}.
            </span>
        </span>
    )
}
function TrendMetricBlock({
    m,
    month,
    prevKey,
    yoyKey,
    window12,
}: {
    m: TrendMetric
    month: string
    prevKey: string
    yoyKey: string
    window12: string[]
}) {
    const uid = useId()
    const hId = `${uid}-h`
    const slots: Slot[] = window12.map((k) => ({
        key: k,
        a: m.values[k] ?? null,
        partial: m.days && m.days[k] ? m.days[k].counted < m.days[k].total : false,
    }))
    const count = slots.filter((x) => x.a !== null).length
    const cm = compareMonths(m, month, prevKey)
    const cy = compareMonths(m, month, yoyKey)
    const curV = m.values[month]
    return (
        <section className="ncr-trend-metric" aria-labelledby={hId}>
            <h3 id={hId} className="ncr-h3">
                {m.label}
            </h3>
            <p className="ncr-figure">
                <CountText text={curV === undefined ? "No data" : m.fmt(curV)} />
            </p>
            <dl className="ncr-trend-cmp">
                <dt>Against {monthName(prevKey)}</dt>
                <dd>
                    <TrendChange c={cm} kind={m.kind} refWords={`on ${monthName(prevKey)}`} />
                </dd>
                <dt>Against {monthLong(yoyKey)}</dt>
                <dd>
                    <TrendChange c={cy} kind={m.kind} refWords={`on ${monthLong(yoyKey)}`} />
                </dd>
            </dl>
            {cm.perDay || cy.perDay ? (
                <p className="ncr-small ncr-muted">A partial month, so visits are compared as a daily average.</p>
            ) : null}
            {count >= 2 ? (
                <>
                    <MonthChart
                        slots={slots}
                        mode="line"
                        nameA={m.label}
                        fmt={m.fmt}
                        yMax={m.yMax}
                        label={`${m.label} by month, last 12 months`}
                        height={160}
                    />
                    <details className="ncr-details">
                        <summary>Show as a table</summary>
                        <TableRegion label={`${m.label} by month`}>
                            <table className="ncr-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Month</th>
                                        <th scope="col">{m.label}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {window12
                                        .filter((k) => m.values[k] !== undefined)
                                        .slice()
                                        .reverse()
                                        .map((k) => (
                                            <tr key={k} className={k === month ? "is-selected" : undefined}>
                                                <th scope="row">{monthLong(k)}</th>
                                                <td>
                                                    {m.fmt(m.values[k])}
                                                    {m.days && m.days[k] && m.days[k].counted < m.days[k].total ? " (partial)" : ""}
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </TableRegion>
                    </details>
                </>
            ) : (
                <p className="ncr-small ncr-muted">The 12 month line starts once two months are recorded.</p>
            )}
        </section>
    )
}
function AivQuestionItem({ q }: { q: AivQuestion }) {
    const uid = useId()
    const [open, setOpen] = useState(false)
    const withText = q.cells.filter((c) => c.row && c.row.excerpt)
    return (
        <li className="ncr-aiv-q">
            <h4 className="ncr-aiv-q-h">{q.question}</h4>
            <ul className="ncr-aiv-cells" role="list">
                {q.cells.map((c) => {
                    const r = c.row
                    return (
                        <li key={c.engine} className="ncr-aiv-cell">
                            <span className="ncr-aiv-cell-e">{c.label}</span>
                            {!r ? (
                                <span className="ncr-aiv-mark is-no">Not asked</span>
                            ) : r.mentioned ? (
                                <span className="ncr-aiv-mark is-yes">
                                    <Icon name="ok" size={16} />
                                    Named
                                </span>
                            ) : (
                                <span className="ncr-aiv-mark is-no">
                                    <Icon name="close" size={16} />
                                    Not named
                                </span>
                            )}
                            {r && r.mentioned && r.position ? (
                                <span className="ncr-aiv-pos">{ordinal(r.position)} business named</span>
                            ) : null}
                            {r && r.cited ? <span className="ncr-aiv-pos">Linked to your site</span> : null}
                        </li>
                    )
                })}
            </ul>
            {q.named.length ? (
                <p className="ncr-aiv-named">
                    <strong>{q.mentioned ? "Also named" : "Named instead"}:</strong> {q.named.join(", ")}
                </p>
            ) : null}
            {withText.length ? (
                <>
                    <button
                        type="button"
                        className="ncr-textbtn ncr-aiv-toggle"
                        aria-expanded={open}
                        aria-controls={`${uid}-ex`}
                        onClick={() => setOpen((o) => !o)}
                    >
                        <Icon name="expand" size={14} />
                        {open ? "Hide what the assistants said" : "Show what the assistants said"}
                    </button>
                    <ul id={`${uid}-ex`} className="ncr-aiv-ex" role="list" hidden={!open}>
                        {withText.map((c) => (
                            <li key={c.engine}>
                                <strong>{c.label}</strong>
                                {c.row!.excerpt}
                            </li>
                        ))}
                    </ul>
                </>
            ) : null}
        </li>
    )
}
function aivMetric(rows: AivRow[]): TrendMetric {
    const values: Record<string, number> = {}
    aivMonths(rows).forEach((k) => {
        const sc = aivScore(rows, k)
        if (sc) values[k] = sc.score
    })
    return { key: "aiv", label: "AI visibility score", fmt: (n) => `${Math.round(n)}%`, kind: "pts", values, yMax: 100 }
}
const enc = encodeURIComponent
async function loadWork(url: string, key: string, cid: string, sid: string): Promise<WorkRow[]> {
    const base = "id,client_id,site_id,done_on,title,detail,category"
    const tries = [`${base},status,due_on,created_at`, `${base},status,due_on`, base]
    for (let i = 0; i < tries.length; i++) {
        try {
            return await authGet<WorkRow[]>(
                url,
                key,
                `/rest/v1/work_log?client_id=eq.${cid}&or=(site_id.eq.${sid},site_id.is.null)&select=${tries[i]}&order=done_on.desc.nullslast&limit=500`,
            )
        } catch (e) {
            if (i === tries.length - 1) throw e
        }
    }
    return []
}
const isOpen = (w: WorkRow) => w.status === "in_progress" || w.status === "up_next"
const isDoneWork = (
    w: WorkRow,
): w is WorkRow & {
    done_on: string
} => !isOpen(w) && !!w.done_on
function openItems(work: WorkRow[]) {
    const rank = (w: WorkRow) => (w.status === "in_progress" ? 0 : 1)
    return work
        .filter(isOpen)
        .sort((a, b) => rank(a) - rank(b) || (a.due_on || "9999").localeCompare(b.due_on || "9999") || a.title.localeCompare(b.title))
}
async function loadLive(url: string, key: string, site: SiteRow): Promise<SiteData> {
    const sid = enc(site.id)
    const cid = enc(site.client_id)
    const since = addMonths(monthKey(new Date()), -24)
    const [scores, traffic, uptime, ranks, snapshots, work, checks] = await Promise.all([
        authGet<ScoreRow[]>(url, key, `/rest/v1/monthly_scores?site_id=eq.${sid}&order=month.asc`),
        authGet<TrafficRow[]>(url, key, `/rest/v1/monthly_traffic?site_id=eq.${sid}&order=month.asc`),
        authGet<UptimeRow[]>(url, key, `/rest/v1/monthly_uptime?site_id=eq.${sid}&order=month.asc`),
        authGet<RankRow[]>(url, key, `/rest/v1/monthly_ranks?site_id=eq.${sid}&order=month.asc,keyword.asc`),
        authGet<SnapshotRow[]>(
            url,
            key,
            `/rest/v1/snapshots?site_id=eq.${sid}&select=id,site_id,run_date,incomplete&order=run_date.desc&limit=60`,
        ),
        loadWork(url, key, cid, sid),
        authGet<CheckRow[]>(url, key, `/rest/v1/uptime_checks?site_id=eq.${sid}&day=gte.${since}&order=day.asc`),
    ])
    const ids = snapshots.map((s) => s.id)
    const recs = ids.length
        ? await authGet<RecRow[]>(
              url,
              key,
              `/rest/v1/recommendations?snapshot_id=in.(${ids.map(enc).join(",")})&select=snapshot_id,position,pillar,kind,sev,title,why,found&order=position.asc`,
          )
        : []
    let pings: PingRow[] = []
    try {
        pings = await authGet<PingRow[]>(url, key, `/rest/v1/uptime_pings?site_id=eq.${sid}&order=checked_at.desc&limit=1`)
    } catch (e) {}
    try {
        const extra = await authGet<SnapshotRow[]>(
            url,
            key,
            `/rest/v1/snapshots?site_id=eq.${sid}&select=id,security_in_control,host_managed,host_name&order=run_date.desc&limit=60`,
        )
        const byId = new Map(extra.map((x) => [x.id, x]))
        snapshots.forEach((sn) => Object.assign(sn, byId.get(sn.id) || {}))
    } catch (e) {}
    let searchScope: SearchScope = "core"
    try {
        const plans = await authGet<
            {
                name: string
                kind: string
                starts_on: string | null
                ends_on: string | null
            }[]
        >(url, key, `/rest/v1/client_plans?client_id=eq.${cid}&select=name,kind,starts_on,ends_on`)
        searchScope = searchScopeOf(plans, new Date().toISOString().slice(0, 10))
    } catch (e) {}
    const optional = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
        try {
            return await fn()
        } catch (e) {
            return null
        }
    }
    const [breakdown, leadRows, aivRaw] = await Promise.all([
        optional<BreakdownRow[]>(() =>
            authGet<BreakdownRow[]>(
                url,
                key,
                `/rest/v1/traffic_breakdown?site_id=eq.${sid}&select=site_id,month,dimension,value,views,visitors&order=month.desc,visitors.desc&limit=2500`,
            ),
        ),
        optional<
            {
                created_at: string
                status: string
            }[]
        >(() =>
            authGet<
                {
                    created_at: string
                    status: string
                }[]
            >(url, key, `/rest/v1/leads?site_id=eq.${sid}&created_at=gte.${since}&select=created_at,status&limit=10000`),
        ),
        optional<any[]>(() =>
            authGet<any[]>(
                url,
                key,
                `/rest/v1/ai_visibility_checks?site_id=eq.${sid}&month=gte.${since}&select=site_id,month,engine,question,mentioned,cited,position,others,excerpt,checked_at&order=month.asc&limit=5000`,
            ),
        ),
    ])
    const aiv = aivRaw ? normalizeAiv(aivRaw) : null
    let leadsByMonth: Record<string, number> | null = null
    if (leadRows) {
        const counts: Record<string, number> = {}
        leadRows
            .filter((l: { created_at: string; status: string }) => l.status !== "spam" && l.created_at)
            .forEach((l: { created_at: string; status: string }) => {
                const k = `${l.created_at.slice(0, 7)}-01`
                counts[k] = (counts[k] || 0) + 1
            })
        leadsByMonth = counts
    }
    return {
        scores,
        traffic,
        uptime,
        ranks,
        snapshots,
        recs,
        work,
        checks,
        pings,
        searchScope,
        hiddenRecs: 0,
        planScope: searchScope,
        breakdown,
        leadsByMonth,
        aiv,
    }
}
function demoSite(all: ReturnType<typeof buildDemo>, site: SiteRow): SiteData {
    const f = <
        T extends {
            site_id: string
        },
    >(
        rows: T[],
    ) => rows.filter((r) => r.site_id === site.id)
    const snaps = f(all.snapshots)
    const ids = new Set(snaps.map((s) => s.id))
    return {
        scores: f(all.scores),
        traffic: f(all.traffic),
        uptime: f(all.uptime),
        ranks: f(all.ranks),
        snapshots: snaps.slice().sort((a, b) => (a.run_date < b.run_date ? 1 : -1)),
        recs: all.recs.filter((r) => ids.has(r.snapshot_id)),
        work: all.work.filter((w) => w.client_id === site.client_id && (w.site_id === site.id || w.site_id === null)),
        checks: f(all.checks),
        pings: f(all.pings),
        searchScope: "search",
        hiddenRecs: 0,
        planScope: "search",
        breakdown: demoBreakdown(site.id, f(all.traffic) as any[]),
        leadsByMonth: demoInquiries(site.id, f(all.traffic) as any[]),
        aiv: demoAiVisibility(
            site.id,
            (f(all.traffic) as any[]).map((t: any) => String(t.month)),
        ),
    }
}
function shapeData(d: SiteData | null, f: Features, hasEnt: boolean): SiteData | null {
    if (!d) return d
    const growth = hasEnt ? f.growth_plan : (d.planScope || d.searchScope) === "search"
    const recs = growth ? d.recs : d.recs.filter((r) => !isGrowthRec(r))
    const from = trafficFrom(f)
    return {
        ...d,
        recs,
        searchScope: growth ? "search" : "core",
        hiddenRecs: d.recs.length - recs.length,
        ranks: f.ranks ? d.ranks : [],
        traffic: from ? d.traffic.filter((t) => t.month >= from) : d.traffic,
        breakdown: breakdownAllowed(d.breakdown ?? null, f),
        leadsByMonth: f.leads ? (d.leadsByMonth ?? null) : null,
        aiv: f.ai_visibility !== "none" ? (d.aiv ?? null) : null,
    }
}
let entMissLogged = false
function logEntMiss(why: unknown) {
    if (entMissLogged) return
    entMissLogged = true
    console.info(
        "[Reports] client_entitlements is not available, so everything shows as before (run migrations_2026-11-04_tier_entitlements.sql).",
        why,
    )
}
interface MsState {
    for: string
    status: "loading" | "ready" | "error"
    snaps: MsSnap[]
    ranks: MsRankRow[]
    recs: MsRec[]
    anchor: MsSource["anchor"]
    error: string
}
const SNAP_SCORE_COLS = "id,run_date,overall,grade,seo,performance,accessibility,best_practices,onpage,security,issues_count,response_ms"
const RANK_PAGE = 1000
function ranksFromMonthly(d: SiteData): MsRankRow[] {
    const runOf = new Map(d.scores.map((s) => [s.month, s.run_date]))
    const out: MsRankRow[] = []
    d.ranks.forEach((r) => {
        const run_date = runOf.get(r.month) || r.month
        Object.entries(r.by_engine || {}).forEach(([engine, position]) =>
            out.push({ run_date, keyword: r.keyword, engine, position: num(position) }),
        )
    })
    return out
}
async function loadMilestonesLive(
    url: string,
    key: string,
    site: SiteRow,
    fallback: SiteData,
): Promise<Omit<MsState, "for" | "status" | "error">> {
    const sid = enc(site.id)
    const cid = enc(site.client_id)
    const opt = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
        try {
            return await fn()
        } catch (e) {
            return null
        }
    }
    const rankPages = async () => {
        const out: MsRankRow[] = []
        for (let page = 0; page < 40; page++) {
            const rows = await authGet<MsRankRow[]>(
                url,
                key,
                `/rest/v1/keyword_ranks?site_id=eq.${sid}&select=run_date,keyword,engine,position&order=run_date.asc,keyword.asc,engine.asc&limit=${RANK_PAGE}&offset=${page * RANK_PAGE}`,
            )
            out.push(...rows)
            if (rows.length < RANK_PAGE) break
        }
        return out
    }
    const [snaps, raw, plans, launches] = await Promise.all([
        authGet<MsSnap[]>(
            url,
            key,
            `/rest/v1/snapshots?site_id=eq.${sid}&incomplete=eq.false&select=${SNAP_SCORE_COLS}&order=run_date.asc&limit=1000`,
        ),
        opt(rankPages),
        opt(() =>
            authGet<
                {
                    kind: string
                    starts_on: string | null
                }[]
            >(url, key, `/rest/v1/client_plans?client_id=eq.${cid}&select=kind,starts_on`),
        ),
        opt(() =>
            authGet<
                {
                    launched_on: string | null
                }[]
            >(url, key, `/rest/v1/sites?client_id=eq.${cid}&select=launched_on`),
        ),
    ])
    const recs: MsRec[] = []
    const ids = snaps.map((x) => x.id)
    for (let i = 0; i < ids.length; i += 40) {
        const chunk = ids.slice(i, i + 40)
        recs.push(
            ...(await authGet<MsRec[]>(
                url,
                key,
                `/rest/v1/recommendations?snapshot_id=in.(${chunk.map(enc).join(",")})&select=snapshot_id,title&limit=2000`,
            )),
        )
    }
    return {
        snaps,
        ranks: raw && raw.length ? raw : ranksFromMonthly(fallback),
        recs,
        anchor: pickAnchor(plans, launches ? launches.map((x) => x.launched_on) : null, snaps),
    }
}
function demoMilestones(all: ReturnType<typeof buildDemo>, site: SiteRow, d: SiteData): Omit<MsState, "for" | "status" | "error"> {
    const snaps: MsSnap[] = d.scores
        .map((s) => {
            const sn = all.snapshots.find((x) => x.site_id === site.id && x.run_date === s.run_date)
            return {
                id: sn ? sn.id : `${site.id}-${s.run_date}`,
                run_date: s.run_date,
                overall: s.overall,
                grade: s.grade,
                seo: s.seo,
                performance: s.performance,
                accessibility: s.accessibility,
                best_practices: s.best_practices,
                onpage: s.onpage,
                security: s.security,
                issues_count: s.issues_count,
                response_ms: s.response_ms,
            }
        })
        .sort((a, b) => (a.run_date < b.run_date ? -1 : 1))
    const ids = new Set(snaps.map((x) => x.id))
    return {
        snaps,
        ranks: ranksFromMonthly(d),
        recs: all.recs.filter((r) => ids.has(r.snapshot_id)).map((r) => ({ snapshot_id: r.snapshot_id, title: r.title })),
        anchor: pickAnchor(
            all.plans.filter((x) => x.client_id === site.client_id),
            all.siteMeta.filter((x) => x.client_id === site.client_id).map((x) => x.launched_on),
            snaps,
        ),
    }
}
type NoticeTone = "warn" | "good" | "work" | "list"
interface Notice {
    id: string
    tone: NoticeTone
    icon: string
    title: string
    body: ReactNode
    href: string
    linkText: string
    hl?: string
}
const NOTICE_KIND: Record<NoticeTone, string> = {
    warn: "Needs attention",
    good: "Good news",
    work: "Done this month",
    list: "On your list",
}
const NOTICE_MAX = 5
const NOTICE_ROTATE_MS = 6000
const NOTICE_SCORE_STEP = 10
function missedChecks(c: CheckRow): number {
    const n = num(c.down_checks as any)
    return n !== null ? n : c.up ? 0 : 1
}
function hadOutage(c: CheckRow) {
    return missedChecks(c) > 0
}
function wholeDayDown(c: CheckRow) {
    const n = num(c.checks as any)
    const m = num(c.down_checks as any)
    return n !== null && m !== null ? n > 0 && m >= n : !c.up
}
function timeShort(iso: string) {
    const d = new Date(iso)
    const now = new Date()
    const t = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    return d.toDateString() === now.toDateString() ? t : `${t} on ${d.toLocaleDateString("en-US", { month: "long", day: "numeric" })}`
}
function buildNotices(d: SiteData, latest: string, seenBefore: boolean, monthlyReports = true): Notice[] {
    if (!latest) return []
    const out: Notice[] = []
    const prev = addMonths(latest, -1)
    const mName = monthName(latest)
    const pName = monthName(prev)
    const inLatest = (day: string) => day.slice(0, 7) === latest.slice(0, 7)
    const checks = d.checks.slice().sort((a, b) => (a.day < b.day ? -1 : a.day > b.day ? 1 : 0))
    const ping = d.pings && d.pings.length ? d.pings[0] : null
    const lastDay = checks.length ? checks[checks.length - 1] : null
    const downNow = ping ? !ping.up : !!lastDay && wholeDayDown(lastDay)
    if (downNow) {
        out.push({
            id: ping ? `down-${ping.checked_at}` : `down-${lastDay!.day}`,
            tone: "warn",
            icon: "alert",
            title: "Your site didn’t respond at our last check",
            body: (
                <>
                    {ping
                        ? `Our check at ${timeShort(ping.checked_at)} couldn’t reach it.`
                        : `Our latest check, on ${dayLong(lastDay!.day)}, couldn’t reach it.`}{" "}
                    If it still won’t load for you, email{" "}
                    <a className="ncr-link" href="mailto:hello@nordmeyercreative.com">
                        hello@nordmeyercreative.com
                    </a>
                    .
                </>
            ),
            href: "#uptime",
            linkText: "See uptime details",
            hl: "uptime-checks",
        })
    } else {
        const up = byMonth(d.uptime, latest)
        const fromMonth = num((up as any)?.days_with_outage)
        const days = fromMonth !== null ? fromMonth : checks.filter((c) => hadOutage(c) && inLatest(c.day)).length
        const pct = num(up?.uptime_pct)
        if (days > 0) {
            out.push({
                id: "outage",
                tone: "warn",
                icon: "alert",
                title: `Your site was briefly unreachable in ${mName}`,
                body: `Our checks couldn’t reach it on ${days} ${days === 1 ? "day" : "days"} this month.`,
                href: "#uptime",
                linkText: "See uptime details",
                hl: "uptime-checks",
            })
        } else if (!checks.some((c) => inLatest(c.day)) && pct !== null && pct < 100) {
            out.push({
                id: "outage",
                tone: "warn",
                icon: "alert",
                title: `Your site was briefly unreachable in ${mName}`,
                body: `Uptime for the month was ${pct}%.`,
                href: "#uptime",
                linkText: "See uptime details",
                hl: "uptime-checks",
            })
        }
    }
    const s = byMonth(d.scores, latest)
    const ps = byMonth(d.scores, prev)
    const scorePairs: {
        key: "overall" | "security"
        name: string
    }[] = [
        { key: "overall", name: "site health score" },
        { key: "security", name: "security score" },
    ]
    const rises: Notice[] = []
    scorePairs.forEach(({ key, name }) => {
        const a = num(ps?.[key])
        const b = num(s?.[key])
        if (a === null || b === null) return
        const diff = b - a
        if (diff <= -NOTICE_SCORE_STEP) {
            out.push({
                id: `drop-${key}`,
                tone: "warn",
                icon: "health",
                title: `Your ${name} dropped ${Math.abs(diff)} points`,
                body: `It went from ${a} to ${b} since ${pName}. The plan shows what comes next.`,
                href: "#health",
                linkText: "See site health",
                hl: `score:${key}`,
            })
        } else if (diff >= NOTICE_SCORE_STEP) {
            rises.push({
                id: `rise-${key}`,
                tone: "good",
                icon: "health",
                title: `Your ${name} rose ${diff} points`,
                body: `Up from ${a} to ${b} since ${pName}.`,
                href: "#health",
                linkText: "See site health",
                hl: `score:${key}`,
            })
        }
    })
    if (!seenBefore && s) {
        out.push({
            id: "ready",
            tone: "good",
            icon: "overview",
            title: monthlyReports ? `Your ${mName} report is ready` : `Your ${mName} numbers are in`,
            body: "Here’s how your site did, compared with the month before.",
            href: "#overview",
            linkText: "See the overview",
            hl: "overview",
        })
    }
    const prevRanks = d.ranks.filter((r) => r.month === prev)
    if (prevRanks.length) {
        const prevPos = new Map(prevRanks.map((r) => [r.keyword, gpos(r)]))
        const entered = d.ranks
            .filter((r) => r.month === latest)
            .filter((r) => {
                const n = gpos(r)
                if (n === null || n > 10) return false
                const p = prevPos.has(r.keyword) ? prevPos.get(r.keyword)! : null
                return p === null || p > 10
            })
            .sort((a, b) => (gpos(a) as number) - (gpos(b) as number))
        if (entered.length === 1) {
            const r = entered[0]
            const p = prevPos.get(r.keyword) ?? null
            out.push({
                id: "top10",
                tone: "good",
                icon: "search",
                title: `\u201c${r.keyword}\u201d reached page one`,
                body: `It’s now at position ${gpos(r)} on Google, up from ${p === null ? "outside the top 50" : `position ${p}`} in ${pName}.`,
                href: "#search",
                linkText: "See search positions",
                hl: `kw:${entered[0].keyword}`,
            })
        } else if (entered.length > 1) {
            out.push({
                id: "top10",
                tone: "good",
                icon: "search",
                title: `${entered.length} of your searches reached page one`,
                body: `Including \u201c${entered[0].keyword}\u201d and \u201c${entered[1].keyword}\u201d.`,
                href: "#search",
                linkText: "See search positions",
                hl: `kw:${entered[0].keyword}`,
            })
        }
    }
    out.push(...rises)
    const done = d.work.filter((w) => isDoneWork(w) && inLatest(w.done_on)).length
    if (done > 0) {
        out.push({
            id: "work",
            tone: "work",
            icon: "work",
            title: `We finished ${done} ${done === 1 ? "improvement" : "improvements"} in ${mName}`,
            body: "Each one is listed in the work log, with what changed.",
            href: "#work",
            linkText: "See the work log",
            hl: `work:${latest}`,
        })
    }
    const added = d.work.filter((w) => w.status === "up_next" && w.created_at && inLatest(w.created_at.slice(0, 10)))
    if (added.length) {
        out.push({
            id: `added-${added
                .map((w) => w.id)
                .sort()
                .join(",")}`,
            tone: "list",
            icon: "calendar",
            title: added.length === 1 ? `We’ve added “${added[0].title}” to your list` : `We’ve added ${added.length} items to your list`,
            body: added.length === 1 ? "It’s up next in your work log." : added.map((w) => w.title).join(". ") + ".",
            href: "#work",
            linkText: "See what we’re working on",
            hl: "work:open",
        })
    }
    return out
}
function dateFull(s: string) {
    return parseDay(s).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}
function planMonth(
    p: PlanRow,
    now: Date,
): {
    n: number
    of: number
} | null {
    if (!p.starts_on) return null
    const a = parseDay(p.starts_on)
    let n = (now.getFullYear() - a.getFullYear()) * 12 + (now.getMonth() - a.getMonth()) + 1
    n = Math.max(1, n)
    let of = 0
    if (p.ends_on) {
        const b = parseDay(p.ends_on)
        const end = new Date(b.getFullYear(), b.getMonth(), b.getDate() + 1)
        of = (end.getFullYear() - a.getFullYear()) * 12 + (end.getMonth() - a.getMonth()) + (end.getDate() > a.getDate() ? 1 : 0)
    }
    if (of > 0) n = Math.min(n, of)
    return { n, of }
}
function billedOn(p: PlanRow): string | null {
    if (p.kind !== "subscription" || p.complimentary || !p.starts_on) return null
    if (p.billing === "year") return "Billed once a year"
    if (p.billing !== "month") return null
    const d = parseDay(p.starts_on).getDate()
    const suffix = d === 1 || d === 21 || d === 31 ? "st" : d === 2 || d === 22 ? "nd" : d === 3 || d === 23 ? "rd" : "th"
    return `Billed on the ${d}${suffix} of each month`
}
const NOTICE_KEY = (site: string, month: string) => `nc-reports-notices:${site}:${month}`
const SEEN_KEY = (site: string) => `nc-reports-seen:${site}`
export default function ReportsDashboardV2(props: Props) {
    const {
        supabaseUrl = "",
        supabaseKey = "",
        signInPath = "/reports",
        demoMode = false,
        contactPath = "/contact",
        plansPath = "/solutions",
        aboutPath = "/sucher",
        portalUrl = PORTAL_URL,
        jagerPreview = false,
        style,
    } = props
    const isStatic = useIsStaticRenderer()
    const reduce = useReducedMotion()
    const url = demoMode ? "" : cleanUrl(supabaseUrl)
    const key = demoMode ? "" : (supabaseKey || "").trim()
    const misconfigured = !demoMode && !!url !== !!key
    const demo = demoMode || (!url && !key) || isStatic
    const probeUrl = demoMode ? cleanUrl(supabaseUrl) : ""
    const probeKey = demoMode ? (supabaseKey || "").trim() : ""
    const { mode, toggle } = useNcTheme(!isStatic)
    const [phase, setPhase] = useState<"checking" | "ready" | "error" | "no-access" | "config">(
        misconfigured && !isStatic ? "config" : demo ? "ready" : "checking",
    )
    const [error, setError] = useState("")
    const [demoAll] = useState(() => buildDemo())
    const [clients, setClients] = useState<ClientRow[]>(demo ? demoAll.clients : [])
    const [sites, setSites] = useState<SiteRow[]>(demo ? demoAll.sites : [])
    const [isStaff, setIsStaff] = useState(false)
    const [siteQuery, setSiteQuery] = useState("")
    const [staffRows, setStaffRows] = useState<StaffSiteRow[] | null>(null)
    const [staffError, setStaffError] = useState("")
    const [clientId, setClientId] = useState<string>(demo ? demoAll.clients[0].id : "")
    const [siteId, setSiteId] = useState<string>(demo ? demoAll.sites[0].id : "")
    const [rawData, setData] = useState<SiteData | null>(demo ? demoSite(demoAll, demoAll.sites[0]) : null)
    const [entState, setEntState] = useState<{
        for: string
        ent: Entitlements | null
    } | null>(null)
    const [entKey, setEntKey] = useState(0)
    const [viewAsOn, setViewAsOn] = useSessionValue<boolean>("nc-reports-view-as", false)
    const [viewAsLogin, setViewAsLogin] = useSessionValue<string>("nc-reports-view-as-login", "")
    const [viewAsMembers, setViewAsMembers] = useState<{
        for: string
        list: MemberRow[]
    } | null>(null)
    const [matrices, setMatrices] = useState<Matrices | null>(null)
    const [demoStaff, setDemoStaff] = useState(false)
    const [previewTier, setPreviewTier] = useState<Tier | "">("")
    const viewing = viewAsOn && isStaff && !demo
    const staffNormal = isStaff && !demo && !viewing
    const ent: Entitlements | null = demo
        ? previewTier && matrices && matrices[previewTier]
            ? { tier: previewTier, features: matrices[previewTier] as Features, viewer_role: "owner" }
            : null
        : entState && entState.for === clientId
          ? entState.ent
          : null
    const viewAsRole =
        viewing && viewAsLogin && viewAsMembers && viewAsMembers.for === clientId
            ? viewAsMembers.list.find((m) => m.email === viewAsLogin)?.role || null
            : null
    const F: Features = featuresFor(ent, { staff: isStaff && !demo, viewAs: viewing })
    const role = roleFor(ent, { staff: isStaff && !demo, viewAs: viewing }, viewAsRole)
    const clientF: Features | null = staffNormal && ent ? ent.features : null
    const staffChip = (g: Gate) => (clientF && !allows(clientF, g) ? <TierChip gate={g} matrices={matrices} /> : null)
    const staffNote = (g: Gate, text: string) => {
        const c = staffChip(g)
        return c ? (
            <p className="ncr-staffnote">
                {c}
                <span>{text}</span>
            </p>
        ) : null
    }
    const hasEnt = !!ent
    const data = useMemo(() => shapeData(rawData, F, hasEnt), [rawData, F, hasEnt])
    const [loadingSite, setLoadingSite] = useState(false)
    const [demoBusy, setDemoBusy] = useState(false)
    const [month, setMonth] = useState<string>("")
    const [section, setSection] = useState<SectionId>("overview")
    const [msId, setMsId] = useState<string | null>(null)
    const [ms, setMs] = useState<MsState | null>(null)
    const [planTarget, setPlanTarget] = useState<string | null>(null)
    const [railOpen, setRailOpen] = useState(false)
    const rail = !railOpen
    const railTimer = useRef<number | null>(null)
    const railHover = useRef(false)
    const railSuppress = useRef(false)
    const sidebarRef = useRef<HTMLDivElement>(null)
    const [drawer, setDrawer] = useState(false)
    const [attempt, setAttempt] = useState(0)
    const [refreshKey, setRefreshKey] = useState(0)
    const [tourOffer, setTourOffer] = useState(false)
    const [tourStep, setTourStep] = useState<number | null>(null)
    const [tourList, setTourList] = useState(TOUR)
    const tourListRef = useRef(TOUR)
    const msLatestRef = useRef<string | null>(null)
    const noticeCountRef = useRef(0)
    const [nordyPx, setNordyPx] = useState(84)
    const [nordyMenu, setNordyMenu] = useState(false)
    const [checkin, setCheckin] = useState(false)
    const tourNav = useRef(false)
    const rootRef = useRef<HTMLDivElement>(null)
    const [noticeStore, setNoticeStore] = useState<{
        key: string
        dismissed: string[]
        seenBefore: boolean
    } | null>(null)
    const [flash, setFlash] = useState<string | null>(null)
    const pendingNoticeFocus = useRef<string | null>(null)
    const headingRef = useRef<HTMLHeadingElement>(null)
    const menuBtnRef = useRef<HTMLButtonElement>(null)
    const [greet, setGreet] = useState("Hello")
    useEffect(() => {
        setGreet(greetingFor(new Date().getHours()))
    }, [])
    const [activePart, setActivePart] = useState("")
    const [msTab, setMsTab] = useState<"all" | "month" | "quarter" | "year">("all")
    const [acctMenu, setAcctMenu] = useState(false)
    const acctRef = useRef<HTMLDivElement>(null)
    const acctBtnRef = useRef<HTMLButtonElement>(null)
    useEffect(() => {
        if (!acctMenu) return
        const onDown = (e: MouseEvent) => {
            if (acctRef.current && !acctRef.current.contains(e.target as Node)) setAcctMenu(false)
        }
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                setAcctMenu(false)
                acctBtnRef.current?.focus()
            }
        }
        document.addEventListener("mousedown", onDown)
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("mousedown", onDown)
            document.removeEventListener("keydown", onKey)
        }
    }, [acctMenu])
    const reportOpen = section === "reports" && !!msId
    const parts: PartSpec[] = useMemo(() => {
        const all: PartSpec[] = section === "reports" ? (reportOpen ? PART_TABS.report : PART_TABS.reports) : PART_TABS[section] || []
        return all.filter((p) => {
            if (section === "reports" && !reportOpen)
                return p.report === "month" ? F.reports_monthly : p.report !== "quarter" || F.reports_quarterly
            if (section === "search" && p.key === "ai") return F.ai_visibility !== "none"
            if (section === "search" && p.key === "google") return seoAny(demo ? { ...F, seo_detail: false } : F)
            if (section === "search") return F.ranks
            if (section === "traffic" && p.key === "trends") return F.trend_reports
            if (section === "traffic" && p.key === "sources") return F.traffic_breakdown !== "none"
            if (section === "account" && (p.key === "plan" || p.key === "access")) return role !== "member"
            return true
        })
    }, [section, reportOpen, F, role, demo])
    const partsKey = `${section}|${month}|${siteId}|${msId || ""}|${phase}`
    useEffect(() => {
        setActivePart("")
        setMsTab("all")
    }, [partsKey])
    useEffect(() => {
        const root = rootRef.current
        const sec = root?.querySelector<HTMLElement>(".ncr-section")
        if (!sec) return
        const clear = () =>
            sec
                .querySelectorAll(".is-ncr-hidden, .is-ncr-solo, .is-ncr-empty")
                .forEach((n) => n.classList.remove("is-ncr-hidden", "is-ncr-solo", "is-ncr-empty"))
        const active = parts.find((p) => p.key === activePart) || null
        const apply = () => {
            clear()
            if (!active || !active.keep) return
            const kept = active.keep.flatMap((sel) => Array.from(sec.querySelectorAll<HTMLElement>(sel)))
            if (!kept.length) return
            const keepsSomething = (el: Element) => kept.some((k) => el === k || el.contains(k))
            for (const k of kept) {
                let node: HTMLElement = k
                while (node !== sec && node.parentElement) {
                    const parent = node.parentElement
                    let visible = 0
                    Array.from(parent.children).forEach((sib) => {
                        if (keepsSomething(sib)) visible++
                        else sib.classList.add("is-ncr-hidden")
                    })
                    if (
                        visible === 1 &&
                        /ncr-score-grid|ncr-kpi-row|ncr-kpi-pair|ncr-acct-row|ncr-ms-two|ncr-overview-top/.test(parent.className)
                    )
                        parent.classList.add("is-ncr-solo")
                    node = parent
                }
            }
            if (active.rows) {
                const { row, text, match, exclude, empty } = active.rows
                let total = 0
                const holders = kept.filter((k) => k.querySelector(row))
                for (const k of holders) {
                    let shown = 0
                    k.querySelectorAll<HTMLElement>(row).forEach((r) => {
                        const ok = text
                            ? (r.querySelector(text.in)?.textContent || "").trim() === text.is
                            : match
                              ? !!r.querySelector(match) || r.matches(match)
                              : exclude
                                ? !(r.querySelector(exclude) || r.matches(exclude))
                                : true
                        if (ok) shown++
                        else r.classList.add("is-ncr-hidden")
                    })
                    total += shown
                    if (!shown) k.classList.add("is-ncr-hidden")
                }
                if (!total && holders[0]) {
                    holders[0].classList.remove("is-ncr-hidden")
                    holders[0].classList.add("is-ncr-empty")
                    holders[0].dataset.ncrEmpty = empty || "Nothing to show here right now."
                }
            }
        }
        apply()
        let t = 0
        const mo = new MutationObserver(() => {
            window.clearTimeout(t)
            t = window.setTimeout(apply, 40)
        })
        mo.observe(sec, { childList: true, subtree: true })
        return () => {
            mo.disconnect()
            window.clearTimeout(t)
            clear()
        }
    }, [activePart, parts, msTab])
    const [introPlay, setIntroPlay] = useState(true)
    const introSeed = `${section}|${siteId}`
    const introFirst = useRef(true)
    useEffect(() => {
        if (introFirst.current) {
            introFirst.current = false
            return
        }
        setIntroPlay(true)
    }, [introSeed])
    const choosePart = (p: PartSpec | null) => {
        setActivePart(p ? p.key : "")
        if (section === "reports" && !reportOpen) setMsTab(p && p.report ? p.report : "all")
        const top = headingRef.current?.getBoundingClientRect().top ?? 0
        if (top < 0) headingRef.current?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" })
    }
    const drawerRef = useRef<HTMLDivElement>(null)
    const firstRender = useRef(true)
    const userNav = useRef(false)
    const site = sites.find((s) => s.id === siteId) || null
    const client = clients.find((c) => c.id === clientId) || null
    const clientSites = sites.filter((s) => s.client_id === clientId)
    useEffect(() => {
        if (typeof window === "undefined" || isStatic) return
        const read = (fromUser: boolean) => {
            const [h, sub] = window.location.hash.replace("#", "").split("/") as [SectionId, string | undefined]
            userNav.current = fromUser && !tourNav.current
            tourNav.current = false
            if (ALL_SECTIONS.some((s) => s.id === h)) setSection(h)
            else setSection("overview")
            let id: string | null = null
            if (h === "reports" && sub) {
                try {
                    id = decodeURIComponent(sub)
                } catch (e) {
                    id = null
                }
            }
            setMsId(id)
        }
        read(false)
        const onHash = () => read(true)
        window.addEventListener("hashchange", onHash)
        return () => window.removeEventListener("hashchange", onHash)
    }, [isStatic])
    useEffect(() => {
        if (firstRender.current) {
            firstRender.current = false
            return
        }
        if (typeof window === "undefined" || !userNav.current) return
        window.scrollTo({ top: 0, behavior: "auto" })
        headingRef.current?.focus({ preventScroll: true })
    }, [section, msId])
    useEffect(() => {
        if (typeof window === "undefined" || isStatic) return
        const onClick = (e: MouseEvent) => {
            const t = e.target as Element | null
            if (!t || !t.closest || !t.closest(".nc-skip-link")) return
            if (!headingRef.current) return
            e.preventDefault()
            e.stopImmediatePropagation()
            headingRef.current.focus({ preventScroll: true })
            headingRef.current.scrollIntoView({ block: "start" })
        }
        window.addEventListener("click", onClick, true)
        return () => window.removeEventListener("click", onClick, true)
    }, [isStatic])
    const clearRailTimer = () => {
        if (railTimer.current !== null) {
            window.clearTimeout(railTimer.current)
            railTimer.current = null
        }
    }
    useEffect(() => () => clearRailTimer(), [])
    const railKeepsOpen = () => {
        const el = sidebarRef.current
        const a = typeof document !== "undefined" ? (document.activeElement as HTMLElement | null) : null
        if (!el || !a || !el.contains(a)) return false
        return a.tagName === "SELECT" || a.matches(":focus-visible")
    }
    const collapseRailNow = () => {
        clearRailTimer()
        setRailOpen(false)
        railSuppress.current = railHover.current
    }
    useEffect(() => {
        if (!railOpen || typeof document === "undefined") return
        const onDown = (e: PointerEvent) => {
            const el = sidebarRef.current
            if (!el || el.contains(e.target as Node)) return
            const focusInside = !!document.activeElement && el.contains(document.activeElement)
            clearRailTimer()
            setRailOpen(false)
            if (focusInside) headingRef.current?.focus({ preventScroll: true })
        }
        document.addEventListener("pointerdown", onDown, true)
        return () => document.removeEventListener("pointerdown", onDown, true)
    }, [railOpen])
    const onRailEnter = (e: RPointerEvent) => {
        if (e.pointerType !== "mouse" || lockedRef.current) return
        railHover.current = true
        if (railSuppress.current) return
        clearRailTimer()
        railTimer.current = window.setTimeout(() => setRailOpen(true), RAIL_OPEN_MS)
    }
    const onRailLeave = (e: RPointerEvent) => {
        if (e.pointerType !== "mouse") return
        railHover.current = false
        railSuppress.current = false
        clearRailTimer()
        railTimer.current = window.setTimeout(() => {
            if (!railKeepsOpen()) setRailOpen(false)
        }, RAIL_CLOSE_MS)
    }
    const onRailFocus = (e: RFocusEvent<HTMLDivElement>) => {
        const t = e.target as HTMLElement
        if (t.matches && t.matches(":focus-visible")) {
            clearRailTimer()
            setRailOpen(true)
        }
    }
    const onRailBlur = (e: RFocusEvent<HTMLDivElement>) => {
        const next = e.relatedTarget as Node | null
        if (next && sidebarRef.current?.contains(next)) return
        if (railHover.current) return
        clearRailTimer()
        railTimer.current = window.setTimeout(() => {
            if (!railHover.current && !railKeepsOpen()) setRailOpen(false)
        }, RAIL_CLOSE_MS)
    }
    const onRailKey = (e: RKeyboardEvent<HTMLDivElement>) => {
        if (e.key !== "Escape" || !railOpen) return
        e.preventDefault()
        setRailOpen(false)
        headingRef.current?.focus({ preventScroll: true })
    }
    useEffect(() => {
        if (isStatic || typeof window === "undefined") return
        if (demoMode) {
            setTourOffer(true)
            return
        }
        if (phase !== "ready") return
        try {
            if (!window.localStorage.getItem(TOUR_OFFERED_KEY)) {
                setTourOffer(true)
                window.localStorage.setItem(TOUR_OFFERED_KEY, "1")
            }
        } catch (e) {}
    }, [demoMode, isStatic, phase])
    const goToStep = useCallback((i: number, dir: 1 | -1 = 1) => {
        let step = tourListRef.current[i]
        if (!step) return
        if (step.report && !msLatestRef.current) {
            const list = tourListRef.current.filter((x) => !x.report)
            tourListRef.current = list
            setTourList(list)
            i = dir > 0 ? i : i - 1
            step = list[i]
            if (!step) return
        }
        const target = step.report ? `${step.section}/${msLatestRef.current}` : step.section
        setTourOffer(false)
        setCheckin(false)
        setTourStep(i)
        if (typeof window !== "undefined" && window.location.hash.replace("#", "") !== target) {
            tourNav.current = true
            window.location.hash = target
        }
    }, [])
    const startTour = useCallback(() => {
        const first = sites.find((x) => x.client_id === clientId) || sites[0]
        if (first && first.id !== siteId) setSiteId(first.id)
        if (demoMode) setNoticeStore((st) => (st ? { ...st, dismissed: [] } : st))
        const list = TOUR.filter((t) => t.target !== "notices" || demoMode || noticeCountRef.current > 0)
        tourListRef.current = list
        setTourList(list)
        goToStep(0)
    }, [sites, clientId, siteId, goToStep, demoMode])
    const endTour = useCallback(() => {
        setTourStep(null)
        setTourOffer(false)
    }, [])
    const onNordy = useCallback(
        (a: NordyTourAction) => {
            if (a === "start") startTour()
            else if (a === "next" && tourStep !== null) goToStep(tourStep + 1)
            else if (a === "back" && tourStep !== null) goToStep(tourStep - 1, -1)
            else if (a === "end") endTour()
            else if (a === "checkin-close") setCheckin(false)
        },
        [startTour, goToStep, endTour, tourStep],
    )
    const checkinDone = useRef(false)
    const blockers = useRef({ tour: false, drawer: false, rail: false, menu: false })
    blockers.current = { tour: tourStep !== null || tourOffer, drawer, rail: railOpen, menu: nordyMenu }
    useEffect(() => {
        if (!demoMode || isStatic || typeof window === "undefined") return
        let visible = 0
        const iv = window.setInterval(() => {
            if (checkinDone.current) return
            if (document.visibilityState === "visible") visible += 1000
            if (visible < CHECKIN_MS) return
            const b = blockers.current
            const a = document.activeElement as HTMLElement | null
            const typing = !!a && (a.tagName === "INPUT" || a.tagName === "TEXTAREA" || a.tagName === "SELECT" || a.isContentEditable)
            if (b.tour || b.drawer || b.rail || b.menu || typing) return
            checkinDone.current = true
            setCheckin(true)
        }, 1000)
        return () => window.clearInterval(iv)
    }, [demoMode, isStatic])
    useEffect(() => {
        if (tourStep === null || typeof window === "undefined") return
        const target = tourListRef.current[tourStep]?.target
        let raf = 0
        let tries = 0
        const find = () => {
            const el = rootRef.current?.querySelector<HTMLElement>(`[data-tour="${target}"]`)
            if (el) {
                el.scrollIntoView({ block: "start", behavior: reduce ? "auto" : "smooth" })
                return
            }
            if (tries++ < 10) raf = requestAnimationFrame(find)
        }
        raf = requestAnimationFrame(find)
        return () => cancelAnimationFrame(raf)
    }, [tourStep, section, msId, siteId, reduce])
    const focusIfSame = (href: string) => {
        if (href === `#${section}`) headingRef.current?.focus({ preventScroll: true })
    }
    useEffect(() => {
        if (!flash || typeof window === "undefined") return
        let tries = 0
        let raf = 0
        let el: HTMLElement | null = null
        const find = () => {
            el = rootRef.current?.querySelector<HTMLElement>(`[data-hl="${CSS.escape(flash)}"]`) || null
            if (el) {
                el.classList.add("is-flash")
                el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" })
                return
            }
            if (tries++ < 30) raf = requestAnimationFrame(find)
        }
        raf = requestAnimationFrame(find)
        const t = window.setTimeout(() => {
            el?.classList.remove("is-flash")
            setFlash(null)
        }, 2600)
        return () => {
            cancelAnimationFrame(raf)
            window.clearTimeout(t)
            el?.classList.remove("is-flash")
        }
    }, [flash, section, reduce])
    useEffect(() => {
        if (section !== "plan" || !planTarget || typeof window === "undefined") return
        let tries = 0
        let raf = 0
        const find = () => {
            const el = rootRef.current?.querySelector<HTMLElement>(`[data-plan-key="${planTarget}"]`)
            if (el) {
                el.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" })
                return
            }
            if (tries++ < 20) raf = requestAnimationFrame(find)
        }
        raf = requestAnimationFrame(find)
        const t = window.setTimeout(() => setPlanTarget(null), 4000)
        return () => {
            cancelAnimationFrame(raf)
            window.clearTimeout(t)
        }
    }, [section, planTarget, reduce])
    const tourTarget = tourStep !== null ? tourList[tourStep]?.target || "" : ""
    const tourCls = (k: string) => (tourTarget === k ? " is-tour" : "")
    useEffect(() => {
        if (demo || misconfigured || typeof window === "undefined") return
        let cancelled = false
        ;(async () => {
            setPhase("checking")
            setError("")
            const s = await liveSession(url, key)
            if (!s) {
                window.location.replace(signInPath)
                return
            }
            try {
                const [staff, cl, st] = await Promise.all([
                    authGet<
                        {
                            user_id: string
                        }[]
                    >(url, key, `/rest/v1/staff?select=user_id`),
                    authGet<ClientRow[]>(url, key, `/rest/v1/clients?select=id,slug,name&order=name.asc`),
                    authGet<SiteRow[]>(url, key, `/rest/v1/sites?select=id,client_id,domain,site_name,platform&order=domain.asc`),
                ])
                if (cancelled) return
                setIsStaff(staff.length > 0)
                setClients(cl)
                setSites(st)
                if (!cl.length || !st.length) {
                    setPhase("no-access")
                    return
                }
                let firstClient = cl.find((c) => st.some((x) => x.client_id === c.id)) || cl[0]
                let firstSite = st.find((x) => x.client_id === firstClient.id)
                if (staff.length > 0) {
                    const me = await authGet<{
                        email?: string
                    }>(url, key, `/auth/v1/user`).catch(() => null)
                    if (cancelled) return
                    setMeEmail((me?.email || "").trim().toLowerCase())
                    const bare = (d: string) =>
                        (d || "")
                            .trim()
                            .toLowerCase()
                            .replace(/^https?:\/\//, "")
                            .replace(/^www\./, "")
                            .replace(/[/:].*$/, "")
                    const at = (me?.email || "").lastIndexOf("@")
                    const domain = at >= 0 ? bare((me?.email || "").slice(at + 1)) : ""
                    const own = domain ? st.find((x) => bare(x.domain) === domain) : undefined
                    const ownClient = own ? cl.find((c) => c.id === own.client_id) : undefined
                    if (own && ownClient) {
                        firstClient = ownClient
                        firstSite = own
                    }
                }
                if (!(staff.length > 0)) setMeEmail("")
                setClientId(firstClient.id)
                setSiteId(firstSite ? firstSite.id : "")
                setPhase("ready")
            } catch (e: any) {
                if (cancelled) return
                if (e instanceof ReportsError && e.status === 401) {
                    window.location.replace(signInPath)
                    return
                }
                setError(e?.message || "Something went wrong while loading your report.")
                setPhase("error")
            }
        })()
        return () => {
            cancelled = true
        }
    }, [demo, misconfigured, url, key, signInPath, attempt])
    const loadSeq = useRef(0)
    useEffect(() => {
        const seq = ++loadSeq.current
        if (!site) {
            setLoadingSite(false)
            return
        }
        if (demo) {
            setData(demoSite(demoAll, site))
            setLoadingSite(false)
            return
        }
        const current = () => seq === loadSeq.current
        setLoadingSite(true)
        let timer = 0
        const timeout = new Promise<never>((_, reject) => {
            timer = window.setTimeout(() => reject(new Error("LOAD_TIMEOUT")), LOAD_TIMEOUT_MS)
        })
        Promise.race([loadLive(url, key, site), timeout])
            .then((d) => {
                if (!current()) return
                setData(d)
                setLoadingSite(false)
            })
            .catch((e: any) => {
                if (!current()) return
                setLoadingSite(false)
                if (e?.message === "LOAD_TIMEOUT") {
                    setError(STALL_MESSAGE)
                    setPhase("error")
                    return
                }
                if (e instanceof ReportsError && e.status === 401) {
                    window.location.replace(signInPath)
                    return
                }
                setError(e?.message || "Something went wrong while loading this site’s report.")
                setPhase("error")
            })
            .finally(() => window.clearTimeout(timer))
        return () => {
            loadSeq.current++
            window.clearTimeout(timer)
        }
    }, [siteId, demo, url, key, attempt])
    const loadingSiteRef = useRef(false)
    loadingSiteRef.current = loadingSite
    const reloadAll = useCallback(async () => {
        if (!site) return
        if (demo) {
            await new Promise<void>((r) => window.setTimeout(r, 700))
            setData(demoSite(demoAll, site))
            setRefreshKey((k) => k + 1)
            return
        }
        if (loadingSiteRef.current) return
        const seq = loadSeq.current
        let timer = 0
        const timeout = new Promise<never>((_, reject) => {
            timer = window.setTimeout(() => reject(new Error("LOAD_TIMEOUT")), LOAD_TIMEOUT_MS)
        })
        try {
            const d = await Promise.race([loadLive(url, key, site), timeout])
            if (seq !== loadSeq.current) return
            setData(d)
            setRefreshKey((k) => k + 1)
        } catch (e: any) {
            if (e instanceof ReportsError && e.status === 401) {
                window.location.replace(signInPath)
                return
            }
            throw e
        } finally {
            window.clearTimeout(timer)
        }
    }, [site, demo, demoAll, url, key, signInPath])
    const rf = useDashboardRefresh({
        demo,
        staff: staffNormal || (!isStaff && !demo && !!ent && F.fresh_pull),
        audience: staffNormal ? "staff" : "client",
        reload: reloadAll,
        siteIds: () => (section === "sites" ? sites.map((x) => x.id) : siteId ? [siteId] : []),
        request: async (sid) => {
            const r = await rpcCall<RefreshRow | RefreshRow[]>(url, key, "request_refresh", { sid })
            return Array.isArray(r) ? r[0] : r
        },
        poll: (ids) =>
            authGet<RefreshRow[]>(
                url,
                key,
                "/rest/v1/refresh_requests?id=in.(" +
                    ids.map(enc).join(",") +
                    ")&select=id,site_id,status,requested_at,started_at,finished_at,message",
            ),
    })
    useEffect(() => {
        if (!loadingSite && data) rf.markLoaded()
    }, [loadingSite, siteId])
    const siteClientId = site ? site.client_id : ""
    useEffect(() => {
        if (!siteId || !siteClientId || demo || phase !== "ready" || typeof window === "undefined") return
        const cid = enc(siteClientId)
        const sid = enc(siteId)
        let stopped = false
        let busy = false
        const tick = async () => {
            if (stopped || busy || document.visibilityState !== "visible") return
            busy = true
            try {
                const work = await loadWork(url, key, cid, sid)
                if (stopped) return
                setData((d: SiteData | null) => (d && JSON.stringify(d.work) !== JSON.stringify(work) ? { ...d, work } : d))
            } catch (e: any) {
                if (!stopped && e instanceof ReportsError && e.status === 401) window.location.replace(signInPath)
            } finally {
                busy = false
            }
        }
        const iv = window.setInterval(tick, WORK_REFRESH_MS)
        const onBack = () => {
            if (document.visibilityState === "visible") tick()
        }
        document.addEventListener("visibilitychange", onBack)
        window.addEventListener("focus", onBack)
        return () => {
            stopped = true
            window.clearInterval(iv)
            document.removeEventListener("visibilitychange", onBack)
            window.removeEventListener("focus", onBack)
        }
    }, [siteId, siteClientId, demo, phase, url, key, signInPath])
    const months = useMemo(() => {
        if (!data) return [] as string[]
        const set = new Set<string>()
        ;[data.scores, data.traffic, data.uptime, data.ranks].forEach((rows) => rows.forEach((r: any) => r.month && set.add(r.month)))
        return Array.from(set).sort().reverse()
    }, [data])
    useEffect(() => {
        if (!data) return
        if (month && months.includes(month)) return
        const scored = data.scores.map((s) => s.month).sort()
        setMonth(scored.length ? scored[scored.length - 1] : months[0] || "")
    }, [data, months])
    const signOut = useCallback(async () => {
        if (demo) {
            window.location.assign(signInPath)
            return
        }
        await signOutRemote(url, key)
        window.location.replace(signInPath)
    }, [demo, url, key, signInPath])
    useEffect(() => {
        if (!drawer || typeof document === "undefined") return
        const prevOverflow = document.body.style.overflow
        document.body.style.overflow = "hidden"
        const panel = drawerRef.current
        const focusables = () =>
            Array.from(panel?.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),select,[tabindex]:not([tabindex="-1"])') || [])
        requestAnimationFrame(() => focusables()[0]?.focus())
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                e.preventDefault()
                setDrawer(false)
                return
            }
            if (e.key !== "Tab") return
            const list = focusables()
            if (!list.length) return
            const first = list[0]
            const last = list[list.length - 1]
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault()
                last.focus()
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault()
                first.focus()
            }
        }
        document.addEventListener("keydown", onKey)
        return () => {
            document.removeEventListener("keydown", onKey)
            document.body.style.overflow = prevOverflow
            const a = document.activeElement
            if (!a || a === document.body || (panel && panel.contains(a))) menuBtnRef.current?.focus()
        }
    }, [drawer])
    useEffect(() => {
        setDrawer(false)
    }, [section])
    const prevKey = month ? addMonths(month, -1) : ""
    const cur = useMemo(() => {
        if (!data || !month) return null
        return {
            score: byMonth(data.scores, month),
            prevScore: byMonth(data.scores, prevKey),
            traffic: byMonth(data.traffic, month),
            prevTraffic: byMonth(data.traffic, prevKey),
            uptime: byMonth(data.uptime, month),
            prevUptime: byMonth(data.uptime, prevKey),
            ranks: data.ranks.filter((r) => r.month === month),
            prevRanks: data.ranks.filter((r) => r.month === prevKey),
        }
    }, [data, month, prevKey])
    const window12 = useMemo(() => {
        if (!month) return [] as string[]
        return Array.from({ length: 12 }, (_, i) => addMonths(month, i - 11))
    }, [month])
    const planSnapshot = useMemo(() => {
        if (!data || !month) return null
        const scoreRun = cur?.score?.run_date
        const inMonth = data.snapshots.filter((s) => !s.incomplete && s.run_date.slice(0, 7) === month.slice(0, 7))
        return (scoreRun && inMonth.find((s) => s.run_date === scoreRun)) || inMonth[0] || null
    }, [data, month, cur])
    const plan = useMemo(
        () =>
            planSnapshot && data ? data.recs.filter((r) => r.snapshot_id === planSnapshot.id).sort((a, b) => a.position - b.position) : [],
        [planSnapshot, data],
    )
    const lastChecked = cur?.score?.run_date || planSnapshot?.run_date || ""
    const latestMonth = useMemo(() => {
        if (!data) return ""
        const scored = data.scores.map((x) => x.month).sort()
        return scored.length ? scored[scored.length - 1] : months[0] || ""
    }, [data, months])
    useEffect(() => {
        if (!siteId || !latestMonth || typeof window === "undefined") return
        const key = NOTICE_KEY(siteId, latestMonth)
        if (demoMode || isStatic) {
            setNoticeStore({ key, dismissed: [], seenBefore: false })
            return
        }
        let dismissed: string[] = []
        let seenBefore = false
        try {
            const raw = window.localStorage.getItem(key)
            const parsed = raw ? JSON.parse(raw) : []
            if (Array.isArray(parsed)) dismissed = parsed.filter((x) => typeof x === "string")
            seenBefore = window.localStorage.getItem(SEEN_KEY(siteId)) === latestMonth
            window.localStorage.setItem(SEEN_KEY(siteId), latestMonth)
        } catch (e) {}
        setNoticeStore({ key, dismissed, seenBefore })
    }, [siteId, latestMonth, demoMode, isStatic])
    const notices = useMemo(() => {
        if (!data || !latestMonth || !noticeStore || noticeStore.key !== NOTICE_KEY(siteId, latestMonth)) return [] as Notice[]
        return buildNotices(data, latestMonth, noticeStore.seenBefore, F.reports_monthly)
            .filter((n) => !noticeStore.dismissed.includes(n.id))
            .slice(0, NOTICE_MAX)
    }, [data, latestMonth, noticeStore, siteId, F.reports_monthly])
    noticeCountRef.current = notices.length
    const dismissNotice = useCallback(
        (id: string, leaving?: boolean) => {
            const ids = notices.map((n) => n.id)
            pendingNoticeFocus.current = leaving || ids.length > 1 ? null : "__heading"
            setNoticeStore((st) => {
                if (!st) return st
                const next = { ...st, dismissed: Array.from(new Set([...st.dismissed, id])) }
                if (!demoMode) {
                    try {
                        window.localStorage.setItem(st.key, JSON.stringify(next.dismissed))
                    } catch (e) {}
                }
                return next
            })
        },
        [notices, demoMode],
    )
    const [account, setAccount] = useState<AccountState | null>(null)
    const accountKeyRef = useRef(0)
    useEffect(() => {
        if (section !== "account" || phase !== "ready" || !clientId) return
        if (demo) {
            const today = new Date().toISOString().slice(0, 10)
            const ev = demoAll.events
                .filter((e) => e.client_id === clientId && e.starts_on >= today)
                .sort((x, y) => (x.starts_on < y.starts_on ? -1 : 1))
            setAccount({
                for: clientId,
                status: "ready",
                plans: demoAll.plans.filter((x) => x.client_id === clientId),
                email: "owner@harborandpine.example",
                lastSignIn: new Date(Date.now() - 2 * 3600000).toISOString(),
                siteMeta: demoAll.siteMeta.filter((x) => x.client_id === clientId),
                events: ev.slice(0, 3),
                nextReport: ev.find((e) => e.kind === "report") || null,
                logins: demoAll.logins,
                reportEmails: true,
                error: "",
            })
            return
        }
        if (account && account.for === clientId && account.status !== "error" && accountKeyRef.current === refreshKey) return
        let cancelled = false
        const quiet = !!(account && account.for === clientId && account.status === "ready")
        const rk = refreshKey
        if (!quiet) setAccount({ ...EMPTY_ACCOUNT, for: clientId, status: "loading" })
        async function optional<T>(fn: () => Promise<T>): Promise<T | null> {
            try {
                return await fn()
            } catch (e) {
                return null
            }
        }
        const cid = encodeURIComponent(clientId)
        const today = new Date().toISOString().slice(0, 10)
        ;(async () => {
            try {
                const [plans, user] = await Promise.all([
                    authGet<PlanRow[]>(url, key, `/rest/v1/client_plans?client_id=eq.${cid}&order=sort.asc`),
                    authGet<{
                        id?: string
                        email?: string
                        last_sign_in_at?: string
                    }>(url, key, `/auth/v1/user`),
                ])
                const [siteMeta, events, nextReport, logins, members] = await Promise.all([
                    optional<SiteMetaRow[]>(() =>
                        authGet<SiteMetaRow[]>(
                            url,
                            key,
                            `/rest/v1/sites?client_id=eq.${cid}&select=id,client_id,domain,platform,launched_on,domain_renews_on,hosting_renews_on&order=domain.asc`,
                        ),
                    ),
                    optional<EventRow[]>(() =>
                        authGet<EventRow[]>(
                            url,
                            key,
                            `/rest/v1/client_events?client_id=eq.${cid}&starts_on=gte.${today}&order=starts_on.asc&limit=3`,
                        ),
                    ),
                    optional<EventRow[]>(() =>
                        authGet<EventRow[]>(
                            url,
                            key,
                            `/rest/v1/client_events?client_id=eq.${cid}&kind=eq.report&starts_on=gte.${today}&order=starts_on.asc&limit=1`,
                        ),
                    ),
                    optional<LoginRow[]>(() => authRpc<LoginRow[]>(url, key, "client_logins", { cid: clientId })),
                    user?.id
                        ? optional<
                              {
                                  report_emails: boolean
                              }[]
                          >(() =>
                              authGet<
                                  {
                                      report_emails: boolean
                                  }[]
                              >(
                                  url,
                                  key,
                                  `/rest/v1/client_members?client_id=eq.${cid}&user_id=eq.${encodeURIComponent(user.id!)}&select=report_emails`,
                              ),
                          )
                        : Promise.resolve(null),
                ])
                if (cancelled) return
                accountKeyRef.current = rk
                setAccount({
                    for: clientId,
                    status: "ready",
                    plans,
                    email: user?.email || "",
                    lastSignIn: user?.last_sign_in_at || "",
                    siteMeta,
                    events,
                    nextReport: nextReport ? nextReport[0] || null : null,
                    logins,
                    reportEmails: members && members.length ? !!members[0].report_emails : null,
                    error: "",
                })
            } catch (e: any) {
                if (cancelled) return
                if (e instanceof ReportsError && e.status === 401) {
                    window.location.replace(signInPath)
                    return
                }
                if (quiet) return
                setAccount({ ...EMPTY_ACCOUNT, for: clientId, status: "error", error: "We couldn’t load your account details just now." })
            }
        })()
        return () => {
            cancelled = true
        }
    }, [section, phase, clientId, demo, url, key, signInPath, attempt, refreshKey])
    const msRef = useRef<MsState | null>(null)
    const msKeyRef = useRef(0)
    msRef.current = ms
    useEffect(() => {
        if (section !== "reports" || phase !== "ready" || !site || !data || loadingSite) return
        if (demo) {
            setMs({ for: site.id, status: "ready", error: "", ...demoMilestones(demoAll, site, data) })
            return
        }
        const have = msRef.current
        if (have && have.for === site.id && have.status !== "error" && msKeyRef.current === refreshKey) return
        let cancelled = false
        const quiet = !!(have && have.for === site.id && have.status === "ready")
        const rk = refreshKey
        if (!quiet) setMs({ for: site.id, status: "loading", snaps: [], ranks: [], recs: [], anchor: null, error: "" })
        loadMilestonesLive(url, key, site, data)
            .then((x) => {
                if (cancelled) return
                msKeyRef.current = rk
                setMs({ for: site.id, status: "ready", error: "", ...x })
            })
            .catch((e: any) => {
                if (cancelled) return
                if (e instanceof ReportsError && e.status === 401) {
                    window.location.replace(signInPath)
                    return
                }
                if (quiet) return
                setMs({
                    for: site.id,
                    status: "error",
                    snaps: [],
                    ranks: [],
                    recs: [],
                    anchor: null,
                    error: e?.message || "The reports could not be loaded.",
                })
            })
        return () => {
            cancelled = true
        }
    }, [section, phase, siteId, data, loadingSite, demo, url, key, attempt, refreshKey])
    const msBundle = useMemo(() => {
        if (!ms || ms.status !== "ready" || ms.for !== siteId || !data) return null
        const src: MsSource = {
            snaps: ms.snaps,
            ranks: F.ranks ? ms.ranks : [],
            recs: ms.recs,
            traffic: data.traffic,
            uptime: data.uptime,
            checks: data.checks,
            work: data.work,
            anchor: ms.anchor,
        }
        const now = new Date()
        const built = buildPeriods(src, now)
        const periods = { ...built, quarters: F.reports_quarterly ? built.quarters : [], months: F.reports_monthly ? built.months : [] }
        const reports = new Map<string, MsReport>()
        ;[...periods.years, ...periods.quarters, ...periods.months].forEach((p) => reports.set(p.id, buildReport(src, p, now)))
        return { periods, reports, anchor: ms.anchor }
    }, [ms, siteId, data, F])
    msLatestRef.current = msBundle
        ? [...msBundle.periods.years, ...msBundle.periods.quarters, ...msBundle.periods.months]
              .filter((x) => x.closed)
              .sort((a, b) => (a.end < b.end ? 1 : a.end > b.end ? -1 : KIND_RANK[a.kind] - KIND_RANK[b.kind]))[0]?.id || null
        : null
    const downloadMonthPdf = async () => {
        if (!site || !data || !month) throw new Error("No month selected")
        let st = ms && ms.for === site.id && ms.status === "ready" ? ms : null
        if (!st) {
            const x = demo ? demoMilestones(demoAll, site, data) : await loadMilestonesLive(url, key, site, data)
            st = { for: site.id, status: "ready", error: "", ...x }
            setMs(st)
        }
        const src: MsSource = {
            snaps: st.snaps,
            ranks: F.ranks ? st.ranks : [],
            recs: st.recs,
            traffic: data.traffic,
            uptime: data.uptime,
            checks: data.checks,
            work: data.work,
            anchor: st.anchor,
        }
        const now = new Date()
        const d = parseDay(month)
        const r = buildReport(src, monthPeriod(d.getFullYear(), d.getMonth(), isoDay(now)), now)
        const business = client?.name || site.site_name || "Your business"
        return buildReportPdf(r, {
            businessName: business,
            domain: site.domain || "",
            demo,
            now,
            history: sixMonthHistory(st.snaps, r.period.end),
        })
    }
    const msReport =
        section === "reports" && msId && msBundle ? (msBundle.reports.get(msId)?.period.closed ? msBundle.reports.get(msId)! : null) : null
    useEffect(() => {
        const target = pendingNoticeFocus.current
        if (!target) return
        pendingNoticeFocus.current = null
        if (target === "__heading") headingRef.current?.focus({ preventScroll: true })
    }, [notices])
    const [meEmail, setMeEmail] = useState<string | null>(null)
    const [jagerPlan, setJagerPlan] = useState<"unknown" | "yes" | "no">("unknown")
    const [prospectPlan, setProspectPlan] = useState(false)
    useEffect(() => {
        if (!JAGER_PLAN_GATE || demo || !clientId || phase !== "ready") return
        let cancelled = false
        setJagerPlan("unknown")
        authGet<
            {
                name: string
                kind: string
                starts_on: string | null
                ends_on: string | null
            }[]
        >(url, key, `/rest/v1/client_plans?client_id=eq.${encodeURIComponent(clientId)}&select=name,kind,starts_on,ends_on`)
            .then((rows) => {
                if (cancelled) return
                const today = new Date().toISOString().slice(0, 10)
                const isLive = (p: { kind: string; starts_on: string | null; ends_on: string | null }) =>
                    p.kind === "subscription" && !!p.starts_on && p.starts_on <= today && (!p.ends_on || p.ends_on >= today)
                const jagerRows = (rows || []).filter((p) => /jager/i.test(p.name || "") && isLive(p))
                setJagerPlan(jagerRows.length ? "yes" : "no")
                setProspectPlan(jagerRows.some((p) => /prospecting/i.test(p.name || "")))
            })
            .catch(() => {
                if (!cancelled) {
                    setJagerPlan("no")
                    setProspectPlan(false)
                }
            })
        return () => {
            cancelled = true
        }
    }, [demo, clientId, phase, url, key])
    const jagerAdmin = staffNormal && meEmail === JAGER_ADMIN_EMAIL && siteId === JAGER_SITE_ID
    const clientLeads = ent ? ent.features.leads : JAGER_PLAN_GATE && jagerPlan === "yes"
    const jagerOk = false
    const navSections: {
        id: SectionId
        label: string
    }[] = [
        ...(staffNormal ? [STAFF_SECTION] : []),
        ...SECTIONS,
        ...(jagerOk ? [JAGER_SECTION] : []),
        ...(staffNormal ? [PERMISSIONS_SECTION] : []),
    ]
    const jagerBackend = useMemo(() => (demo ? demoJagerBackend() : liveJagerBackend(url, key, siteId)), [demo, url, key, siteId])
    const prospectBackend = useMemo(
        () => (demo ? demoProspectBackend() : siteClientId ? liveProspectBackend(url, key, siteClientId) : null),
        [demo, url, key, siteClientId],
    )
    const collectedBackend = useMemo(
        () => (demo ? demoCollectedBackend() : siteClientId ? liveCollectedBackend(url, key, siteClientId) : null),
        [demo, url, key, siteClientId],
    )
    const deskJager = useMemo(
        () => (viewing ? readOnlyBackend(jagerBackend, ["update", "archive", "remove"]) : jagerBackend),
        [viewing, jagerBackend],
    )
    const deskProspects = useMemo(
        () =>
            viewing && prospectBackend
                ? readOnlyBackend(prospectBackend, ["update", "saveProfile", "hunt", "archive", "remove"])
                : prospectBackend,
        [viewing, prospectBackend],
    )
    const deskCollected = useMemo(
        () => (viewing && collectedBackend ? readOnlyBackend(collectedBackend, ["add", "update", "archive", "remove"]) : collectedBackend),
        [viewing, collectedBackend],
    )
    useEffect(() => {
        if (demo || !clientId || phase !== "ready") return
        let cancelled = false
        rpcCall(url, key, "client_entitlements", { cid: clientId })
            .then((j) => {
                if (cancelled) return
                const parsed = parseEntitlements(j)
                if (!parsed) logEntMiss("empty answer")
                setEntState({ for: clientId, ent: parsed })
            })
            .catch((e: any) => {
                if (cancelled) return
                logEntMiss(e?.message || e)
                setEntState({ for: clientId, ent: null })
            })
        return () => {
            cancelled = true
        }
    }, [demo, clientId, phase, url, key, entKey, refreshKey])
    useEffect(() => {
        if (matrices) return
        const live = !demo && phase === "ready" && hasEnt
        const probe = demoMode && demoStaff
        if (!live && !probe) return
        let cancelled = false
        const u = live ? url : probeUrl
        const k = live ? key : probeKey
        fetchMatrices((t) => rpcCall(u, k, "tier_features", { t })).then((m) => {
            if (!cancelled && m) setMatrices(m)
        })
        return () => {
            cancelled = true
        }
    }, [matrices, demo, demoMode, phase, hasEnt, demoStaff, url, key, probeUrl, probeKey])
    useEffect(() => {
        if (!demoMode || isStatic || !probeUrl || !probeKey || !readSession()) return
        let cancelled = false
        authGet<
            {
                user_id: string
            }[]
        >(probeUrl, probeKey, `/rest/v1/staff?select=user_id`)
            .then((rows) => {
                if (!cancelled) setDemoStaff(Array.isArray(rows) && rows.length > 0)
            })
            .catch(() => {})
        return () => {
            cancelled = true
        }
    }, [demoMode, isStatic, probeUrl, probeKey])
    useEffect(() => {
        if (!viewing || !clientId || phase !== "ready") return
        if (viewAsMembers && viewAsMembers.for === clientId) return
        let cancelled = false
        rpcCall(url, key, "client_permissions", { cid: clientId })
            .then((j) => {
                const p = parsePermData(j)
                if (!cancelled) setViewAsMembers({ for: clientId, list: p ? p.members : [] })
            })
            .catch(() => {
                if (!cancelled) setViewAsMembers({ for: clientId, list: [] })
            })
        return () => {
            cancelled = true
        }
    }, [viewing, clientId, phase, url, key, viewAsMembers])
    const permApi: PermApi = useMemo(
        () => ({
            load: async (cid: string) => parsePermData(await rpcCall(url, key, "client_permissions", { cid })),
            save: (cid: string, patch: Record<string, any>) => rpcCall(url, key, "set_client_features", { cid, patch }),
            setRole: (cid: string, email: string, r: "owner" | "member") =>
                rpcCall(url, key, "set_member_role", { cid, member_email: email, new_role: r }),
        }),
        [url, key],
    )
    const setViewing = (on: boolean) => {
        setViewAsOn(on)
        if (!on) {
            setViewAsLogin("")
            setViewAsMembers(null)
        }
        if (on && (section === "sites" || section === "permissions") && typeof window !== "undefined") window.location.hash = "overview"
    }
    useEffect(() => {
        if (section !== "jager" || phase !== "ready" || jagerOk) return
        if (demo || (meEmail !== null && (!JAGER_PLAN_GATE || jagerPlan !== "unknown"))) setSection("overview")
    }, [section, phase, jagerOk, demo, meEmail, jagerPlan])
    const navList = (
        inDrawer: boolean,
        list: {
            id: SectionId
            label: string
        }[] = navSections,
    ) => (
        <ul className="ncr-nav-list" role="list">
            {list.map((s) => {
                const current = s.id === section
                return (
                    <li key={s.id}>
                        <a
                            href={`#${s.id}`}
                            className={`ncr-nav-link${current ? " is-current" : ""}`}
                            aria-current={current ? "page" : undefined}
                            aria-label={inDrawer ? undefined : s.label}
                            onClick={() => {
                                if (inDrawer) setDrawer(false)
                                else collapseRailNow()
                                if (s.id === section) headingRef.current?.focus({ preventScroll: true })
                            }}
                        >
                            <Icon name={s.id === "account" ? "person" : s.id} />
                            <span className="ncr-nav-text ncr-fade">{s.label}</span>
                        </a>
                    </li>
                )
            })}
        </ul>
    )
    const pickSite = (id: string) => {
        const next = sites.find((x) => x.id === id)
        if (!next) return
        setClientId(next.client_id)
        setSiteId(next.id)
    }
    const staffPicker = () => {
        const q = siteQuery.trim().toLowerCase()
        const groups = clients
            .map((c) => ({
                c,
                list: sites.filter(
                    (x) =>
                        x.client_id === c.id &&
                        (x.id === siteId || !q || `${c.name} ${x.domain} ${x.site_name || ""}`.toLowerCase().includes(q)),
                ),
            }))
            .filter((g) => g.list.length)
        const shown = groups.reduce((n, g) => n + g.list.length, 0)
        return (
            <div className="ncr-switchers">
                {sites.length > 6 ? (
                    <label className="ncr-field-label">
                        <span>Find a site</span>
                        <input
                            type="search"
                            className="ncr-input ncr-input-sm"
                            value={siteQuery}
                            onChange={(e) => setSiteQuery(e.target.value)}
                            placeholder="Client or domain"
                            aria-describedby="ncr-site-count"
                        />
                    </label>
                ) : null}
                <label className="ncr-field-label">
                    <span>Website</span>
                    <select
                        className="ncr-select"
                        value={siteId}
                        onChange={(e) => {
                            pickSite(e.target.value)
                            collapseRailNow()
                        }}
                    >
                        {groups.map((g) => (
                            <optgroup key={g.c.id} label={g.c.name}>
                                {g.list.map((x) => (
                                    <option key={x.id} value={x.id}>
                                        {x.domain}
                                    </option>
                                ))}
                            </optgroup>
                        ))}
                    </select>
                </label>
                {sites.length > 6 ? (
                    <span id="ncr-site-count" className="ncr-sr" role="status" aria-live="polite">
                        {shown} of {sites.length} sites shown
                    </span>
                ) : null}
            </div>
        )
    }
    const visClients = viewing ? clients.filter((c) => c.id === clientId) : clients
    const switchers = staffNormal ? (
        staffPicker()
    ) : (
        <div className="ncr-switchers">
            {visClients.length > 1 ? (
                <label className="ncr-field-label">
                    <span>{isStaff ? "Client" : "Business"}</span>
                    <select
                        className="ncr-select"
                        value={clientId}
                        onChange={(e) => {
                            const next = e.target.value
                            setClientId(next)
                            collapseRailNow()
                            const first = sites.find((x) => x.client_id === next)
                            setSiteId(first ? first.id : "")
                        }}
                    >
                        {visClients.map((c) => (
                            <option key={c.id} value={c.id}>
                                {c.name}
                            </option>
                        ))}
                    </select>
                </label>
            ) : null}
            {clientSites.length > 1 ? (
                <label className="ncr-field-label">
                    <span>Website</span>
                    <select
                        className="ncr-select"
                        value={siteId}
                        onChange={(e) => {
                            setSiteId(e.target.value)
                            collapseRailNow()
                        }}
                    >
                        {clientSites.map((s) => (
                            <option key={s.id} value={s.id}>
                                {s.domain}
                            </option>
                        ))}
                    </select>
                </label>
            ) : null}
        </div>
    )
    const sidebarBody = (inDrawer: boolean) => {
        const themeLabel = mode === "dark" ? "Switch to light mode" : "Switch to dark mode"
        const exitLabel = demoMode ? "Exit demo" : "Sign out"
        return (
            <>
                {inDrawer ? (
                    <div className="ncr-drawer-head">
                        <div className="ncr-lockup">
                            <a href="/" className="ncr-brand-link" aria-label="Nordmeyer Creative home">
                                <span className="ncr-logo ncr-logo-lock" aria-hidden="true" />
                            </a>
                            <span className="ncr-lockup-rule" aria-hidden="true" />
                            <SucherPill />
                        </div>
                        <button
                            type="button"
                            className="ncr-icon-btn ncr-drawer-close"
                            onClick={() => setDrawer(false)}
                            aria-label="Close menu"
                        >
                            <Icon name="close" />
                        </button>
                    </div>
                ) : (
                    <>
                        <div className="ncr-brand ncr-lockup">
                            <a href="/" className="ncr-brand-link" aria-label="Nordmeyer Creative home">
                                <span className="ncr-logo-box" aria-hidden="true">
                                    <span className="ncr-logo ncr-logo-full" />
                                    <span className="ncr-logo ncr-logo-mark" />
                                </span>
                            </a>
                            <span className="ncr-lockup-rule ncr-fade" aria-hidden="true" />
                            <span className="ncr-fade ncr-pill-wrap">
                                <SucherPill />
                            </span>
                        </div>
                    </>
                )}
                <nav aria-label="Report sections" className="ncr-nav">
                    {navList(inDrawer)}
                </nav>
                {inDrawer && demoMode ? (
                    <div className="ncr-drawer-cta">
                        <a href={aboutPath} className="ncr-link">
                            What is Sucher?
                        </a>
                    </div>
                ) : null}
                <div className="ncr-side-foot">
                    <nav aria-label="Account" className="ncr-nav ncr-nav-account">
                        {navList(inDrawer, [ACCOUNT_SECTION])}
                    </nav>
                    {inDrawer ? switchers : <div className="ncr-switch-slot ncr-fade">{switchers}</div>}
                    <div className="ncr-side-actions">
                        <button
                            type="button"
                            className="ncr-side-btn"
                            onClick={() => {
                                toggle()
                                if (!inDrawer) collapseRailNow()
                            }}
                            aria-label={inDrawer ? undefined : themeLabel}
                        >
                            <Icon name={mode === "dark" ? "sun" : "moon"} />
                            <span className="ncr-fade">{themeLabel}</span>
                        </button>
                        <button type="button" className="ncr-side-btn" onClick={signOut} aria-label={inDrawer ? undefined : exitLabel}>
                            <Icon name="signout" />
                            <span className="ncr-fade">{exitLabel}</span>
                        </button>
                    </div>
                    <div className="ncr-side-meta ncr-fade">
                        <ul className="ncr-legal" role="list" aria-label="Legal">
                            <li>
                                <a href="/privacy">Privacy</a>
                            </li>
                            <li>
                                <a href="/accessibility">Accessibility</a>
                            </li>
                            <li>
                                <a href="/terms">Terms</a>
                            </li>
                        </ul>
                        <a href="/" className="ncr-back">
                            <Icon name="back" size={16} />
                            <span>nordmeyercreative.com</span>
                        </a>
                        <p className="ncr-powered">Powered by Nordmeyer Creative</p>
                    </div>
                </div>
            </>
        )
    }
    const kpi = (opts: {
        label: string
        value: string
        cur: number | null
        prev: number | null
        better: Better
        kind: "pct" | "pts" | "ms" | "count"
        note?: string
        perDay?: boolean
        href?: string
        dest?: string
    }) => (
        <div className={`ncr-card ncr-kpi${opts.href ? " ncr-linkcard" : ""}`}>
            {opts.href ? (
                <h2 className="ncr-kpi-label">
                    <CardLink href={opts.href} dest={opts.dest || ""} onSame={focusIfSame}>
                        {opts.label}
                    </CardLink>
                </h2>
            ) : (
                <p className="ncr-kpi-label">{opts.label}</p>
            )}
            <p className="ncr-figure">
                <CountText text={opts.value} />
            </p>
            <Delta cur={opts.cur} prev={opts.prev} better={opts.better} kind={opts.kind} prevKey={prevKey} perDay={opts.perDay} />
            {opts.note ? <p className="ncr-small ncr-muted">{opts.note}</p> : null}
            {opts.href ? <ViewHint /> : null}
        </div>
    )
    const partialNote = (t: TrafficRow | null) => {
        if (!t || !month) return ""
        const total = daysInMonth(month)
        return t.days_reported < total
            ? `Partial month: traffic data for ${t.days_reported} of ${total} days, so the change is a daily average.`
            : ""
    }
    const trafficPair = (field: "visits" | "unique_visitors") => {
        const a = cur?.traffic || null
        const b = cur?.prevTraffic || null
        const av = num(a?.[field])
        const bv = num(b?.[field])
        if (!a || !b || av === null || bv === null) return { cur: av, prev: bv, perDay: false }
        const partial = a.days_reported < daysInMonth(a.month) || b.days_reported < daysInMonth(b.month)
        if (!partial) return { cur: av, prev: bv, perDay: false }
        return { cur: av / Math.max(1, a.days_reported), prev: bv / Math.max(1, b.days_reported), perDay: true }
    }
    const dailyVisits = (k: string) => {
        const r = byMonth(data ? data.traffic : [], k)
        const v = num(r?.visits)
        return r && v !== null ? v / Math.max(1, r.days_reported) : null
    }
    const pageOne = (rows: RankRow[]) =>
        rows.filter((r) => {
            const g = gpos(r)
            return g !== null && g <= 10
        }).length
    const renderOverview = () => {
        const s = cur?.score
        const overall = num(s?.overall)
        const prevOverall = num(cur?.prevScore?.overall)
        const t = cur?.traffic || null
        const u = cur?.uptime || null
        const trend: Slot[] = window12.map((k) => ({ key: k, a: num(byMonth(data!.scores, k)?.overall) }))
        const trendCount = trend.filter((p) => p.a !== null).length
        return (
            <>
                <div className="ncr-overview-top">
                    <div className={`ncr-ring-frame${tourCls("health")}`} data-tour="health" data-hl="overview">
                        <div className="ncr-card ncr-health ncr-linkcard">
                            <h2 className="ncr-h2">
                                <CardLink href="#health" dest="site health" onSame={focusIfSame}>
                                    Overall health
                                </CardLink>
                            </h2>
                            <ViewHint />
                            {overall === null ? (
                                <p className="ncr-small">No health score was recorded for {monthLong(month)}.</p>
                            ) : (
                                <div className="ncr-health-body">
                                    <HealthRing score={overall} />
                                    <div className="ncr-health-copy">
                                        <p className="ncr-grade">
                                            Grade <strong>{s?.grade || "None"}</strong>
                                        </p>
                                        <Delta cur={overall} prev={prevOverall} better="up" kind="pts" prevKey={prevKey} />
                                        <p className="ncr-small ncr-muted">
                                            One score that combines search basics, speed, accessibility, best practices, on-page setup and
                                            security. It does not include rankings or traffic.
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                    <div className="ncr-card ncr-kpi ncr-kpi-wide ncr-linkcard">
                        <h2 className="ncr-kpi-label">
                            <CardLink href="#traffic" dest="traffic" onSame={focusIfSame}>
                                Visits
                            </CardLink>
                        </h2>
                        <ViewHint />
                        <p className="ncr-figure-lg">
                            <CountText text={fmtInt(num(t?.visits))} />
                        </p>
                        <Delta {...trafficPair("visits")} better="up" kind="pct" prevKey={prevKey} />
                        {partialNote(t) ? <p className="ncr-small ncr-muted">{partialNote(t)}</p> : null}
                        {window12.filter((k) => dailyVisits(k) !== null).length >= 2 ? (
                            <div className="ncr-spark-block">
                                <Sparkline values={window12.map(dailyVisits)} />
                                <p className="ncr-small ncr-muted">Visits per day, last 12 months</p>
                            </div>
                        ) : null}
                    </div>
                </div>
                <div className={`ncr-kpi-row${F.ranks ? "" : " ncr-kpi-row-3"}${tourCls("deltas")}`} data-tour="deltas">
                    {kpi({
                        label: "Unique visitors",
                        value: fmtInt(num(t?.unique_visitors)),
                        ...trafficPair("unique_visitors"),
                        better: "up",
                        kind: "pct",
                        href: "#traffic",
                        dest: "traffic",
                    })}
                    {kpi({
                        label: "Uptime",
                        value: num(u?.uptime_pct) === null ? "No data" : `${num(u?.uptime_pct)}%`,
                        cur: num(u?.uptime_pct),
                        prev: num(cur?.prevUptime?.uptime_pct),
                        better: "up",
                        kind: "pts",
                        href: "#uptime",
                        dest: "uptime",
                    })}
                    {kpi({
                        label: "Response time at monthly check",
                        value: num(cur?.score?.response_ms) === null ? "No data" : `${fmtInt(num(cur?.score?.response_ms))} ms`,
                        cur: num(cur?.score?.response_ms),
                        prev: num(cur?.prevScore?.response_ms),
                        better: "down",
                        kind: "ms",
                        href: "#uptime",
                        dest: "uptime",
                    })}
                    {F.ranks &&
                        kpi({
                            label: "Keywords on Google page 1",
                            value: cur?.ranks.length ? `${pageOne(cur.ranks)} of ${cur.ranks.length}` : "No data",
                            cur: cur?.ranks.length ? pageOne(cur.ranks) : null,
                            prev: cur?.prevRanks.length ? pageOne(cur.prevRanks) : null,
                            better: "up",
                            kind: "count",
                            href: "#search",
                            dest: "search positions",
                        })}
                </div>
                {(() => {
                    const open = openItems(data!.work)
                    if (!open.length) return null
                    const doing = open.filter((w) => w.status === "in_progress").length
                    const next = open.length - doing
                    const parts = [doing ? `${doing} in progress` : "", next ? `${next} up next` : ""].filter(Boolean)
                    return (
                        <div className="ncr-card ncr-onlist ncr-linkcard">
                            <div className="ncr-onlist-copy">
                                <h2 className="ncr-kpi-label">
                                    <CardLink href="#work" dest="the work log" onSame={focusIfSame}>
                                        On our list
                                    </CardLink>
                                </h2>
                                <p className="ncr-figure">
                                    <CountText text={`${open.length} ${open.length === 1 ? "item" : "items"}`} />
                                </p>
                                <p className="ncr-small ncr-muted">{parts.join(", ")}</p>
                            </div>
                            <ViewHint />
                        </div>
                    )
                })()}

                <section className="ncr-card ncr-panel" aria-labelledby="ncr-trend-h">
                    <div className="ncr-panel-head">
                        <h2 id="ncr-trend-h" className="ncr-h2">
                            Overall health, last 12 months
                        </h2>
                        <a href="#health" className="ncr-link ncr-view-link" onClick={() => focusIfSame("#health")}>
                            View health<span className="ncr-sr"> details</span>
                            <Icon name="expand" size={14} />
                        </a>
                    </div>
                    {trendCount < 2 ? (
                        <FirstMonth what="your site’s health" />
                    ) : (
                        <>
                            <MonthChart
                                slots={trend}
                                mode="line"
                                nameA="Overall health"
                                fmt={(n) => `${n}`}
                                yMax={100}
                                label="Overall health score by month"
                            />
                            <details className="ncr-details">
                                <summary>Show as a table</summary>
                                <TableRegion label="Overall health by month">
                                    <table className="ncr-table">
                                        <thead>
                                            <tr>
                                                <th scope="col">Month</th>
                                                <th scope="col">Overall health</th>
                                                <th scope="col">Grade</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {window12
                                                .map((k) => byMonth(data!.scores, k))
                                                .filter(Boolean)
                                                .reverse()
                                                .map((r) => (
                                                    <tr key={r!.month}>
                                                        <th scope="row">{monthLong(r!.month)}</th>
                                                        <td>{r!.overall ?? "No data"}</td>
                                                        <td>{r!.grade || "None"}</td>
                                                    </tr>
                                                ))}
                                        </tbody>
                                    </table>
                                </TableRegion>
                            </details>
                        </>
                    )}
                </section>
                <section className="ncr-card ncr-panel" aria-labelledby="ncr-top-plan-h">
                    <div className="ncr-panel-head">
                        <h2 id="ncr-top-plan-h" className="ncr-h2">
                            Top of the plan
                        </h2>
                        <a href="#plan" className="ncr-link">
                            See the whole plan
                        </a>
                    </div>
                    {plan.length ? (
                        <ol className="ncr-top-plan" role="list">
                            {plan.slice(0, 3).map((r) => (
                                <li key={`${r.snapshot_id}-${r.position}`} className="ncr-linkrow">
                                    <span className="ncr-top-plan-meta">
                                        {PILLARS[r.pillar] || "General"} <span aria-hidden="true">/</span>{" "}
                                        {r.kind === "fix" ? "Fix" : "Opportunity"}
                                    </span>
                                    <a
                                        href="#plan"
                                        className="ncr-top-plan-title ncr-card-link"
                                        onClick={() => {
                                            setPlanTarget(`${r.snapshot_id}-${r.position}`)
                                            focusIfSame("#plan")
                                        }}
                                    >
                                        {r.title}
                                        <span className="ncr-sr">, see it in the plan</span>
                                    </a>
                                    <Severity sev={r.sev} />
                                </li>
                            ))}
                        </ol>
                    ) : (
                        <p className="ncr-small">No plan was recorded for {monthLong(month)}.</p>
                    )}
                </section>
            </>
        )
    }
    const renderHealth = () => {
        const s = cur?.score
        const p = cur?.prevScore
        const scored = window12.map((k) => byMonth(data!.scores, k))
        const many = scored.filter(Boolean).length >= 2
        return (
            <>
                <div className="ncr-score-grid" data-hl="score:overall">
                    {METRICS.map((m) => {
                        const v = num((s as any)?.[m.key])
                        return (
                            <div className="ncr-card ncr-score" key={m.key} data-hl={`score:${m.key}`}>
                                <div className="ncr-score-head">
                                    <h2 className="ncr-h3">{m.label}</h2>
                                    {m.key === "security" && s?.security_grade ? (
                                        <span className="ncr-pill">Grade {s.security_grade}</span>
                                    ) : null}
                                </div>
                                <div className="ncr-score-body">
                                    <p className="ncr-figure">
                                        <CountText text={v === null ? "No data" : v} />
                                    </p>
                                    {many ? <Sparkline values={scored.map((r) => num((r as any)?.[m.key]))} /> : null}
                                </div>
                                <Delta cur={v} prev={num((p as any)?.[m.key])} better="up" kind="pts" prevKey={prevKey} />
                                {m.key === "security" ? <HostNote snap={planSnapshot} /> : null}
                                <p className="ncr-small ncr-muted">{m.help}</p>
                            </div>
                        )
                    })}
                </div>
                {!many ? <FirstMonth what="these scores" /> : null}
                <section className="ncr-card ncr-panel" aria-labelledby="ncr-health-table-h">
                    <h2 id="ncr-health-table-h" className="ncr-h2">
                        Scores by month
                    </h2>
                    <TableRegion label="Scores by month">
                        <table className="ncr-table">
                            <thead>
                                <tr>
                                    <th scope="col">Month</th>
                                    <th scope="col">Overall</th>
                                    {METRICS.map((m) => (
                                        <th scope="col" key={m.key}>
                                            {m.label}
                                        </th>
                                    ))}
                                    <th scope="col">Issues found</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data!.scores
                                    .filter((r) => r.month <= month)
                                    .slice()
                                    .reverse()
                                    .map((r) => (
                                        <tr key={r.month} className={r.month === month ? "is-selected" : undefined}>
                                            <th scope="row">{monthLong(r.month)}</th>
                                            <td>{r.overall ?? "No data"}</td>
                                            {METRICS.map((m) => (
                                                <td key={m.key}>{(r as any)[m.key] ?? "No data"}</td>
                                            ))}
                                            <td>{r.issues_count ?? "No data"}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </TableRegion>
                </section>
            </>
        )
    }
    const renderTraffic = () => {
        const t = cur?.traffic || null
        const slots: Slot[] = window12.map((k) => {
            const r = byMonth(data!.traffic, k)
            return { key: k, a: num(r?.visits), b: num(r?.unique_visitors), partial: r ? r.days_reported < daysInMonth(k) : false }
        })
        const count = slots.filter((s) => s.a !== null).length
        const anyPartial = slots.some((s) => s.partial && s.a !== null)
        return (
            <>
                <div className="ncr-kpi-pair">
                    {kpi({
                        label: "Visits",
                        value: fmtInt(num(t?.visits)),
                        ...trafficPair("visits"),
                        better: "up",
                        kind: "pct",
                        note: partialNote(t),
                    })}
                    {kpi({
                        label: "Unique visitors",
                        value: fmtInt(num(t?.unique_visitors)),
                        ...trafficPair("unique_visitors"),
                        better: "up",
                        kind: "pct",
                        note: partialNote(t),
                    })}
                </div>
                <section className={`ncr-card ncr-panel${tourCls("traffic")}`} data-tour="traffic" aria-labelledby="ncr-traffic-h">
                    <h2 id="ncr-traffic-h" className="ncr-h2">
                        Visits and unique visitors, last 12 months
                    </h2>
                    {count < 2 ? (
                        <FirstMonth what="your traffic" />
                    ) : (
                        <>
                            <ul className="ncr-legend" role="list" aria-label="Chart key">
                                <li>
                                    <span className="ncr-swatch" style={{ background: "var(--ncr-accent)" }} aria-hidden="true" />
                                    Visits (bars)
                                </li>
                                <li>
                                    <span
                                        className="ncr-swatch ncr-swatch-line"
                                        style={{ background: "var(--ncr-series-2)" }}
                                        aria-hidden="true"
                                    />
                                    Unique visitors (line)
                                </li>
                                {anyPartial ? (
                                    <li>
                                        <span className="ncr-swatch ncr-swatch-hatch" aria-hidden="true" />
                                        Striped bars are partial months
                                    </li>
                                ) : null}
                            </ul>
                            <MonthChart
                                slots={slots}
                                mode="barline"
                                nameA="Visits"
                                nameB="Unique visitors"
                                fmt={(n) => fmtInt(n)}
                                label="Visits and unique visitors by month"
                            />
                        </>
                    )}
                    <TableRegion label="Traffic by month">
                        <table className="ncr-table">
                            <thead>
                                <tr>
                                    <th scope="col">Month</th>
                                    <th scope="col">Visits</th>
                                    <th scope="col">Unique visitors</th>
                                    <th scope="col">Days counted</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data!.traffic
                                    .filter((r) => r.month <= month)
                                    .slice()
                                    .reverse()
                                    .map((r) => (
                                        <tr key={r.month} className={r.month === month ? "is-selected" : undefined}>
                                            <th scope="row">{monthLong(r.month)}</th>
                                            <td>{fmtInt(num(r.visits))}</td>
                                            <td>{fmtInt(num(r.unique_visitors))}</td>
                                            <td>
                                                {r.days_reported} of {daysInMonth(r.month)}
                                                {r.days_reported < daysInMonth(r.month) ? " (partial)" : ""}
                                            </td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </TableRegion>
                </section>
                {renderTrafficExtras()}
                {renderTrends()}
            </>
        )
    }
    const makeCsv = () => {
        const keys = window12.filter((k) => byMonth(data!.traffic, k) || byMonth(data!.scores, k))
        const header = [
            "Month",
            "Visits",
            "Unique visitors",
            "Days counted",
            "Overall health",
            "Grade",
            ...METRICS.map((m) => m.label),
            "Uptime %",
            "Response time (ms)",
        ]
        const rows = keys.map((k) => {
            const t = byMonth(data!.traffic, k)
            const s = byMonth(data!.scores, k)
            const u = byMonth(data!.uptime, k)
            return [
                k.slice(0, 7),
                num(t?.visits),
                num(t?.unique_visitors),
                t ? t.days_reported : null,
                num(s?.overall),
                s?.grade || null,
                ...METRICS.map((m) => num((s as any)?.[m.key])),
                num(u?.uptime_pct),
                num(s?.response_ms),
            ]
        })
        const host = (site?.domain || "site").replace(/[^a-z0-9.-]/gi, "")
        return { name: `${host}-traffic-and-scores-${month.slice(0, 7)}.csv`, text: buildCsv(header, rows) }
    }
    const renderTrafficExtras = () => {
        const bd = data?.breakdown ?? null
        const monthsLine = trafficMonthsText(F, matrices)
        const visits = num(cur?.traffic?.visits)
        const inq = data?.leadsByMonth && month ? (data.leadsByMonth[month] ?? 0) : null
        const showConv = F.conversion && F.leads && inq !== null && visits !== null && visits > 0
        const dims: BreakdownRow["dimension"][] =
            F.traffic_breakdown === "full" ? ["page", "source", "device", "country"] : ["page", "source"]
        return (
            <>
                {F.traffic_breakdown !== "none" ? (
                    <section className="ncr-card ncr-panel" aria-labelledby="ncr-bd-h">
                        <h2 id="ncr-bd-h" className="ncr-h2">
                            Where visits came from, {monthLong(month)}
                            {staffChip("breakdown") || staffChip("breakdown_full")}
                        </h2>
                        {bd === null ? (
                            <p className="ncr-small ncr-muted">Top pages and sources start with the next traffic pull.</p>
                        ) : (
                            <BreakdownTiles rows={bd} month={month} monthLabel={monthLong(month)} dims={dims} />
                        )}
                        {F.traffic_breakdown === "basic" ? <LockedLine gate="breakdown_full" matrices={matrices} /> : null}
                    </section>
                ) : (
                    <LockedLine gate="breakdown" matrices={matrices} />
                )}
                {showConv ? (
                    <div className="ncr-card ncr-kpi">
                        <p className="ncr-kpi-label">
                            Visits to inquiry
                            {staffChip("conversion")}
                        </p>
                        <p className="ncr-figure">
                            <CountText text={`${(((inq as number) / (visits as number)) * 100).toFixed(1)}%`} />
                        </p>
                        <p className="ncr-small ncr-muted">
                            {inq} {inq === 1 ? "inquiry" : "inquiries"} from {fmtInt(visits)} visits in {monthLong(month)}.
                        </p>
                    </div>
                ) : F.leads && !F.conversion ? (
                    <LockedLine gate="conversion" matrices={matrices} />
                ) : null}
                {!F.leads ? (
                    <LockedLine gate="leads" matrices={matrices} />
                ) : (
                    staffNote("leads", "Staff only: lead inquiries are not in this client’s plan.")
                )}
                {F.export ? (
                    <div className="ncr-export-row">
                        <CsvButton make={makeCsv} />
                        {staffChip("export")}
                    </div>
                ) : (
                    <LockedLine gate="export" matrices={matrices} />
                )}
                {monthsLine ? <LockedLine text={monthsLine} /> : null}
            </>
        )
    }
    const renderSearch = () =>
        !F.ranks ? (
            <>
                <LockedLine gate="ranks" matrices={matrices} />
                {renderAiVisibility()}
                {renderSeo()}
            </>
        ) : (
            <>
                {staffNote(
                    "ranks",
                    "Staff only: keyword rankings are not in this client’s plan, so the client sees one line here instead.",
                )}
                {renderSearchInner()}
                {renderAiVisibility()}
                {renderSeo()}
            </>
        )
    const renderSeo = () => (
        <SeoSections
            features={demo ? { ...F, seo_detail: false } : F}
            clientFeatures={clientF}
            month={month}
            siteId={siteId}
            demo={demo}
            url={url}
            apiKey={key}
            refreshKey={refreshKey}
        />
    )
    const renderAiVisibility = () => {
        if (F.ai_visibility === "none") return <LockedLine gate="ai_visibility" matrices={matrices} />
        const rows = data?.aiv || []
        const cadence = F.ai_visibility === "quarterly" ? "Each quarter" : "Each month"
        const quarterly = F.ai_visibility === "quarterly"
        const aivMonth = quarterly
            ? aivMonths(rows)
                  .filter((k) => k <= month)
                  .sort()
                  .pop() || month
            : month
        const aivPrev = quarterly ? addMonths(aivMonth, -3) : prevKey
        const intro = `${cadence} we ask Google AI Overviews, ChatGPT, Perplexity and Gemini the questions your customers ask, and note whether your business is named in the answer.`
        if (!rows.length) {
            return (
                <section className="ncr-card ncr-panel" aria-labelledby="ncr-aiv-h">
                    <h2 id="ncr-aiv-h" className="ncr-h2">
                        AI visibility
                        {staffChip("ai_visibility")}
                    </h2>
                    <p className="ncr-small ncr-muted">{intro}</p>
                    <div className="ncr-first">
                        <p className="ncr-h3">Your first AI visibility check runs at the start of next month.</p>
                    </div>
                </section>
            )
        }
        const metric = aivMetric(rows)
        const sc = aivScore(rows, aivMonth)
        const engines = aivByEngine(rows, aivMonth)
        const questions = aivQuestions(rows, aivMonth)
        const slots: Slot[] = window12.map((k) => ({ key: k, a: metric.values[k] ?? null }))
        const count = slots.filter((x) => x.a !== null).length
        return (
            <section className="ncr-card ncr-panel" aria-labelledby="ncr-aiv-h">
                <h2 id="ncr-aiv-h" className="ncr-h2">
                    AI visibility, {monthLong(aivMonth)}
                    {staffChip("ai_visibility")}
                </h2>
                {quarterly ? <p className="ncr-kpi-label">Checked each quarter</p> : null}
                <p className="ncr-small ncr-muted">{intro}</p>
                {!sc ? (
                    <p className="ncr-small">
                        No AI visibility check was recorded for {monthLong(aivMonth)}. The line below shows the months that were checked.
                    </p>
                ) : (
                    <>
                        <div className="ncr-aiv-top">
                            <div className="ncr-aiv-score">
                                <p className="ncr-kpi-label">Visibility score</p>
                                <p className="ncr-figure">
                                    <CountText text={`${sc.score}%`} />
                                </p>
                                <p className="ncr-small ncr-muted">
                                    Named in {sc.mentioned} of {sc.total} answers.
                                </p>
                            </div>
                            <TrendChange c={compareMonths(metric, aivMonth, aivPrev)} kind="pts" refWords={`on ${monthName(aivPrev)}`} />
                        </div>
                        <h3 className="ncr-h3 ncr-aiv-sub">By assistant</h3>
                        <ul className="ncr-aiv-engines" role="list">
                            {engines.map((e) => (
                                <li key={e.engine} className="ncr-aiv-engine">
                                    <span className="ncr-aiv-engine-name">{e.label}</span>
                                    <span className="ncr-aiv-bar" aria-hidden="true">
                                        <span style={{ width: `${Math.max(2, (e.mentioned / Math.max(1, e.total)) * 100)}%` }} />
                                    </span>
                                    <span className="ncr-aiv-engine-num">
                                        Named in {e.mentioned} of {e.total} {e.total === 1 ? "question" : "questions"}
                                    </span>
                                </li>
                            ))}
                        </ul>
                        <h3 className="ncr-h3 ncr-aiv-sub">Questions we asked</h3>
                        <ul className="ncr-aiv-qs" role="list">
                            {questions.map((q) => (
                                <AivQuestionItem key={q.question} q={q} />
                            ))}
                        </ul>
                    </>
                )}
                <h3 className="ncr-h3 ncr-aiv-sub">Visibility score, last 12 months</h3>
                {count >= 2 ? (
                    <>
                        <MonthChart
                            slots={slots}
                            mode="line"
                            nameA="Visibility score"
                            fmt={(n) => `${Math.round(n)}%`}
                            yMax={100}
                            label="AI visibility score by month"
                            height={200}
                        />
                        <details className="ncr-details">
                            <summary>Show as a table</summary>
                            <TableRegion label="AI visibility score by month">
                                <table className="ncr-table">
                                    <thead>
                                        <tr>
                                            <th scope="col">Month</th>
                                            <th scope="col">Visibility score</th>
                                            <th scope="col">Answers that named you</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {window12
                                            .map((k) => ({ k, s: aivScore(rows, k) }))
                                            .filter((x) => x.s)
                                            .reverse()
                                            .map((x) => (
                                                <tr key={x.k} className={x.k === month ? "is-selected" : undefined}>
                                                    <th scope="row">{monthLong(x.k)}</th>
                                                    <td>{x.s!.score}%</td>
                                                    <td>
                                                        {x.s!.mentioned} of {x.s!.total}
                                                    </td>
                                                </tr>
                                            ))}
                                    </tbody>
                                </table>
                            </TableRegion>
                        </details>
                    </>
                ) : (
                    <p className="ncr-small ncr-muted">The line starts once two months have been checked.</p>
                )}
            </section>
        )
    }
    const renderTrends = () => {
        if (!F.trend_reports) return <LockedLine gate="trends" matrices={matrices} />
        const yoyKey = addMonths(month, -12)
        const metrics: TrendMetric[] = []
        const days: Record<
            string,
            {
                counted: number
                total: number
            }
        > = {}
        const visitors: Record<string, number> = {}
        const visits: Record<string, number> = {}
        data!.traffic.forEach((t) => {
            const v = num(t.unique_visitors)
            const w = num(t.visits)
            if (v !== null) visitors[t.month] = v
            if (w !== null) visits[t.month] = w
            days[t.month] = { counted: t.days_reported, total: daysInMonth(t.month) }
        })
        metrics.push({ key: "visitors", label: "Visitors", fmt: (n) => fmtInt(n), kind: "pct", values: visitors, days })
        metrics.push({ key: "visits", label: "Visits", fmt: (n) => fmtInt(n), kind: "pct", values: visits, days })
        const health: Record<string, number> = {}
        data!.scores.forEach((r) => {
            const v = num(r.overall)
            if (v !== null) health[r.month] = v
        })
        metrics.push({ key: "health", label: "Health score", fmt: (n) => `${Math.round(n)}`, kind: "pts", values: health, yMax: 100 })
        if (F.ranks && data!.ranks.length) {
            const p1: Record<string, number> = {}
            Array.from(new Set(data!.ranks.map((r) => r.month))).forEach((k) => {
                p1[k] = pageOne(data!.ranks.filter((r) => r.month === k))
            })
            metrics.push({ key: "pageone", label: "Keywords on Google page one", fmt: (n) => fmtInt(n), kind: "count", values: p1 })
        }
        if (F.leads && data!.leadsByMonth) {
            const lm = data!.leadsByMonth
            const keys = Object.keys(lm).sort()
            if (keys.length) {
                const leads: Record<string, number> = {}
                for (let k = keys[0]; k <= month; k = addMonths(k, 1)) leads[k] = lm[k] || 0
                metrics.push({ key: "leads", label: "Lead inquiries", fmt: (n) => fmtInt(n), kind: "count", values: leads })
            }
        }
        if (F.ai_visibility !== "none" && data!.aiv && data!.aiv.length) metrics.push(aivMetric(data!.aiv))
        const changes = whatChanged(metrics, month, prevKey, yoyKey, monthName, monthLong)
        return (
            <section className="ncr-card ncr-panel" aria-labelledby="ncr-trends-h">
                <h2 id="ncr-trends-h" className="ncr-h2">
                    Trends, {monthLong(month)}
                    {staffChip("trends")}
                </h2>
                <p className="ncr-small ncr-muted">
                    How each number moved against last month and against the same month last year. Built from the figures on this dashboard.
                </p>
                <h3 className="ncr-h3">What changed</h3>
                {changes.length ? (
                    <ul className="ncr-trend-changes" role="list">
                        {changes.map((c) => (
                            <li key={c.text}>
                                <Icon name={c.dir} size={16} />
                                <span>{c.text}</span>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p className="ncr-small ncr-muted">
                        Nothing to compare yet. Changes appear here once there is an earlier month to measure against.
                    </p>
                )}
                <div className="ncr-trend-grid">
                    {metrics.map((m) => (
                        <TrendMetricBlock key={m.key} m={m} month={month} prevKey={prevKey} yoyKey={yoyKey} window12={window12} />
                    ))}
                </div>
            </section>
        )
    }
    const renderSearchInner = () => {
        const rows = (cur?.ranks || []).slice().sort((a, b) => (gpos(a) ?? 999) - (gpos(b) ?? 999))
        const prevMap = new Map((cur?.prevRanks || []).map((r) => [r.keyword, gpos(r)]))
        const hasPrev = (cur?.prevRanks || []).length > 0
        const improved = hasPrev
            ? rows.filter((r) => {
                  const p = prevMap.get(r.keyword)
                  const c = gpos(r)
                  return c !== null && (p === null || p === undefined ? false : c < p)
              }).length
            : null
        const pos = (v: any) => (num(v) === null ? "Not in top 50" : `${num(v)}`)
        const eng = (r: RankRow, e: string) => {
            const by = r.by_engine || {}
            const k = Object.keys(by).find((x) => x.toLowerCase().replace(/[^a-z]/g, "") === e)
            return k ? pos(by[k]) : "Not checked"
        }
        if (!rows.length) {
            return (
                <div className="ncr-card ncr-panel">
                    <p className="ncr-h3">No keywords were checked in {monthLong(month)}.</p>
                    <p className="ncr-small">Search positions appear here once your keywords are being tracked.</p>
                </div>
            )
        }
        return (
            <>
                <div className="ncr-kpi-row ncr-kpi-row-3">
                    {kpi({
                        label: "Keywords on Google page 1",
                        value: `${pageOne(rows)} of ${rows.length}`,
                        cur: pageOne(rows),
                        prev: hasPrev ? pageOne(cur!.prevRanks) : null,
                        better: "up",
                        kind: "count",
                    })}
                    <div className="ncr-card ncr-kpi">
                        <p className="ncr-kpi-label">Moved up this month</p>
                        <p className="ncr-figure">
                            <CountText text={improved === null ? "No data" : improved} />
                        </p>
                        <p className="ncr-small ncr-muted">
                            {improved === null ? `No ${monthName(prevKey)} positions to compare` : `of ${rows.length} keywords tracked`}
                        </p>
                    </div>
                    <div className="ncr-card ncr-kpi">
                        <p className="ncr-kpi-label">Best Google position</p>
                        <p className="ncr-figure">
                            <CountText text={gpos(rows[0]) === null ? "None" : gpos(rows[0])} />
                        </p>
                        <p className="ncr-small ncr-muted ncr-clamp">{rows[0].keyword}</p>
                    </div>
                </div>
                <section className={`ncr-card ncr-panel${tourCls("search")}`} data-tour="search" aria-labelledby="ncr-search-h">
                    <h2 id="ncr-search-h" className="ncr-h2">
                        Where you show up, {monthLong(month)}
                    </h2>
                    <p className="ncr-small ncr-muted">
                        Position 1 is the top result. Positions 1 to 10 are page one. The headline figures use Google; Bing, Yahoo and
                        DuckDuckGo are shown for reference. We check the top 50 results on each search engine.
                    </p>
                    <div className="ncr-search-table">
                        <TableRegion label="Keyword positions">
                            <table className="ncr-table">
                                <thead>
                                    <tr>
                                        <th scope="col">Keyword</th>
                                        <th scope="col">Google position</th>
                                        <th scope="col">Last month</th>
                                        <th scope="col">Change</th>
                                        <th scope="col">Google</th>
                                        <th scope="col">Bing</th>
                                        <th scope="col">Yahoo</th>
                                        <th scope="col">DuckDuckGo</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {rows.map((r) => {
                                        const p = hasPrev ? (prevMap.get(r.keyword) ?? null) : null
                                        return (
                                            <tr key={r.keyword} data-hl={`kw:${r.keyword}`}>
                                                <th scope="row">{r.keyword}</th>
                                                <td className="ncr-strong">{pos(gpos(r))}</td>
                                                <td>{hasPrev ? pos(p) : "No data"}</td>
                                                <td>
                                                    {hasPrev ? (
                                                        <RankChange cur={gpos(r)} prev={p} />
                                                    ) : (
                                                        <span className="ncr-muted">First month</span>
                                                    )}
                                                </td>
                                                <td>{eng(r, "google")}</td>
                                                <td>{eng(r, "bing")}</td>
                                                <td>{eng(r, "yahoo")}</td>
                                                <td>{eng(r, "duckduckgo")}</td>
                                            </tr>
                                        )
                                    })}
                                </tbody>
                            </table>
                        </TableRegion>
                    </div>
                    <ul className="ncr-search-cards" role="list">
                        {rows.map((r) => {
                            const p = hasPrev ? (prevMap.get(r.keyword) ?? null) : null
                            return (
                                <li key={r.keyword} className="ncr-search-card" data-hl={`kw:${r.keyword}`}>
                                    <h3 className="ncr-h3">{r.keyword}</h3>
                                    <div className="ncr-search-main">
                                        <span className="ncr-figure-sm">
                                            <CountText text={pos(gpos(r))} />
                                        </span>
                                        {hasPrev ? (
                                            <RankChange cur={gpos(r)} prev={p} />
                                        ) : (
                                            <span className="ncr-small ncr-muted">First month</span>
                                        )}
                                    </div>
                                    <dl className="ncr-engines">
                                        <div>
                                            <dt>Last month</dt>
                                            <dd>{hasPrev ? pos(p) : "No data"}</dd>
                                        </div>
                                        <div>
                                            <dt>Google</dt>
                                            <dd>{eng(r, "google")}</dd>
                                        </div>
                                        <div>
                                            <dt>Bing</dt>
                                            <dd>{eng(r, "bing")}</dd>
                                        </div>
                                        <div>
                                            <dt>Yahoo</dt>
                                            <dd>{eng(r, "yahoo")}</dd>
                                        </div>
                                        <div>
                                            <dt>DuckDuckGo</dt>
                                            <dd>{eng(r, "duckduckgo")}</dd>
                                        </div>
                                    </dl>
                                </li>
                            )
                        })}
                    </ul>
                </section>
            </>
        )
    }
    const renderUptime = () => {
        const u = cur?.uptime || null
        const monthChecks = data!.checks.filter((c) => c.day.slice(0, 7) === month.slice(0, 7))
        const downs = monthChecks.filter(hadOutage)
        const missedTotal = monthChecks.reduce((a, c) => a + missedChecks(c), 0)
        const summarised = monthChecks.some((c) => num(c.checks as any) !== null)
        const ping = data!.pings && data!.pings.length ? data!.pings[0] : null
        const slots: Slot[] = window12.map((k) => ({ key: k, a: num(byMonth(data!.scores, k)?.response_ms) }))
        const count = slots.filter((s) => s.a !== null).length
        return (
            <>
                <div className="ncr-kpi-row ncr-kpi-row-3">
                    {kpi({
                        label: "Uptime",
                        value: num(u?.uptime_pct) === null ? "No data" : `${num(u?.uptime_pct)}%`,
                        cur: num(u?.uptime_pct),
                        prev: num(cur?.prevUptime?.uptime_pct),
                        better: "up",
                        kind: "pts",
                    })}
                    {kpi({
                        label: "Response time at monthly check",
                        value: num(cur?.score?.response_ms) === null ? "No data" : `${fmtInt(num(cur?.score?.response_ms))} ms`,
                        cur: num(cur?.score?.response_ms),
                        prev: num(cur?.prevScore?.response_ms),
                        better: "down",
                        kind: "ms",
                    })}
                    <div className="ncr-card ncr-kpi">
                        <p className="ncr-kpi-label">Checks this month</p>
                        <p className="ncr-figure">
                            <CountText text={u ? fmtInt(num(u.checks)) : "No data"} />
                        </p>
                        <p className={`ncr-small ${downs.length ? "ncr-bad-text" : "ncr-muted"}`}>
                            {downs.length ? (
                                summarised ? (
                                    <>
                                        <Icon name="alert" size={14} /> {fmtInt(missedTotal)} missed{" "}
                                        {missedTotal === 1 ? "check" : "checks"} across {downs.length} {downs.length === 1 ? "day" : "days"}
                                    </>
                                ) : (
                                    <>
                                        <Icon name="alert" size={14} /> {downs.length} {downs.length === 1 ? "check found" : "checks found"}{" "}
                                        the site down
                                    </>
                                )
                            ) : (
                                "Every check found the site up"
                            )}
                        </p>
                    </div>
                </div>
                <section className="ncr-card ncr-panel" aria-labelledby="ncr-uptime-h">
                    <h2 id="ncr-uptime-h" className="ncr-h2">
                        Response time at each monthly check, last 12 months
                    </h2>
                    {count < 2 ? (
                        <FirstMonth what="your uptime" />
                    ) : (
                        <MonthChart
                            slots={slots}
                            mode="line"
                            nameA="Response time"
                            fmt={(n) => `${fmtInt(n)} ms`}
                            label="Response time in milliseconds at each monthly check"
                        />
                    )}
                    <TableRegion label="Uptime by month">
                        <table className="ncr-table">
                            <thead>
                                <tr>
                                    <th scope="col">Month</th>
                                    <th scope="col">Uptime</th>
                                    <th scope="col">Avg response</th>
                                    <th scope="col">Checks</th>
                                </tr>
                            </thead>
                            <tbody>
                                {data!.uptime
                                    .filter((r) => r.month <= month)
                                    .slice()
                                    .reverse()
                                    .map((r) => (
                                        <tr key={r.month} className={r.month === month ? "is-selected" : undefined}>
                                            <th scope="row">{monthLong(r.month)}</th>
                                            <td>{num(r.uptime_pct) === null ? "No data" : `${num(r.uptime_pct)}%`}</td>
                                            <td>
                                                {num(byMonth(data!.scores, r.month)?.response_ms) === null
                                                    ? "No data"
                                                    : `${fmtInt(num(byMonth(data!.scores, r.month)?.response_ms))} ms`}
                                            </td>
                                            <td>{fmtInt(num(r.checks))}</td>
                                        </tr>
                                    ))}
                            </tbody>
                        </table>
                    </TableRegion>
                </section>
                <section className="ncr-card ncr-panel" aria-labelledby="ncr-checks-h" data-hl="uptime-checks">
                    <h2 id="ncr-checks-h" className="ncr-h2">
                        {summarised ? "Day by day" : "Daily checks"}, {monthLong(month)}
                    </h2>
                    {ping ? (
                        <p className="ncr-small ncr-muted">
                            {summarised ? "We check every 5 minutes. " : ""}Last checked {timeShort(ping.checked_at)}.
                        </p>
                    ) : summarised ? (
                        <p className="ncr-small ncr-muted">We check every 5 minutes, day and night.</p>
                    ) : null}
                    {monthChecks.length ? (
                        <details className="ncr-details">
                            <summary>
                                Show all {monthChecks.length} {summarised ? "days" : "checks"}
                                {downs.length ? `, ${downs.length} with missed checks` : ""}
                            </summary>
                            <TableRegion label={`${summarised ? "Uptime by day" : "Daily checks"} for ${monthLong(month)}`}>
                                <table className="ncr-table">
                                    <thead>
                                        <tr>
                                            <th scope="col">Date</th>
                                            <th scope="col">Status</th>
                                            {summarised ? <th scope="col">Uptime</th> : null}
                                            {summarised ? null : <th scope="col">Server code</th>}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {monthChecks
                                            .slice()
                                            .reverse()
                                            .map((c) => {
                                                const m = missedChecks(c)
                                                const ok = m === 0
                                                return (
                                                    <tr key={c.day}>
                                                        <th scope="row">{dayLong(c.day)}</th>
                                                        <td>
                                                            <span className={`ncr-status ${ok ? "is-up" : "is-down"}`}>
                                                                <Icon name={ok ? "ok" : "alert"} size={14} />
                                                                {ok
                                                                    ? summarised
                                                                        ? "Up all day"
                                                                        : "Up"
                                                                    : summarised
                                                                      ? `${m} missed ${m === 1 ? "check" : "checks"}`
                                                                      : "Down"}
                                                            </span>
                                                        </td>
                                                        {summarised ? (
                                                            <td>
                                                                {num(c.uptime_pct as any) === null
                                                                    ? "No data"
                                                                    : `${num(c.uptime_pct as any)}%`}
                                                            </td>
                                                        ) : null}
                                                        {summarised ? null : <td>{c.code ?? "None"}</td>}
                                                    </tr>
                                                )
                                            })}
                                    </tbody>
                                </table>
                            </TableRegion>
                        </details>
                    ) : (
                        <p className="ncr-small">No checks were recorded for {monthLong(month)}.</p>
                    )}
                </section>
            </>
        )
    }
    const renderWork = () => {
        const open = openItems(data!.work)
        const groups = new Map<
            string,
            (WorkRow & {
                done_on: string
            })[]
        >()
        data!.work
            .filter(isDoneWork)
            .sort((a, b) => (a.done_on < b.done_on ? 1 : -1))
            .forEach((w) => {
                const k = `${w.done_on.slice(0, 7)}-01`
                if (!groups.has(k)) groups.set(k, [])
                groups.get(k)!.push(w)
            })
        const keys = Array.from(groups.keys())
        if (!keys.length && !open.length) {
            return (
                <div className="ncr-card ncr-panel">
                    <p className="ncr-h3">No work has been logged for this site yet.</p>
                    <p className="ncr-small">Each month, the updates, fixes and improvements we make to your site are listed here.</p>
                </div>
            )
        }
        return (
            <div className={`ncr-work${tourCls("work")}`} data-tour="work">
                {open.length ? (
                    <section className="ncr-work-month ncr-work-open" aria-labelledby="ncr-work-open-h" data-hl="work:open">
                        <div className="ncr-work-head">
                            <h2 id="ncr-work-open-h" className="ncr-h2">
                                What we’re working on for you
                            </h2>
                            <p className="ncr-small ncr-muted">
                                {open.length} {open.length === 1 ? "item" : "items"}
                            </p>
                        </div>
                        <ol className="ncr-work-list" role="list">
                            {open.map((w) => (
                                <li key={w.id} className="ncr-work-item ncr-open-item">
                                    <span className={`ncr-status ${w.status === "in_progress" ? "is-doing" : "is-next"}`}>
                                        <Icon name={w.status === "in_progress" ? "play" : "calendar"} size={14} />
                                        <span>{w.status === "in_progress" ? "In progress" : "Up next"}</span>
                                    </span>
                                    <div className="ncr-work-body">
                                        <h3 className="ncr-h3">{w.title}</h3>
                                        {w.detail ? <p className="ncr-body-text">{w.detail}</p> : null}
                                        {w.due_on ? (
                                            <p className="ncr-small ncr-muted">
                                                Planned for{" "}
                                                <time dateTime={w.due_on}>
                                                    {parseDay(w.due_on).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                </time>
                                            </p>
                                        ) : null}
                                    </div>
                                </li>
                            ))}
                        </ol>
                    </section>
                ) : null}
                {keys.length ? (
                    <>
                        {open.length ? (
                            <h2 className="ncr-h2 ncr-work-finished-h" id="ncr-work-done-h">
                                Finished
                            </h2>
                        ) : null}
                        {keys.map((k) => {
                            const items = groups.get(k)!
                            const H = open.length ? "h3" : "h2"
                            const IH = open.length ? "h4" : "h3"
                            return (
                                <section
                                    key={k}
                                    className={`ncr-work-month${k === month ? " is-selected" : ""}`}
                                    aria-labelledby={`ncr-work-${k}`}
                                    data-hl={`work:${k}`}
                                >
                                    <div className="ncr-work-head">
                                        <H id={`ncr-work-${k}`} className="ncr-h2">
                                            {monthLong(k)}
                                        </H>
                                        <p className="ncr-small ncr-muted">
                                            {items.length} {items.length === 1 ? "thing done" : "things done"}
                                        </p>
                                    </div>
                                    <ol className="ncr-work-list" role="list">
                                        {items.map((w) => (
                                            <li key={w.id} className="ncr-work-item">
                                                <time className="ncr-work-date" dateTime={w.done_on}>
                                                    {parseDay(w.done_on).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                                </time>
                                                <div className="ncr-work-body">
                                                    <div className="ncr-work-title-row">
                                                        <IH className="ncr-h3">{w.title}</IH>
                                                        <span className="ncr-chip">{CATEGORY[w.category || ""] || "Update"}</span>
                                                    </div>
                                                    {w.detail ? <p className="ncr-body-text">{w.detail}</p> : null}
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                </section>
                            )
                        })}
                    </>
                ) : null}
            </div>
        )
    }
    const renderPlan = () => {
        if (!planSnapshot) {
            return (
                <div className="ncr-card ncr-panel">
                    <p className="ncr-h3">No plan for {monthLong(month)} yet.</p>
                    <p className="ncr-small">
                        The plan is written from each month's full site check. It appears here after the check runs.
                    </p>
                </div>
            )
        }
        return (
            <>
                <p className="ncr-small ncr-muted ncr-plan-source">
                    From the site check on {dayLong(planSnapshot.run_date)}. {plan.length} {plan.length === 1 ? "item" : "items"} in order
                    of priority.
                </p>
                {data && data.searchScope === "core" ? (
                    <p className="ncr-small ncr-muted ncr-plan-scope">
                        Your plan keeps the site healthy, fast and secure, and we make the structural search fixes ourselves. Ranking and
                        search-growth work sits outside this plan, so it is not listed here.
                    </p>
                ) : null}
                {clientF && !clientF.growth_plan && rawData && rawData.recs.some(isGrowthRec)
                    ? staffNote(
                          "growth",
                          "Staff only: the search-growth opportunities shown here are not in this client’s plan, so the client does not see them.",
                      )
                    : null}
                {staffNormal && data && data.hiddenRecs ? (
                    <p className="ncr-small ncr-muted ncr-plan-scope">
                        Staff only: {data.hiddenRecs} search-growth {data.hiddenRecs === 1 ? "item is" : "items are"} held back by this
                        plan's scope.
                    </p>
                ) : null}
                {(["found", "speed", "trust"] as const).map((pillar, pi) => {
                    const items = plan.filter((r) => r.pillar === pillar)
                    return (
                        <section
                            key={pillar}
                            className={`ncr-card ncr-panel ncr-pillar${pi === 0 ? tourCls("plan") : ""}`}
                            data-tour={pi === 0 ? "plan" : undefined}
                            aria-labelledby={`ncr-pillar-${pillar}`}
                        >
                            <h2 id={`ncr-pillar-${pillar}`} className="ncr-h2">
                                {PILLARS[pillar]}
                            </h2>
                            {items.length ? (
                                (["fix", "opportunity"] as const).map((kind) => {
                                    const list = items.filter((r) => (kind === "fix" ? r.kind === "fix" : r.kind !== "fix"))
                                    if (!list.length) return null
                                    return (
                                        <div key={kind} className="ncr-plan-group">
                                            <h3 className="ncr-plan-kind">{kind === "fix" ? "Fixes" : "Opportunities"}</h3>
                                            <ol className="ncr-plan-list" role="list">
                                                {list.map((r) => (
                                                    <li
                                                        key={r.position}
                                                        className={`ncr-plan-item${planTarget === `${r.snapshot_id}-${r.position}` ? " is-target" : ""}`}
                                                        data-plan-key={`${r.snapshot_id}-${r.position}`}
                                                    >
                                                        <div className="ncr-plan-title-row">
                                                            <h4 className="ncr-h3">{r.title}</h4>
                                                            <Severity sev={r.sev} />
                                                        </div>
                                                        {r.why ? <p className="ncr-body-text">{r.why}</p> : null}
                                                        {r.found ? (
                                                            <p className="ncr-small ncr-muted">
                                                                <span className="ncr-strong-muted">What we found:</span> {r.found}
                                                            </p>
                                                        ) : null}
                                                    </li>
                                                ))}
                                            </ol>
                                        </div>
                                    )
                                })
                            ) : (
                                <p className="ncr-small">Nothing to do here this month.</p>
                            )}
                        </section>
                    )
                })}
            </>
        )
    }
    const msStatus = (p: Period) => (
        <p className={`ncr-plan-status ncr-ms-status ${p.closed ? "is-ended" : "is-soon"}`}>
            <Icon name={p.closed ? "ok" : "uptime"} size={16} />
            <span>
                {p.closed
                    ? "Closed"
                    : p.daysLeft === 0
                      ? "In progress, last day"
                      : `In progress, ${p.daysLeft} ${p.daysLeft === 1 ? "day" : "days"} left`}
            </span>
        </p>
    )
    const renderMilestoneList = () => {
        const { periods, reports } = msBundle!
        const years = periods.years.filter((x) => x.closed)
        const quarters = periods.quarters.filter((x) => x.closed)
        const months = periods.months.filter((x) => x.closed)
        const nextM = periods.months.find((x) => !x.closed) || null
        const nextQ = periods.quarters.find((x) => !x.closed) || null
        const nextY = periods.years.find((x) => !x.closed) || null
        const monthCard = (p: Period) => {
            const r = reports.get(p.id)!
            const hp = healthPair(r)
            const a = num(hp.from?.overall)
            const b = num(hp.to?.overall)
            const tid = `ncr-ms-t-${p.id}`
            const fid = `ncr-ms-f-${p.id}`
            return (
                <li key={p.id} className="ncr-ms-cell is-month">
                    <a
                        href={`#reports/${p.id}`}
                        className="ncr-card ncr-ms-card ncr-ms-card-sm ncr-linkcard"
                        aria-labelledby={tid}
                        aria-describedby={fid}
                    >
                        <span className="ncr-kpi-label">Monthly report</span>
                        <h3 id={tid} className="ncr-ms-card-title">
                            {p.title}
                        </h3>
                        <dl id={fid} className="ncr-ms-card-facts">
                            <div>
                                <dt>Overall health</dt>
                                <dd>
                                    {b === null ? (
                                        "No check"
                                    ) : (
                                        <>
                                            <span>{b}</span>
                                            {a !== null ? <MsChange from={a} to={b} unit="pts" /> : null}
                                        </>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>Visits</dt>
                                <dd>{fmtInt(r.traffic.visits)}</dd>
                            </div>
                        </dl>
                    </a>
                </li>
            )
        }
        const card = (p: Period) => {
            const r = reports.get(p.id)!
            const hp = healthPair(r)
            const a = num(hp.from?.overall)
            const b = num(hp.to?.overall)
            const po = r.search.pageOne
            const best = headlineMove(r)
            const tid = `ncr-ms-t-${p.id}`
            const did = `ncr-ms-d-${p.id}`
            const fid = `ncr-ms-f-${p.id}`
            return (
                <li key={p.id} className={`ncr-ms-cell${p.kind === "year" ? " is-year" : ""}`}>
                    <a
                        href={`#reports/${p.id}`}
                        className="ncr-card ncr-ms-card ncr-linkcard"
                        aria-labelledby={`${tid} ${did}`}
                        aria-describedby={fid}
                    >
                        <span className="ncr-kpi-label">{p.kind === "year" ? "Annual report" : "Quarterly report"}</span>
                        <h3 id={tid} className="ncr-ms-card-title">
                            {p.title}
                        </h3>
                        <span id={did} className="ncr-small ncr-muted">
                            {p.dates}
                        </span>
                        <dl id={fid} className="ncr-ms-card-facts">
                            <div>
                                <dt>Overall health</dt>
                                <dd>
                                    {b === null ? (
                                        "No check"
                                    ) : (
                                        <>
                                            <span>
                                                {b}
                                                {hp.to?.grade ? ` (${hp.to.grade})` : ""}
                                            </span>
                                            {a !== null ? <MsChange from={a} to={b} unit="pts" /> : null}
                                        </>
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>Google page one</dt>
                                <dd>
                                    {!r.search.tracked || po.now === null ? (
                                        "Not tracked"
                                    ) : po.start === null || r.search.startRun === r.search.nowRun ? (
                                        `${po.now} of ${r.search.counts.now}`
                                    ) : (
                                        <>
                                            <span>
                                                {po.start} to {po.now}
                                            </span>
                                            <MsChange from={po.start} to={po.now} unit="count" />
                                        </>
                                    )}
                                </dd>
                            </div>
                            <div className="ncr-ms-card-wide">
                                <dt>Biggest Google move</dt>
                                <dd>
                                    {best ? (
                                        <span className="ncr-ms-move">
                                            “{best.keyword}” {best.start === null ? "new in the top 50" : `${best.start}`} to {best.now}
                                        </span>
                                    ) : (
                                        "No keyword moved up"
                                    )}
                                </dd>
                            </div>
                            <div>
                                <dt>Visits</dt>
                                <dd>{fmtInt(r.traffic.visits)}</dd>
                            </div>
                            <div>
                                <dt>Uptime</dt>
                                <dd>{fmtPct(r.uptime.pct)}</dd>
                            </div>
                        </dl>
                        <ViewHint />
                    </a>
                </li>
            )
        }
        const nextLines: string[] = []
        if (nextM) nextLines.push(`Next report: ${nextM.name}, available ${dayLongFull(nextM.availableOn)}`)
        if (nextQ) nextLines.push(`Next report: ${nextQ.name}, available ${dayLongFull(nextQ.availableOn)}`)
        if (nextY) nextLines.push(`${nextY.title} available ${dayLongFull(nextY.availableOn)}`)
        const none = !years.length && !quarters.length && !months.length
        return (
            <>
                <p className="ncr-body-text ncr-ms-intro">
                    A report becomes available at the end of {F.reports_monthly ? "every calendar month, " : ""}
                    {F.reports_quarterly ? "every calendar quarter and " : ""}every year with us. Each one sums up the whole stretch: how
                    the site’s health changed, where each search started and where it stands now, traffic, uptime and the work we finished.
                    Every report downloads as a PDF.
                </p>
                {!F.reports_quarterly ? (
                    <LockedLine gate="quarterly" matrices={matrices} />
                ) : (
                    staffNote("quarterly", "Staff only: quarterly reports are not in this client’s plan.")
                )}
                {!F.reports_monthly ? (
                    <LockedLine gate="monthly" matrices={matrices} />
                ) : (
                    staffNote("monthly", "Staff only: monthly reports are not in this client’s plan; they get quarterly reports.")
                )}
                {none ? (
                    <div className={`ncr-card ncr-panel${tourCls("reports")}`} data-tour="reports">
                        <p className="ncr-h3">
                            {nextM
                                ? `Your first report, for ${nextM.name}, arrives on ${dayLongFull(nextM.availableOn)}.`
                                : nextQ
                                  ? `Your first report arrives at the end of this quarter, on ${dayLongFull(nextQ.availableOn)}.`
                                  : "Your first report arrives at the end of this month."}
                        </p>
                        {nextLines.slice(nextM ? 1 : 0).map((x) => (
                            <p key={x} className="ncr-small ncr-muted">
                                {x}.
                            </p>
                        ))}
                    </div>
                ) : (
                    <section className={`ncr-ms-grid-wrap${tourCls("reports")}`} data-tour="reports" aria-label="Available reports">
                        {msTab === "all" || msTab === "year" ? (
                            years.length ? (
                                <>
                                    {msTab === "all" ? <h2 className="ncr-h2 ncr-ms-group-h">Annual</h2> : null}
                                    <ul className="ncr-ms-grid" role="list">
                                        {years.map(card)}
                                    </ul>
                                </>
                            ) : msTab === "year" ? (
                                <p className="ncr-ms-missing">No annual report yet.</p>
                            ) : null
                        ) : null}
                        {msTab === "all" || msTab === "quarter" ? (
                            quarters.length ? (
                                <>
                                    {msTab === "all" ? <h2 className="ncr-h2 ncr-ms-group-h">Quarterly</h2> : null}
                                    <ul className="ncr-ms-grid" role="list">
                                        {quarters.map(card)}
                                    </ul>
                                </>
                            ) : msTab === "quarter" ? (
                                <p className="ncr-ms-missing">No quarterly report yet.</p>
                            ) : null
                        ) : null}
                        {msTab === "all" || msTab === "month" ? (
                            months.length ? (
                                <>
                                    {msTab === "all" ? <h2 className="ncr-h2 ncr-ms-group-h">Monthly</h2> : null}
                                    <ul className="ncr-ms-grid ncr-ms-grid-sm" role="list">
                                        {months.map(monthCard)}
                                    </ul>
                                </>
                            ) : msTab === "month" ? (
                                <p className="ncr-ms-missing">No monthly report yet.</p>
                            ) : null
                        ) : null}
                        {(() => {
                            const lines =
                                msTab === "all"
                                    ? nextLines
                                    : [
                                          msTab === "month" && nextM
                                              ? `Next report: ${nextM.name}, available ${dayLongFull(nextM.availableOn)}`
                                              : msTab === "quarter" && nextQ
                                                ? `Next report: ${nextQ.name}, available ${dayLongFull(nextQ.availableOn)}`
                                                : msTab === "year" && nextY
                                                  ? `${nextY.title} available ${dayLongFull(nextY.availableOn)}`
                                                  : "",
                                      ].filter(Boolean)
                            return lines.length ? (
                                <ul className="ncr-ms-next" role="list">
                                    {lines.map((x) => (
                                        <li key={x}>
                                            <Icon name="calendar" size={15} />
                                            <span>{x}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : null
                        })()}
                    </section>
                )}
            </>
        )
    }
    const renderMilestoneReport = (r: MsReport) => {
        const p = r.period
        const kind = p.kind === "quarter" ? "quarter" : p.kind === "month" ? "month" : "year"
        const h = r.health
        const hp = healthPair(r)
        const s = r.search
        const t = r.traffic
        const u = r.uptime
        const iss = r.issues
        const business = client?.name || site?.site_name || "Your business"
        const multi = s.startRun !== s.nowRun
        const slots: Slot[] = t.months.map((m) => ({
            key: m.key,
            a: m.visits,
            b: m.unique,
            partial: m.visits !== null && m.days < m.total,
        }))
        const vCh = trafficChange(r, "visits")
        const uCh = trafficChange(r, "unique")
        const pctChange = (
            ch: {
                pct: number
                perDay: boolean
            } | null,
        ) =>
            ch === null ? (
                <span className="ncr-delta ncr-delta-none">No data for {p.prevName} to compare</span>
            ) : ch.pct === 0 ? (
                <span className="ncr-delta ncr-delta-flat">
                    <Icon name="flat" size={14} />
                    Level with {p.prevName}
                </span>
            ) : (
                <span className={`ncr-delta ${ch.pct > 0 ? "ncr-delta-good" : "ncr-delta-bad"}`}>
                    <Icon name={ch.pct > 0 ? "up" : "down"} size={14} />
                    <span aria-hidden="true">
                        {ch.pct > 0 ? "+" : "−"}
                        {Math.abs(ch.pct).toLocaleString("en-US", { maximumFractionDigits: 1 })}%{ch.perDay ? " per day" : ""} vs{" "}
                        {p.prevName}
                    </span>
                    <span className="ncr-sr">
                        {ch.perDay ? "Daily average " : ""}
                        {ch.pct > 0 ? "up" : "down"} {Math.abs(ch.pct).toLocaleString("en-US", { maximumFractionDigits: 1 })}% on{" "}
                        {p.prevName}.
                    </span>
                </span>
            )
        const engCell = (k: (typeof s.rows)[number], e: string) => {
            const a = k.startBy ? k.startBy[e] : undefined
            const b = k.nowBy ? k.nowBy[e] : undefined
            return multi ? `${posText(a)} to ${posText(b)}` : posText(b)
        }
        return (
            <>
                <a href="#reports" className="ncr-link ncr-ms-back">
                    <Icon name="back" size={16} />
                    All reports
                </a>

                <section className="ncr-card ncr-panel ncr-ms-head" aria-labelledby="ncr-ms-sum-h">
                    <div className="ncr-ms-head-top">
                        <div className="ncr-ms-head-who">
                            <p className="ncr-kpi-label">
                                {p.kind === "quarter"
                                    ? "Quarterly report"
                                    : p.kind === "month"
                                      ? "Monthly report"
                                      : "Annual report, by client year"}
                            </p>
                            <p className="ncr-strong">
                                {business}
                                {site?.domain ? <span className="ncr-muted ncr-ms-domain">, {site.domain}</span> : null}
                            </p>
                            <p className="ncr-small">
                                {p.long}, {p.dates}
                            </p>
                        </div>
                        {msStatus(p)}
                    </div>
                    <h2 id="ncr-ms-sum-h" className="ncr-h2">
                        In short
                    </h2>
                    <ul className="ncr-ms-summary" role="list">
                        {r.summary.map((x) => (
                            <li key={x}>{x}</li>
                        ))}
                    </ul>
                    <ReportDownloads
                        demo={demo}
                        tourClass={tourCls("report-download")}
                        buildPdf={() =>
                            buildReportPdf(r, {
                                businessName: business,
                                domain: site?.domain || "",
                                demo,
                                now: new Date(),
                                history: sixMonthHistory(ms?.snaps || [], r.period.end),
                            })
                        }
                        buildText={() =>
                            buildMilestoneText(r, { businessName: business, domain: site?.domain || "", demo, now: new Date() })
                        }
                    />
                </section>

                <section className="ncr-card ncr-panel" aria-labelledby="ncr-ms-health-h">
                    <h2 id="ncr-ms-health-h" className="ncr-h2">
                        Site health, start and end
                    </h2>
                    {!h.end ? (
                        <p className="ncr-small">
                            No complete site check ran in this {kind}
                            {p.closed ? "" : " yet"}.
                        </p>
                    ) : (
                        <>
                            <div className="ncr-ms-hero">
                                <div className="ncr-ms-hero-fig">
                                    <p className="ncr-kpi-label">Overall health{p.closed ? `, end of the ${kind}` : ", latest check"}</p>
                                    <p className="ncr-figure-lg">
                                        <CountText text={`${num(h.end.overall) ?? "No data"}`} />
                                    </p>
                                    <p className="ncr-grade">
                                        Grade <strong>{h.end.grade || "None"}</strong>
                                    </p>
                                </div>
                                <div className="ncr-ms-hero-copy">
                                    <p className="ncr-small">At the check on {dayLong(h.end.run_date)}.</p>
                                    <p className="ncr-small ncr-muted">
                                        One score that combines search basics, speed, accessibility, best practices, on-page setup and
                                        security. It does not include rankings or traffic.
                                    </p>
                                </div>
                            </div>
                            {h.series.length >= 2 ? (
                                <div className="ncr-ms-history">
                                    <MonthChart
                                        slots={h.series.map((x) => ({ key: x.key, a: x.overall, b: null }))}
                                        mode="barline"
                                        nameA="Overall health"
                                        fmt={(n) => `${n}`}
                                        yMax={100}
                                        height={190}
                                        label="Overall health at each monthly check"
                                    />
                                    <p className="ncr-ms-caption">
                                        <MsChange from={h.series[0].overall} to={h.series[h.series.length - 1].overall} unit="pts" />
                                        <span className="ncr-small">{sinceText(h.series)}</span>
                                    </p>
                                </div>
                            ) : (
                                <p className="ncr-small ncr-muted">One check so far, so there is no history to chart yet.</p>
                            )}
                            <TableRegion label="Health scores at the start and end of the period">
                                <table className="ncr-table">
                                    <thead>
                                        <tr>
                                            <th scope="col">Score</th>
                                            {h.before ? <th scope="col">Before ({dayLong(h.before.run_date)})</th> : null}
                                            {h.start && h.start.id !== h.end.id ? (
                                                <th scope="col">Start ({dayLong(h.start.run_date)})</th>
                                            ) : null}
                                            <th scope="col">
                                                {h.start && h.start.id !== h.end.id ? "End" : "Only check"} ({dayLong(h.end.run_date)})
                                            </th>
                                            <th scope="col">Change</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {[{ key: "overall" as keyof MsSnap, label: "Overall" }, ...PILLAR_ROWS].map(({ key: k, label }) => {
                                            const v = (x: MsSnap | null) => (x ? num(x[k]) : null)
                                            return (
                                                <tr key={String(k)}>
                                                    <th scope="row">{label}</th>
                                                    {h.before ? <td>{v(h.before) ?? "No data"}</td> : null}
                                                    {h.start && h.start.id !== h.end!.id ? <td>{v(h.start) ?? "No data"}</td> : null}
                                                    <td className="ncr-strong">{v(h.end) ?? "No data"}</td>
                                                    <td>
                                                        <MsChange from={v(hp.from)} to={v(hp.to)} unit="pts" />
                                                    </td>
                                                </tr>
                                            )
                                        })}
                                    </tbody>
                                </table>
                            </TableRegion>
                        </>
                    )}
                </section>

                <section className="ncr-card ncr-panel" aria-labelledby="ncr-ms-search-h">
                    <h2 id="ncr-ms-search-h" className="ncr-h2">
                        Search engines: where you started and where you are now
                    </h2>
                    {!s.tracked ? (
                        <p className="ncr-small">No keywords are being tracked for this site yet.</p>
                    ) : s.noRunInPeriod ? (
                        <p className="ncr-small">
                            No keyword checks ran in this {kind}. Keyword tracking for this site began on {dayLong(s.firstRun || "")}.
                        </p>
                    ) : (
                        <>
                            <p className="ncr-small ncr-muted">
                                {multi
                                    ? `Start is the check on ${dayLong(s.startRun || "")}; now is the check on ${dayLong(s.nowRun || "")}.`
                                    : `One check ran, on ${dayLong(s.nowRun || "")}.`}{" "}
                                The headline figures use Google. Position 1 is the top result and positions 1 to 10 are page one. We check
                                the top 50 results on each search engine.
                            </p>
                            <div className="ncr-kpi-row ncr-kpi-row-3">
                                <div className="ncr-card ncr-kpi">
                                    <p className="ncr-kpi-label">On Google page one now</p>
                                    <p className="ncr-figure">
                                        <CountText text={`${s.pageOne.now ?? 0} of ${s.counts.now}`} />
                                    </p>
                                    {multi ? <MsChange from={s.pageOne.start} to={s.pageOne.now} unit="count" /> : null}
                                    <p className="ncr-small ncr-muted">Check on {dayLong(s.nowRun || "")}</p>
                                </div>
                                <div className="ncr-card ncr-kpi">
                                    <p className="ncr-kpi-label">At the start of the {kind}</p>
                                    <p className="ncr-figure">
                                        <CountText text={multi ? `${s.pageOne.start ?? 0} of ${s.counts.start}` : "Same check"} />
                                    </p>
                                    <p className="ncr-small ncr-muted">
                                        {multi ? `Check on ${dayLong(s.startRun || "")}` : "Only one check in this period"}
                                    </p>
                                </div>
                                <div className="ncr-card ncr-kpi">
                                    <p className="ncr-kpi-label">Since your first check</p>
                                    <p className="ncr-figure">
                                        <CountText text={`${s.pageOne.first ?? 0} of ${s.counts.first}`} />
                                    </p>
                                    <p className="ncr-small ncr-muted">
                                        On page one on {dayLong(s.firstRun || "")}, the first time we checked
                                    </p>
                                </div>
                            </div>
                            <div className="ncr-search-table">
                                <TableRegion label="Google positions at the start and now">
                                    <table className="ncr-table">
                                        <thead>
                                            <tr>
                                                <th scope="col">Keyword</th>
                                                <th scope="col">Start</th>
                                                <th scope="col">Now</th>
                                                <th scope="col">This {kind}</th>
                                                <th scope="col">First check</th>
                                                <th scope="col">Since first check</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {s.rows.map((k) => (
                                                <tr key={k.keyword}>
                                                    <th scope="row">{k.keyword}</th>
                                                    <td>{posText(k.start)}</td>
                                                    <td className="ncr-strong">{posText(k.now)}</td>
                                                    <td>
                                                        <MoveBadge m={k.move} />
                                                    </td>
                                                    <td>{posText(k.first)}</td>
                                                    <td>
                                                        <MoveBadge m={k.moveAll} />
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </TableRegion>
                            </div>
                            <ul className="ncr-search-cards" role="list">
                                {s.rows.map((k) => (
                                    <li key={k.keyword} className="ncr-search-card">
                                        <h3 className="ncr-h3">{k.keyword}</h3>
                                        <div className="ncr-search-main">
                                            <span className="ncr-figure-sm">{posText(k.now)}</span>
                                            <MoveBadge m={k.move} />
                                        </div>
                                        <dl className="ncr-engines">
                                            <div>
                                                <dt>Start</dt>
                                                <dd>{posText(k.start)}</dd>
                                            </div>
                                            <div>
                                                <dt>Now</dt>
                                                <dd>{posText(k.now)}</dd>
                                            </div>
                                            <div>
                                                <dt>First check</dt>
                                                <dd>{posText(k.first)}</dd>
                                            </div>
                                            <div>
                                                <dt>Since first check</dt>
                                                <dd>{moveText(k.moveAll)}</dd>
                                            </div>
                                        </dl>
                                    </li>
                                ))}
                            </ul>
                            <details className="ncr-details">
                                <summary>Show every search engine</summary>
                                <TableRegion label="Positions on every search engine">
                                    <table className="ncr-table">
                                        <thead>
                                            <tr>
                                                <th scope="col">Keyword</th>
                                                {ENGINE_NAMES.map(([e, n]) => (
                                                    <th scope="col" key={e}>
                                                        {n}
                                                        {multi ? ", start to now" : ""}
                                                    </th>
                                                ))}
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {s.rows.map((k) => (
                                                <tr key={k.keyword}>
                                                    <th scope="row">{k.keyword}</th>
                                                    {ENGINE_NAMES.map(([e]) => (
                                                        <td key={e}>{engCell(k, e)}</td>
                                                    ))}
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </TableRegion>
                                <p className="ncr-small ncr-muted">
                                    Only Google counts toward page one here. Not checked means that search engine could not be read at that
                                    check.
                                </p>
                            </details>
                        </>
                    )}
                </section>

                <section className="ncr-card ncr-panel" aria-labelledby="ncr-ms-traffic-h">
                    <h2 id="ncr-ms-traffic-h" className="ncr-h2">
                        Traffic
                    </h2>
                    {t.visits === null ? (
                        <p className="ncr-small">
                            No traffic data was recorded for this {kind}
                            {p.closed ? "" : " yet"}.
                        </p>
                    ) : (
                        <>
                            <div className="ncr-kpi-pair">
                                <div className="ncr-card ncr-kpi">
                                    <p className="ncr-kpi-label">Visits{p.closed ? "" : " so far"}</p>
                                    <p className="ncr-figure">
                                        <CountText text={fmtInt(t.visits)} />
                                    </p>
                                    {pctChange(vCh)}
                                    {t.prev ? (
                                        <p className="ncr-small ncr-muted">
                                            {fmtInt(t.prev.visits)} in {p.prevName}
                                        </p>
                                    ) : null}
                                </div>
                                <div className="ncr-card ncr-kpi">
                                    <p className="ncr-kpi-label">Unique visitors{p.closed ? "" : " so far"}</p>
                                    <p className="ncr-figure">
                                        <CountText text={fmtInt(t.unique)} />
                                    </p>
                                    {pctChange(uCh)}
                                    {t.prev ? (
                                        <p className="ncr-small ncr-muted">
                                            {fmtInt(t.prev.unique)} in {p.prevName}
                                        </p>
                                    ) : null}
                                </div>
                            </div>
                            {slots.filter((x) => x.a !== null).length >= 2 ? (
                                <>
                                    <ul className="ncr-legend" role="list" aria-label="Chart key">
                                        <li>
                                            <span className="ncr-swatch" style={{ background: "var(--ncr-accent)" }} aria-hidden="true" />
                                            Visits (bars)
                                        </li>
                                        <li>
                                            <span
                                                className="ncr-swatch ncr-swatch-line"
                                                style={{ background: "var(--ncr-series-2)" }}
                                                aria-hidden="true"
                                            />
                                            Unique visitors (line)
                                        </li>
                                        {slots.some((x) => x.partial) ? (
                                            <li>
                                                <span className="ncr-swatch ncr-swatch-hatch" aria-hidden="true" />
                                                Striped bars are partial months
                                            </li>
                                        ) : null}
                                    </ul>
                                    <MonthChart
                                        slots={slots}
                                        mode="barline"
                                        nameA="Visits"
                                        nameB="Unique visitors"
                                        fmt={(n) => fmtInt(n)}
                                        label={`Visits and unique visitors by month, ${p.long}`}
                                    />
                                </>
                            ) : null}
                            {t.missing.length || t.partial.length ? (
                                <ul className="ncr-ms-notes" role="list">
                                    {t.missing.length ? <li>No traffic data for {t.missing.map(monthLong).join(", ")}.</li> : null}
                                    {t.partial.map((m) => (
                                        <li key={m.key}>
                                            {monthLong(m.key)}: traffic counted for {m.days} of {m.total} days.
                                        </li>
                                    ))}
                                    {vCh?.perDay ? (
                                        <li>The two periods have a different number of days counted, so the change is a daily average.</li>
                                    ) : null}
                                </ul>
                            ) : vCh?.perDay ? (
                                <p className="ncr-small ncr-muted">
                                    The two periods have a different number of days counted, so the change is a daily average.
                                </p>
                            ) : null}
                            <details className="ncr-details">
                                <summary>Show as a table</summary>
                                <TableRegion label={`Traffic by month, ${p.long}`}>
                                    <table className="ncr-table">
                                        <thead>
                                            <tr>
                                                <th scope="col">Month</th>
                                                <th scope="col">Visits</th>
                                                <th scope="col">Unique visitors</th>
                                                <th scope="col">Days counted</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {t.months.map((m) => (
                                                <tr key={m.key}>
                                                    <th scope="row">{monthLong(m.key)}</th>
                                                    <td>{fmtInt(m.visits)}</td>
                                                    <td>{fmtInt(m.unique)}</td>
                                                    <td>{m.visits === null ? "None" : `${m.days} of ${m.total}`}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </TableRegion>
                            </details>
                        </>
                    )}
                </section>

                <div className="ncr-ms-two">
                    <section className="ncr-card ncr-panel" aria-labelledby="ncr-ms-up-h">
                        <h2 id="ncr-ms-up-h" className="ncr-h2">
                            Uptime
                        </h2>
                        {u.pct === null ? (
                            <p className="ncr-small">
                                No uptime checks were recorded for this {kind}
                                {p.closed ? "" : " yet"}.
                            </p>
                        ) : (
                            <div className="ncr-ms-pair">
                                <div>
                                    <p className="ncr-kpi-label">Uptime{p.closed ? "" : " so far"}</p>
                                    <p className="ncr-figure">
                                        <CountText text={fmtPct(u.pct)} />
                                    </p>
                                    <p className="ncr-small ncr-muted">
                                        {u.source === "daily"
                                            ? `Across ${u.daysChecked} ${u.daysChecked === 1 ? "day" : "days"} of checks`
                                            : "From the monthly uptime totals"}
                                    </p>
                                </div>
                                <div>
                                    <p className="ncr-kpi-label">Days with an outage</p>
                                    <p className="ncr-figure">
                                        <CountText text={`${u.outageDays}`} />
                                    </p>
                                    <p className={`ncr-small ${u.outageDays ? "ncr-bad-text" : "ncr-muted"}`}>
                                        {u.outageDays ? (
                                            <>
                                                <Icon name="alert" size={14} /> At least one check missed on{" "}
                                                {u.outageDays === 1 ? "that day" : "those days"}
                                            </>
                                        ) : (
                                            "Every check found the site up"
                                        )}
                                    </p>
                                </div>
                            </div>
                        )}
                        <div className="ncr-ms-resp">
                            <p className="ncr-kpi-label">Response time at monthly check</p>
                            {u.respStart && u.respEnd ? (
                                <>
                                    <p className="ncr-body-text">
                                        <span className="ncr-strong">{fmtInt(u.respStart.ms)} ms</span> on {dayLong(u.respStart.date)}
                                        {u.respEnd.date !== u.respStart.date ? (
                                            <>
                                                {" "}
                                                to <span className="ncr-strong">{fmtInt(u.respEnd.ms)} ms</span> on{" "}
                                                {dayLong(u.respEnd.date)}
                                            </>
                                        ) : null}
                                    </p>
                                    {u.respEnd.date !== u.respStart.date ? (
                                        <MsChange from={u.respStart.ms} to={u.respEnd.ms} unit="ms" better="down" />
                                    ) : null}
                                </>
                            ) : (
                                <p className="ncr-small">Not measured in this {kind}.</p>
                            )}
                        </div>
                    </section>

                    <section className="ncr-card ncr-panel" aria-labelledby="ncr-ms-iss-h">
                        <h2 id="ncr-ms-iss-h" className="ncr-h2">
                            Issues fixed
                        </h2>
                        {!iss.from || !iss.to ? (
                            <p className="ncr-small">Only one site check, or none, so there is nothing to compare yet.</p>
                        ) : (
                            <>
                                <div>
                                    <p className="ncr-kpi-label">Issues found</p>
                                    <p className="ncr-body-text">
                                        <span className="ncr-strong">{num(iss.from.issues_count) ?? "No data"}</span> on{" "}
                                        {dayLong(iss.from.run_date)} to{" "}
                                        <span className="ncr-strong">{num(iss.to.issues_count) ?? "No data"}</span> on{" "}
                                        {dayLong(iss.to.run_date)}
                                    </p>
                                    <MsChange from={num(iss.from.issues_count)} to={num(iss.to.issues_count)} unit="count" better="down" />
                                </div>
                                <div className="ncr-ms-issues">
                                    <h3 className="ncr-h3">Resolved ({iss.resolved.length})</h3>
                                    {iss.resolved.length ? (
                                        <ul className="ncr-ms-issue-list is-resolved" role="list">
                                            {iss.resolved.map((x) => (
                                                <li key={x}>
                                                    <Icon name="ok" size={16} />
                                                    <span>{x}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="ncr-small ncr-muted">No plan items were resolved between these two checks.</p>
                                    )}
                                    <h3 className="ncr-h3">Still open ({iss.open.length})</h3>
                                    {iss.open.length ? (
                                        <ul className="ncr-ms-issue-list is-open" role="list">
                                            {iss.open.map((x) => (
                                                <li key={x}>
                                                    <Icon name="flat" size={16} />
                                                    <span>{x}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    ) : (
                                        <p className="ncr-small ncr-muted">Nothing from the start of the period is still open.</p>
                                    )}
                                    {iss.added ? (
                                        <p className="ncr-small ncr-muted">
                                            {iss.added} new {iss.added === 1 ? "item was" : "items were"} added to the plan during the{" "}
                                            {kind}.{" "}
                                            <a className="ncr-link ncr-link-inline" href="#plan">
                                                See the plan
                                            </a>
                                        </p>
                                    ) : null}
                                </div>
                            </>
                        )}
                    </section>
                </div>

                <section className="ncr-card ncr-panel" aria-labelledby="ncr-ms-work-h">
                    <div className="ncr-panel-head">
                        <h2 id="ncr-ms-work-h" className="ncr-h2">
                            Work completed
                        </h2>
                        <p className="ncr-small ncr-muted">
                            {r.work.done.length} {r.work.done.length === 1 ? "thing" : "things"} done
                            {r.work.carried !== null
                                ? `, ${r.work.carried} ${p.closed ? "carried into the next period" : "still open"}`
                                : ""}
                        </p>
                    </div>
                    {r.work.groups.length ? (
                        <div className={`ncr-ms-work${p.kind === "year" ? " is-year" : ""}`}>
                            {r.work.groups.map((g) => (
                                <div key={g.category || "other"} className="ncr-ms-work-group">
                                    <h3 className="ncr-h3">
                                        {CATEGORY_NAMES[g.category] || "Other updates"} ({g.items.length})
                                    </h3>
                                    <ol className="ncr-work-list" role="list">
                                        {g.items.map((w) => (
                                            <li key={w.id} className="ncr-work-item">
                                                <time className="ncr-work-date" dateTime={w.done_on}>
                                                    {parseDay(w.done_on).toLocaleDateString(
                                                        "en-US",
                                                        p.kind === "year"
                                                            ? { month: "short", day: "numeric", year: "numeric" }
                                                            : { month: "short", day: "numeric" },
                                                    )}
                                                </time>
                                                <div className="ncr-work-body">
                                                    <p className="ncr-strong">{w.title}</p>
                                                    {w.detail ? <p className="ncr-small">{w.detail}</p> : null}
                                                </div>
                                            </li>
                                        ))}
                                    </ol>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="ncr-small">
                            No finished work was logged in this {kind}
                            {p.closed ? "" : " yet"}.
                        </p>
                    )}
                </section>
            </>
        )
    }
    const renderMilestones = () => {
        if (ms && ms.for === siteId && ms.status === "error") {
            return (
                <Problem
                    title="We could not load your reports"
                    text={`${ms.error} Your data is safe; this page just could not reach it. Try again, and if it keeps happening, email hello@nordmeyercreative.com.`}
                    action={
                        <button
                            type="button"
                            className="ncr-btn"
                            onClick={() => {
                                setMs(null)
                                setAttempt((a) => a + 1)
                            }}
                        >
                            Try again
                        </button>
                    }
                />
            )
        }
        if (!msBundle) {
            return (
                <div className="ncr-loading" role="status">
                    <span className="ncr-spinner" aria-hidden="true" />
                    Loading your reports…
                </div>
            )
        }
        if (msReport) return renderMilestoneReport(msReport)
        return (
            <>
                {msId ? (
                    <p className="ncr-small ncr-ms-missing" role="status">
                        That report is not available yet. Choose one of the reports below.
                    </p>
                ) : null}
                {renderMilestoneList()}
            </>
        )
    }
    useEffect(() => {
        if ((section === "sites" || section === "permissions") && phase === "ready" && !staffNormal) setSection("overview")
    }, [section, phase, staffNormal])
    useEffect(() => {
        if (section !== "sites" || phase !== "ready" || !isStaff || demo || !sites.length) return
        let cancelled = false
        const opt = async <T,>(fn: () => Promise<T>): Promise<T | null> => {
            try {
                return await fn()
            } catch (e) {
                return null
            }
        }
        ;(async () => {
            setStaffError("")
            try {
                const cur = monthKey(new Date())
                const prev = addMonths(cur, -1)
                const scores = await authGet<
                    {
                        site_id: string
                        month: string
                        overall: number | null
                        grade: string | null
                    }[]
                >(url, key, `/rest/v1/monthly_scores?select=site_id,month,overall,grade&month=gte.${addMonths(cur, -2)}&order=month.desc`)
                type UpRow = {
                    site_id: string
                    uptime_pct: number | null
                    days_with_outage?: number | null
                }
                const uptime: UpRow[] =
                    (await opt<UpRow[]>(() =>
                        authGet<UpRow[]>(url, key, `/rest/v1/monthly_uptime?select=site_id,uptime_pct,days_with_outage&month=eq.${cur}`),
                    )) ||
                    (await opt<UpRow[]>(() =>
                        authGet<UpRow[]>(url, key, `/rest/v1/monthly_uptime?select=site_id,uptime_pct&month=eq.${cur}`),
                    )) ||
                    []
                const pings: (PingRow[] | null)[] = await Promise.all(
                    sites.map((x) =>
                        opt<PingRow[]>(() =>
                            authGet<PingRow[]>(
                                url,
                                key,
                                `/rest/v1/uptime_pings?site_id=eq.${enc(x.id)}&select=site_id,checked_at,up&order=checked_at.desc&limit=1`,
                            ),
                        ),
                    ),
                )
                if (cancelled) return
                const now = Date.now()
                const rows: StaffSiteRow[] = sites.map((x, i) => {
                    const mine = scores.filter((r) => r.site_id === x.id)
                    const latest = mine[0] || null
                    const before = mine.find((r) => latest && r.month < latest.month) || null
                    const u = uptime.find((r) => r.site_id === x.id) || null
                    const ping = pings[i] && pings[i]!.length ? pings[i]![0] : null
                    const flags: string[] = []
                    if (ping && !ping.up) flags.push("Down at the last check")
                    const days = num(u?.days_with_outage as any)
                    if (days) flags.push(`Unreachable on ${days} ${days === 1 ? "day" : "days"} this month`)
                    const a = num(latest?.overall)
                    const b = num(before?.overall)
                    if (a !== null && b !== null && a - b <= -NOTICE_SCORE_STEP) flags.push(`Score down ${b - a} points`)
                    if (!ping) flags.push("No uptime checks yet")
                    else if (now - new Date(ping.checked_at).getTime() > 30 * 60 * 1000) flags.push("No check in the last 30 minutes")
                    if (latest && latest.month < prev) flags.push("No report since " + monthLong(latest.month))
                    return {
                        id: x.id,
                        client: clients.find((c) => c.id === x.client_id)?.name || "Unknown client",
                        domain: x.domain,
                        score: a,
                        grade: latest?.grade || null,
                        scoreMonth: latest?.month || null,
                        uptime: num(u?.uptime_pct),
                        lastChecked: ping ? ping.checked_at : null,
                        flags,
                    }
                })
                rows.sort((p, q) => p.client.localeCompare(q.client) || p.domain.localeCompare(q.domain))
                setStaffRows(rows)
            } catch (e: any) {
                if (!cancelled) setStaffError("The site list couldn’t load. Try again in a moment.")
            }
        })()
        return () => {
            cancelled = true
        }
    }, [section, phase, isStaff, demo, sites, clients, url, key, refreshKey])
    const renderSites = () => {
        if (staffError) return <Problem title="All sites" text={staffError} />
        if (!staffRows) {
            return (
                <div className="ncr-loading" role="status">
                    <span className="ncr-spinner" aria-hidden="true" />
                    Loading every site…
                </div>
            )
        }
        const flagged = staffRows.filter((r) => r.flags.length).length
        return (
            <section className="ncr-card ncr-panel" aria-labelledby="ncr-sites-h">
                <div className="ncr-panel-head">
                    <h2 id="ncr-sites-h" className="ncr-h2">
                        Every site we look after
                    </h2>
                    <p className="ncr-small ncr-muted">
                        {staffRows.length} {staffRows.length === 1 ? "site" : "sites"},{" "}
                        {flagged ? `${flagged} needing attention` : "nothing flagged"}
                    </p>
                </div>
                <TableRegion label="Every site we look after">
                    <table className="ncr-table ncr-sites-table">
                        <thead>
                            <tr>
                                <th scope="col">Site</th>
                                <th scope="col">Health</th>
                                <th scope="col">Uptime this month</th>
                                <th scope="col">Last checked</th>
                                <th scope="col">Needs attention</th>
                            </tr>
                        </thead>
                        <tbody>
                            {staffRows.map((r) => (
                                <tr key={r.id} className={r.id === siteId ? "is-current" : undefined}>
                                    <th scope="row">
                                        <button
                                            type="button"
                                            className="ncr-row-link"
                                            onClick={() => {
                                                pickSite(r.id)
                                                window.location.hash = "overview"
                                            }}
                                        >
                                            <span className="ncr-strong">{r.client}</span>
                                            <span className="ncr-small ncr-muted ncr-clamp-any">{r.domain}</span>
                                        </button>
                                    </th>
                                    <td>
                                        {r.score === null ? (
                                            <span className="ncr-muted">No score yet</span>
                                        ) : (
                                            <>
                                                {r.score}
                                                {r.grade ? ` (${r.grade})` : ""}
                                                {r.scoreMonth && r.scoreMonth !== monthKey(new Date()) ? (
                                                    <span className="ncr-small ncr-muted"> {monthShortYear(r.scoreMonth)}</span>
                                                ) : null}
                                            </>
                                        )}
                                    </td>
                                    <td>{r.uptime === null ? <span className="ncr-muted">No data</span> : `${r.uptime}%`}</td>
                                    <td>{r.lastChecked ? timeShort(r.lastChecked) : <span className="ncr-muted">Never</span>}</td>
                                    <td>
                                        {r.flags.length ? (
                                            <ul className="ncr-flags" role="list">
                                                {r.flags.map((f) => (
                                                    <li key={f}>
                                                        <Icon name="alert" size={14} />
                                                        <span>{f}</span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <span className="ncr-muted">Nothing flagged</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </TableRegion>
                <p className="ncr-small ncr-muted">
                    Choose a site to open its full dashboard. You are seeing this because your login is a staff login.
                </p>
            </section>
        )
    }
    const firstMonth = useRef(true)
    useEffect(() => {
        if (!demo || !month) return
        if (firstMonth.current) {
            firstMonth.current = false
            return
        }
        setDemoBusy(true)
        const t = window.setTimeout(() => setDemoBusy(false), 700)
        return () => window.clearTimeout(t)
    }, [month, demo])
    const rawBusy =
        loadingSite ||
        phase === "checking" ||
        demoBusy ||
        (section === "account" && phase === "ready" && (!account || account.status === "loading")) ||
        (section === "reports" && phase === "ready" && !demo && !!site && (!ms || ms.for !== siteId || ms.status === "loading"))
    const [stalled, setStalled] = useState(false)
    useEffect(() => {
        if (!rawBusy) {
            setStalled(false)
            return
        }
        const t = window.setTimeout(() => {
            setStalled(true)
            setLoadingSite(false)
            setDemoBusy(false)
            setError(STALL_MESSAGE)
            setPhase("error")
        }, LOAD_TIMEOUT_MS + 500)
        return () => window.clearTimeout(t)
    }, [rawBusy])
    const busy = rawBusy && !stalled
    const [overlay, setOverlay] = useState(false)
    const overlayAt = useRef(0)
    useEffect(() => {
        let t = 0
        if (busy && !overlay) {
            t = window.setTimeout(() => {
                overlayAt.current = Date.now()
                setOverlay(true)
            }, 250)
        } else if (!busy && overlay) {
            t = window.setTimeout(() => setOverlay(false), Math.max(0, 400 - (Date.now() - overlayAt.current)))
        }
        return () => {
            if (t) window.clearTimeout(t)
        }
    }, [busy, overlay])
    const locked = overlay
    const lockedRef = useRef(false)
    lockedRef.current = locked
    const mainwrapRef = useRef<HTMLDivElement>(null)
    const nordyWrapRef = useRef<HTMLDivElement>(null)
    const lockFocus = useRef<HTMLElement | null>(null)
    useEffect(() => {
        const regions = [sidebarRef.current, mainwrapRef.current, nordyWrapRef.current] as (HTMLElement | null)[]
        if (locked && typeof document !== "undefined") lockFocus.current = document.activeElement as HTMLElement | null
        regions.forEach((el) => {
            if (el) (el as any).inert = locked
        })
        if (locked) {
            collapseRailNow()
            setDrawer(false)
        } else {
            const back = lockFocus.current
            lockFocus.current = null
            if (back && back.isConnected && (document.activeElement === document.body || !document.activeElement))
                back.focus({ preventScroll: true })
        }
        return () => regions.forEach((el) => el && ((el as any).inert = false))
    }, [locked])
    const introGo = !busy && !overlay
    const introValue = useMemo(() => ({ go: introGo, reduce: !!reduce || !introPlay }), [introGo, reduce, introPlay])
    useEffect(() => {
        if (!introPlay || !introGo) return
        const t = window.setTimeout(() => setIntroPlay(false), COUNT_MS + CHART_DELAY_MS + CHART_MS + 900)
        return () => window.clearTimeout(t)
    }, [introPlay, introGo])
    const sectionLabel = msReport ? msReport.period.title : ALL_SECTIONS.find((s) => s.id === section)?.label || "Overview"
    let body: ReactNode = null
    if (phase === "config") {
        body = (
            <Problem
                title="This dashboard is only half set up"
                text="Both the Supabase project URL and the publishable key are needed. One of them is filled in and the other is empty, so no data can load. Fill in both, or clear both to show sample data."
            />
        )
    } else if (phase === "checking" || (!data && phase === "ready")) {
        body = (
            <div className="ncr-loading" role="status">
                <span className="ncr-spinner" aria-hidden="true" />
                Loading your report…
            </div>
        )
    } else if (phase === "error") {
        body = (
            <Problem
                title="We could not load your report"
                text={`${error} Your data is safe; this page just could not reach it. Try again, and if it keeps happening, email hello@nordmeyercreative.com.`}
                action={
                    <button
                        type="button"
                        className="ncr-btn"
                        onClick={() => {
                            setPhase("checking")
                            setAttempt((a) => a + 1)
                        }}
                    >
                        Try again
                    </button>
                }
            />
        )
    } else if (phase === "no-access") {
        body = (
            <Problem
                title="Your account is not linked to a website yet"
                text="You are signed in, but no client reports are connected to this account. Email hello@nordmeyercreative.com and we will link your site."
            />
        )
    } else if (section === "jager" && phase === "ready" && jagerOk && site) {
        body = (
            <div className={viewing ? "ncr-ro-wrap" : undefined} title={viewing ? READ_ONLY_MSG : undefined}>
                {viewing ? <ReadOnlyNote /> : null}
                <JagerScreen
                    key={`${siteId}${viewing ? "-ro" : ""}`}
                    backend={deskJager}
                    reloadKey={refreshKey}
                    prospects={demoMode ? null : deskProspects}
                    staff={staffNormal}
                    prospectsAllowed={(demo && !demoMode) || prospectPlan}
                    collected={deskCollected}
                    businessName={client?.name || site.site_name || site.domain}
                    domain={site.domain}
                    signature={{
                        name: staffNormal || demo ? "Ryan" : "The team",
                        business: staffNormal || demo ? "Nordmeyer Creative" : client?.name || site.site_name || site.domain,
                    }}
                    who={`${demo ? "sample data preview" : staffNormal ? "Nordmeyer Creative staff" : "site owner"} · ${site.domain}`}
                    slashFocus
                />
            </div>
        )
    } else if (section === "permissions" && phase === "ready" && staffNormal) {
        body = (
            <PermissionsPanel
                key={clientId}
                clientId={clientId}
                clientName={client?.name || site?.site_name || "This client"}
                api={permApi}
                onViewAs={() => {
                    setViewAsOn(true)
                    window.location.hash = "overview"
                }}
                onChanged={() => setEntKey((k) => k + 1)}
            />
        )
    } else if (section === "sites" && phase === "ready" && staffNormal) {
        body = renderSites()
    } else if (section === "account" && phase === "ready") {
        body = (
            <AccountSection
                state={account}
                demo={demo}
                portalUrl={portalUrl}
                url={url}
                apiKey={key}
                signInPath={signInPath}
                tourClass={tourCls("account")}
                clientId={clientId}
                businessName={client?.name || site?.site_name || "our business"}
                role={role}
                loginsAllowed={ent ? (clientF ? clientF.logins : F.logins) : undefined}
                readOnly={viewing}
                buildFile={() =>
                    buildDataText({
                        demo,
                        businessName: client?.name || site?.site_name || "Your business",
                        domain: site?.domain || "",
                        account: account!,
                        data: data || {
                            scores: [],
                            traffic: [],
                            uptime: [],
                            ranks: [],
                            snapshots: [],
                            recs: [],
                            work: [],
                            checks: [],
                            pings: [],
                            searchScope: "core",
                            hiddenRecs: 0,
                        },
                        now: new Date(),
                    })
                }
                onRetry={() => {
                    setAccount(null)
                    setAttempt((a) => a + 1)
                }}
            />
        )
    } else if (data && month) {
        body =
            section === "reports"
                ? renderMilestones()
                : section === "overview"
                  ? renderOverview()
                  : section === "health"
                    ? renderHealth()
                    : section === "traffic"
                      ? renderTraffic()
                      : section === "search"
                        ? renderSearch()
                        : section === "uptime"
                          ? renderUptime()
                          : section === "work"
                            ? renderWork()
                            : renderPlan()
    } else if (data && !month) {
        body = (
            <Problem
                title="No reports yet"
                text="This site is set up, but its first monthly check has not run yet. Your first report appears here after it does."
            />
        )
    }
    const showContext = phase === "ready" && !!data
    const domain = site?.domain || ""
    return (
        <div
            ref={rootRef}
            className={`ncr ncr-app ncr-v2${locked ? " is-locked" : ""}${introPlay && introGo && !reduce ? " is-ncr-intro" : ""}`}
            style={{ ...style, position: "relative", width: "100%", ["--ncr-nordy-h" as any]: `${nordyPx}px` }}
            data-rail={rail ? "1" : "0"}
            aria-busy={busy}
        >
            <style>{FONT_CSS + THEME_CSS + APP_CSS + V2_CSS + REFRESH_CSS + TIERS_CSS + MEISTER_CSS + SEO_CSS}</style>

            <span className="ncr-sr" role="status" aria-live="polite">
                {overlay ? "Loading your reports…" : ""}
            </span>

            <aside className="ncr-v2-rail" aria-label="Quick navigation">
                <div className="ncr-v2-rail-group" role="group" aria-label="Appearance">
                    <button
                        type="button"
                        className={`ncr-v2-rail-btn${mode === "light" ? " is-on" : ""}`}
                        onClick={() => {
                            if (mode !== "light") toggle()
                        }}
                        aria-pressed={mode === "light"}
                        aria-label="Light mode"
                        title="Light mode"
                    >
                        <Icon name="sun" size={18} />
                    </button>
                    <button
                        type="button"
                        className={`ncr-v2-rail-btn${mode === "dark" ? " is-on" : ""}`}
                        onClick={() => {
                            if (mode !== "dark") toggle()
                        }}
                        aria-pressed={mode === "dark"}
                        aria-label="Dark mode"
                        title="Dark mode"
                    >
                        <Icon name="moon" size={18} />
                    </button>
                </div>
                {showContext ? (
                    <nav className="ncr-v2-rail-group" aria-label="Sections">
                        <ul role="list">
                            {[...navSections, ACCOUNT_SECTION].map((s) => {
                                const current = s.id === section
                                return (
                                    <li key={s.id}>
                                        <a
                                            href={`#${s.id}`}
                                            className={`ncr-v2-rail-btn${current ? " is-current" : ""}`}
                                            aria-current={current ? "page" : undefined}
                                            aria-label={s.label}
                                            title={s.label}
                                            onClick={() => {
                                                if (s.id === section) headingRef.current?.focus({ preventScroll: true })
                                            }}
                                        >
                                            <Icon name={s.id === "account" ? "person" : s.id} size={18} />
                                        </a>
                                    </li>
                                )
                            })}
                        </ul>
                    </nav>
                ) : null}
                <div className="ncr-v2-rail-group" role="group" aria-label="Help and sign out">
                    <a href={aboutPath} className="ncr-v2-rail-btn" aria-label="What is Sucher?" title="What is Sucher?">
                        <HelpGlyph />
                    </a>
                    <button
                        type="button"
                        className="ncr-v2-rail-btn"
                        onClick={signOut}
                        aria-label={demoMode ? "Exit demo" : "Sign out"}
                        title={demoMode ? "Exit demo" : "Sign out"}
                    >
                        <Icon name="signout" size={18} />
                    </button>
                </div>
            </aside>

            <div className="ncr-mainwrap" ref={mainwrapRef}>
                {viewing && showContext ? (
                    <ViewAsBanner
                        client={client?.name || site?.site_name || "this client"}
                        tier={ent ? ent.tier : null}
                        members={viewAsMembers && viewAsMembers.for === clientId ? viewAsMembers.list : null}
                        login={viewAsLogin}
                        onLogin={setViewAsLogin}
                        onExit={() => {
                            setViewing(false)
                            headingRef.current?.focus({ preventScroll: true })
                        }}
                    />
                ) : null}

                <header className="ncr-v2-top">
                    <a href="/" className="ncr-brand-link ncr-v2-brand" aria-label="Nordmeyer Creative home">
                        <span className="ncr-logo ncr-v2-logo" aria-hidden="true" />
                    </a>
                    {showContext ? (
                        <nav className="ncr-v2-tabs" aria-label={`${sectionLabel} parts`}>
                            <button
                                type="button"
                                className="ncr-v2-tab ncr-v2-tab-section"
                                aria-label={`${sectionLabel}: show everything and go to the top`}
                                onClick={() => {
                                    choosePart(null)
                                    window.scrollTo({ top: 0, behavior: reduce ? "auto" : "smooth" })
                                }}
                            >
                                <Icon name={section === "account" ? "person" : section} size={16} />
                                <span className="ncr-v2-tab-text">{sectionLabel}</span>
                            </button>
                            {parts.length ? (
                                <ul role="list" className="ncr-v2-parts">
                                    {[null, ...parts].map((p) => {
                                        const current = (p ? p.key : "") === activePart
                                        return (
                                            <li key={p ? p.key : "all"}>
                                                <button
                                                    type="button"
                                                    className={`ncr-v2-tab ncr-v2-part${current ? " is-current" : ""}`}
                                                    aria-pressed={current}
                                                    onClick={() => choosePart(p)}
                                                >
                                                    {current ? (
                                                        <motion.span
                                                            className="ncr-v2-tab-pill"
                                                            layoutId={`ncr-v2-part-pill-${section}-${reportOpen ? "r" : "l"}`}
                                                            initial={false}
                                                            transition={reduce ? { duration: 0 } : SPRING}
                                                            aria-hidden="true"
                                                        />
                                                    ) : null}
                                                    <span className="ncr-v2-tab-text">{p ? p.label : "All"}</span>
                                                </button>
                                            </li>
                                        )
                                    })}
                                </ul>
                            ) : null}
                        </nav>
                    ) : null}
                    <div className="ncr-v2-top-end">
                        {demo && !demoMode ? <span className="ncr-sample">Sample data</span> : null}

                        {showContext && isStaff && !demo ? <ViewAsToggle on={viewing} onChange={setViewing} /> : null}
                        {showContext ? (
                            <RefreshControl rf={rf} variant="v2" note={viewing ? `${READ_ONLY_MSG}, so no fresh pull` : undefined} />
                        ) : null}
                        {showContext ? (
                            <div className="ncr-v2-acct" ref={acctRef}>
                                <button
                                    ref={acctBtnRef}
                                    type="button"
                                    className={`ncr-v2-account${acctMenu ? " is-open" : ""}`}
                                    aria-haspopup="menu"
                                    aria-expanded={acctMenu}
                                    aria-controls="ncr-v2-acct-menu"
                                    aria-label={`Account menu for ${client?.name || site?.site_name || "your business"}`}
                                    onClick={() => setAcctMenu((v) => !v)}
                                >
                                    <span className="ncr-v2-avatar" aria-hidden="true">
                                        {initialsOf(client?.name || site?.site_name || "Your business")}
                                    </span>
                                    <span className="ncr-v2-account-text" aria-hidden="true">
                                        <span className="ncr-v2-account-name">{client?.name || site?.site_name || "Your business"}</span>
                                        <span className="ncr-v2-account-sub">{demoMode ? "Example business" : domain || "My account"}</span>
                                    </span>
                                    <span className="ncr-v2-account-chev" aria-hidden="true">
                                        <ChevronGlyph />
                                    </span>
                                </button>
                                <AnimatePresence>
                                    {acctMenu ? (
                                        <motion.div
                                            key="acct-menu"
                                            id="ncr-v2-acct-menu"
                                            className="ncr-v2-menu"
                                            role="menu"
                                            aria-label="Account"
                                            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                                            animate={{ opacity: 1, y: 0, scale: 1 }}
                                            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -6, scale: 0.98 }}
                                            transition={reduce ? { duration: 0.12 } : { type: "spring", bounce: 0, duration: 0.28 }}
                                        >
                                            <div className="ncr-v2-menu-head" aria-hidden="true">
                                                <span className="ncr-v2-menu-name">
                                                    {client?.name || site?.site_name || "Your business"}
                                                </span>
                                                <span className="ncr-v2-menu-sub">{demoMode ? "Example business" : domain || ""}</span>
                                            </div>
                                            <a
                                                href="#account"
                                                role="menuitem"
                                                className="ncr-v2-menu-item"
                                                onClick={() => {
                                                    setAcctMenu(false)
                                                    if (section === "account") headingRef.current?.focus({ preventScroll: true })
                                                }}
                                            >
                                                <Icon name="person" size={16} />
                                                <span>My account</span>
                                            </a>
                                            <button
                                                type="button"
                                                role="menuitem"
                                                className="ncr-v2-menu-item"
                                                onClick={() => {
                                                    toggle()
                                                }}
                                            >
                                                <Icon name={mode === "dark" ? "sun" : "moon"} size={16} />
                                                <span>{mode === "dark" ? "Switch to light mode" : "Switch to dark mode"}</span>
                                            </button>
                                            {!demoMode ? (
                                                <a
                                                    href={portalUrl || PORTAL_URL}
                                                    role="menuitem"
                                                    className="ncr-v2-menu-item"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    onClick={() => setAcctMenu(false)}
                                                >
                                                    <Icon name="back" size={16} />
                                                    <span>
                                                        Client portal<span className="ncr-sr"> (opens in a new tab)</span>
                                                    </span>
                                                </a>
                                            ) : (
                                                <a
                                                    href={aboutPath}
                                                    role="menuitem"
                                                    className="ncr-v2-menu-item"
                                                    onClick={() => setAcctMenu(false)}
                                                >
                                                    <HelpGlyph />
                                                    <span>What is Sucher?</span>
                                                </a>
                                            )}
                                            <div className="ncr-v2-menu-rule" role="separator" />
                                            <button
                                                type="button"
                                                role="menuitem"
                                                className="ncr-v2-menu-item ncr-v2-menu-out"
                                                onClick={() => {
                                                    setAcctMenu(false)
                                                    signOut()
                                                }}
                                            >
                                                <Icon name="signout" size={16} />
                                                <span>{demoMode ? "Exit demo" : "Sign out"}</span>
                                            </button>
                                        </motion.div>
                                    ) : null}
                                </AnimatePresence>
                            </div>
                        ) : null}
                        <button
                            ref={menuBtnRef}
                            type="button"
                            className="ncr-icon-btn ncr-menu-btn"
                            onClick={() => setDrawer(true)}
                            aria-label="Open menu"
                            aria-expanded={drawer}
                            aria-controls="ncr-drawer"
                        >
                            <Icon name="menu" />
                        </button>
                    </div>
                </header>

                {showContext && phase === "ready" && section !== "sites" ? (
                    <NoticeStrip
                        notices={notices}
                        reduce={!!reduce}
                        tourClass={tourCls("notices")}
                        onAck={dismissNotice}
                        onView={(n) => {
                            setFlash(n.hl || null)
                            dismissNotice(n.id, true)
                            focusIfSame(n.href)
                        }}
                    />
                ) : null}

                <div className="ncr-content" aria-busy={busy}>
                    <div className={`ncr-loader${overlay ? " is-on" : ""}`} aria-hidden="true">
                        <div className="ncr-loader-inner">
                            <div className="ncr-loader-ring">
                                <svg viewBox="0 0 80 80" focusable="false">
                                    <circle className="ncr-loader-track" cx="40" cy="40" r="37" />
                                    <circle className="ncr-loader-arc" cx="40" cy="40" r="37" />
                                </svg>
                                <span className="ncr-loader-mark" />
                            </div>
                        </div>
                    </div>

                    <div className="ncr-v2-head">
                        <div className="ncr-v2-head-copy">
                            <h1 ref={headingRef} tabIndex={-1} className="ncr-h1">
                                {showContext && section === "overview" && !msReport ? (
                                    <>
                                        {greet}, {client?.name || site?.site_name || "there"}
                                    </>
                                ) : (
                                    sectionLabel
                                )}
                                {showContext && month && section !== "reports" ? (
                                    <span className="ncr-sr">, {monthLong(month)}</span>
                                ) : null}
                            </h1>
                            {showContext && !msReport ? (
                                <p className="ncr-v2-sub">
                                    {section === "overview"
                                        ? demoMode
                                            ? `Here is how an example business is doing${month ? ` in ${monthLong(month)}` : ""}. The numbers are invented.`
                                            : `Here is how ${domain || "your website"} is doing${month ? ` in ${monthLong(month)}` : ""}.`
                                        : section === "reports" && !F.reports_monthly
                                          ? "Quarterly and annual report cards, each with a PDF."
                                          : TAGLINES[section]}
                                    {demoMode ? (
                                        <span className="ncr-what">
                                            <span aria-hidden="true"> · </span>
                                            <a href={aboutPath}>What is Sucher?</a>
                                        </span>
                                    ) : null}
                                </p>
                            ) : null}
                        </div>
                        {showContext ? (
                            <div className="ncr-v2-head-actions">
                                {staffNormal ? <span className="ncr-staff-badge">Staff view</span> : null}
                                {demoMode && demoStaff ? (
                                    <DemoTierPicker value={previewTier} onChange={setPreviewTier} ready={!!matrices} />
                                ) : null}
                                {demo && !demoMode ? <span className="ncr-sample ncr-sample-desk">Sample data</span> : null}
                                {(staffNormal ? sites.length > 1 : visClients.length > 1 || clientSites.length > 1) ? (
                                    <div className="ncr-v2-switch">{switchers}</div>
                                ) : null}
                                {months.length ? (
                                    <label className="ncr-month">
                                        <span className="ncr-month-label ncr-sr">Month</span>
                                        <select className="ncr-select" value={month} onChange={(e) => setMonth(e.target.value)}>
                                            {months.map((m) => (
                                                <option key={m} value={m}>
                                                    {monthLong(m)}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                ) : null}
                                {section === "overview" && F.reports_monthly && month && site && data ? (
                                    <MonthPdfLink make={downloadMonthPdf} />
                                ) : null}
                            </div>
                        ) : null}
                    </div>
                    {showContext && lastChecked ? <p className="ncr-checked ncr-v2-checked">Last checked {dayLong(lastChecked)}</p> : null}
                    <motion.div
                        key={`${section}-${section === "reports" ? msId || "list" : month}-${siteId}`}
                        className="ncr-section"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={reduce ? { duration: 0.15 } : SPRING}
                    >
                        <IntroCtx.Provider value={introValue}>{body}</IntroCtx.Provider>
                    </motion.div>
                    {showContext && phase === "ready" ? (
                        <p className="ncr-disclaimer">
                            Scores are point-in-time measurements from public testing tools such as Google Lighthouse. They help us find and
                            fix problems, but they are not a guarantee of security, accessibility, or search rankings.
                        </p>
                    ) : null}
                </div>
            </div>

            <div ref={nordyWrapRef} style={{ display: "contents" }}>
                <Nordy
                    mode="reports"
                    sample={demoMode}
                    suppressed={drawer}
                    plansPath={plansPath}
                    tour={
                        (tourStep !== null && tourList[tourStep]
                            ? {
                                  kind: "step",
                                  index: tourStep,
                                  total: tourList.length,
                                  title: tourList[tourStep].title,
                                  body: tourList[tourStep].body,
                              }
                            : tourOffer
                              ? { kind: "offer" }
                              : checkin && demoMode
                                ? { kind: "checkin" }
                                : null) as NordyTourView | null
                    }
                    onTour={onNordy}
                    onFootprint={(px) => setNordyPx(Math.max(px, 0))}
                    onOpenChange={setNordyMenu}
                />
            </div>

            <AnimatePresence>
                {drawer ? (
                    <>
                        <motion.div
                            key="scrim"
                            className="ncr-scrim"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: reduce ? 0.12 : 0.24 }}
                            onClick={() => setDrawer(false)}
                            aria-hidden="true"
                        />
                        <motion.div
                            key="drawer"
                            id="ncr-drawer"
                            ref={drawerRef}
                            className="ncr-drawer"
                            role="dialog"
                            aria-modal="true"
                            aria-label="Menu"
                            initial={reduce ? { opacity: 0 } : { x: "100%" }}
                            animate={reduce ? { opacity: 1 } : { x: 0 }}
                            exit={reduce ? { opacity: 0 } : { x: "100%" }}
                            transition={reduce ? { duration: 0.15 } : SPRING}
                        >
                            {sidebarBody(true)}
                        </motion.div>
                    </>
                ) : null}
            </AnimatePresence>
        </div>
    )
}
function NoticeStrip({
    notices,
    reduce,
    tourClass,
    onAck,
    onView,
}: {
    notices: Notice[]
    reduce: boolean
    tourClass: string
    onAck: (id: string) => void
    onView: (n: Notice) => void
}) {
    const [i, setI] = useState(0)
    const [paused, setPaused] = useState(false)
    const [held, setHeld] = useState(false)
    const [spoken, setSpoken] = useState("")
    const rootRef = useRef<HTMLDivElement>(null)
    const announced = useRef(false)
    const n = notices.length
    const idx = n ? Math.min(i, n - 1) : 0
    const cur = n ? notices[idx] : null
    const say = (k: number) => {
        const x = notices[k]
        if (x) setSpoken(`Notice ${k + 1} of ${n}. ${NOTICE_KIND[x.tone]}. ${x.title}.`)
    }
    useEffect(() => {
        if (n && !announced.current) {
            announced.current = true
            setSpoken(n === 1 ? `1 notice. ${notices[0].title}.` : `${n} notices. ${notices[0].title}.`)
        }
    }, [n])
    useEffect(() => {
        if (reduce || paused || held || n < 2) return
        const t = window.setInterval(() => setI((v) => (v + 1) % n), NOTICE_ROTATE_MS)
        return () => window.clearInterval(t)
    }, [reduce, paused, held, n])
    const go = (d: number) => {
        const k = (idx + d + n) % n
        setI(k)
        say(k)
    }
    const ack = (id: string) => {
        const nextCount = n - 1
        onAck(id)
        if (nextCount > 0) {
            const k = Math.min(idx, nextCount - 1)
            setI(k)
            const nx = notices.filter((x) => x.id !== id)[k]
            if (nx) setSpoken(`Marked as seen. Notice ${k + 1} of ${nextCount}. ${nx.title}.`)
            requestAnimationFrame(() =>
                rootRef.current?.querySelector<HTMLElement>(".ncr-strip-slide.is-on .ncr-strip-ack")?.focus({ preventScroll: true }),
            )
        } else setSpoken("All notices marked as seen.")
    }
    return (
        <>
            <span className="ncr-sr" aria-live="polite">
                {spoken}
            </span>
            <AnimatePresence initial={false}>
                {cur ? (
                    <motion.div
                        key="strip"
                        ref={rootRef}
                        className={`ncr-strip${tourClass}`}
                        data-tour="notices"
                        role="region"
                        aria-label="Notices"
                        aria-roledescription="carousel"
                        initial={reduce ? { opacity: 0 } : { opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={reduce ? { opacity: 0, transition: { duration: 0.12 } } : { opacity: 0, height: 0, transition: SPRING }}
                        transition={reduce ? { duration: 0.12 } : SPRING}
                        onPointerEnter={() => setHeld(true)}
                        onPointerLeave={() => setHeld(false)}
                        onFocus={() => setHeld(true)}
                        onBlur={(e) => {
                            if (!rootRef.current?.contains(e.relatedTarget as Node | null)) setHeld(false)
                        }}
                    >
                        <div className="ncr-strip-inner">
                            <div className="ncr-strip-stack">
                                {notices.map((x, k) => {
                                    const on = k === idx
                                    return (
                                        <div
                                            key={x.id}
                                            className={`ncr-strip-slide is-${x.tone}${on ? " is-on" : ""}`}
                                            role="group"
                                            aria-roledescription="notice"
                                            aria-label={`${k + 1} of ${n}`}
                                            aria-hidden={on ? undefined : true}
                                            {...(!on ? { inert: "" as any } : {})}
                                        >
                                            <span className="ncr-notice-icon">
                                                <Icon name={x.icon} size={18} />
                                            </span>
                                            <div className="ncr-notice-text">
                                                <p className="ncr-notice-kind">{NOTICE_KIND[x.tone]}</p>
                                                <p className="ncr-notice-title">{x.title}</p>
                                                <p className="ncr-small ncr-strip-body">{x.body}</p>
                                            </div>
                                            <div className="ncr-strip-actions">
                                                <a className="ncr-strip-view" href={x.href} onClick={() => onView(x)}>
                                                    View<span className="ncr-sr">{x.linkText.replace(/^See /, " ")}</span>
                                                    <Icon name="expand" size={14} />
                                                </a>
                                                <button
                                                    type="button"
                                                    className="ncr-icon-btn ncr-strip-ack"
                                                    aria-label={`Mark as seen: ${x.title}`}
                                                    onClick={() => ack(x.id)}
                                                >
                                                    <Icon name="ok" size={20} />
                                                </button>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                            {n > 1 ? (
                                <div className="ncr-strip-nav">
                                    <button
                                        type="button"
                                        className="ncr-icon-btn ncr-strip-btn"
                                        aria-label="Previous notice"
                                        onClick={() => go(-1)}
                                    >
                                        <Icon name="collapse" size={18} />
                                    </button>
                                    <span className="ncr-strip-count" aria-hidden="true">
                                        {idx + 1} of {n}
                                    </span>
                                    <button
                                        type="button"
                                        className="ncr-icon-btn ncr-strip-btn"
                                        aria-label="Next notice"
                                        onClick={() => go(1)}
                                    >
                                        <Icon name="expand" size={18} />
                                    </button>
                                    {!reduce ? (
                                        <button
                                            type="button"
                                            className="ncr-icon-btn ncr-strip-btn"
                                            aria-label={paused ? "Resume rotating notices" : "Pause rotating notices"}
                                            onClick={() => setPaused((v) => !v)}
                                        >
                                            <Icon name={paused ? "play" : "pause"} size={18} />
                                        </button>
                                    ) : null}
                                </div>
                            ) : null}
                        </div>
                    </motion.div>
                ) : null}
            </AnimatePresence>
        </>
    )
}
const SUCHER_LIGHT = "https://framerusercontent.com/images/ZyZV6Nio0jq2Un8Gdazh3Wl98s.png"
const SUCHER_DARK = "https://framerusercontent.com/images/LahWeoj7RflXomcCFy2EmVy5u8.png"
function SucherPill() {
    return (
        <span className="ncr-pill-logo">
            <img className="ncr-pill-img ncr-pill-light" src={SUCHER_LIGHT} alt="Sucher" width={1279} height={332} decoding="async" />
            <img className="ncr-pill-img ncr-pill-dark" src={SUCHER_DARK} alt="Sucher" width={1279} height={332} decoding="async" />
        </span>
    )
}
function HostNote({ snap }: { snap: SnapshotRow | null }) {
    const managed = num(snap?.host_managed)
    if (!snap || managed === null || managed <= 0) return null
    const inControl = num(snap.security_in_control)
    const host = (snap.host_name || "").trim() || "your host"
    return (
        <div className="ncr-host-note">
            <p className="ncr-small">
                <Icon name="ok" size={15} />
                <span>
                    Everything in your site’s control:{" "}
                    <strong>{inControl === null || inControl >= 100 ? "passing" : `${inControl} out of 100`}</strong>
                </span>
            </p>
            <p className="ncr-small ncr-muted">
                {managed} {managed === 1 ? "check is" : "checks are"} set by your host, {host}, not by the site itself.{" "}
                {managed === 1 ? "It still counts" : "They still count"} toward the security score above, and we review{" "}
                {managed === 1 ? "it" : "them"} every month.
            </p>
        </div>
    )
}
function CardLink({ href, dest, onSame, children }: { href: string; dest: string; onSame: (h: string) => void; children: ReactNode }) {
    return (
        <a href={href} className="ncr-card-link" onClick={() => onSame(href)}>
            {children}
            {dest ? <span className="ncr-sr">, see {dest}</span> : null}
        </a>
    )
}
function ViewHint() {
    return (
        <span className="ncr-view-hint" aria-hidden="true">
            View
            <Icon name="expand" size={14} />
        </span>
    )
}
interface AccountState {
    for: string
    status: "loading" | "ready" | "error"
    plans: PlanRow[]
    email: string
    lastSignIn: string
    siteMeta: SiteMetaRow[] | null
    events: EventRow[] | null
    nextReport: EventRow | null
    logins: LoginRow[] | null
    reportEmails: boolean | null
    error: string
}
const EMPTY_ACCOUNT: AccountState = {
    for: "",
    status: "loading",
    plans: [],
    email: "",
    lastSignIn: "",
    siteMeta: null,
    events: null,
    nextReport: null,
    logins: null,
    reportEmails: null,
    error: "",
}
async function authRpc<T = any>(url: string, key: string, fn: string, body: Record<string, unknown>): Promise<T> {
    const s = await liveSession(url, key)
    if (!s) throw new ReportsError("Your session has ended. Please sign in again.", 401)
    const res = await fetch(`${url}/rest/v1/rpc/${fn}`, {
        method: "POST",
        headers: { apikey: key, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
    })
    if (!res.ok) throw new ReportsError(`Request failed (${res.status})`, res.status)
    const text = await res.text()
    return (text ? JSON.parse(text) : null) as T
}
const PARTNER = { name: "Ryan Nordmeyer", email: "hello@nordmeyercreative.com" }
const PLATFORM_NAMES: Record<string, string> = {
    framer: "Framer",
    wix: "Wix",
    shopify: "Shopify",
    squarespace: "Squarespace",
    wordpress: "WordPress",
}
function dateTimeFull(iso: string) {
    const d = new Date(iso)
    return `${d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} at ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`
}
function mailto(subject: string, body?: string, to = "hello@nordmeyercreative.com") {
    return `mailto:${to}?subject=${encodeURIComponent(subject)}${body ? `&body=${encodeURIComponent(body)}` : ""}`
}
function wrapText(text: string, indent = "", width = 80): string {
    const words = text.split(/\s+/).filter(Boolean)
    const lines: string[] = []
    let line = indent
    for (const w of words) {
        if (line.trim() && (line + " " + w).length > width) {
            lines.push(line)
            line = indent + w
        } else {
            line = line.trim() ? `${line} ${w}` : indent + w
        }
    }
    if (line.trim()) lines.push(line)
    return lines.join("\n")
}
const RULE = "=".repeat(72)
const monthShortYear = (k: string) => parseDay(k).toLocaleDateString("en-US", { month: "short", year: "numeric" })
const slugify = (t: string) =>
    t
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "") || "your-business"
function buildDataText(opts: { demo: boolean; businessName: string; domain: string; account: AccountState; data: SiteData; now: Date }): {
    name: string
    text: string
} {
    const { demo, businessName, domain, account, data, now } = opts
    const out: string[] = []
    const add = (t = "") => out.push(t)
    const para = (t: string, indent = "") => out.push(wrapText(t, indent))
    const section = (title: string) => {
        add()
        add(RULE)
        add(title)
        add(RULE)
    }
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`
    const todayFull = now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    if (demo) add("SAMPLE: invented data for a demo business")
    add("Your data from Nordmeyer Creative")
    add(`Business: ${businessName}`)
    add(`Generated: ${todayFull}`)
    add()
    para(
        "This file is a plain text copy of what your Nordmeyer Creative reports dashboard holds about your account and your website, as it stood on the date above.",
    )
    section("ACCOUNT")
    add(`Login email: ${account.email || "Not available"}`)
    add(`Last sign in: ${account.lastSignIn ? dateTimeFull(account.lastSignIn) : "Not available"}`)
    if (REPORT_EMAILS_LIVE && (account.reportEmails !== null || demo))
        add(`Report emails: ${(account.reportEmails ?? true) ? "On" : "Off"}`)
    const others = (account.logins || []).filter((l) => l.email && l.email !== account.email)
    add(`Other people with access: ${others.length ? others.map((l) => l.email).join(", ") : "None"}`)
    section("PLAN")
    if (!account.plans.length) add("No plan details yet.")
    account.plans.forEach((p, i) => {
        if (i) add()
        add(p.name)
        if (p.kind === "subscription") {
            const start = p.starts_on ? parseDay(p.starts_on) : null
            const end = p.ends_on ? parseDay(p.ends_on) : null
            const day = new Date(now.getFullYear(), now.getMonth(), now.getDate())
            const status = start && day < start ? `Starts ${dateFull(p.starts_on!)}` : end && day > end ? "Ended" : "Active"
            add(`  Status: ${status}`)
            if (p.starts_on && p.ends_on) add(`  Term: ${dateFull(p.starts_on)} to ${dateFull(p.ends_on)}`)
            else if (p.starts_on) add(`  Since: ${dateFull(p.starts_on)}`)
            if (billedOn(p)) add(`  ${billedOn(p)}`)
        } else {
            add(`  Status: ${p.complimentary ? "Complimentary" : "Completed project"}`)
        }
        const features = (p.features || []).filter((f) => f && !/^no\b/i.test(f.trim()))
        if (features.length) {
            add("  Included:")
            features.forEach((f) => para(`* ${f}`, "    "))
        }
    })
    section("WEBSITE")
    const sites = (account.siteMeta || []).filter((x) => x.domain)
    if (!sites.length) add(`Domain: ${domain || "Not available"}`)
    sites.forEach((x, i) => {
        if (i) add()
        add(`Domain: ${x.domain}`)
        if (x.platform) add(`Built on: ${PLATFORM_NAMES[x.platform.toLowerCase()] || x.platform}`)
        if (x.launched_on) add(`Live since: ${dateFull(x.launched_on)}`)
        if (x.domain_renews_on) add(`Domain renews: ${dateFull(x.domain_renews_on)}`)
        if (x.hosting_renews_on) add(`Hosting renews: ${dateFull(x.hosting_renews_on)}`)
    })
    section("SCORES")
    const scores = data.scores.filter((r) => num(r.overall) !== null).sort((a, b) => (a.month < b.month ? 1 : -1))
    if (!scores.length) add("No scores recorded yet.")
    else {
        const l = scores[0]
        add(`Latest month: ${monthLong(l.month)}`)
        add(`  Overall health: ${num(l.overall)} out of 100 (grade ${l.grade || "none"})`)
        const parts: [string, number | null][] = [
            ["Google Lighthouse SEO", num(l.seo)],
            ["Lighthouse Performance", num(l.performance)],
            ["Lighthouse Accessibility", num(l.accessibility)],
            ["Lighthouse Best Practices", num(l.best_practices)],
            ["On-page search checks", num(l.onpage)],
            ["Security", num(l.security)],
        ]
        parts.forEach(([k, v]) => add(`  ${k}: ${v === null ? "not measured" : v}`))
        if (scores.length > 1) {
            add()
            add("Earlier months:")
            scores.slice(1).forEach((r) => add(`  ${monthShortYear(r.month)}: ${num(r.overall)}${r.grade ? ` (${r.grade})` : ""}`))
        }
    }
    const snaps = data.snapshots.slice().sort((a, b) => (a.run_date < b.run_date ? 1 : -1))
    const planSnap = snaps.find((x) => data.recs.some((r) => r.snapshot_id === x.id))
    if (planSnap) {
        const items = data.recs.filter((r) => r.snapshot_id === planSnap.id).sort((a, b) => a.position - b.position)
        add()
        add(`Current plan, from the site check on ${dateFull(planSnap.run_date)}:`)
        items.forEach((r, i) => para(`${i + 1}. ${r.title}`, "  "))
    }
    section("SEARCH")
    const rankMonths = Array.from(new Set(data.ranks.map((r) => r.month))).sort()
    const lastRank = rankMonths[rankMonths.length - 1]
    if (!lastRank) add("No keywords tracked yet.")
    else {
        para(`Tracked keywords, ${monthLong(lastRank)} (Google position):`)
        data.ranks
            .filter((r) => r.month === lastRank)
            .sort((a, b) => a.keyword.localeCompare(b.keyword))
            .forEach((r) => para(`* ${r.keyword}: ${gpos(r) === null ? "not in Google’s top 50" : `position ${gpos(r)}`}`, "  "))
    }
    section("TRAFFIC")
    const traffic = data.traffic.slice().sort((a, b) => (a.month < b.month ? 1 : -1))
    if (!traffic.length) add("No traffic recorded yet.")
    else {
        add("Visits per month (totals only, never individual visitors):")
        traffic.forEach((t) => {
            const partial = t.days_reported < daysInMonth(t.month) ? ` (partial month, ${t.days_reported} days)` : ""
            add(`  ${monthShortYear(t.month)}: ${fmtInt(num(t.visits))} visits${partial}`)
        })
    }
    section("UPTIME")
    const uptime = data.uptime.slice().sort((a, b) => (a.month < b.month ? 1 : -1))
    if (!uptime.length) add("No uptime recorded yet.")
    else
        uptime.forEach((u) => {
            const pct = num(u.uptime_pct)
            const days = num(u.days_with_outage as any)
            const outage = days === null ? "" : `, ${days} ${days === 1 ? "day" : "days"} with an outage`
            add(`  ${monthShortYear(u.month)}: ${pct === null ? "no data" : `${pct}% uptime`}${outage}`)
        })
    section("WORK")
    const open = openItems(data.work)
    const doing = open.filter((w) => w.status === "in_progress")
    const next = open.filter((w) => w.status === "up_next")
    const done = data.work.filter(isDoneWork).sort((a, b) => (a.done_on < b.done_on ? 1 : -1))
    const shortDate = (d: string) => parseDay(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    add("In progress:")
    if (!doing.length) add("  Nothing right now.")
    doing.forEach((w) => para(`* ${w.title}${w.due_on ? ` (planned for ${shortDate(w.due_on)})` : ""}`, "  "))
    add()
    add("Up next:")
    if (!next.length) add("  Nothing right now.")
    next.forEach((w) => para(`* ${w.title}${w.due_on ? ` (planned for ${shortDate(w.due_on)})` : ""}`, "  "))
    add()
    add("Finished:")
    if (!done.length) add("  Nothing logged yet.")
    done.forEach((w) => para(`${shortDate(w.done_on)}: ${w.title}`, "  "))
    section("WHAT IS NOT IN THIS FILE")
    add(wrapText("* Your password: it is stored in a protected form that nobody, including us, can read."))
    add()
    add(
        wrapText(
            "* Contracts, proposals, signatures, invoices, payments and files you’ve shared with us: these are kept in our client portal, Suitenote. Ask us for a copy at hello@nordmeyercreative.com, or download them from the portal.",
        ),
    )
    add()
    add(
        wrapText(
            "* Your Google Analytics and Google Search Console data: those accounts belong to you, and you can export directly from Google.",
        ),
    )
    add()
    add(RULE)
    add("Questions or a deletion request: hello@nordmeyercreative.com")
    add()
    return { name: `nordmeyer-creative-data-${slugify(businessName)}-${today}.txt`, text: out.join("\n") }
}
function AccountSection({
    state,
    demo,
    portalUrl,
    url,
    apiKey,
    signInPath,
    onRetry,
    tourClass,
    clientId,
    businessName,
    buildFile,
    role = "owner",
    loginsAllowed,
    readOnly = false,
}: {
    state: AccountState | null
    demo: boolean
    portalUrl: string
    url: string
    apiKey: string
    signInPath: string
    onRetry: () => void
    tourClass: string
    clientId: string
    businessName: string
    buildFile: () => {
        name: string
        text: string
    }
    role?: string
    loginsAllowed?: number | null
    readOnly?: boolean
}) {
    if (!state || state.status === "loading") {
        return (
            <div className="ncr-loading" role="status">
                <span className="ncr-spinner" aria-hidden="true" />
                Loading your account…
            </div>
        )
    }
    if (state.status === "error") {
        return (
            <div className="ncr-card ncr-panel">
                <p className="ncr-h3">{state.error}</p>
                <p className="ncr-small">
                    Your details are safe; this page just couldn’t reach them. Try again, or email hello@nordmeyercreative.com.
                </p>
                <div className="ncr-problem-action">
                    <button type="button" className="ncr-btn" onClick={onRetry}>
                        Try again
                    </button>
                </div>
            </div>
        )
    }
    const now = new Date()
    const sites = (state.siteMeta || []).filter((x) => x.domain)
    const subject = businessName && businessName !== "our business" ? `Question from ${businessName}` : "Question from a client"
    return (
        <div className="ncr-acct">
            {readOnly ? <ReadOnlyNote /> : null}

            {role === "member" ? null : (
                <section className={`ncr-card ncr-panel${tourClass}`} data-tour="account" aria-labelledby="ncr-plan-h">
                    <h2 id="ncr-plan-h" className="ncr-h2">
                        Your plan
                    </h2>
                    {state.plans.length ? (
                        <ul className="ncr-plan-rows" role="list">
                            {state.plans.map((p) => {
                                const features = (p.features || []).filter((f) => f && !/^no\b/i.test(f.trim()))
                                return (
                                    <li key={p.id} className={`ncr-plan-row${features.length ? "" : " is-compact"}`}>
                                        <div className="ncr-plan-main">
                                            <h3 className="ncr-h3">{p.name}</h3>
                                            {p.kind === "subscription" ? (
                                                <PlanTimeline p={p} now={now} />
                                            ) : (
                                                <p className={`ncr-plan-status ${p.complimentary ? "is-soon" : "is-ended"}`}>
                                                    <Icon name={p.complimentary ? "ok" : "work"} size={16} />
                                                    <span>{p.complimentary ? "Complimentary" : "Completed project"}</span>
                                                </p>
                                            )}
                                        </div>
                                        {features.length ? (
                                            <div className="ncr-plan-incl">
                                                <h4 className="ncr-included-h">What’s included in your plan</h4>
                                                <ul className="ncr-included-list ncr-included-cols" role="list">
                                                    {features.map((f) => (
                                                        <li key={f}>
                                                            <Icon name="ok" size={16} />
                                                            <span>{f}</span>
                                                        </li>
                                                    ))}
                                                </ul>
                                            </div>
                                        ) : null}
                                    </li>
                                )
                            })}
                        </ul>
                    ) : (
                        <p className="ncr-body-text">
                            Your plan details will appear here soon. Questions? Reach us at{" "}
                            <a className="ncr-link ncr-link-inline" href="mailto:hello@nordmeyercreative.com">
                                hello@nordmeyercreative.com
                            </a>
                            .
                        </p>
                    )}
                    <div className="ncr-account-portal">
                        <a className="ncr-btn" href={portalUrl} target="_blank" rel="noopener noreferrer">
                            Open the client portal<span className="ncr-sr"> (opens in a new tab)</span>
                        </a>
                        <p className="ncr-small ncr-muted">Invoices, payments and messages live in the client portal.</p>
                    </div>
                </section>
            )}

            <div className="ncr-acct-row">
                <section className="ncr-card ncr-panel" aria-labelledby="ncr-site-h">
                    <h2 id="ncr-site-h" className="ncr-h2">
                        Your website
                    </h2>
                    {sites.length ? (
                        <ul className="ncr-site-list" role="list">
                            {sites.map((x) => (
                                <li key={x.id} className="ncr-site">
                                    <p className="ncr-h3 ncr-clamp-any">{x.domain}</p>
                                    <dl className="ncr-facts-dl">
                                        {x.platform ? (
                                            <div>
                                                <dt>Built on</dt>
                                                <dd>{PLATFORM_NAMES[x.platform.toLowerCase()] || x.platform}</dd>
                                            </div>
                                        ) : null}
                                        {x.launched_on ? (
                                            <div>
                                                <dt>Live since</dt>
                                                <dd>{dateFull(x.launched_on)}</dd>
                                            </div>
                                        ) : null}
                                        {state.nextReport ? (
                                            <div>
                                                <dt>Next report</dt>
                                                <dd>{dateFull(state.nextReport.starts_on)}</dd>
                                            </div>
                                        ) : null}
                                        {x.domain_renews_on ? (
                                            <div>
                                                <dt>Domain renews</dt>
                                                <dd>{dateFull(x.domain_renews_on)}</dd>
                                            </div>
                                        ) : null}
                                        {x.hosting_renews_on ? (
                                            <div>
                                                <dt>Hosting renews</dt>
                                                <dd>{dateFull(x.hosting_renews_on)}</dd>
                                            </div>
                                        ) : null}
                                    </dl>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        <p className="ncr-body-text">
                            Your website’s details, like when it went live and when the domain renews, will appear here.
                        </p>
                    )}
                </section>

                <section className="ncr-card ncr-panel" aria-labelledby="ncr-partner-h">
                    <h2 id="ncr-partner-h" className="ncr-h2">
                        Your partner at Nordmeyer Creative
                    </h2>
                    <div className="ncr-partner">
                        <p className="ncr-h3">{PARTNER.name}</p>
                        <p className="ncr-body-text">Ryan looks after your website and your reports. Write to him any time.</p>
                        <a className="ncr-link ncr-link-inline ncr-partner-email" href={`mailto:${PARTNER.email}`}>
                            {PARTNER.email}
                        </a>
                    </div>
                    <div className="ncr-card-foot">
                        <a className="ncr-btn ncr-btn-quiet" href={mailto(subject, undefined, PARTNER.email)}>
                            Email Ryan
                        </a>
                    </div>
                </section>
            </div>

            <div className="ncr-acct-row">
                <div className="ncr-card ncr-panel ncr-stack-card">
                    {state.reportEmails !== null || demo ? (
                        <ReportEmails
                            demo={demo}
                            readOnly={readOnly}
                            initial={state.reportEmails ?? true}
                            url={url}
                            apiKey={apiKey}
                            clientId={clientId}
                            className="ncr-subpanel"
                        />
                    ) : null}

                    {state.logins && role !== "member" ? (
                        <section className="ncr-subpanel" aria-labelledby="ncr-access-h">
                            <h2 id="ncr-access-h" className="ncr-h2">
                                Who has access
                            </h2>
                            {loginsAllowed !== undefined ? (
                                <p className="ncr-small ncr-muted">
                                    {loginsAllowed === null
                                        ? `${state.logins.length} ${state.logins.length === 1 ? "login" : "logins"}, no limit`
                                        : `${state.logins.length} of ${loginsAllowed} ${loginsAllowed === 1 ? "login" : "logins"}`}
                                </p>
                            ) : null}
                            {state.logins.length ? (
                                <ul className="ncr-access" role="list">
                                    {state.logins.map((l) => (
                                        <li key={l.email}>
                                            <span className="ncr-strong ncr-clamp-any">{l.email}</span>
                                            <span className="ncr-small ncr-muted">
                                                {l.last_sign_in_at
                                                    ? `Last signed in ${dateTimeFull(l.last_sign_in_at)}`
                                                    : "Hasn’t signed in yet"}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="ncr-body-text">Only you have access right now.</p>
                            )}
                            {readOnly ? null : (
                                <div className="ncr-account-portal">
                                    <a
                                        className="ncr-btn ncr-btn-quiet"
                                        href={mailto(
                                            "Dashboard access for a colleague",
                                            `Hi Ryan,\n\nPlease give a colleague access to the ${businessName} reports dashboard.\n\nTheir name:\nTheir email:\n\nThank you.`,
                                        )}
                                    >
                                        Give a colleague access
                                    </a>
                                </div>
                            )}
                        </section>
                    ) : null}

                    <section className="ncr-subpanel" aria-labelledby="ncr-data-h">
                        <h2 id="ncr-data-h" className="ncr-h2">
                            Your data
                        </h2>
                        <DownloadData demo={demo} buildFile={buildFile} />
                        <ul className="ncr-data-links" role="list">
                            <li>
                                <a className="ncr-link ncr-link-inline" href={mailto(`Delete my data: ${businessName}`)}>
                                    Ask us to delete your data
                                </a>
                            </li>
                        </ul>
                        <p className="ncr-small ncr-muted">
                            How we look after it is set out in our{" "}
                            <a className="ncr-link ncr-link-inline" href="/privacy">
                                privacy policy
                            </a>
                            .
                        </p>
                    </section>
                </div>

                <section className="ncr-card ncr-panel" aria-labelledby="ncr-signin-h">
                    <h2 id="ncr-signin-h" className="ncr-h2">
                        Account security
                    </h2>
                    {readOnly ? (
                        <p className="ncr-small ncr-muted" title={READ_ONLY_MSG}>
                            {READ_ONLY_MSG}: password and sign-out controls are switched off.
                        </p>
                    ) : (
                        <>
                            {state.email ? (
                                <p className="ncr-body-text">
                                    Signed in as <strong className="ncr-strong">{state.email}</strong>
                                </p>
                            ) : null}
                            {state.lastSignIn ? (
                                <p className="ncr-small ncr-muted">Last signed in {dateTimeFull(state.lastSignIn)}</p>
                            ) : null}
                            <PasswordForm demo={demo} url={url} apiKey={apiKey} signInPath={signInPath} />
                            <SignOutEverywhere demo={demo} url={url} apiKey={apiKey} signInPath={signInPath} />
                        </>
                    )}
                </section>
            </div>
        </div>
    )
}
function DownloadData({
    demo,
    buildFile,
    label = "Download my data",
    intro,
}: {
    demo: boolean
    buildFile: () => {
        name: string
        text: string
    }
    label?: string
    intro?: ReactNode
}) {
    const [msg, setMsg] = useState("")
    const [busy, setBusy] = useState(false)
    const msgId = `${useId()}-msg`
    const go = () => {
        if (busy) return
        setBusy(true)
        setMsg("")
        try {
            const { name, text } = buildFile()
            const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
            const href = URL.createObjectURL(blob)
            const a = document.createElement("a")
            a.href = href
            a.download = name
            a.rel = "noopener"
            document.body.appendChild(a)
            a.click()
            a.remove()
            window.setTimeout(() => URL.revokeObjectURL(href), 2000)
            setMsg("Your file is downloading.")
        } catch (e) {
            setMsg("We couldn’t put your file together. Please try again, or write to hello@nordmeyercreative.com for a copy.")
        } finally {
            setBusy(false)
        }
    }
    return (
        <div className="ncr-download">
            <p className="ncr-body-text">
                {intro ?? (
                    <>
                        One plain text file with what this dashboard holds about your account and your website
                        {demo ? ", made from the demo’s invented data" : ""}.
                    </>
                )}
            </p>
            <button type="button" className="ncr-btn" onClick={go} disabled={busy} aria-describedby={msgId}>
                {label}
            </button>
            <span id={msgId} className="ncr-small ncr-switch-msg" role="status" aria-live="polite">
                {msg}
            </span>
        </div>
    )
}
const REPORT_EMAILS_LIVE = false
function ReportEmails({
    demo,
    initial,
    url,
    apiKey,
    clientId,
    className = "ncr-card ncr-panel",
    readOnly = false,
}: {
    demo: boolean
    initial: boolean
    url: string
    apiKey: string
    clientId: string
    className?: string
    readOnly?: boolean
}) {
    const [on, setOn] = useState(initial)
    const [busy, setBusy] = useState(false)
    const [msg, setMsg] = useState("")
    const uid = useId()
    const flip = async () => {
        if (demo || busy || readOnly) return
        const next = !on
        setOn(next)
        setBusy(true)
        setMsg("")
        try {
            await authRpc(url, apiKey, "set_report_emails", { cid: clientId, on_off: next })
            setMsg(next ? "Saved. We’ll email you when each report is ready." : "Saved. We won’t email you about new reports.")
        } catch (e) {
            setOn(!next)
            setMsg("That didn’t save, so nothing changed. Please try again.")
        } finally {
            setBusy(false)
        }
    }
    if (!REPORT_EMAILS_LIVE) {
        return (
            <section className={className} aria-labelledby="ncr-emails-h">
                <h2 id="ncr-emails-h" className="ncr-h2">
                    Report emails
                </h2>
                <p className="ncr-small ncr-muted">
                    We don’t send report emails yet. Each new report appears here on your dashboard, and we’ll tell you before emails start.
                </p>
            </section>
        )
    }
    return (
        <section className={className} aria-labelledby="ncr-emails-h">
            <h2 id="ncr-emails-h" className="ncr-h2">
                Report emails
            </h2>
            <div className="ncr-switch-row">
                <span id={`${uid}-l`} className="ncr-switch-label">
                    Email me when a new report is ready
                </span>
                <button
                    type="button"
                    role="switch"
                    aria-checked={on}
                    aria-labelledby={`${uid}-l`}
                    aria-describedby={demo ? `${uid}-demo` : `${uid}-note`}
                    className={`ncr-switch${on ? " is-on" : ""}`}
                    disabled={demo || readOnly}
                    title={readOnly ? READ_ONLY_MSG : undefined}
                    onClick={flip}
                >
                    <span className="ncr-switch-knob" aria-hidden="true" />
                    <span className="ncr-switch-state" aria-hidden="true">
                        {on ? "On" : "Off"}
                    </span>
                </button>
            </div>
            <p id={`${uid}-note`} className="ncr-small ncr-muted">
                Emails come from Nordmeyer Creative.
            </p>
            {demo ? (
                <p id={`${uid}-demo`} className="ncr-small ncr-muted">
                    Not available in the demo.
                </p>
            ) : null}
            <span className="ncr-small ncr-switch-msg" role="status" aria-live="polite">
                {msg}
            </span>
        </section>
    )
}
function SignOutEverywhere({ demo, url, apiKey, signInPath }: { demo: boolean; url: string; apiKey: string; signInPath: string }) {
    const [asking, setAsking] = useState(false)
    const [busy, setBusy] = useState(false)
    const [err, setErr] = useState("")
    const confirmRef = useRef<HTMLParagraphElement>(null)
    const triggerRef = useRef<HTMLButtonElement>(null)
    const uid = useId()
    useEffect(() => {
        if (asking) confirmRef.current?.focus()
    }, [asking])
    const go = async () => {
        setBusy(true)
        setErr("")
        try {
            const s = await liveSession(url, apiKey)
            if (s) {
                const res = await fetch(`${url}/auth/v1/logout?scope=global`, {
                    method: "POST",
                    headers: { apikey: apiKey, Authorization: `Bearer ${s.access_token}` },
                })
                if (!res.ok && res.status !== 401) throw new Error(String(res.status))
            }
            writeSession(null)
            const sep = signInPath.includes("?") ? "&" : "?"
            window.location.replace(`${signInPath}${sep}signedout=everywhere`)
        } catch (e) {
            setBusy(false)
            setErr("We couldn’t sign you out everywhere just now. Please try again.")
        }
    }
    return (
        <div className="ncr-signout-all">
            <h3 className="ncr-h3">Sign out everywhere</h3>
            <p className="ncr-small ncr-muted">Ends your session on every phone and computer you’ve used, including this one.</p>
            {demo ? (
                <p id={`${uid}-demo`} className="ncr-small ncr-muted">
                    Not available in the demo.
                </p>
            ) : null}
            {!asking ? (
                <button
                    ref={triggerRef}
                    type="button"
                    className="ncr-btn ncr-btn-quiet"
                    disabled={demo}
                    aria-describedby={demo ? `${uid}-demo` : undefined}
                    onClick={() => setAsking(true)}
                >
                    Sign out everywhere
                </button>
            ) : (
                <div
                    className="ncr-confirm"
                    role="group"
                    aria-labelledby={`${uid}-q`}
                    onKeyDown={(e) => {
                        if (e.key === "Escape" && !busy) {
                            e.preventDefault()
                            setAsking(false)
                            requestAnimationFrame(() => triggerRef.current?.focus())
                        }
                    }}
                >
                    <p id={`${uid}-q`} ref={confirmRef} tabIndex={-1} className="ncr-body-text ncr-confirm-q">
                        Sign out on every device, including this one?
                    </p>
                    <div className="ncr-confirm-actions">
                        <button type="button" className="ncr-btn" onClick={go} disabled={busy}>
                            {busy ? <span className="ncr-spinner ncr-spinner-sm" aria-hidden="true" /> : null}
                            {busy ? "Signing out…" : "Yes, sign out everywhere"}
                        </button>
                        <button
                            type="button"
                            className="ncr-btn ncr-btn-quiet"
                            disabled={busy}
                            onClick={() => {
                                setAsking(false)
                                requestAnimationFrame(() => triggerRef.current?.focus())
                            }}
                        >
                            Cancel
                        </button>
                    </div>
                </div>
            )}
            {err ? (
                <p className="ncr-form-result is-bad" role="alert">
                    <Icon name="alert" size={18} />
                    <span>{err}</span>
                </p>
            ) : null}
        </div>
    )
}
function PlanTimeline({ p, now }: { p: PlanRow; now: Date }) {
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    const start = p.starts_on ? parseDay(p.starts_on) : null
    const end = p.ends_on ? parseDay(p.ends_on) : null
    const status: {
        tone: string
        icon: string
        text: string
    } =
        start && today < start
            ? { tone: "is-soon", icon: "uptime", text: `Starts ${dateFull(p.starts_on!)}` }
            : end && today > end
              ? { tone: "is-ended", icon: "flat", text: "Ended" }
              : { tone: "is-active", icon: "ok", text: "Active" }
    const m = status.tone === "is-active" ? planMonth(p, now) : null
    return (
        <>
            <p className={`ncr-plan-status ${status.tone}`}>
                <Icon name={status.icon} size={16} />
                <span>{status.text}</span>
            </p>
            {p.starts_on && p.ends_on ? (
                <p className="ncr-small">
                    <span className="ncr-muted">Term: </span>
                    {dateFull(p.starts_on)} to {dateFull(p.ends_on)}
                </p>
            ) : p.starts_on ? (
                <p className="ncr-small">
                    <span className="ncr-muted">Since </span>
                    {dateFull(p.starts_on)}
                </p>
            ) : null}
            {billedOn(p) ? <p className="ncr-small ncr-muted">{billedOn(p)}</p> : null}
            {m && m.of ? (
                <div className="ncr-plan-progress">
                    <p className="ncr-small ncr-strong">
                        Month {m.n} of {m.of}
                    </p>
                    <div
                        className="ncr-plan-bar"
                        role="progressbar"
                        aria-label="Plan progress"
                        aria-valuemin={1}
                        aria-valuemax={m.of}
                        aria-valuenow={m.n}
                        aria-valuetext={`Month ${m.n} of ${m.of}`}
                    >
                        <span style={{ width: `${Math.round((m.n / m.of) * 100)}%` }} />
                    </div>
                </div>
            ) : m ? (
                <p className="ncr-small ncr-strong">Month {m.n}</p>
            ) : null}
        </>
    )
}
function PasswordForm({ demo, url, apiKey, signInPath }: { demo: boolean; url: string; apiKey: string; signInPath: string }) {
    const [pw, setPw] = useState("")
    const [confirm, setConfirm] = useState("")
    const [errors, setErrors] = useState<{
        pw?: string
        confirm?: string
    }>({})
    const [busy, setBusy] = useState(false)
    const [result, setResult] = useState<{
        ok: boolean
        text: string
    } | null>(null)
    const [announce, setAnnounce] = useState("")
    const pwRef = useRef<HTMLInputElement>(null)
    const confirmRef = useRef<HTMLInputElement>(null)
    const uid = useId()
    const checkPw = (v: string) => (v.length < 8 ? "Use at least 8 characters." : "")
    const checkConfirm = (v: string, p: string) =>
        !v ? "Type the new password again to confirm it." : v !== p ? "The two passwords don’t match. Type the same password in both." : ""
    const submit = async (e: FormEvent) => {
        e.preventDefault()
        if (demo || busy) return
        setResult(null)
        const next = { pw: checkPw(pw) || undefined, confirm: checkConfirm(confirm, pw) || undefined }
        setErrors(next)
        if (next.pw || next.confirm) {
            setAnnounce(next.pw || next.confirm || "")
            ;(next.pw ? pwRef : confirmRef).current?.focus()
            return
        }
        setBusy(true)
        try {
            const s = await liveSession(url, apiKey)
            if (!s) {
                window.location.replace(signInPath)
                return
            }
            const res = await fetch(`${url}/auth/v1/user`, {
                method: "PUT",
                headers: { apikey: apiKey, Authorization: `Bearer ${s.access_token}`, "Content-Type": "application/json" },
                body: JSON.stringify({ password: pw }),
            })
            if (!res.ok) {
                const body = await res.json().catch(() => null)
                const weak = res.status === 422 && /password/i.test(body?.msg || body?.message || "")
                const same = /different from the old/i.test(body?.msg || body?.message || "")
                const text = same
                    ? "That’s your current password. Choose a new one."
                    : weak
                      ? "That password is too easy to guess. Try a longer one, for example three or four unrelated words."
                      : res.status === 401
                        ? "Your session has ended. Sign in again, then change your password."
                        : "Your new password couldn’t be saved. Please try again in a moment."
                if (weak || same) {
                    setErrors({ pw: text })
                    pwRef.current?.focus()
                } else setResult({ ok: false, text })
                setAnnounce(text)
                return
            }
            setPw("")
            setConfirm("")
            setErrors({})
            const text = "Your password has been changed. Use the new one next time you sign in."
            setResult({ ok: true, text })
            setAnnounce(text)
        } catch (err) {
            const text = "We couldn’t reach the server. Check your connection and try again."
            setResult({ ok: false, text })
            setAnnounce(text)
        } finally {
            setBusy(false)
        }
    }
    const field = (
        id: "pw" | "confirm",
        label: string,
        value: string,
        set: (v: string) => void,
        ref: RefObject<HTMLInputElement>,
        onBlur: () => void,
    ) => {
        const err = errors[id]
        const inputId = `${uid}-${id}`
        const errId = `${uid}-${id}-err`
        return (
            <div className="ncr-form-field">
                <label htmlFor={inputId} className="ncr-form-label">
                    {label}
                </label>
                <input
                    ref={ref}
                    id={inputId}
                    className="ncr-input"
                    type="password"
                    name={id === "pw" ? "new-password" : "confirm-password"}
                    autoComplete="new-password"
                    minLength={8}
                    value={value}
                    disabled={demo}
                    aria-invalid={err ? true : undefined}
                    aria-describedby={err ? errId : id === "pw" ? `${uid}-hint` : undefined}
                    onChange={(e) => {
                        set(e.target.value)
                        if (result) setResult(null)
                    }}
                    onBlur={onBlur}
                />
                {id === "pw" && !err ? (
                    <p id={`${uid}-hint`} className="ncr-small ncr-muted">
                        At least 8 characters.
                    </p>
                ) : null}
                {err ? (
                    <p id={errId} className="ncr-field-error">
                        <Icon name="alert" size={16} />
                        <span>{err}</span>
                    </p>
                ) : null}
            </div>
        )
    }
    return (
        <form className="ncr-pw-form" onSubmit={submit} noValidate aria-describedby={demo ? `${uid}-demo` : undefined}>
            <h3 className="ncr-h3">Change password</h3>
            {demo ? (
                <p id={`${uid}-demo`} className="ncr-small ncr-muted">
                    Not available in the demo.
                </p>
            ) : null}
            {field("pw", "New password", pw, setPw, pwRef, () => {
                if (pw) setErrors((x) => ({ ...x, pw: checkPw(pw) || undefined }))
            })}
            {field("confirm", "Confirm new password", confirm, setConfirm, confirmRef, () => {
                if (confirm) setErrors((x) => ({ ...x, confirm: checkConfirm(confirm, pw) || undefined }))
            })}
            <div className="ncr-pw-actions">
                <button type="submit" className="ncr-btn" disabled={demo || busy} onMouseDown={(e) => e.preventDefault()}>
                    {busy ? <span className="ncr-spinner ncr-spinner-sm" aria-hidden="true" /> : null}
                    {busy ? "Saving…" : demo ? "Not available in the demo" : "Change password"}
                </button>
            </div>
            {result ? (
                <p className={`ncr-form-result ${result.ok ? "is-ok" : "is-bad"}`}>
                    <Icon name={result.ok ? "ok" : "alert"} size={18} />
                    <span>{result.text}</span>
                </p>
            ) : null}
            <span className="ncr-sr" aria-live="polite">
                {announce}
            </span>
        </form>
    )
}
const PILLARS: Record<string, string> = {
    found: "Get found on Google",
    speed: "Speed & experience",
    trust: "Security & trust",
}
const CATEGORY: Record<string, string> = {
    seo: "Search",
    design: "Design",
    security: "Security",
    content: "Content",
    maintenance: "Care",
}
const METRICS: {
    key: string
    label: string
    help: string
}[] = [
    {
        key: "seo",
        label: "Search basics",
        help: "Google Lighthouse’s technical checks: whether search engines can read and index the pages. It does not measure rankings, traffic or how often people search for you; see the Search section for that.",
    },
    { key: "performance", label: "Performance", help: "How quickly pages load and respond, measured on a phone." },
    { key: "accessibility", label: "Accessibility", help: "How usable the site is for people with disabilities." },
    { key: "best_practices", label: "Best practices", help: "Modern, safe technical setup across the site." },
    { key: "onpage", label: "On-page", help: "Titles, descriptions, headings and image text on each page." },
    { key: "security", label: "Security", help: "Protective settings that keep visitors and the site safe." },
]
function Severity({ sev }: { sev: string | null }) {
    const s = (sev || "").toLowerCase()
    const label =
        s === "high" || s === "critical"
            ? "High priority"
            : s === "medium"
              ? "Medium priority"
              : s === "low"
                ? "Low priority"
                : "Priority not set"
    const tone = s === "high" || s === "critical" ? "is-high" : s === "medium" ? "is-medium" : "is-low"
    return (
        <span className={`ncr-sev ${tone}`}>
            <span className="ncr-sev-bars" aria-hidden="true">
                <i />
                <i />
                <i />
            </span>
            {label}
        </span>
    )
}
function Problem({ title, text, action }: { title: string; text: string; action?: ReactNode }) {
    return (
        <div className="ncr-card ncr-problem" role="alert">
            <Icon name="alert" size={22} />
            <div>
                <p className="ncr-h2">{title}</p>
                <p className="ncr-body-text">{text}</p>
                {action ? <div className="ncr-problem-action">{action}</div> : null}
            </div>
        </div>
    )
}
const APP_CSS = `
@property --ncr-angle{syntax:"<angle>";initial-value:0deg;inherits:false}
.ncr-app{min-height:100dvh;background:var(--ncr-bg);color:var(--ncr-body);font-family:${F_BODY};font-size:15px;line-height:1.55;
  display:flex;align-items:stretch;-webkit-font-smoothing:antialiased;
  transition:background-color 240ms ease,color 240ms ease}
.ncr-app *,.ncr-app *::before,.ncr-app *::after{box-sizing:border-box}
.ncr-app :where(a,button,select,summary){touch-action:manipulation;-webkit-tap-highlight-color:transparent}
.ncr-app :where(h1,h2,h3,h4){text-wrap:balance}
.ncr-app :is(a,button,select,summary,[tabindex]:not([tabindex="-1"])):focus-visible{outline:2px solid var(--ncr-accent);outline-offset:2px}
:where(.ncr-app) :where(p,h1,h2,h3,h4,ul,ol,dl,dd){margin:0;padding:0}
:where(.ncr-app) :where(ul,ol){list-style:none}
:where(.ncr-app) a{color:inherit}
.ncr-sr{position:absolute!important;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}

.ncr-h1{font-family:${F_HEAD};font-weight:600;font-size:32px;line-height:1.12;letter-spacing:-0.022em;color:var(--ncr-ink);outline:none}
.ncr-h2{font-family:${F_HEAD};font-weight:600;font-size:18px;line-height:1.3;letter-spacing:-0.01em;color:var(--ncr-ink)}
.ncr-h3{font-family:${F_BODY};font-weight:600;font-size:15px;line-height:1.35;letter-spacing:-0.003em;color:var(--ncr-ink)}
.ncr-body-text{font-size:15px;line-height:1.6;color:var(--ncr-body);max-width:68ch}
.ncr-small{font-size:13px;line-height:1.5;letter-spacing:0.004em;color:var(--ncr-body)}
.ncr-muted{color:var(--ncr-muted)}
.ncr-strong{font-weight:600;color:var(--ncr-ink)}
.ncr-strong-muted{font-weight:600;color:var(--ncr-body)}
.ncr-figure-xl{font-family:${F_HEAD};font-weight:600;font-size:44px;line-height:1;letter-spacing:-0.035em;color:var(--ncr-ink)}
.ncr-figure-lg{font-family:${F_HEAD};font-weight:600;font-size:44px;line-height:1.05;letter-spacing:-0.03em;color:var(--ncr-ink)}
.ncr-figure{font-family:${F_HEAD};font-weight:600;font-size:28px;line-height:1.1;letter-spacing:-0.02em;color:var(--ncr-ink)}
.ncr-figure-sm{font-family:${F_HEAD};font-weight:600;font-size:22px;line-height:1.1;letter-spacing:-0.015em;color:var(--ncr-ink)}
.ncr-kpi-label{font-size:13px;line-height:1.4;font-weight:500;color:var(--ncr-muted);letter-spacing:0.004em}
.ncr-axis{font-family:${F_BODY};font-size:11px;fill:var(--ncr-muted);font-variant-numeric:tabular-nums}
.ncr-link{color:var(--ncr-accent-text);font-weight:500;font-size:14px;text-decoration:underline;text-decoration-color:transparent;text-underline-offset:3px;transition:text-decoration-color 180ms ease}
.ncr-link:hover{text-decoration-color:currentColor}

.ncr-sidebar{position:sticky;top:0;height:100dvh;flex:none;width:76px;z-index:6}
.ncr-sidebar::after{content:"";position:absolute;top:0;bottom:0;right:0;width:1px;background:var(--ncr-hair);pointer-events:none;z-index:2;opacity:0;transition:opacity 120ms ease-out}
.ncr-app[data-rail="1"] .ncr-sidebar::after{opacity:1;transition-delay:180ms}
.ncr-sidebar-panel{position:absolute;top:0;left:0;bottom:0;width:260px;overflow:hidden;
  clip-path:inset(0 -60px 0 0);transition:clip-path 220ms cubic-bezier(.2,.8,.2,1);
  background:var(--ncr-chrome-heavy);backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);
  box-shadow:inset -1px 0 0 var(--ncr-hair)}
.ncr-app[data-rail="1"] .ncr-sidebar-panel{clip-path:inset(0 184px 0 0)}
.ncr-app[data-rail="0"] .ncr-sidebar-panel{box-shadow:inset -1px 0 0 var(--ncr-hair),16px 0 40px rgba(0,0,0,0.14)}
.ncr-sidebar .ncr-fade{transition:opacity 160ms ease-out,visibility 0s linear 0s}
.ncr-app[data-rail="1"] .ncr-sidebar .ncr-fade{opacity:0;visibility:hidden;transition:opacity 120ms ease-out,visibility 0s linear 120ms}
.ncr-sidebar .ncr-nav-text,.ncr-sidebar .ncr-side-btn span,.ncr-sidebar .ncr-side-label,.ncr-sidebar .ncr-legal a,.ncr-sidebar .ncr-back span,.ncr-sidebar .ncr-powered{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ncr-switch-slot{min-height:var(--ncr-switch-h,auto)}
.ncr-sidebar .ncr-nav-link{position:relative;background:transparent!important;box-shadow:none!important}
.ncr-sidebar .ncr-nav-link::before{content:"";position:absolute;top:0;bottom:0;left:0;width:100%;border-radius:10px;z-index:-1;transition:width 220ms cubic-bezier(.2,.8,.2,1),background-color 180ms ease}
.ncr-sidebar .ncr-nav-link>*{position:relative}
.ncr-sidebar .ncr-nav-link:hover::before{background:var(--ncr-accent-wash)}
.ncr-sidebar .ncr-nav-link.is-current::before{background:var(--ncr-surface);box-shadow:inset 0 0 0 1px var(--ncr-border)}
.ncr-app[data-rail="1"] .ncr-sidebar .ncr-nav-link::before{width:46px}
.ncr-sidebar .ncr-nav-list li{isolation:isolate}
.ncr-logo-box{position:relative;display:block;width:84px;height:32px}
.ncr-logo-box .ncr-logo{width:84px;height:32px}
.ncr-logo-box .ncr-logo-mark{width:21px}
.ncr-lockup{display:flex;align-items:center;gap:12px;flex-wrap:nowrap}
.ncr-sidebar .ncr-brand{padding-left:12px;padding-right:4px}
.ncr-lockup-rule{width:1px;height:24px;background:var(--ncr-border);flex:none}
.ncr-pill-wrap{display:inline-flex;flex:none}
.ncr-pill-logo{display:inline-flex;flex:none}
.ncr-pill-img{display:block;width:auto;height:24px}
.ncr-pill-dark{display:none}

html[data-nc-theme="dark"] .ncr-pill-light{display:none}
html[data-nc-theme="dark"] .ncr-pill-dark{display:block}
.ncr-logo-lock{width:84px;height:32px}
.ncr-logo-box .ncr-logo{position:absolute;left:0;top:0;transition:opacity 180ms ease-out}
.ncr-logo-box .ncr-logo-mark{opacity:0}
.ncr-app[data-rail="1"] .ncr-logo-box .ncr-logo-full{opacity:0}
.ncr-app[data-rail="1"] .ncr-logo-box .ncr-logo-mark{opacity:1}
@media (prefers-reduced-motion: reduce){
  .ncr-sidebar-panel,.ncr-sidebar .ncr-fade,.ncr-logo-box .ncr-logo,.ncr-sidebar .ncr-nav-link::before,.ncr-sidebar::after{transition:none!important}
}
.ncr-sidebar-inner{width:260px;height:100%;display:flex;flex-direction:column;padding:20px 14px 18px;overflow-y:auto;overflow-x:hidden;scrollbar-width:thin}
.ncr-brand{display:flex;align-items:center;gap:10px;padding:2px 8px 14px;min-height:44px}
.ncr-side-label{font:500 11px/1.2 ${F_MONO};letter-spacing:0.1em;text-transform:uppercase;color:var(--ncr-muted);padding:0 13px 12px}
.ncr-brand-link{display:inline-flex;border-radius:8px;padding:4px;margin:-4px}
.ncr-logo{display:block;width:128px;height:38px;background-color:var(--ncr-ink);
  -webkit-mask:url("${NC_LOGO}") left center/contain no-repeat;mask:url("${NC_LOGO}") left center/contain no-repeat}
.ncr-logo-mark{width:25px;height:38px;-webkit-mask-size:auto 100%;mask-size:auto 100%}
.ncr-nav-list{display:flex;flex-direction:column;gap:2px}
.ncr-nav-link{display:flex;align-items:center;gap:12px;height:44px;padding:0 13px;border-radius:10px;text-decoration:none;
  color:var(--ncr-body);font-weight:500;font-size:14.5px;letter-spacing:0;cursor:pointer;white-space:nowrap;
  transition:background-color 180ms ease,color 180ms ease,transform 100ms ease-out}
.ncr-nav-link:hover{background:var(--ncr-accent-wash);color:var(--ncr-ink)}
.ncr-nav-link:active{transform:scale(0.97)}
.ncr-nav-link.is-current{background:var(--ncr-surface);color:var(--ncr-ink);box-shadow:inset 0 0 0 1px var(--ncr-border)}
.ncr-nav-link.is-current svg{color:var(--ncr-accent)}
.ncr-side-foot{margin-top:auto;display:flex;flex-direction:column;gap:14px;padding-top:18px}
.ncr-switchers{display:flex;flex-direction:column;gap:10px}
.ncr-field-label{display:flex;flex-direction:column;gap:5px;font-size:12.5px;font-weight:500;color:var(--ncr-muted)}
.ncr-select{appearance:none;-webkit-appearance:none;width:100%;min-height:40px;padding:8px 34px 8px 12px;border-radius:10px;
  border:1px solid var(--ncr-field);background:var(--ncr-surface) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23888' stroke-width='2.4' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E") no-repeat right 12px center;
  color:var(--ncr-ink);font:500 14px/1.3 ${F_BODY};cursor:pointer;transition:border-color 180ms ease}
.ncr-select:hover{border-color:var(--ncr-ink)}
.ncr-side-actions{display:flex;flex-direction:column;gap:2px}
.ncr-side-btn{display:flex;align-items:center;gap:12px;height:44px;padding:0 13px;border:0;border-radius:10px;background:transparent;
  color:var(--ncr-body);font:500 14px/1 ${F_BODY};cursor:pointer;text-align:left;white-space:nowrap;
  transition:background-color 180ms ease,color 180ms ease,transform 100ms ease-out}
.ncr-side-btn:hover{background:var(--ncr-accent-wash);color:var(--ncr-ink)}
.ncr-side-btn:active{transform:scale(0.97)}
.ncr-legal{display:flex;flex-wrap:wrap;gap:4px 14px;padding:0 13px}
.ncr-legal a,.ncr-back{font-size:13px;color:var(--ncr-muted);text-decoration:underline;text-decoration-color:transparent;text-underline-offset:3px;transition:color 180ms ease,text-decoration-color 180ms ease}
.ncr-legal a:hover,.ncr-back:hover{color:var(--ncr-ink);text-decoration-color:currentColor}
.ncr-back{display:inline-flex;align-items:center;gap:6px;padding:0 13px;align-self:flex-start}
.ncr-powered{font-family:${F_MONO};font-size:10px;letter-spacing:0.05em;text-transform:uppercase;color:var(--ncr-muted);padding:0 13px;white-space:nowrap}

.ncr-mainwrap{flex:1;min-width:0;display:flex;flex-direction:column;--ncr-inset:50px;--ncr-gutter:max(var(--ncr-inset),calc((100% - 1440px) / 2))}
.ncr-topbar{display:none}
.ncr-context{position:sticky;top:0;z-index:2;display:flex;align-items:center;justify-content:space-between;gap:16px 24px;flex-wrap:wrap;
  padding:16px var(--ncr-gutter);background:var(--ncr-chrome);backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%)}
.ncr-context::after{content:"";position:absolute;left:0;right:0;top:100%;height:14px;pointer-events:none;
  background:linear-gradient(to bottom,var(--ncr-chrome),transparent)}
.ncr-client{font-family:${F_HEAD};font-weight:600;font-size:16px;line-height:1.3;letter-spacing:-0.01em;color:var(--ncr-ink);display:flex;align-items:center;gap:10px;min-width:0}
.ncr-client-name{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ncr-context-who{min-width:0;flex:1 1 auto}
.ncr-context-cta{display:flex;align-items:center;gap:14px}
.ncr-cta-note{font-size:13px;color:var(--ncr-body);white-space:nowrap}
.ncr-drawer-cta{display:flex;flex-direction:column;align-items:flex-start;gap:10px;margin:18px 13px 0;padding-top:16px;box-shadow:inset 0 1px 0 var(--ncr-hair)}
@media (max-width: 1279.98px){.ncr-cta-note{position:absolute!important;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}}
@media (min-width: 1024px) and (max-width: 1279.98px){.ncr-context .ncr-month-label{position:absolute!important;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}}
@media (min-width: 1024px){.ncr-context .ncr-domain{white-space:nowrap}}
@media (min-width: 1024px){
  .ncr-context{flex-wrap:nowrap;min-height:68px;padding-top:12px;padding-bottom:12px}
  .ncr-context-when{flex-wrap:nowrap;flex:none}
}
.ncr-domain{font-size:13.5px;color:var(--ncr-body);overflow-wrap:anywhere}
@media (max-width: 1023.98px){.ncr-what{display:none}}
.ncr-domain a{text-decoration:underline;text-underline-offset:3px;text-decoration-color:var(--ncr-border)}
.ncr-domain a:hover{text-decoration-color:currentColor}
.ncr-context-when{display:flex;align-items:center;gap:16px;flex-wrap:wrap}
.ncr-month{display:flex;align-items:center;gap:10px}
.ncr-month-label{font-size:13px;font-weight:500;color:var(--ncr-body)}
.ncr-month .ncr-select{width:auto;min-width:176px}
.ncr-checked{font-size:13px;color:var(--ncr-body)}
.ncr-sample{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;font:500 11px/1 ${F_MONO};letter-spacing:0.08em;text-transform:uppercase;
  color:var(--ncr-accent-text);background:var(--ncr-accent-wash);box-shadow:inset 0 0 0 1px var(--ncr-accent)}
.ncr-content{padding:28px var(--ncr-inset) 48px;max-width:calc(1440px + 2 * var(--ncr-inset));width:100%;margin:0 auto;position:relative}
.ncr-loader{position:absolute;inset:0;min-height:max(320px,calc((100dvh - var(--ncr-loader-top)) / 2 + 136px));z-index:6;background:color-mix(in srgb,var(--ncr-bg) 78%,transparent);opacity:0;visibility:hidden;pointer-events:none;
  transition:opacity 180ms ease,visibility 0s linear 180ms}
.ncr-loader.is-on{opacity:1;visibility:visible;pointer-events:auto;transition:opacity 180ms ease,visibility 0s}
.ncr-sidebar-inner,.ncr-context>*,.ncr-topbar>*,.ncr-strip{transition:opacity 180ms ease}
.ncr-app.is-locked .ncr-sidebar-inner,.ncr-app.is-locked .ncr-context>*,.ncr-app.is-locked .ncr-topbar>*,.ncr-app.is-locked .ncr-strip{opacity:0.45}
.ncr-app.is-locked .ncr-sidebar,.ncr-app.is-locked .ncr-mainwrap{cursor:progress}
.ncr-mainwrap{--ncr-loader-top:68px}
@media (max-width: 1023.98px), (hover: none) and (pointer: coarse){.ncr-mainwrap{--ncr-loader-top:calc(60px + env(safe-area-inset-top))}}
.ncr-loader-inner{position:sticky;top:calc(var(--ncr-loader-top) + (100dvh - var(--ncr-loader-top)) / 2 - 40px);height:80px;display:flex;justify-content:center}
.ncr-loader-ring{position:relative;width:80px;height:80px}
.ncr-loader-ring svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
.ncr-loader-track{fill:none;stroke:var(--ncr-hair);stroke-width:3}
.ncr-loader-arc{fill:none;stroke:var(--ncr-accent);stroke-width:3;stroke-linecap:round;stroke-dasharray:58 175;transform-origin:40px 40px;animation:ncr-spin 900ms linear infinite}
.ncr-loader-mark{position:absolute;left:50%;top:50%;width:29px;height:44px;transform:translate(-50%,-50%);background-color:var(--ncr-ink);
  -webkit-mask:url("${NC_LOGO}") left center/auto 100% no-repeat;mask:url("${NC_LOGO}") left center/auto 100% no-repeat}
@keyframes ncr-spin{to{transform:rotate(360deg)}}
.ncr-figure-xl,.ncr-figure-lg,.ncr-figure,.ncr-figure-sm{font-variant-numeric:tabular-nums}
.ncr-count{position:relative;display:inline-block}
.ncr-count-final{opacity:0}
.ncr-count-live{position:absolute;left:0;top:0;white-space:nowrap}
.ncr-ring-center .ncr-count-live{left:50%;transform:translateX(-50%)}
.ncr-intro .ncr-draw{stroke-dasharray:1;stroke-dashoffset:1;animation:ncr-draw ${CHART_MS}ms cubic-bezier(.22,.61,.36,1) ${CHART_DELAY_MS}ms both;animation-play-state:paused}
.ncr-intro .ncr-draw-late{animation-delay:calc(${CHART_DELAY_MS}ms + 200ms)}
.ncr-intro .ncr-grow{transform-box:fill-box;transform-origin:50% 100%;animation:ncr-grow 700ms cubic-bezier(.22,.61,.36,1) both;animation-delay:calc(${CHART_DELAY_MS}ms + var(--i,0) * ${BAR_STAGGER_MS}ms);animation-play-state:paused}
.ncr-intro .ncr-dot{animation:ncr-fade 260ms ease-out ${CHART_DELAY_MS + CHART_MS - 150}ms both;animation-play-state:paused}
.ncr-intro.is-play .ncr-draw,.ncr-intro.is-play .ncr-grow,.ncr-intro.is-play .ncr-dot{animation-play-state:running}
@keyframes ncr-draw{from{stroke-dashoffset:1}to{stroke-dashoffset:0}}
@keyframes ncr-grow{from{transform:scaleY(0)}to{transform:scaleY(1)}}
@keyframes ncr-fade{from{opacity:0}to{opacity:1}}
@keyframes ncr-pulse{from{opacity:1}to{opacity:0.45}}
@media (prefers-reduced-motion: reduce){
  .ncr-loader,.ncr-loader.is-on{transition:none}
  .ncr-loader-arc{animation:ncr-pulse 1.6s ease-in-out infinite alternate;stroke-dasharray:none}
  .ncr-intro .ncr-draw,.ncr-intro .ncr-grow,.ncr-intro .ncr-dot{animation:none;stroke-dasharray:none;stroke-dashoffset:0;transform:none;opacity:1}
}
.ncr-content .ncr-h1{margin-bottom:24px}
.ncr-section{display:flex;flex-direction:column;gap:20px}
.ncr-mobile-switch{display:none}

.ncr-card{background:var(--ncr-surface);border:1px solid var(--ncr-border);border-radius:14px;box-shadow:var(--ncr-shadow);transition:background-color 240ms ease,border-color 240ms ease}
.ncr-panel{padding:24px;display:flex;flex-direction:column;gap:16px;border-radius:18px}
.ncr-panel-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap}
.ncr-kpi{padding:20px;display:flex;flex-direction:column;gap:8px;min-width:0}
.ncr-kpi-row{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:16px}
.ncr-kpi-row-3{grid-template-columns:repeat(3,minmax(0,1fr))}
.ncr-kpi-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px}
.ncr-overview-top{display:grid;grid-template-columns:minmax(0,1.45fr) minmax(0,1fr);gap:16px}
.ncr-kpi-wide{justify-content:flex-start}
.ncr-spark-block{margin-top:auto;display:flex;flex-direction:column;gap:4px;padding-top:8px}
.ncr-pill{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:600;color:var(--ncr-ink);background:var(--ncr-surface-2)}
.ncr-chip{display:inline-flex;align-items:center;height:24px;padding:0 10px;border-radius:999px;font-size:12px;font-weight:500;color:var(--ncr-body);box-shadow:inset 0 0 0 1px var(--ncr-border);white-space:nowrap}
.ncr-clamp{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}

.ncr-ring-frame{position:relative;border-radius:19px;padding:1.5px;
  background:conic-gradient(from var(--ncr-angle),#b98cff,#d04c9a,#8b3dff,#b98cff);
  animation:ncr-spin 9s linear infinite}
.ncr-ring-frame>.ncr-card{border:0;height:100%;border-radius:17.5px}
@keyframes ncr-spin{to{--ncr-angle:360deg}}
@media (prefers-reduced-motion: reduce){.ncr-ring-frame{animation:none}}
.ncr-health{padding:24px;display:flex;flex-direction:column;gap:18px}
.ncr-health-body{display:flex;align-items:center;gap:28px;flex-wrap:wrap}
.ncr-ring{position:relative;width:132px;height:132px;flex:none}
.ncr-ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px}
.ncr-health-copy{display:flex;flex-direction:column;gap:10px;flex:1;min-width:180px}
.ncr-grade{font-family:${F_HEAD};font-size:18px;letter-spacing:-0.01em;color:var(--ncr-ink)}
.ncr-grade strong{font-weight:600}

.ncr-delta{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:600;line-height:1.3;font-variant-numeric:tabular-nums}
.ncr-delta-good{color:var(--ncr-good)}
.ncr-delta-bad{color:var(--ncr-bad)}
.ncr-delta-flat,.ncr-delta-none{color:var(--ncr-muted);font-weight:500}
.ncr-bad-text{color:var(--ncr-bad);display:inline-flex;align-items:center;gap:5px;font-weight:600}

.ncr-score-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.ncr-score{padding:20px;display:flex;flex-direction:column;gap:10px}
.ncr-score-head{display:flex;align-items:center;justify-content:space-between;gap:8px}
.ncr-score-body{display:flex;align-items:flex-end;justify-content:space-between;gap:12px}

.ncr-first{padding:18px 20px;border-radius:14px;background:var(--ncr-surface-2);display:flex;flex-direction:column;gap:6px}

.ncr-chart{position:relative;width:100%;border-radius:10px;outline-offset:4px}
.ncr-tip{position:absolute;top:6px;transform:translateX(-50%);pointer-events:none;min-width:150px;padding:10px 12px;border-radius:10px;
  background:var(--ncr-surface);box-shadow:0 0 0 1px var(--ncr-border),0 8px 24px rgba(0,0,0,0.14);font-size:13px;line-height:1.4;color:var(--ncr-body)}
.ncr-tip-month{font-weight:600;color:var(--ncr-ink);margin-bottom:4px}
.ncr-tip-row{display:flex;align-items:center;gap:8px}
.ncr-tip-row strong{color:var(--ncr-ink);font-weight:600;font-variant-numeric:tabular-nums}
.ncr-key{width:12px;height:2px;border-radius:2px;flex:none}
.ncr-legend{display:flex;flex-wrap:wrap;gap:6px 18px;font-size:13px;color:var(--ncr-body)}
.ncr-legend li{display:inline-flex;align-items:center;gap:8px}
.ncr-swatch{width:12px;height:12px;border-radius:3px;flex:none}
.ncr-swatch-line{height:2px;border-radius:2px}
.ncr-swatch-hatch{background:repeating-linear-gradient(45deg,var(--ncr-accent) 0 2px,var(--ncr-accent-wash) 2px 4.5px)}
.ncr-spark{display:block;flex:none}

.ncr-table-wrap{overflow-x:auto;border-radius:10px;-webkit-overflow-scrolling:touch}
.ncr-table{width:100%;border-collapse:collapse;font-size:14px;line-height:1.4;font-variant-numeric:tabular-nums}
.ncr-table th,.ncr-table td{padding:10px 12px;text-align:left;white-space:nowrap;vertical-align:middle}
.ncr-table thead th{font-size:12.5px;font-weight:500;color:var(--ncr-muted);box-shadow:inset 0 -1px 0 var(--ncr-border)}
.ncr-table tbody th{font-weight:500;color:var(--ncr-ink)}
.ncr-table tbody td{color:var(--ncr-body)}
.ncr-table tbody tr+tr th,.ncr-table tbody tr+tr td{box-shadow:inset 0 1px 0 var(--ncr-hair)}
.ncr-table tr.is-selected th,.ncr-table tr.is-selected td{background:var(--ncr-accent-wash)}
.ncr-details summary{cursor:pointer;font-size:14px;font-weight:500;color:var(--ncr-accent-text);padding:4px 0;width:max-content;max-width:100%;border-radius:6px}
.ncr-details[open] summary{margin-bottom:10px}
.ncr-status{display:inline-flex;align-items:center;gap:6px;font-weight:600}
.ncr-status.is-up{color:var(--ncr-good)}
.ncr-status.is-down{color:var(--ncr-bad)}

.ncr-search-cards{display:none}
.ncr-search-card{padding:16px 0;display:flex;flex-direction:column;gap:10px}
.ncr-search-card+.ncr-search-card{box-shadow:inset 0 1px 0 var(--ncr-hair)}
.ncr-search-main{display:flex;align-items:center;gap:12px;flex-wrap:wrap}
.ncr-engines{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 16px;font-size:13px}
.ncr-engines dt{color:var(--ncr-muted)}
.ncr-engines dd{color:var(--ncr-ink);font-weight:500}

.ncr-top-plan{display:flex;flex-direction:column}
.ncr-top-plan li{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"meta sev" "title sev";gap:2px 16px;padding:14px 0;align-items:center}
.ncr-top-plan li+li{box-shadow:inset 0 1px 0 var(--ncr-hair)}
.ncr-top-plan-meta{grid-area:meta;font-size:12.5px;color:var(--ncr-muted)}
.ncr-top-plan-title{grid-area:title;font-weight:600;color:var(--ncr-ink);font-size:15px;line-height:1.4}
.ncr-top-plan .ncr-sev{grid-area:sev}
.ncr-plan-source{margin-top:-6px}
.ncr-plan-scope{margin-top:-2px;max-width:70ch}
.ncr-plan-group{display:flex;flex-direction:column;gap:6px}
.ncr-plan-group+.ncr-plan-group{margin-top:8px}
.ncr-plan-kind{font-family:${F_MONO};font-weight:500;font-size:11.5px;letter-spacing:0.1em;text-transform:uppercase;color:var(--ncr-muted)}
.ncr-plan-list{display:flex;flex-direction:column}
.ncr-plan-item{padding:14px 0;display:flex;flex-direction:column;gap:6px}
.ncr-plan-item+.ncr-plan-item{box-shadow:inset 0 1px 0 var(--ncr-hair)}
.ncr-plan-title-row{display:flex;align-items:flex-start;justify-content:space-between;gap:12px;flex-wrap:wrap}
.ncr-sev{display:inline-flex;align-items:center;gap:7px;font-size:12.5px;font-weight:600;white-space:nowrap;color:var(--ncr-body)}
.ncr-sev-bars{display:inline-flex;align-items:flex-end;gap:2px;height:12px}
.ncr-sev-bars i{display:block;width:3px;border-radius:1px;background:var(--ncr-border)}
.ncr-sev-bars i:nth-child(1){height:5px}
.ncr-sev-bars i:nth-child(2){height:8px}
.ncr-sev-bars i:nth-child(3){height:12px}
.ncr-sev.is-low .ncr-sev-bars i:nth-child(1),
.ncr-sev.is-medium .ncr-sev-bars i:nth-child(-n+2),
.ncr-sev.is-high .ncr-sev-bars i{background:currentColor}
.ncr-sev.is-high{color:var(--ncr-bad)}
.ncr-sev.is-medium{color:var(--ncr-warn)}

.ncr-work{display:flex;flex-direction:column;gap:20px}
.ncr-work-month{background:var(--ncr-surface);border:1px solid var(--ncr-border);border-radius:18px;padding:24px;box-shadow:var(--ncr-shadow)}
.ncr-work-month.is-selected{box-shadow:var(--ncr-shadow),inset 0 0 0 1px var(--ncr-accent)}
.ncr-work-head{display:flex;align-items:baseline;justify-content:space-between;gap:12px;flex-wrap:wrap;margin-bottom:10px}
.ncr-work-list{position:relative}
.ncr-work-item{display:grid;grid-template-columns:72px minmax(0,1fr);gap:16px;padding:14px 0;position:relative}
.ncr-work-item+.ncr-work-item{box-shadow:inset 0 1px 0 var(--ncr-hair)}
.ncr-work-date{font-family:${F_MONO};font-size:12.5px;letter-spacing:0.02em;color:var(--ncr-muted);padding-top:2px;text-transform:uppercase}
.ncr-work-body{display:flex;flex-direction:column;gap:6px;min-width:0}
.ncr-open-item{grid-template-columns:118px minmax(0,1fr)}
.ncr-status{display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;font-size:12.5px;font-weight:600;white-space:nowrap;align-self:start;justify-self:start}
.ncr-status.is-doing{color:var(--ncr-accent-text);box-shadow:inset 0 0 0 1px var(--ncr-accent)}
.ncr-status.is-next{color:var(--ncr-ink);box-shadow:inset 0 0 0 1px var(--ncr-border)}
.ncr-work-finished-h{margin-top:8px}
.ncr-onlist{display:flex;align-items:center;justify-content:space-between;gap:12px 24px;flex-wrap:wrap;padding:18px 24px;position:relative}
.ncr-onlist-copy{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
@media (max-width: 599.98px){.ncr-open-item{grid-template-columns:minmax(0,1fr)}}
.ncr-work-title-row{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}

.ncr-problem{padding:24px;display:flex;gap:16px;align-items:flex-start;color:var(--ncr-bad)}
.ncr-problem>div{display:flex;flex-direction:column;gap:8px;color:var(--ncr-body)}
.ncr-problem-action{margin-top:8px}
.ncr-loading{display:flex;align-items:center;gap:12px;padding:40px 0;color:var(--ncr-body);font-size:15px}
.ncr-spinner{width:18px;height:18px;border-radius:50%;border:2px solid var(--ncr-border);border-top-color:var(--ncr-accent);animation:ncr-rot 800ms linear infinite}
@keyframes ncr-rot{to{transform:rotate(360deg)}}
@media (prefers-reduced-motion: reduce){.ncr-spinner{animation-duration:2400ms}}
.ncr-btn{display:inline-flex;align-items:center;justify-content:center;height:44px;padding:0 22px;border:0;border-radius:999px;
  background:var(--ncr-accent);color:var(--ncr-on-accent);font:600 14px/1 ${F_BODY};cursor:pointer;transition:filter 180ms ease,transform 100ms ease-out}
.ncr-btn:hover{filter:brightness(1.06)}
.ncr-btn:active{transform:scale(0.97)}
.ncr-icon-btn{display:inline-flex;align-items:center;justify-content:center;width:44px;height:44px;border:0;border-radius:12px;background:transparent;color:var(--ncr-ink);cursor:pointer;transition:background-color 180ms ease,transform 100ms ease-out}
.ncr-icon-btn:hover{background:var(--ncr-accent-wash)}
.ncr-icon-btn:active{transform:scale(0.95)}

.ncr-linkcard{position:relative;cursor:pointer;transition:transform 180ms ease-out,box-shadow 180ms ease-out}
.ncr-card-link{color:inherit;text-decoration:none}
.ncr-linkcard .ncr-card-link::after,.ncr-linkrow .ncr-card-link::after{content:"";position:absolute;inset:0;border-radius:inherit;z-index:1}
.ncr-linkcard:hover{transform:translateY(-2px);box-shadow:inset 0 0 0 1px var(--ncr-accent),var(--ncr-shadow)}
.ncr-view-hint{position:absolute;top:16px;right:16px;display:inline-flex;align-items:center;gap:2px;font-size:12.5px;font-weight:500;color:var(--ncr-accent-text)}
.ncr-view-link{display:inline-flex;align-items:center;gap:4px}
.ncr-linkrow{position:relative;border-radius:10px;transition:background-color 180ms ease-out}
.ncr-linkrow:hover{background:var(--ncr-accent-wash)}
.ncr-linkrow .ncr-card-link:hover{text-decoration:underline;text-underline-offset:3px}
@supports selector(:has(*)){
  .ncr-app .ncr-card-link:focus-visible{outline:none}
  .ncr-linkcard:has(.ncr-card-link:focus-visible),.ncr-linkrow:has(.ncr-card-link:focus-visible){outline:2px solid var(--ncr-accent);outline-offset:2px}
}
.ncr-plan-item.is-target{border-radius:12px;box-shadow:0 0 0 3px var(--ncr-accent);transition:box-shadow 200ms ease-out}
@media (prefers-reduced-motion: reduce){.ncr-linkcard,.ncr-linkcard:hover{transform:none;transition:none}}

.ncr-disclaimer{margin-top:28px;padding-top:16px;box-shadow:inset 0 1px 0 var(--ncr-hair);font-size:12.5px;line-height:1.55;color:var(--ncr-muted);max-width:80ch}

.ncr-host-note{display:flex;flex-direction:column;gap:4px;padding:10px 12px;border-radius:10px;background:var(--ncr-surface-2)}
.ncr-host-note .ncr-small:first-child{display:flex;align-items:flex-start;gap:6px;color:var(--ncr-ink)}
.ncr-host-note svg{color:var(--ncr-good);margin-top:2px}

.ncr-included{display:flex;flex-direction:column;gap:8px;margin-top:10px;padding-top:12px;box-shadow:inset 0 1px 0 var(--ncr-hair)}
.ncr-included-h{font-size:13px;font-weight:600;color:var(--ncr-ink)}
.ncr-included-list{display:flex;flex-direction:column;gap:6px}
.ncr-included-list li{display:flex;align-items:flex-start;gap:8px;font-size:14px;line-height:1.45;color:var(--ncr-body)}
.ncr-included-list svg{color:var(--ncr-good);margin-top:2px}
.ncr-facts-list{display:flex;flex-direction:column;gap:14px;margin-top:12px}
.ncr-facts{display:flex;flex-direction:column;gap:8px;padding:16px;border-radius:14px;background:var(--ncr-surface-2)}
.ncr-facts-dl{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px 20px}
.ncr-facts-dl dt{font-size:12.5px;color:var(--ncr-muted)}
.ncr-facts-dl dd{font-size:14.5px;font-weight:500;color:var(--ncr-ink)}
.ncr-clamp-any{overflow-wrap:anywhere}
.ncr-events{display:flex;flex-direction:column;gap:10px;margin-top:12px}
.ncr-event{display:flex;align-items:center;gap:12px}
.ncr-event-icon{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;background:var(--ncr-surface-2);color:var(--ncr-accent-text);flex:none}
.ncr-event-text{display:flex;flex-direction:column;gap:1px;min-width:0}
.ncr-event-title{font-size:15px;font-weight:600;color:var(--ncr-ink)}
.ncr-partner{display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin-top:10px}
.ncr-partner-links{display:flex;flex-direction:column;gap:4px;font-size:15px}
.ncr-btn-quiet{background:transparent;color:var(--ncr-accent-text);box-shadow:inset 0 0 0 1px var(--ncr-accent-text)}
.ncr-btn-quiet:hover:not(:disabled){background:var(--ncr-accent-wash)}
.ncr-switch-row{display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:10px;max-width:520px}
.ncr-switch-label{font-size:15px;color:var(--ncr-ink)}
.ncr-switch{position:relative;display:inline-flex;align-items:center;width:64px;height:36px;padding:0 8px;border:0;border-radius:999px;cursor:pointer;flex:none;
  background:var(--ncr-surface-2);box-shadow:inset 0 0 0 1px var(--ncr-field);color:var(--ncr-ink);transition:background-color 200ms ease-out}
.ncr-switch.is-on{background:var(--ncr-accent);box-shadow:none;color:var(--ncr-on-accent)}
.ncr-switch-knob{position:absolute;top:4px;left:4px;width:28px;height:28px;border-radius:50%;background:var(--ncr-surface);box-shadow:0 1px 3px rgba(0,0,0,0.25);transition:transform 220ms cubic-bezier(.2,.8,.2,1)}
.ncr-switch.is-on .ncr-switch-knob{transform:translateX(28px)}
.ncr-switch-state{font-size:11px;font-weight:700;margin-left:auto}
.ncr-switch.is-on .ncr-switch-state{margin-left:0}
.ncr-switch:disabled{opacity:0.55;cursor:not-allowed}
@media (prefers-reduced-motion: reduce){.ncr-switch,.ncr-switch-knob{transition:none}}
.ncr-switch-msg:empty{display:none}
.ncr-access{display:flex;flex-direction:column;gap:10px;margin-top:12px}
.ncr-access li{display:flex;flex-direction:column;gap:2px}
.ncr-signout-all{display:flex;flex-direction:column;align-items:flex-start;gap:8px;margin-top:22px;padding-top:18px;box-shadow:inset 0 1px 0 var(--ncr-hair)}
.ncr-confirm{display:flex;flex-direction:column;gap:10px;padding:14px;border-radius:12px;background:var(--ncr-surface-2)}
.ncr-confirm-q{outline:none;font-weight:600;color:var(--ncr-ink)}
.ncr-confirm-actions{display:flex;flex-wrap:wrap;gap:10px}
.ncr-data-links{display:flex;flex-direction:column;gap:6px;margin:10px 0 8px;font-size:15px}

.ncr-staff-badge{display:inline-flex;align-items:center;height:22px;margin-left:10px;padding:0 9px;border-radius:999px;font-size:11.5px;font-weight:600;letter-spacing:0.02em;color:var(--ncr-accent-text);box-shadow:inset 0 0 0 1px var(--ncr-accent);vertical-align:middle;white-space:nowrap}
.ncr-input-sm{min-height:40px;padding:8px 10px;font-size:14px}
.ncr-sites-table th[scope="row"]{font-weight:400}
.ncr-sites-table tr.is-current th,.ncr-sites-table tr.is-current td{background:var(--ncr-surface-2)}
.ncr-row-link{display:flex;flex-direction:column;align-items:flex-start;gap:2px;min-width:0;max-width:280px;padding:4px 6px;margin:-4px -6px;border:0;border-radius:8px;background:none;color:var(--ncr-ink);font:inherit;text-align:left;cursor:pointer;transition:background-color 180ms ease}
.ncr-row-link:hover{background:var(--ncr-surface-2)}
.ncr-row-link:focus-visible{outline:2px solid var(--ncr-accent);outline-offset:2px}
.ncr-flags{display:flex;flex-direction:column;gap:4px}
.ncr-flags li{display:flex;align-items:flex-start;gap:6px;color:var(--ncr-ink)}
.ncr-flags svg{color:var(--ncr-warn-text, var(--ncr-ink));margin-top:2px;flex:none}
.ncr-acct{display:flex;flex-direction:column;gap:20px}
.ncr-acct-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;align-items:stretch}
.ncr-acct-row>.ncr-card{height:100%;box-sizing:border-box}
.ncr-plan-rows{display:flex;flex-direction:column}
.ncr-plan-row{display:grid;grid-template-columns:minmax(0,5fr) minmax(0,7fr);gap:16px 40px;padding:18px 0}
.ncr-plan-row+.ncr-plan-row{box-shadow:inset 0 1px 0 var(--ncr-hair)}
.ncr-plan-row:first-child{padding-top:4px}
.ncr-plan-row.is-compact{grid-template-columns:minmax(0,1fr)}
.ncr-plan-main{display:flex;flex-direction:column;gap:8px;min-width:0}
.ncr-plan-incl{display:flex;flex-direction:column;gap:10px;min-width:0}
.ncr-included-cols{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px 24px}
.ncr-site-list{display:flex;flex-direction:column;gap:18px}
.ncr-site{display:flex;flex-direction:column;gap:10px}
.ncr-partner-email{font-size:15px;overflow-wrap:anywhere}
.ncr-card-foot{margin-top:auto;padding-top:8px}
.ncr-stack-card{gap:0}
.ncr-subpanel{display:flex;flex-direction:column;gap:10px;padding:20px 0}
.ncr-subpanel:first-child{padding-top:0}
.ncr-subpanel:last-child{padding-bottom:0}
.ncr-subpanel+.ncr-subpanel{box-shadow:inset 0 1px 0 var(--ncr-hair)}
.ncr-download{display:flex;flex-direction:column;align-items:flex-start;gap:10px}
@media (max-width: 1099.98px){.ncr-plan-row{grid-template-columns:minmax(0,1fr)}}
@media (max-width: 809.98px){.ncr-acct-row{grid-template-columns:minmax(0,1fr)}.ncr-included-cols{grid-template-columns:minmax(0,1fr)}}
.ncr-plan-cards{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:12px;margin-top:14px}
.ncr-plan-card{display:flex;flex-direction:column;gap:6px;padding:18px;border-radius:14px;background:var(--ncr-surface-2)}
.ncr-plan-status{align-self:flex-start;display:inline-flex;align-items:center;gap:6px;height:26px;padding:0 10px;border-radius:999px;font-size:12.5px;font-weight:600;
  background:var(--ncr-surface);box-shadow:inset 0 0 0 1px var(--ncr-border)}
.ncr-plan-status.is-active{color:var(--ncr-good)}
.ncr-plan-status.is-soon{color:var(--ncr-accent-text)}
.ncr-plan-status.is-ended{color:var(--ncr-muted)}
.ncr-plan-progress{display:flex;flex-direction:column;gap:6px;margin-top:4px}
.ncr-plan-bar{height:6px;border-radius:999px;background:var(--ncr-border);overflow:hidden}
.ncr-plan-bar span{display:block;height:100%;border-radius:999px;background:var(--ncr-accent)}
.ncr-account-portal{display:flex;align-items:center;gap:10px 18px;flex-wrap:wrap;margin-top:18px}
.ncr-btn[href]{text-decoration:none}
.ncr-strong{color:var(--ncr-ink);font-weight:600;overflow-wrap:anywhere}
.ncr-link-inline{font-size:inherit;text-decoration-color:currentColor}
.ncr-pw-form{display:flex;flex-direction:column;gap:14px;margin-top:16px;max-width:420px}
.ncr-form-field{display:flex;flex-direction:column;gap:6px}
.ncr-form-label{font-size:14px;font-weight:500;color:var(--ncr-ink)}
.ncr-input{width:100%;min-height:44px;padding:10px 12px;border-radius:10px;border:1px solid var(--ncr-field);background:var(--ncr-surface);color:var(--ncr-ink);font:500 15px/1.3 ${F_BODY};transition:border-color 180ms ease}
.ncr-input:hover:not(:disabled){border-color:var(--ncr-ink)}
.ncr-input:focus-visible{outline:2px solid var(--ncr-accent);outline-offset:2px}
.ncr-input[aria-invalid="true"]{border-color:var(--ncr-bad)}
.ncr-input:disabled{background:var(--ncr-surface-2);cursor:not-allowed}
.ncr-field-error,.ncr-form-result{display:flex;align-items:flex-start;gap:6px;font-size:13.5px;line-height:1.45;font-weight:500}
.ncr-field-error{color:var(--ncr-bad)}
.ncr-form-result.is-ok{color:var(--ncr-good)}
.ncr-form-result.is-bad{color:var(--ncr-bad)}
.ncr-field-error svg,.ncr-form-result svg{margin-top:1px}
.ncr-pw-actions{display:flex}
.ncr-btn:disabled{opacity:0.55;cursor:not-allowed}
.ncr-spinner-sm{width:14px;height:14px;margin-right:8px;border-color:currentColor;border-top-color:transparent}
.ncr-nav-account{margin-bottom:4px}

.ncr-strip{overflow:hidden;scroll-margin-top:84px}
@media (prefers-contrast: more){.ncr-strip-inner{box-shadow:inset 0 0 0 1px var(--ncr-field)}}
.ncr-strip-inner{display:flex;align-items:center;gap:8px 16px;margin:12px auto 0;max-width:calc(1440px + 2 * var(--ncr-inset));padding:10px 10px 10px 14px;
  margin-left:var(--ncr-gutter);margin-right:var(--ncr-gutter);border-radius:14px;background:var(--ncr-surface);box-shadow:inset 0 0 0 1px var(--ncr-border)}
.ncr-strip-stack{display:grid;flex:1;min-width:0}
.ncr-strip-slide{grid-area:1/1;display:grid;grid-template-columns:auto minmax(0,1fr) auto;align-items:center;gap:4px 12px;opacity:0;visibility:hidden;
  transition:opacity 320ms ease-out,visibility 0s linear 320ms}
.ncr-strip-slide.is-on{opacity:1;visibility:visible;transition:opacity 320ms ease-out,visibility 0s}
.ncr-strip-body{display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.ncr-strip-actions{display:flex;align-items:center;gap:4px}
.ncr-strip-view{display:inline-flex;align-items:center;gap:2px;min-height:44px;padding:0 8px;border-radius:10px;font-size:14px;font-weight:600;color:var(--ncr-accent-text);text-decoration:none;white-space:nowrap;transition:background-color 180ms ease}
.ncr-strip-view:hover{background:var(--ncr-accent-wash)}
.ncr-strip-ack{color:var(--ncr-good)}
.ncr-strip-ack:hover{background:var(--ncr-accent-wash)}
.ncr-strip-nav{display:flex;align-items:center;gap:0;flex:none;padding-left:12px;box-shadow:inset 1px 0 0 var(--ncr-hair)}
.ncr-strip-btn{color:var(--ncr-body)}
.ncr-strip-btn:hover{background:var(--ncr-accent-wash);color:var(--ncr-ink)}
.ncr-strip-count{font:500 12.5px/1 ${F_MONO};color:var(--ncr-muted);min-width:44px;text-align:center;font-variant-numeric:tabular-nums}
.is-flash{border-radius:12px;box-shadow:0 0 0 3px var(--ncr-accent)!important;transition:box-shadow 200ms ease-out}
tr.is-flash>*{background:var(--ncr-accent-wash)}
@media (prefers-reduced-motion: reduce){.ncr-strip-slide,.ncr-strip-slide.is-on{transition:none}}
@media (max-width: 1023.98px), (hover: none) and (pointer: coarse){.ncr-strip-inner{margin-left:24px;margin-right:24px}}
@media (max-width: 599.98px){
  .ncr-strip-inner{margin:10px 16px 0;flex-wrap:wrap;padding:10px}
  .ncr-strip-nav{width:100%;justify-content:space-between;padding:6px 0 0;box-shadow:inset 0 1px 0 var(--ncr-hair)}
  .ncr-strip-slide{grid-template-columns:auto minmax(0,1fr)}
  .ncr-strip-actions{grid-column:2;justify-self:start;margin-left:-8px}
}

.ncr-notice-icon{display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:10px;margin-top:2px;background:var(--ncr-surface-2)}
.ncr-strip-slide.is-warn .ncr-notice-icon,.ncr-strip-slide.is-warn .ncr-notice-kind{color:var(--ncr-warn)}
.ncr-strip-slide.is-good .ncr-notice-icon,.ncr-strip-slide.is-good .ncr-notice-kind{color:var(--ncr-good)}
.ncr-strip-slide.is-work .ncr-notice-icon,.ncr-strip-slide.is-work .ncr-notice-kind,.ncr-strip-slide.is-list .ncr-notice-icon,.ncr-strip-slide.is-list .ncr-notice-kind{color:var(--ncr-accent-text)}
.ncr-notice-text{display:flex;flex-direction:column;gap:2px;min-width:0;padding-top:1px}
.ncr-notice-kind{font:500 11px/1.3 ${F_MONO};letter-spacing:0.08em;text-transform:uppercase}
.ncr-notice-title{font-family:${F_BODY};font-weight:600;font-size:15px;line-height:1.35;color:var(--ncr-ink);overflow-wrap:anywhere}

.ncr-btn-sm{height:38px;padding:0 18px;font-size:13.5px;text-decoration:none;white-space:nowrap}
.ncr-app .ncr-mainwrap .ncr-content{padding-bottom:calc(var(--ncr-nordy-h, 84px) + 16px)}
.ncr-app [data-tour]{scroll-margin-top:104px}
.is-tour{outline:3px solid var(--ncr-accent);outline-offset:6px;transition:outline-offset 200ms ease}
.ncr-ring-frame.is-tour,.ncr-panel.is-tour{border-radius:19px}
.ncr-ms-downloads.is-tour,.ncr-ms-grid-wrap.is-tour{border-radius:14px}
@media (prefers-reduced-motion: reduce){.is-tour{transition:none}}

.ncr-scrim{position:fixed;inset:0;z-index:40;background:var(--ncr-scrim)}
.ncr-drawer{position:fixed;top:0;right:0;bottom:0;z-index:41;width:min(320px,86vw);display:flex;flex-direction:column;padding:calc(8px + env(safe-area-inset-top)) calc(12px + env(safe-area-inset-right)) calc(20px + env(safe-area-inset-bottom)) 14px;overflow-y:auto;overscroll-behavior:contain;
  background:var(--ncr-chrome-heavy);backdrop-filter:blur(24px) saturate(160%);-webkit-backdrop-filter:blur(24px) saturate(160%);
  box-shadow:-1px 0 0 var(--ncr-hair),-12px 0 40px rgba(0,0,0,0.18)}
.ncr-drawer-head{display:flex;align-items:center;justify-content:space-between;min-height:52px;margin-bottom:10px}
.ncr-drawer-head .ncr-side-label{padding:0 13px}
.ncr-drawer-close{margin-left:auto}

@media (prefers-reduced-transparency: reduce){
  .ncr-sidebar-panel,.ncr-drawer{background:var(--ncr-surface-2);backdrop-filter:none;-webkit-backdrop-filter:none}
  .ncr-context,.ncr-topbar{background:var(--ncr-bg);backdrop-filter:none;-webkit-backdrop-filter:none}
}
@media (prefers-contrast: more){
  .ncr-sidebar-panel,.ncr-drawer,.ncr-context,.ncr-topbar{backdrop-filter:none;-webkit-backdrop-filter:none}
  .ncr-sidebar-panel{box-shadow:inset -1px 0 0 var(--ncr-field)}
  .ncr-context{box-shadow:inset 0 -1px 0 var(--ncr-field)}
  .ncr-context::after{display:none}
}
@media (prefers-reduced-motion: reduce){
  .ncr-app,.ncr-card,.ncr-nav-link,.ncr-side-btn,.ncr-btn,.ncr-icon-btn{transition-duration:120ms}
  .ncr-nav-link:active,.ncr-side-btn:active,.ncr-btn:active,.ncr-icon-btn:active{transform:none}
}

@media (min-width: 1024px) and (max-height: 760px){
  .ncr-sidebar-inner{padding-top:14px;padding-bottom:12px}
  .ncr-brand{padding-bottom:8px}
  .ncr-side-label{padding-bottom:8px}
  .ncr-side-foot{gap:8px;padding-top:10px}
  .ncr-nav-list{gap:0}
}
@media (max-width: 1023.98px), (hover: none) and (pointer: coarse){
  .ncr-sidebar{display:none}
  .ncr-topbar{position:sticky;top:0;z-index:4;display:flex;align-items:center;gap:6px;height:calc(60px + env(safe-area-inset-top));padding:env(safe-area-inset-top) calc(12px + env(safe-area-inset-right)) 0 calc(14px + env(safe-area-inset-left));
    background:var(--ncr-chrome-heavy);backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%)}
  .ncr-topbar::after{content:"";position:absolute;left:0;right:0;top:100%;height:12px;pointer-events:none;background:linear-gradient(to bottom,var(--ncr-chrome-heavy),transparent)}
  .ncr-top-home{margin:0;padding:6px 4px;border-radius:8px}
  .ncr-top-end{margin-left:auto;display:flex;align-items:center;gap:8px}
  .ncr-logo-top{width:108px;height:32px}
  .ncr-context{position:relative;top:auto;padding:18px 24px 6px;background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none}
  .ncr-context::after{display:none}
  .ncr-sample-desk{display:none}
  .ncr-context-cta{display:none}
  .ncr-content{padding:18px 24px 40px}
  .ncr-mobile-switch{display:block;margin:-8px 0 20px}
  .ncr-mobile-switch .ncr-switchers{max-width:360px}
  .ncr-app [data-tour]{scroll-margin-top:84px}
}
@media (max-width: 1023.98px){
  .ncr-kpi-row{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ncr-score-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ncr-overview-top{grid-template-columns:minmax(0,1fr)}
}
@media (max-width: 719.98px){
  .ncr-search-table{display:none}
  .ncr-search-cards{display:flex;flex-direction:column}
}
@media (max-width: 599.98px){
  .ncr-context{padding:16px 16px 4px;gap:12px}
  .ncr-context-when{width:100%}
  .ncr-month{width:100%}
  .ncr-month .ncr-select{flex:1;min-width:0}
  .ncr-content{padding:14px 16px 32px}
  .ncr-h1{font-size:27px}
  .ncr-panel{padding:18px;border-radius:16px}
  .ncr-work-month{padding:18px}
  .ncr-kpi{padding:16px}
  .ncr-kpi-row,.ncr-kpi-row-3,.ncr-kpi-pair,.ncr-score-grid{grid-template-columns:minmax(0,1fr)}
  .ncr-kpi-row{grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
  .ncr-kpi-row.ncr-kpi-row-3{grid-template-columns:minmax(0,1fr)}
  .ncr-figure{font-size:24px}
  .ncr-figure-lg{font-size:38px}
  .ncr-health{padding:18px}
  .ncr-health-body{gap:20px}
  .ncr-work-item{grid-template-columns:minmax(0,1fr);gap:4px}
  .ncr-top-plan li{grid-template-columns:minmax(0,1fr);grid-template-areas:"meta" "title" "sev";gap:4px}
}
@media (max-width: 359.98px){
  .ncr-kpi-row{grid-template-columns:minmax(0,1fr)}
}

.ncr-ms-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:16px}
.ncr-ms-cell{display:flex;min-width:0}
.ncr-ms-cell.is-year{grid-column:span 2}
.ncr-ms-card{position:relative;display:flex;flex-direction:column;gap:4px;width:100%;padding:20px 22px 22px;border-radius:18px;text-decoration:none;color:inherit;
  background:var(--ncr-surface)}
.ncr-ms-cell.is-year .ncr-ms-card{border-color:color-mix(in srgb,var(--ncr-accent) 45%,var(--ncr-border));padding:24px 26px 26px}
.ncr-ms-card-title{font-family:${F_HEAD};font-weight:600;font-size:19px;line-height:1.25;letter-spacing:-0.012em;color:var(--ncr-ink);margin-top:2px}
.ncr-ms-cell.is-year .ncr-ms-card-title{font-size:24px;letter-spacing:-0.018em}
.ncr-ms-card-facts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 20px;margin-top:14px;padding-top:14px;box-shadow:inset 0 1px 0 var(--ncr-hair)}
.ncr-ms-cell.is-year .ncr-ms-card-facts{grid-template-columns:repeat(4,minmax(0,1fr))}
.ncr-ms-card-facts>div{display:flex;flex-direction:column;gap:2px;min-width:0}
.ncr-ms-card-wide{grid-column:1/-1}
.ncr-ms-cell.is-year .ncr-ms-card-wide{grid-column:span 2}
.ncr-ms-card-facts dt{font-size:12.5px;color:var(--ncr-muted)}
.ncr-ms-card-facts dd{font-size:14.5px;font-weight:500;color:var(--ncr-ink);display:flex;align-items:center;gap:2px 10px;flex-wrap:wrap;font-variant-numeric:tabular-nums;min-width:0}
.ncr-ms-move{overflow-wrap:anywhere}
.ncr-app a.ncr-ms-card:focus-visible{outline:2px solid var(--ncr-accent)!important;outline-offset:3px}
.ncr-ms-next{display:flex;flex-direction:column;gap:6px;margin-top:16px}
.ncr-ms-group-h{margin:28px 0 12px}
.ncr-ms-grid-sm{grid-template-columns:repeat(4,minmax(0,1fr));gap:12px}
.ncr-ms-card-sm{padding:16px 18px 18px;border-radius:14px}
.ncr-ms-card-sm .ncr-ms-card-title{font-size:16px}
.ncr-ms-card-sm .ncr-ms-card-facts{margin-top:10px;padding-top:10px;gap:8px 14px}
.ncr-ms-history{display:flex;flex-direction:column;gap:8px}
.ncr-ms-caption{display:flex;align-items:center;gap:6px 12px;flex-wrap:wrap}
.ncr-month-pdf{display:inline-flex}
.ncr-month-pdf .ncr-textbtn{white-space:nowrap}
@media (max-width: 1099.98px){.ncr-ms-grid-sm{grid-template-columns:repeat(3,minmax(0,1fr))}}
@media (max-width: 699.98px){.ncr-ms-grid-sm{grid-template-columns:repeat(2,minmax(0,1fr))}}
@media (max-width: 419.98px){.ncr-ms-grid-sm{grid-template-columns:minmax(0,1fr)}}
.ncr-ms-next li{display:flex;align-items:center;gap:8px;font-size:13.5px;color:var(--ncr-body)}
.ncr-ms-next svg{color:var(--ncr-muted)}
.ncr-ms-dl-row{display:flex;align-items:center;gap:10px 20px;flex-wrap:wrap}
.ncr-textbtn{border:0;background:none;padding:10px 2px;min-height:44px;font:500 14px/1.2 ${F_BODY};color:var(--ncr-accent-text);cursor:pointer;text-decoration:underline;text-decoration-color:transparent;text-underline-offset:3px;transition:text-decoration-color 180ms ease}
.ncr-textbtn:hover{text-decoration-color:currentColor}
@media (max-width: 1099.98px){
  .ncr-ms-grid{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ncr-ms-cell.is-year .ncr-ms-card-facts{grid-template-columns:repeat(2,minmax(0,1fr))}
  .ncr-ms-cell.is-year .ncr-ms-card-wide{grid-column:1/-1}
}
@media (max-width: 699.98px){
  .ncr-ms-grid{grid-template-columns:minmax(0,1fr)}
  .ncr-ms-cell.is-year{grid-column:auto}
  .ncr-ms-card,.ncr-ms-cell.is-year .ncr-ms-card{padding:18px}
  .ncr-ms-cell.is-year .ncr-ms-card-title{font-size:21px}
}
@media (max-width: 359.98px){
  .ncr-ms-card-facts,.ncr-ms-cell.is-year .ncr-ms-card-facts{grid-template-columns:minmax(0,1fr)}
}
.ncr-ms-intro{margin-top:-6px}
.ncr-ms-list{display:flex;flex-direction:column;margin:0 -12px}
.ncr-ms-item{display:grid;grid-template-columns:minmax(0,1fr) auto;grid-template-areas:"main status" "facts facts";gap:10px 16px;padding:16px 12px;align-items:start;cursor:pointer}
.ncr-ms-item+.ncr-ms-item{box-shadow:inset 0 1px 0 var(--ncr-hair)}
.ncr-ms-item-main{grid-area:main;display:flex;flex-direction:column;gap:2px;min-width:0}
.ncr-ms-item .ncr-card-link{overflow-wrap:anywhere}
.ncr-ms-item .ncr-ms-status{grid-area:status}
.ncr-ms-facts{grid-area:facts;display:flex;flex-wrap:wrap;gap:8px 36px}
.ncr-ms-facts>div{display:flex;flex-direction:column;gap:2px;min-width:0}
.ncr-ms-facts dt{font-size:12.5px;color:var(--ncr-muted)}
.ncr-ms-facts dd{font-size:14.5px;font-weight:500;color:var(--ncr-ink);display:flex;align-items:center;gap:4px 10px;flex-wrap:wrap;font-variant-numeric:tabular-nums}
@media (min-width: 900px){
  .ncr-ms-item{grid-template-columns:minmax(0,1.25fr) minmax(0,1.5fr) 236px;grid-template-areas:"main facts status";align-items:center}
  .ncr-ms-item .ncr-ms-status{justify-self:end}
}
@supports selector(:has(*)){.ncr-app .ncr-ms-item a.ncr-card-link:focus-visible{outline:none!important}}
.ncr-ms-status{white-space:nowrap}
.ncr-ms-back{display:inline-flex;align-items:center;gap:6px;align-self:flex-start;min-height:44px;margin:-10px 0 -6px}
.ncr-ms-missing{padding:12px 14px;border-radius:12px;background:var(--ncr-surface-2);color:var(--ncr-ink)}
.ncr-ms-head-top{display:flex;justify-content:space-between;align-items:flex-start;gap:12px 20px;flex-wrap:wrap}
.ncr-ms-head-who{display:flex;flex-direction:column;gap:2px;min-width:0}
.ncr-ms-domain{font-weight:500}
.ncr-ms-summary{display:flex;flex-direction:column;gap:8px;max-width:76ch}
.ncr-ms-summary li{position:relative;padding-left:18px;font-size:15px;line-height:1.55;color:var(--ncr-ink);overflow-wrap:anywhere}
.ncr-ms-summary li::before{content:"";position:absolute;left:3px;top:0.64em;width:6px;height:6px;border-radius:50%;background:var(--ncr-accent)}
.ncr-ms-head .ncr-download{padding-top:16px;box-shadow:inset 0 1px 0 var(--ncr-hair)}
.ncr-ms-hero{display:flex;align-items:flex-start;gap:16px 40px;flex-wrap:wrap}
.ncr-ms-hero-fig{display:flex;flex-direction:column;gap:6px;flex:none}
.ncr-ms-hero-copy{display:flex;flex-direction:column;gap:8px;flex:1;min-width:220px;max-width:68ch;padding-top:4px}
.ncr-ms-two{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px;align-items:start}
.ncr-ms-pair{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px 24px}
.ncr-ms-pair>div{display:flex;flex-direction:column;gap:6px;min-width:0}
.ncr-ms-resp{display:flex;flex-direction:column;gap:6px;padding-top:14px;box-shadow:inset 0 1px 0 var(--ncr-hair)}
.ncr-ms-issues{display:flex;flex-direction:column;gap:8px;padding-top:14px;box-shadow:inset 0 1px 0 var(--ncr-hair)}
.ncr-ms-issue-list{display:flex;flex-direction:column;margin-bottom:6px}
.ncr-ms-issue-list li{display:flex;align-items:flex-start;gap:8px;padding:6px 0;font-size:14px;line-height:1.45;color:var(--ncr-body);overflow-wrap:anywhere}
.ncr-ms-issue-list li+li{box-shadow:inset 0 1px 0 var(--ncr-hair)}
.ncr-ms-issue-list svg{flex:none;margin-top:1px}
.ncr-ms-issue-list.is-resolved svg{color:var(--ncr-good)}
.ncr-ms-issue-list.is-open svg{color:var(--ncr-muted)}
.ncr-ms-notes{display:flex;flex-direction:column;gap:4px;font-size:13px;line-height:1.5;color:var(--ncr-body)}
.ncr-ms-work{columns:2;column-gap:32px}
.ncr-ms-work-group{display:flex;flex-direction:column;gap:2px;min-width:0;break-inside:avoid;margin-bottom:14px}
.ncr-ms-work-group .ncr-work-item{grid-template-columns:64px minmax(0,1fr);gap:12px;padding:10px 0}
.ncr-ms-work.is-year .ncr-work-item{grid-template-columns:108px minmax(0,1fr)}
.ncr-ms-work-group .ncr-strong{font-size:14.5px;line-height:1.4}
@media (max-width: 809.98px){
  .ncr-ms-two{grid-template-columns:minmax(0,1fr)}
  .ncr-ms-work{columns:1}
}
@media (max-width: 599.98px){
  .ncr-ms-list{margin:0 -8px}
  .ncr-ms-item{grid-template-columns:minmax(0,1fr);grid-template-areas:"main" "status" "facts";padding:14px 8px;gap:8px}
  .ncr-ms-facts{gap:8px 24px}
  .ncr-ms-pair{grid-template-columns:minmax(0,1fr)}
  .ncr-ms-hero{gap:12px}
  .ncr-ms-work-group .ncr-work-item,.ncr-ms-work.is-year .ncr-work-item{grid-template-columns:minmax(0,1fr);gap:2px}
}
`
const V2_LIGHT = `
--ncr-bg:#f3f4f6;--ncr-surface:#ffffff;--ncr-surface-2:#f4f5f8;
--ncr-border:rgba(22,24,28,0.06);--ncr-hair:rgba(22,24,28,0.07);
--ncr-chrome:rgba(243,244,246,0.82);--ncr-chrome-heavy:rgba(255,255,255,0.92);
--ncr-shadow:0 1px 2px rgba(16,24,40,0.04),0 14px 34px -16px rgba(16,24,40,0.14);
--ncr-v2-pill-shadow:0 1px 2px rgba(16,24,40,0.04),0 8px 24px -12px rgba(16,24,40,0.14);
--ncr-v2-hero-from:#9b5cff;--ncr-v2-hero-to:#7a2ee6;--ncr-v2-hero-glow:rgba(139,61,255,0.45);
`
const V2_DARK = `
--ncr-bg:#0c0e11;--ncr-surface:#161920;--ncr-surface-2:#1d2129;
--ncr-border:rgba(255,255,255,0.06);--ncr-hair:rgba(255,255,255,0.08);
--ncr-chrome:rgba(12,14,17,0.80);--ncr-chrome-heavy:rgba(22,25,32,0.92);
--ncr-shadow:0 1px 2px rgba(0,0,0,0.35),0 16px 40px -18px rgba(0,0,0,0.6);
--ncr-v2-pill-shadow:0 1px 2px rgba(0,0,0,0.35),0 10px 28px -14px rgba(0,0,0,0.6);
--ncr-v2-hero-from:#8d49ff;--ncr-v2-hero-to:#6a22d6;--ncr-v2-hero-glow:rgba(139,61,255,0.35);
`
const V2_CSS = `
.ncr-v2{${V2_LIGHT}--ncr-v2-radius:22px;--ncr-inset:50px;--ncr-v2-edge:18px}

html[data-nc-theme="dark"] .ncr-v2{${V2_DARK}}
html[data-nc-theme="light"] .ncr-v2{${V2_LIGHT}}
@media (prefers-contrast: more){.ncr-v2{--ncr-border:var(--ncr-field);--ncr-hair:var(--ncr-field);--ncr-chrome:var(--ncr-bg);--ncr-chrome-heavy:var(--ncr-bg)}}

.ncr-v2.ncr-app{display:flex;align-items:stretch}
.ncr-v2 .ncr-sidebar,.ncr-v2 .ncr-topbar,.ncr-v2 .ncr-context,.ncr-v2 .ncr-mobile-switch{display:none!important}
.ncr-v2 .ncr-mainwrap{--ncr-loader-top:84px;--ncr-rail-pad:0px;flex:1;min-width:0}
.ncr-v2 .ncr-content{padding:22px var(--ncr-inset) 56px;max-width:calc(1440px + 2 * var(--ncr-inset))}
.ncr-v2 .ncr-strip-inner{border-radius:18px;box-shadow:var(--ncr-v2-pill-shadow)}

.ncr-v2-top{position:sticky;top:0;z-index:7;display:flex;align-items:center;flex-wrap:nowrap;gap:12px 14px;padding:14px var(--ncr-inset) 12px;margin-left:calc(-1 * var(--ncr-rail-pad));
  background:var(--ncr-chrome);backdrop-filter:blur(20px) saturate(160%);-webkit-backdrop-filter:blur(20px) saturate(160%)}
.ncr-v2-top::after{content:"";position:absolute;left:0;right:0;top:100%;height:14px;pointer-events:none;background:linear-gradient(to bottom,var(--ncr-chrome),transparent)}
.ncr-v2-top>*{transition:opacity 180ms ease}
.ncr-v2.is-locked .ncr-v2-top>*,.ncr-v2.is-locked .ncr-v2-rail>*{opacity:0.45}
.ncr-v2-brand{display:inline-flex;align-items:center;height:52px;padding:0 10px 0 0;margin:0;border-radius:10px;flex:none}
.ncr-v2-logo{width:112px;height:34px}
.ncr-v2-tabs{display:flex;align-items:center;height:52px;padding:0 6px;border-radius:999px;background:var(--ncr-surface);box-shadow:var(--ncr-v2-pill-shadow);
  min-width:0;overflow-x:auto;scrollbar-width:none;-ms-overflow-style:none}
.ncr-v2-tabs::-webkit-scrollbar{display:none}
.ncr-v2-tabs{gap:6px;flex:0 1 auto;min-width:0}
.ncr-v2-parts{display:flex;align-items:center;gap:2px}
.ncr-v2-tabs .ncr-v2-tab-section{gap:8px;padding:0 14px 0 10px;border:0;background:transparent;color:var(--ncr-ink);font-family:inherit;font-weight:600;cursor:pointer;position:relative;margin-right:4px}
.ncr-v2-tabs .ncr-v2-tab-section:hover{background:var(--ncr-surface-2)}
.ncr-v2-tabs .ncr-v2-tab-section::after{content:"";position:absolute;right:-5px;top:10px;bottom:10px;width:1px;background:var(--ncr-hair)}
.ncr-v2-tabs .ncr-v2-tab-section:only-child{margin-right:0;padding:0 12px 0 10px}
.ncr-v2-tabs .ncr-v2-tab-section:only-child::after{display:none}
.ncr-v2-tabs .ncr-v2-tab-section svg{color:#8b3dff}
.ncr-v2-tab-section svg{flex:none}
.ncr-v2-part{border:0;background:transparent;font-family:inherit;cursor:pointer}
.ncr-v2-part.is-current{color:#ffffff}
.ncr-v2-part.is-current:hover{background:transparent}
.ncr-v2-part .ncr-v2-tab-pill{background:#8b3dff}
.ncr-v2-tab{position:relative;display:inline-flex;align-items:center;height:40px;padding:0 18px;border-radius:999px;text-decoration:none;
  font-weight:500;font-size:14px;letter-spacing:0;color:var(--ncr-body);white-space:nowrap;isolation:isolate;
  transition:color 180ms ease,background-color 180ms ease,transform 100ms ease-out}
.ncr-v2-tab:hover{color:var(--ncr-ink);background:var(--ncr-surface-2)}
.ncr-v2-tab:active{transform:scale(0.97)}
.ncr-v2-tab.is-current{color:var(--ncr-bg);background:transparent}
.ncr-v2-tab.is-current:hover{background:transparent}
.ncr-v2-tab-pill{position:absolute;inset:0;border-radius:999px;background:var(--ncr-ink);z-index:-1}
.ncr-v2-tab-text{position:relative}
.ncr-v2-top-end{margin-left:auto;display:flex;align-items:center;gap:12px;flex:none}
.ncr-v2-top-icons{display:flex;align-items:center;gap:2px;height:52px;padding:0 6px;border-radius:999px;background:var(--ncr-surface);box-shadow:var(--ncr-v2-pill-shadow)}
.ncr-v2-top-icon{width:40px;height:40px;border-radius:999px;color:var(--ncr-body)}
.ncr-v2-top-icon:hover{background:var(--ncr-surface-2);color:var(--ncr-ink)}
.ncr-v2-account{display:flex;align-items:center;gap:10px;height:52px;padding:0 14px 0 6px;border-radius:999px;background:var(--ncr-surface);box-shadow:var(--ncr-v2-pill-shadow);
  text-decoration:none;color:var(--ncr-ink);max-width:300px;transition:background-color 180ms ease,transform 100ms ease-out}
.ncr-v2-account:hover{background:var(--ncr-surface-2)}
.ncr-v2-account:active{transform:scale(0.98)}
.ncr-v2-account.is-current{box-shadow:var(--ncr-v2-pill-shadow),inset 0 0 0 1.5px var(--ncr-accent)}
.ncr-v2-avatar{display:inline-flex;align-items:center;justify-content:center;flex:none;width:40px;height:40px;border-radius:50%;
  background:linear-gradient(135deg,#b98cff,#d04c9a);color:#fff;font:600 13px/1 ${F_HEAD};letter-spacing:0.02em}
.ncr-v2-account-text{display:flex;flex-direction:column;gap:1px;min-width:0}
.ncr-v2-account-name{font:600 13.5px/1.2 ${F_HEAD};letter-spacing:-0.005em;color:var(--ncr-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ncr-v2-account-sub{font-size:12px;line-height:1.2;color:var(--ncr-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ncr-v2-account-chev{display:inline-flex;color:var(--ncr-muted);transition:transform 180ms ease}
.ncr-v2-account{border:0;font-family:inherit;cursor:pointer;text-align:left}
.ncr-v2-account.is-open .ncr-v2-account-chev{transform:rotate(180deg)}
.ncr-v2-acct{position:relative}
.ncr-v2-menu{position:absolute;right:0;top:calc(100% + 8px);z-index:9;min-width:248px;padding:8px;border-radius:18px;background:var(--ncr-surface);box-shadow:var(--ncr-shadow),inset 0 0 0 1px var(--ncr-border);display:flex;flex-direction:column;gap:2px;transform-origin:top right}
.ncr-v2-menu-head{display:flex;flex-direction:column;gap:2px;padding:8px 12px 10px;min-width:0}
.ncr-v2-menu-name{font:600 14px/1.3 ${F_HEAD};color:var(--ncr-ink);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ncr-v2-menu-sub{font-size:12.5px;color:var(--ncr-muted);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.ncr-v2-menu-item{display:flex;align-items:center;gap:10px;width:100%;min-height:40px;padding:0 12px;border:0;border-radius:12px;background:transparent;color:var(--ncr-ink);font:500 14px/1.2 ${F_BODY};text-decoration:none;text-align:left;cursor:pointer;transition:background-color 160ms ease}
.ncr-v2-menu-item:hover{background:var(--ncr-surface-2)}
.ncr-v2-menu-item svg{flex:none;color:var(--ncr-muted)}
.ncr-v2-menu-rule{height:1px;margin:4px 8px;background:var(--ncr-hair)}
.ncr-v2 .ncr-menu-btn{display:none}
.ncr-v2 .ncr-sample{height:28px}

.ncr-v2-rail{position:sticky;top:0;height:100dvh;flex:none;z-index:5;display:none;flex-direction:column;justify-content:flex-start;gap:8px;width:calc(var(--ncr-v2-edge) + 62px);padding:84px 10px 16px var(--ncr-v2-edge)}
.ncr-v2-rail-group{display:flex;flex-direction:column;gap:2px;padding:6px;border-radius:999px;background:var(--ncr-surface);box-shadow:var(--ncr-v2-pill-shadow)}
.ncr-v2-rail-group ul{display:flex;flex-direction:column;gap:2px}
.ncr-v2-rail-btn{display:inline-flex;align-items:center;justify-content:center;width:40px;height:40px;border:0;border-radius:999px;background:transparent;
  color:var(--ncr-muted);cursor:pointer;text-decoration:none;transition:background-color 180ms ease,color 180ms ease,transform 100ms ease-out}
.ncr-v2-rail-btn:hover{background:var(--ncr-surface-2);color:var(--ncr-ink)}
.ncr-v2-rail-btn:active{transform:scale(0.95)}
.ncr-v2-rail-btn.is-current,.ncr-v2-rail-btn.is-current:hover{background:#8b3dff;color:#ffffff}
.ncr-v2-rail-btn.is-on,.ncr-v2-rail-btn.is-on:hover{background:var(--ncr-surface-2);color:var(--ncr-ink)}
@media (min-width: 1024px) and (hover: hover) and (pointer: fine){
  .ncr-v2-rail{display:flex}
  .ncr-v2 .ncr-mainwrap{--ncr-rail-pad:calc(var(--ncr-v2-edge) + 62px)}
  .ncr-v2 .ncr-content{padding-left:12px}
  .ncr-v2 .ncr-strip-inner{margin-left:12px}
  .ncr-v2-top{padding-left:var(--ncr-v2-edge);gap:12px}
  .ncr-v2-brand{width:calc(var(--ncr-rail-pad) - var(--ncr-v2-edge));padding:0;justify-content:flex-start;padding-left:13px}
  .ncr-v2-logo{width:26px;height:36px;-webkit-mask-size:auto 100%;mask-size:auto 100%}
}

.ncr-v2-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px 28px;flex-wrap:wrap;margin-bottom:22px}
.ncr-v2-head-copy{display:flex;flex-direction:column;gap:6px;min-width:0;flex:1 1 440px}
.ncr-v2 .ncr-h1{font-size:36px;line-height:1.1;letter-spacing:-0.03em;margin:0}
.ncr-v2 .ncr-content .ncr-h1{margin-bottom:0}
.ncr-v2-sub{font-size:15px;line-height:1.5;color:var(--ncr-muted);max-width:68ch;overflow-wrap:anywhere}
.ncr-v2-sub a{color:var(--ncr-accent-text);text-decoration:underline;text-underline-offset:3px;text-decoration-color:transparent;transition:text-decoration-color 180ms ease}
.ncr-v2-sub a:hover{text-decoration-color:currentColor}
.ncr-v2 .ncr-what{display:inline}
.ncr-v2-head-actions{display:flex;align-items:center;gap:10px 14px;flex-wrap:wrap;justify-content:flex-end}
.ncr-v2-switch .ncr-switchers{flex-direction:row;gap:10px}
.ncr-v2-switch .ncr-field-label{flex-direction:row;align-items:center;gap:8px}
.ncr-v2-switch .ncr-field-label>span{white-space:nowrap}
.ncr-v2 .ncr-staff-badge{margin-left:0;height:28px}
.ncr-v2-checked{margin:-10px 0 18px;color:var(--ncr-muted)}
.ncr-v2 .ncr-select{border-radius:999px;min-height:44px;padding-left:16px;background-color:var(--ncr-surface);box-shadow:var(--ncr-v2-pill-shadow)}
.ncr-v2 .ncr-month .ncr-select{min-width:184px}
.ncr-v2 .ncr-input{border-radius:14px}
.ncr-v2 .ncr-input-sm{border-radius:999px}

.ncr-v2 .ncr-card{border-color:transparent;border-radius:var(--ncr-v2-radius);box-shadow:var(--ncr-shadow)}
.ncr-v2 .ncr-panel{border-radius:var(--ncr-v2-radius);padding:26px}
.ncr-v2 .ncr-kpi{padding:22px 24px;border-radius:var(--ncr-v2-radius)}
.ncr-v2 .ncr-health{padding:26px}
.ncr-v2 .ncr-work-month{border-radius:var(--ncr-v2-radius)}
.ncr-v2 .ncr-ring-frame{border-radius:calc(var(--ncr-v2-radius) + 1.5px)}
.ncr-v2 .ncr-ring-frame>.ncr-card{border-radius:var(--ncr-v2-radius)}
.ncr-v2 .ncr-ring-frame.is-tour,.ncr-v2 .ncr-panel.is-tour{border-radius:calc(var(--ncr-v2-radius) + 1.5px)}
.ncr-v2 .ncr-linkcard:hover{transform:translateY(-2px);box-shadow:inset 0 0 0 1.5px var(--ncr-accent),0 1px 2px rgba(16,24,40,0.04),0 22px 44px -18px rgba(16,24,40,0.22)}
.ncr-v2 .ncr-view-hint{top:20px;right:20px}
.ncr-v2 .ncr-kpi.ncr-linkcard .ncr-kpi-label,.ncr-v2 .ncr-health.ncr-linkcard .ncr-h2{padding-right:56px}
.ncr-v2 .ncr-section{gap:18px}
.ncr-v2 .ncr-kpi-row,.ncr-v2 .ncr-kpi-pair,.ncr-v2 .ncr-overview-top,.ncr-v2 .ncr-score-grid,.ncr-v2 .ncr-ms-grid{gap:18px}
.ncr-v2 .ncr-kpi-label{font-size:13.5px}
.ncr-v2 .ncr-figure{font-size:30px}
.ncr-v2 .ncr-figure-lg{font-size:46px}
.ncr-v2 .ncr-btn{background:var(--ncr-ink);color:var(--ncr-bg);box-shadow:var(--ncr-v2-pill-shadow)}
.ncr-v2 .ncr-btn:hover{filter:none;background:var(--ncr-accent);color:var(--ncr-on-accent)}
.ncr-v2 .ncr-btn-quiet{background:var(--ncr-surface-2);color:var(--ncr-ink);box-shadow:none}
.ncr-v2 .ncr-btn-quiet:hover{background:var(--ncr-border);color:var(--ncr-ink)}
.ncr-v2 .ncr-icon-btn{border-radius:999px}
.ncr-v2 .ncr-pill{background:var(--ncr-surface-2)}
.ncr-v2 .ncr-chip{box-shadow:none;background:var(--ncr-surface-2);color:var(--ncr-body)}
.ncr-v2 .ncr-delta{align-self:flex-start;min-height:26px;padding:3px 10px 3px 8px;border-radius:999px;background:var(--ncr-surface-2)}
.ncr-v2 .ncr-delta-good{background:color-mix(in srgb,var(--ncr-good) 12%,transparent)}
.ncr-v2 .ncr-delta-bad{background:color-mix(in srgb,var(--ncr-bad) 11%,transparent)}
.ncr-v2 .ncr-table-wrap{border-radius:16px}
.ncr-v2 .ncr-table thead th{color:var(--ncr-muted)}
.ncr-v2 .ncr-table tbody tr:hover th,.ncr-v2 .ncr-table tbody tr:hover td{background:var(--ncr-surface-2)}
.ncr-v2 .ncr-subpanel,.ncr-v2 .ncr-ms-missing,.ncr-v2 .ncr-search-card{border-radius:16px}
.ncr-v2 .ncr-disclaimer{color:var(--ncr-muted)}

.ncr-v2 .ncr-kpi-row[data-tour="deltas"]>.ncr-kpi:first-child{
  --ncr-ink:#ffffff;--ncr-body:rgba(255,255,255,0.9);--ncr-muted:rgba(255,255,255,0.84);
  --ncr-good:#ffffff;--ncr-bad:#ffffff;--ncr-accent:#ffffff;--ncr-accent-text:#ffffff;
  --ncr-series-2:rgba(255,255,255,0.65);--ncr-grid:rgba(255,255,255,0.2);--ncr-surface-2:rgba(255,255,255,0.16);--ncr-hair:rgba(255,255,255,0.2);
  color:var(--ncr-body);position:relative;overflow:hidden;isolation:isolate;background:var(--ncr-surface);
  box-shadow:0 1px 2px rgba(16,24,40,0.04),0 18px 40px -16px var(--ncr-v2-hero-glow)}
.ncr-v2 .ncr-kpi-row[data-tour="deltas"]>.ncr-kpi:first-child::before{content:"";position:absolute;inset:0;z-index:-1;border-radius:inherit;
  background:linear-gradient(135deg,var(--ncr-v2-hero-from) 0%,var(--ncr-v2-hero-to) 100%);
  clip-path:none}
.ncr-v2.is-ncr-intro .ncr-kpi-row[data-tour="deltas"]>.ncr-kpi:first-child::before{clip-path:circle(0% at 0% 100%);animation:ncr-v2-fill 760ms cubic-bezier(.22,.61,.36,1) 80ms both}
@keyframes ncr-v2-fill{to{clip-path:circle(165% at 0% 100%)}}
@media (prefers-reduced-motion: reduce){.ncr-v2 .ncr-kpi-row[data-tour="deltas"]>.ncr-kpi:first-child::before{animation:none;clip-path:none}}
.ncr-v2 .ncr-kpi-row[data-tour="deltas"]>.ncr-kpi:first-child .ncr-delta-good,
.ncr-v2 .ncr-kpi-row[data-tour="deltas"]>.ncr-kpi:first-child .ncr-delta-bad,
.ncr-v2 .ncr-kpi-row[data-tour="deltas"]>.ncr-kpi:first-child .ncr-delta-flat,
.ncr-v2 .ncr-kpi-row[data-tour="deltas"]>.ncr-kpi:first-child .ncr-delta-none{background:rgba(255,255,255,0.18);color:#fff}
.ncr-v2 .ncr-kpi-row[data-tour="deltas"]>.ncr-kpi:first-child .ncr-view-hint{color:rgba(255,255,255,0.9)}
.ncr-v2 .ncr-kpi-row[data-tour="deltas"]>.ncr-kpi:first-child:focus-within,.ncr-v2 .ncr-kpi-row[data-tour="deltas"]>.ncr-kpi:first-child:hover{
  box-shadow:0 1px 2px rgba(16,24,40,0.04),0 24px 48px -18px var(--ncr-v2-hero-glow)}

.ncr-v2 .is-ncr-hidden{display:none!important}
.ncr-v2 .is-ncr-solo{grid-template-columns:minmax(0,1fr)!important;display:grid!important}
.ncr-v2 .is-ncr-solo>*{max-width:820px}
.ncr-v2 .is-ncr-solo .ncr-figure{font-size:44px}
.ncr-v2 .is-ncr-solo .ncr-kpi,.ncr-v2 .is-ncr-solo .ncr-score{padding:28px 30px}
.ncr-v2 .is-ncr-solo .ncr-small{font-size:14.5px}
.ncr-v2 .is-ncr-empty::after{content:attr(data-ncr-empty);display:block;padding:14px 16px;border-radius:14px;background:var(--ncr-surface-2);color:var(--ncr-body);font-size:14.5px}

.ncr-v2 .ncr-drawer{border-radius:24px 0 0 24px;background:var(--ncr-chrome-heavy)}
.ncr-v2 .ncr-nav-link.is-current{background:#8b3dff;color:#ffffff;box-shadow:none}
.ncr-v2 .ncr-nav-link.is-current svg{color:#ffffff}

.ncr-v2 .ncr-loader{background:color-mix(in srgb,var(--ncr-bg) 72%,transparent)}

@media (prefers-reduced-transparency: reduce){
  .ncr-v2-top{background:var(--ncr-bg);backdrop-filter:none;-webkit-backdrop-filter:none}
  .ncr-v2-top::after{display:none}
}
@media (prefers-contrast: more){
  .ncr-v2-top{backdrop-filter:none;-webkit-backdrop-filter:none;box-shadow:inset 0 -1px 0 var(--ncr-field)}
  .ncr-v2-top::after{display:none}
  .ncr-v2-brand,.ncr-v2-tabs,.ncr-v2-top-icons,.ncr-v2-account,.ncr-v2-rail-group,.ncr-v2 .ncr-card{box-shadow:inset 0 0 0 1px var(--ncr-field)}
}
@media (prefers-reduced-motion: reduce){
  .ncr-v2 .ncr-linkcard:hover{transform:none}
  .ncr-v2-tab:active,.ncr-v2-rail-btn:active,.ncr-v2-account:active{transform:none}
}

@media (min-width: 1024px) and (max-width: 1279.98px){
  .ncr-v2-tab{padding:0 13px;font-size:13.5px}
  .ncr-v2-account-text{display:none}
  .ncr-v2-account{padding-right:10px}
  .ncr-v2-logo{width:96px;height:30px}
}
@media (max-width: 1023.98px), (hover: none) and (pointer: coarse){
  .ncr-v2-rail,.ncr-v2-top-icons{display:none}
  .ncr-v2-top{flex-wrap:wrap}
  .ncr-v2-tabs{order:3;flex:1 1 100%;height:48px}
  .ncr-v2-tab{height:36px;padding:0 14px;font-size:13.5px}
  .ncr-v2 .ncr-mainwrap{--ncr-rail-pad:0px}
  .ncr-v2 .ncr-menu-btn{display:inline-flex;width:52px;height:52px;background:var(--ncr-surface);box-shadow:var(--ncr-v2-pill-shadow)}
  .ncr-v2-top{padding:calc(10px + env(safe-area-inset-top)) calc(16px + env(safe-area-inset-right)) 10px calc(16px + env(safe-area-inset-left));gap:10px}
  .ncr-v2-brand{height:48px;padding:0 6px 0 0}
  .ncr-v2-logo{width:100px;height:30px}
  .ncr-v2-account{height:48px}
  .ncr-v2 .ncr-content{padding:14px 20px 44px}
  .ncr-v2 .ncr-h1{font-size:30px}
  .ncr-v2-head{margin-bottom:18px}
  .ncr-v2 .ncr-mainwrap{--ncr-loader-top:calc(68px + env(safe-area-inset-top))}
  .ncr-v2 [data-tour]{scroll-margin-top:92px}
  .ncr-v2 .ncr-sample-desk{display:inline-flex}
  .ncr-v2-top .ncr-sample{display:none}
}
@media (max-width: 599.98px){
  .ncr-v2-account-text,.ncr-v2-account-chev{display:none}
  .ncr-v2-account{padding:0 4px;width:48px;justify-content:center}
  .ncr-v2 .ncr-content{padding:12px 16px 36px}
  .ncr-v2 .ncr-h1{font-size:27px}
  .ncr-v2-head-actions{width:100%;justify-content:flex-start}
  .ncr-v2 .ncr-month{width:100%}
  .ncr-v2 .ncr-month .ncr-select{flex:1;min-width:0}
  .ncr-v2-switch{width:100%}
  .ncr-v2-switch .ncr-switchers{flex-direction:column}
  .ncr-v2 .ncr-panel,.ncr-v2 .ncr-health{padding:18px;border-radius:18px}
  .ncr-v2 .ncr-kpi{padding:16px 18px;border-radius:18px}
  .ncr-v2 .ncr-card{border-radius:18px}
  .ncr-v2 .ncr-ring-frame{border-radius:19.5px}
  .ncr-v2 .ncr-ring-frame>.ncr-card{border-radius:18px}
  .ncr-v2 .ncr-figure{font-size:26px}
  .ncr-v2 .ncr-figure-lg{font-size:40px}
}

.ncr-v2-rail{max-height:100dvh;overflow-y:auto;overflow-x:hidden;overscroll-behavior:contain;scrollbar-width:none;-ms-overflow-style:none}
.ncr-v2-rail::-webkit-scrollbar{display:none}
.ncr-v2-rail>*{flex:none}
.ncr-v2{--ncr-v2-bar:78px}
@media (min-width: 1024px) and (hover: hover) and (pointer: fine){
  .ncr-v2-rail{top:var(--ncr-v2-bar);margin-top:var(--ncr-v2-bar);height:calc(100dvh - var(--ncr-v2-bar));max-height:calc(100dvh - var(--ncr-v2-bar));padding-top:6px}
}
.ncr-v2-rail-btn:focus-visible{outline:2px solid var(--ncr-accent);outline-offset:2px}
.ncr-v2-rail-btn.is-current:focus-visible{outline-color:var(--ncr-ink)}
@media (min-width: 1024px) and (hover: hover) and (pointer: fine){
  .ncr-app.ncr-v2 .ncr-mainwrap .ncr-content{padding-right:max(var(--ncr-inset),min(96px,calc(var(--ncr-nordy-h, 84px) * 99)))}
}
@media (min-width: 1024px) and (max-height: 800px) and (hover: hover) and (pointer: fine){
  .ncr-v2-rail{gap:6px;padding-top:4px;padding-bottom:10px}
  .ncr-v2-rail-group{padding:4px;gap:1px}
  .ncr-v2-rail-group ul{gap:1px}
  .ncr-v2-rail-btn{width:38px;height:38px}
}
@media (min-width: 1024px) and (max-height: 600px) and (hover: hover) and (pointer: fine){
  .ncr-v2{--ncr-v2-bar:60px}
  .ncr-v2-top{padding-top:8px;padding-bottom:8px}
  .ncr-v2-brand,.ncr-v2-tabs,.ncr-v2-top-icons,.ncr-v2-account{height:44px}
  .ncr-v2-top .ncr-rf-btn{width:44px;height:44px}
  .ncr-v2-tab{height:34px}
  .ncr-v2-top-icon{width:34px;height:34px}
  .ncr-v2-avatar{width:34px;height:34px}
  .ncr-v2 .ncr-mainwrap{--ncr-loader-top:60px}
  .ncr-v2 [data-tour]{scroll-margin-top:76px}
  .ncr-v2 .ncr-content{padding-top:14px}
  .ncr-v2-rail{gap:4px;padding-top:4px;padding-bottom:8px}
  .ncr-v2-rail-group{padding:3px}
  .ncr-v2-rail-btn{width:34px;height:34px}
  .ncr-v2-rail-btn svg{width:16px;height:16px}
  .ncr-v2-head{margin-bottom:14px}
  .ncr-v2 .ncr-h1{font-size:30px}
}
@media (min-width: 900px) and (max-width: 1023.98px){
  .ncr-v2-top{flex-wrap:nowrap}
  .ncr-v2-tabs{order:0;flex:0 1 auto;height:52px}
  .ncr-app.ncr-v2 .ncr-mainwrap .ncr-content{padding-right:max(20px,min(96px,calc(var(--ncr-nordy-h, 84px) * 99)))}
}
@media (max-width: 1023.98px) and (min-width: 600px) and (max-height: 600px){
  .ncr-v2-top{padding-top:calc(6px + env(safe-area-inset-top));padding-bottom:6px;row-gap:6px}
  .ncr-v2-brand,.ncr-v2-account,.ncr-v2-tabs{height:44px}
  .ncr-v2 .ncr-menu-btn{width:44px;height:44px}
  .ncr-v2-top .ncr-rf-btn{width:44px;height:44px}
  .ncr-v2-tab{height:34px}
  .ncr-v2-avatar{width:34px;height:34px}
  .ncr-v2 [data-tour]{scroll-margin-top:72px}
}
`
addPropertyControls(ReportsDashboardV2, {
    supabaseUrl: {
        type: ControlType.String,
        title: "Supabase URL",
        defaultValue: "",
        placeholder: "https://xxxx.supabase.co",
        description: "Leave both fields empty to show sample data.",
    },
    supabaseKey: {
        type: ControlType.String,
        title: "Publishable Key",
        defaultValue: "",
        placeholder: "sb_publishable_…",
        description: "The publishable (anon) key only. Never the service role key.",
    },
    aboutPath: {
        type: ControlType.String,
        title: "About Path",
        defaultValue: "/sucher",
        description: 'Where the demo\'s "What is Sucher?" link goes.',
    },
    plansPath: {
        type: ControlType.String,
        title: "Plans Path",
        defaultValue: "/solutions",
        description: 'Where the demo\'s "See Business Suite plans" button goes. A page, never a #anchor.',
    },
    portalUrl: {
        type: ControlType.String,
        title: "Client Portal URL",
        defaultValue: PORTAL_URL,
        description: "My account's \"Open the client portal\" button. Match the site footer's Client Portal link.",
    },
    signInPath: {
        type: ControlType.String,
        title: "Sign-in Path",
        defaultValue: "/reports",
        description: "Also where Exit demo goes.",
    },
    demoMode: {
        type: ControlType.Boolean,
        title: "Demo Mode",
        defaultValue: false,
        description: "Public demo: sample data, guided tour, no Supabase requests.",
    },
    jagerPreview: {
        type: ControlType.Boolean,
        title: "Jager preview",
        defaultValue: false,
        description: "Own preview only: shows the Jager section with invented leads when the Supabase fields are empty. Keep off.",
        hidden: (p: any) => !!p.demoMode,
    },
    contactPath: {
        type: ControlType.String,
        title: "Contact Path",
        defaultValue: "/contact",
        hidden: (p: any) => !p.demoMode,
    },
})
