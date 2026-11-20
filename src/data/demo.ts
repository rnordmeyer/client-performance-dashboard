/**
 * Demo data. Every name, number and sentence here is invented.
 * "Lakeshore Coffee Roasters" is not a real business, and .example domains
 * cannot exist. Dates are relative to today, so the demo never goes stale.
 *
 * The overall score is a plain average of the five category scores. A real
 * deployment can weight categories however it likes; the dashboard only
 * displays the stored number.
 */
import type {
  DashboardData,
  MonthlyRank,
  MonthlyScore,
  MonthlyTraffic,
  MonthlyUptime,
  Recommendation,
  WorkItem,
} from "./types"

const CLIENT = "client-lakeshore"
const SITE = "site-lakeshore"
const MONTHS = 12

/** Deterministic pseudo-random noise so the demo looks the same on every load. */
function noise(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 233280
  return x - Math.floor(x)
}

const pad = (n: number) => String(n).padStart(2, "0")
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

const KEYWORDS: [string, number | null, number][] = [
  // keyword, starting position (null = not in the top 50), monthly gain
  ["coffee roaster near me", 24, 1.7],
  ["single origin coffee beans", 31, 2.1],
  ["coffee subscription", 46, 3.0],
  ["wholesale coffee for cafes", null, 0],
  ["cold brew concentrate", 15, 0.8],
  ["espresso beans", 19, 1.2],
]

const PLAN: Omit<Recommendation, "site_id" | "month" | "position">[] = [
  {
    pillar: "speed", kind: "fix", severity: "medium",
    title: "Compress the shop photos",
    why: "Large photos are the main reason the shop page is slow on phones, and slow pages lose visitors before they finish loading.",
    found: "The shop page loads 4.1 MB of images.",
  },
  {
    pillar: "found", kind: "fix", severity: "high",
    title: "Give each product page its own title",
    why: "Search engines use the page title to decide what a page is about. Pages that share one compete with each other.",
    found: "5 product pages share the title “Shop”.",
  },
  {
    pillar: "found", kind: "opportunity", severity: "medium",
    title: "Add a page for wholesale accounts",
    why: "Cafes search for wholesale roasters on their own. A page that answers that one question can rank for it.",
    found: "“wholesale coffee for cafes” has steady searches and no page targets it.",
  },
  {
    pillar: "trust", kind: "fix", severity: "high",
    title: "Add a header that blocks clickjacking",
    why: "It stops other sites from loading this one inside a hidden frame to trick visitors into clicking.",
    found: "The X-Frame-Options header is missing.",
  },
  {
    pillar: "trust", kind: "opportunity", severity: "low",
    title: "Show roasting days and pickup hours in the footer",
    why: "Visitors look for hours first, and matching them to the business listing builds trust with search engines.",
    found: "Hours appear only on the contact page.",
  },
]

const WORK: [WorkItem["category"], string, string][] = [
  ["seo", "Rewrote page titles and descriptions", "Every page now has a title written for the searches customers actually make."],
  ["design", "Simplified the checkout on phones", "Fewer steps, larger buttons, and the order summary stays visible."],
  ["security", "Added modern security headers", "Browsers are now told to block framing and insecure requests."],
  ["maintenance", "Monthly care check", "Checked forms, links and backups. Everything working as expected."],
  ["content", "Published the brewing guides", "Short guides for pour-over, French press and cold brew."],
  ["seo", "Updated the business listing", "New photos, holiday hours and the wholesale service listed."],
  ["design", "Resized every product photo", "Images now load in modern formats at the size they are shown."],
  ["content", "Added origin stories to each coffee", "Farm, region and tasting notes on every product page."],
  ["maintenance", "Tested the order form on four phones", "Every test order arrived. One label was fixed for screen readers."],
  ["design", "Improved button contrast", "Button text now meets WCAG 2.1 AA contrast in both themes."],
]

export function buildDemo(now: Date = new Date()): DashboardData {
  const scores: MonthlyScore[] = []
  const traffic: MonthlyTraffic[] = []
  const uptime: MonthlyUptime[] = []
  const ranks: MonthlyRank[] = []
  const recommendations: Recommendation[] = []
  const work: WorkItem[] = []

  for (let i = 0; i < MONTHS; i++) {
    const first = new Date(now.getFullYear(), now.getMonth() - (MONTHS - 1 - i), 1)
    const month = iso(first)
    const t = i / (MONTHS - 1) // 0 at the first month, 1 at the latest
    const n = (k: number) => noise(i * 17 + k)
    const isLatest = i === MONTHS - 1

    // Each category climbs from a weak start toward a strong finish.
    const seo = clamp(66 + 30 * t + (n(1) - 0.5) * 3)
    const performance = clamp(52 + 28 * t + (n(2) - 0.5) * 4)
    const accessibility = clamp(71 + 26 * t + (n(3) - 0.5) * 2)
    const best_practices = clamp(74 + 21 * t + (n(4) - 0.5) * 2)
    const security = clamp(60 + 30 * t + (n(5) - 0.5) * 3)
    const overall = clamp((seo + performance + accessibility + best_practices + security) / 5)

    scores.push({
      site_id: SITE, month, overall, seo, performance, accessibility, best_practices, security,
      issues_count: Math.max(4, Math.round(34 - 28 * t + n(6) * 3)),
      response_ms: Math.round(640 - 330 * t + n(7) * 40),
    })

    const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
    const daysReported = isLatest ? Math.max(1, now.getDate() - 1) : daysInMonth
    const visits = Math.round((42 + 70 * t + n(8) * 8) * daysReported)
    traffic.push({
      site_id: SITE, month, visits,
      unique_visitors: Math.round(visits * (0.66 + n(9) * 0.06)),
      days_reported: daysReported,
    })

    // Checks every 5 minutes. One invented outage, months ago.
    const checks = daysReported * 288
    const missed = i === 3 ? 30 : isLatest ? 0 : Math.round(n(10) * 3)
    uptime.push({
      site_id: SITE, month,
      uptime_pct: Math.round((1000 * (checks - missed)) / checks) / 10,
      avg_ms: Math.round(600 - 300 * t + n(11) * 30),
      checks,
    })

    KEYWORDS.forEach(([keyword, start, gain], k) => {
      let best: number | null = start === null ? null : Math.round(start - gain * i + (noise(i * 31 + k) - 0.5) * 2)
      if (keyword === "wholesale coffee for cafes" && i >= 7) best = 41 - (i - 7) * 5
      if (best !== null) best = best > 50 ? null : Math.max(1, best)
      ranks.push({ site_id: SITE, month, keyword, best_position: best })
    })

    if (isLatest) {
      PLAN.forEach((item, p) => recommendations.push({ ...item, site_id: SITE, month, position: p + 1 }))
    }

    const count = 2 + Math.round(n(12))
    for (let w = 0; w < count; w++) {
      const [category, title, detail] = WORK[(i * 3 + w) % WORK.length]
      const when = new Date(first.getFullYear(), first.getMonth(), Math.min(daysInMonth, 5 + w * 9))
      if (when > now) continue
      work.push({ id: `work-${month}-${w}`, client_id: CLIENT, done_on: iso(when), title, detail, category })
    }
  }

  return {
    clients: [{ id: CLIENT, name: "Lakeshore Coffee Roasters" }],
    sites: [{ id: SITE, client_id: CLIENT, domain: "lakeshorecoffee.example", site_name: "Lakeshore Coffee Roasters" }],
    scores, traffic, uptime, ranks, recommendations, work,
  }
}
