export interface ClientRow {
    id: string
    slug: string
    name: string
}
export interface SiteRow {
    id: string
    client_id: string
    domain: string
    site_name: string | null
    platform: string | null
}
export interface ScoreRow {
    site_id: string
    month: string
    run_date: string
    overall: number | null
    grade: string | null
    seo: number | null
    performance: number | null
    accessibility: number | null
    best_practices: number | null
    onpage: number | null
    security: number | null
    security_grade: string | null
    issues_count: number | null
    response_ms: number | null
}
export interface TrafficRow {
    site_id: string
    month: string
    visits: number
    unique_visitors: number
    days_reported: number
}
export interface UptimeRow {
    site_id: string
    month: string
    uptime_pct: number | null
    avg_ms: number | null
    checks: number
    days_with_outage?: number | null
}
export interface RankRow {
    site_id: string
    month: string
    keyword: string
    best_position: number | null
    by_engine: Record<string, number | null>
}
export interface SnapshotRow {
    id: string
    site_id: string
    run_date: string
    incomplete: boolean
    security_in_control?: number | null
    host_managed?: number | null
    host_name?: string | null
}
export interface RecRow {
    snapshot_id: string
    position: number
    pillar: string
    kind: string
    sev: string | null
    title: string
    why: string | null
    found: string | null
}
export interface WorkRow {
    id: string
    client_id: string
    site_id: string | null
    done_on: string | null
    title: string
    detail: string | null
    category: string | null
    status?: "done" | "in_progress" | "up_next" | null
    due_on?: string | null
    created_at?: string | null
}
export interface CheckRow {
    site_id: string
    day: string
    up: boolean
    ms: number | null
    code: number | null
    checks?: number | null
    down_checks?: number | null
    uptime_pct?: number | null
    max_ms?: number | null
}
export interface PingRow {
    site_id: string
    checked_at: string
    up: boolean
    ms: number | null
    code: number | null
}
export interface PlanRow {
    id: string
    client_id: string
    name: string
    kind: "subscription" | "one_time"
    price: number
    billing: "month" | "year" | "once"
    starts_on: string | null
    ends_on: string | null
    discount_label: string | null
    discount_amount: number | null
    complimentary: boolean
    sort: number
    features?: string[] | null
}
export interface SiteMetaRow {
    id: string
    client_id: string
    domain: string
    platform: string | null
    launched_on: string | null
    domain_renews_on: string | null
    hosting_renews_on: string | null
}
export interface EventRow {
    id: string
    client_id: string
    kind: "report" | "check_in" | "strategy_call" | "other"
    title: string
    starts_on: string
}
export interface LoginRow {
    email: string
    last_sign_in_at: string | null
}
export interface DemoBundle {
    clients: ClientRow[]
    sites: SiteRow[]
    scores: ScoreRow[]
    traffic: TrafficRow[]
    uptime: UptimeRow[]
    ranks: RankRow[]
    snapshots: SnapshotRow[]
    recs: RecRow[]
    work: WorkRow[]
    checks: CheckRow[]
    pings: PingRow[]
    plans: PlanRow[]
    siteMeta: SiteMetaRow[]
    events: EventRow[]
    logins: LoginRow[]
}
const CLIENT = "demo-client-harbor-pine"
const SITE_A = "demo-site-bakery"
const SITE_B = "demo-site-catering"
function noise(seed: number) {
    const x = Math.sin(seed * 9301 + 49297) * 233280
    return x - Math.floor(x)
}
function pad(n: number) {
    return n < 10 ? `0${n}` : `${n}`
}
function iso(d: Date) {
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
function monthStart(y: number, m: number) {
    return new Date(y, m, 1)
}
function daysIn(y: number, m: number) {
    return new Date(y, m + 1, 0).getDate()
}
function grade(n: number) {
    return n >= 90 ? "A" : n >= 80 ? "B" : n >= 70 ? "C" : n >= 60 ? "D" : "F"
}
function clamp(n: number, lo = 0, hi = 100) {
    return Math.max(lo, Math.min(hi, Math.round(n)))
}
const KEYWORDS: [string, number | null, number][] = [
    ["artisan bakery", 18, 1.6],
    ["sourdough bread", 27, 2.2],
    ["custom birthday cakes", 41, 3.4],
    ["wedding cake bakery", null, 0],
    ["fresh croissants", 12, 0.9],
    ["gluten free bakery", 34, 1.1],
    ["bakery catering", 22, 2.0],
    ["morning pastries", 9, 0.6],
]
const ENGINES = ["google", "bing", "yahoo", "duckduckgo"]
const PLAN: Omit<RecRow, "snapshot_id" | "position">[] = [
    {
        pillar: "speed",
        kind: "fix",
        sev: "medium",
        title: "Compress the menu photos",
        why: "Large photos are the main reason the menu page is slow on phones, and slow pages lose visitors before they load.",
        found: "The menu page loads 3.8 MB of images.",
    },
    {
        pillar: "speed",
        kind: "opportunity",
        sev: "low",
        title: "Load the map only when it is needed",
        why: "The embedded map loads on every visit even though most visitors never scroll to it.",
        found: "The contact page map adds 0.9 seconds on a phone connection.",
    },
    {
        pillar: "found",
        kind: "fix",
        sev: "high",
        title: "Give each page its own title",
        why: "Search engines use the page title to decide what a page is about. When several pages share one, they compete with each other and none of them ranks well.",
        found: '4 pages share the title "Harbor & Pine Bakery".',
    },
    {
        pillar: "found",
        kind: "opportunity",
        sev: "medium",
        title: "Add a page for custom cakes",
        why: "People search for custom cakes on their own. A page that answers that one question can rank for it; a paragraph on the menu page cannot.",
        found: '"custom birthday cakes" is searched often and no page targets it.',
    },
    {
        pillar: "trust",
        kind: "fix",
        sev: "high",
        title: "Add a security header that blocks clickjacking",
        why: "It stops other sites from loading this one inside a hidden frame to trick visitors into clicking.",
        found: "The X-Frame-Options header is missing.",
    },
    {
        pillar: "trust",
        kind: "opportunity",
        sev: "low",
        title: "Show opening hours in the footer",
        why: "Visitors look for hours first. Matching them to the Google listing also builds trust with search engines.",
        found: "Hours appear only on the contact page.",
    },
]
const PRE_PLAN: (Omit<RecRow, "snapshot_id" | "position"> & {
    until: number
})[] = [
    {
        pillar: "trust",
        kind: "fix",
        sev: "high",
        title: "Send every visitor to the secure address",
        why: "Pages that load without HTTPS show a warning in some browsers and can be tampered with on the way.",
        found: "Two pages still load without HTTPS.",
        until: -9,
    },
    {
        pillar: "speed",
        kind: "fix",
        sev: "medium",
        title: "Serve photos in a modern format",
        why: "Modern image formats are a fraction of the size, so pages appear sooner on a phone.",
        found: "Every photo is a full size JPEG.",
        until: -5,
    },
    {
        pillar: "found",
        kind: "fix",
        sev: "medium",
        title: "Describe every photo for people using screen readers",
        why: "A short description lets everyone know what a photo shows, and search engines read it too.",
        found: "11 photos have no description.",
        until: -2,
    },
    {
        pillar: "found",
        kind: "opportunity",
        sev: "low",
        title: "Add a description to the home page",
        why: "The description is the short summary search engines show under the page title.",
        found: "The home page has no description.",
        until: 0,
    },
]
const WORK: [string, string, string][] = [
    [
        "seo",
        "Rewrote page titles and descriptions",
        "Every page now has its own title and description written for the searches customers actually make.",
    ],
    [
        "design",
        "Refreshed the menu page layout",
        "Prices and allergens are easier to scan on a phone, and the order button stays in reach.",
    ],
    ["security", "Added modern security headers", "The site now tells browsers to block framing and insecure requests."],
    ["maintenance", "Monthly care check", "Checked forms, links and backups. Everything working as expected."],
    ["content", "Published the holiday ordering page", "One page with order deadlines, pickup times and the seasonal menu."],
    ["seo", "Updated the Google Business Profile", "New photos, holiday hours and the catering service listed."],
    ["design", "Compressed and resized every photo", "Images now load in modern formats at the size they are shown."],
    ["content", "Added a gluten free section", "A clear list of what is gluten free and how it is prepared."],
    ["maintenance", "Renewed the domain for two years", "Renewed early so the address cannot lapse. Auto-renew is on."],
    ["seo", "Fixed three broken links", "Two old menu links and a dead social link now go to the right pages."],
    ["design", "Added a photo gallery of the shop", "Real photos of the counter, the ovens and the morning bake."],
    ["security", "Turned on two-step sign-in for the site editor", "Editor access now needs a code from a phone as well as a password."],
    ["content", "Wrote the catering enquiry page", "Menus, minimum orders, lead times and how to ask for a quote, all on one page."],
    ["seo", "Added structured data for opening hours", "Search engines can now read the hours straight from the site."],
    ["maintenance", "Tested the order form on four phones", "Every test order arrived. One label was fixed for screen readers."],
    ["design", "Made the header easier to use on phones", "The menu and the order button now fit on the smallest screens."],
    ["content", "Updated the seasonal menu", "Autumn pastries added and summer items retired."],
    ["seo", "Linked the catering page from the home page", "Helps visitors and search engines find catering from the front door."],
    ["maintenance", "Monthly care check", "Checked forms, links, backups and speed. Response time improved again."],
    ["security", "Removed an unused plugin", "Less code on the site means fewer things that can go wrong."],
    ["content", "Added staff introductions to the about page", "Short bios for the four bakers, with their own photos."],
    ["design", "Improved colour contrast on buttons", "Button text now meets the WCAG 2.1 AA contrast level in both themes."],
    ["seo", "Submitted the updated sitemap", "Search engines were told about the new pages the same day."],
    ["maintenance", "Monthly care check", "Checked forms, links and backups. One expired coupon banner removed."],
]
export function buildDemo(now: Date = new Date()): DemoBundle {
    const anchor = now.getDate() >= 3 ? monthStart(now.getFullYear(), now.getMonth()) : monthStart(now.getFullYear(), now.getMonth() - 1)
    const HISTORY = 20
    const RECENT = 8
    const months: Date[] = []
    for (let i = HISTORY - 1; i >= 0; i--) months.push(monthStart(anchor.getFullYear(), anchor.getMonth() - i))
    const clients: ClientRow[] = [{ id: CLIENT, slug: "harbor-and-pine", name: "Harbor & Pine Bakery" }]
    const sites: SiteRow[] = [
        { id: SITE_A, client_id: CLIENT, domain: "harborandpine.example", site_name: "Harbor & Pine Bakery", platform: "framer" },
        {
            id: SITE_B,
            client_id: CLIENT,
            domain: "catering.harborandpine.example",
            site_name: "Harbor & Pine Catering",
            platform: "framer",
        },
    ]
    const scores: ScoreRow[] = []
    const traffic: TrafficRow[] = []
    const uptime: UptimeRow[] = []
    const ranks: RankRow[] = []
    const snapshots: SnapshotRow[] = []
    const recs: RecRow[] = []
    const work: WorkRow[] = []
    const checks: CheckRow[] = []
    const pings: PingRow[] = []
    const isCurrentMonth = (d: Date) => d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
    const addSite = (siteId: string, list: Date[], base: number, scale: number, offset = 0) => {
        list.forEach((m, i) => {
            const y = m.getFullYear()
            const mo = m.getMonth()
            const month = iso(m)
            const runDay = new Date(y, mo, 2)
            const run = iso(runDay)
            const r = i - offset
            const t = r + base
            const n = (k: number) => noise(t * 13 + k + scale)
            const latestA = siteId === SITE_A && i === list.length - 1
            const PRE = [70, 52, 74, 78, 58, 62]
            const START = [84, 64, 86, 86, 74, 76]
            const SEPT = [98, 78, 96, 94, 91, 88]
            const OCT = [100, 82, 98, 96, 95, 90]
            let sub: number[]
            if (siteId === SITE_A && r < 0) {
                const f = (r + offset) / Math.max(1, offset)
                sub = PRE.map((v, k) => clamp(v + (START[k] - v) * f + (r > -offset ? (n(k + 1) - 0.5) * 2 : 0)))
            } else if (siteId === SITE_A) {
                const steps = RECENT - 2
                const f = Math.min(1, r / Math.max(1, steps))
                sub = latestA ? OCT : START.map((v, k) => clamp(v + (SEPT[k] - v) * f + (r > 0 && r < steps ? (n(k + 1) - 0.5) * 2 : 0)))
            } else {
                sub = [
                    clamp(80 + n(1) * 6),
                    clamp(70 + n(2) * 6),
                    clamp(90 + n(3) * 4),
                    clamp(88 + n(4) * 4),
                    clamp(82 + n(5) * 6),
                    clamp(84 + n(6) * 4),
                ]
            }
            const [seo, performance, accessibility, best, onpage, security] = sub
            const overall = clamp(seo * 0.22 + performance * 0.13 + accessibility * 0.1 + best * 0.1 + onpage * 0.2 + security * 0.25)
            const responseMs = Math.round(520 - t * (t < 0 ? 20 : 34) + n(7) * 40)
            scores.push({
                site_id: siteId,
                month,
                run_date: run,
                overall,
                grade: grade(overall),
                seo,
                performance,
                accessibility,
                best_practices: best,
                onpage,
                security,
                security_grade: grade(security),
                issues_count: Math.max(3, 31 - t * (t < 0 ? 2 : 3) + Math.round(n(8) * 3)),
                response_ms: responseMs,
            })
            const total = daysIn(y, mo)
            const reported = isCurrentMonth(m) ? Math.max(1, now.getDate() - 1) : total
            const dailyVisits = ((t < 0 ? Math.max(8, 38 + t * 2.2) : 38 + t * 6.5) + n(9) * 6) * scale
            const visits = Math.round(dailyVisits * reported)
            traffic.push({
                site_id: siteId,
                month,
                visits,
                unique_visitors: Math.round(visits * (0.68 + n(10) * 0.06)),
                days_reported: reported,
            })
            const PER_DAY = 288
            let totalChecks = 0
            let missed = 0
            let msSum = 0
            let outageDays = 0
            for (let d = 1; d <= reported; d++) {
                const latestBlip = i === list.length - 1 && reported >= 2 && d === Math.min(2, reported - 1)
                const oldOutage = r === 2 && d === 14
                const firstYearOutage = r === -7 && d === 20
                const down = siteId === SITE_A ? (oldOutage ? 30 : firstYearOutage ? 18 : latestBlip ? 12 : 0) : 0
                const ms = Math.round(responseMs * (0.82 + noise(t * 97 + d) * 0.4))
                const maxMs = Math.round(ms * (1.9 + noise(t * 53 + d) * 0.8))
                totalChecks += PER_DAY
                missed += down
                msSum += ms
                if (down) outageDays++
                checks.push({
                    site_id: siteId,
                    day: iso(new Date(y, mo, d)),
                    up: down === 0,
                    ms,
                    code: 200,
                    checks: PER_DAY,
                    down_checks: down,
                    uptime_pct: Math.round((1000 * (PER_DAY - down)) / PER_DAY) / 10,
                    max_ms: maxMs,
                })
            }
            uptime.push({
                site_id: siteId,
                month,
                uptime_pct: Math.round((1000 * (totalChecks - missed)) / totalChecks) / 10,
                avg_ms: Math.round(msSum / reported),
                checks: totalChecks,
                days_with_outage: outageDays,
            })
            if (i === list.length - 1) {
                pings.push({
                    site_id: siteId,
                    checked_at: new Date(now.getTime() - 3 * 60000).toISOString(),
                    up: true,
                    ms: Math.round(responseMs * 0.9),
                    code: 200,
                })
            }
            KEYWORDS.forEach(([keyword, start, gain], k) => {
                let best: number | null = null
                if (start !== null) best = Math.max(1, Math.round(start - gain * t + (noise(t * 31 + k) - 0.5) * 2))
                if (best !== null && best > 50) best = null
                if (keyword === "wedding cake bakery" && t >= 6) best = 38 - (t - 6) * 4
                if (keyword === "sourdough bread" && siteId === SITE_A && i === list.length - 2) best = 13
                if (keyword === "sourdough bread" && siteId === SITE_A && i === list.length - 1) best = 9
                const by: Record<string, number | null> = {}
                ENGINES.forEach((e, j) => {
                    by[e] = best === null ? null : j === 0 ? best : best + Math.round(noise(t * 7 + k * 3 + j) * 4)
                })
                if (best !== null && best > 30) by.yahoo = null
                ranks.push({ site_id: siteId, month, keyword, best_position: best, by_engine: by })
            })
            const snapId = `demo-snap-${siteId}-${month}`
            snapshots.push({
                id: snapId,
                site_id: siteId,
                run_date: run,
                incomplete: false,
                ...(latestA ? { security_in_control: 100, host_managed: 4, host_name: "Framer" } : {}),
            })
            const DONE = ["Give each page its own title", "Add a security header that blocks clickjacking"]
            const done = DONE.slice(0, Math.max(0, Math.min(2, Math.floor(t / 3))))
            const early = siteId === SITE_A ? PRE_PLAN.filter((x) => r < x.until).map(({ until, ...x }) => x) : []
            ;[...early, ...PLAN.filter((x) => !done.includes(x.title))].forEach((x, p) =>
                recs.push({ ...x, snapshot_id: snapId, position: p + 1 }),
            )
            if (siteId === SITE_A) {
                const count = r < 0 ? 1 + Math.round(n(11)) : 2 + Math.round(n(11) * 2)
                for (let w = 0; w < count; w++) {
                    const [category, title, detail] = WORK[(((r * 3 + w) % WORK.length) + WORK.length) % WORK.length]
                    const day = Math.min(daysIn(y, mo), 4 + w * 8 + Math.round(n(12 + w) * 4))
                    const when = new Date(y, mo, day)
                    if (when > now) continue
                    work.push({
                        id: `demo-work-${month}-${w}`,
                        client_id: CLIENT,
                        site_id: siteId,
                        done_on: iso(when),
                        title,
                        detail,
                        category,
                    })
                }
            }
        })
    }
    addSite(SITE_A, months, 0, 1, HISTORY - RECENT)
    addSite(SITE_B, [anchor], 0, 0.35)
    const today = now.getDate()
    const thisMonth = (d: number) => iso(new Date(now.getFullYear(), now.getMonth(), Math.min(d, today)))
    const inDays = (d: number) => iso(new Date(now.getFullYear(), now.getMonth(), today + d))
    work.push({
        id: "demo-open-cakes",
        client_id: CLIENT,
        site_id: SITE_A,
        done_on: null,
        status: "in_progress",
        due_on: null,
        created_at: thisMonth(2),
        title: "Adding a custom cakes page",
        detail: "A page for celebration cakes, with photos and how to order.",
        category: "design",
    })
    work.push({
        id: "demo-open-holiday",
        client_id: CLIENT,
        site_id: SITE_A,
        done_on: null,
        status: "up_next",
        due_on: inDays(14),
        created_at: thisMonth(today),
        title: "Talk through holiday hours on the site",
        detail: "You asked how to show holiday hours. We will go through the options together.",
        category: null,
    })
    work.push({
        id: "demo-open-photos",
        client_id: CLIENT,
        site_id: SITE_A,
        done_on: null,
        status: "up_next",
        due_on: null,
        created_at: iso(new Date(now.getFullYear(), now.getMonth() - 1, 18)),
        title: "Refresh the menu photos",
        detail: "New photos of the seasonal menu, ready for the menu page.",
        category: "design",
    })
    work.push({
        id: "demo-work-catering-launch",
        client_id: CLIENT,
        site_id: SITE_B,
        done_on: iso(new Date(anchor.getFullYear(), anchor.getMonth(), 2)),
        title: "Launched the catering site",
        detail: "Built, tested and published. The first full report arrives next month.",
        category: "design",
    })
    const launch = new Date(months[0].getFullYear(), months[0].getMonth() - 1, 9)
    const planStart = launch
    const plans: PlanRow[] = [
        {
            id: "demo-plan-grundwerk",
            client_id: CLIENT,
            name: "Grundwerk Business Suite",
            kind: "subscription",
            price: 0,
            billing: "month",
            starts_on: iso(planStart),
            ends_on: null,
            discount_label: null,
            discount_amount: null,
            complimentary: false,
            sort: 0,
            features: [
                "Custom 6 to 8 page website",
                "Brand identity: logo, palette and fonts",
                "Basic SEO setup",
                "Basic analytics",
                "Google Business Profile setup",
                "Quarterly check-ins",
            ],
        },
    ]
    const siteMeta: SiteMetaRow[] = [
        {
            id: SITE_A,
            client_id: CLIENT,
            domain: "harborandpine.example",
            platform: "framer",
            launched_on: iso(launch),
            domain_renews_on: iso(new Date(anchor.getFullYear() + 1, launch.getMonth(), 9)),
            hosting_renews_on: null,
        },
    ]
    const events: EventRow[] = [
        {
            id: "demo-ev-report",
            client_id: CLIENT,
            kind: "report",
            title: "Your monthly report",
            starts_on: iso(new Date(anchor.getFullYear(), anchor.getMonth() + 1, 1)),
        },
        {
            id: "demo-ev-checkin",
            client_id: CLIENT,
            kind: "check_in",
            title: "Quarterly check-in",
            starts_on: iso(new Date(anchor.getFullYear(), anchor.getMonth() + 2, 10)),
        },
    ]
    const logins: LoginRow[] = [
        { email: "manager@harborandpine.example", last_sign_in_at: new Date(now.getTime() - 9 * 86400000).toISOString() },
        { email: "owner@harborandpine.example", last_sign_in_at: new Date(now.getTime() - 2 * 3600000).toISOString() },
    ]
    return { clients, sites, scores, traffic, uptime, ranks, snapshots, recs, work, checks, pings, plans, siteMeta, events, logins }
}
export default function ReportsDemoData() {
    return null
}
