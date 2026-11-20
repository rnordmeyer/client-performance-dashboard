/**
 * Row shapes. They match the tables and views in db/schema.sql one to one, so
 * the dashboard reads demo data and live data through exactly the same code.
 */

export interface Client {
  id: string
  name: string
}

export interface Site {
  id: string
  client_id: string
  domain: string
  site_name: string
}

/** One audit per site per month (the monthly_scores view). Scores are 0 to 100. */
export interface MonthlyScore {
  site_id: string
  month: string // YYYY-MM-01
  overall: number
  seo: number
  performance: number
  accessibility: number
  best_practices: number
  security: number
  issues_count: number
  response_ms: number
}

export interface MonthlyTraffic {
  site_id: string
  month: string
  visits: number
  unique_visitors: number
  days_reported: number
}

export interface MonthlyUptime {
  site_id: string
  month: string
  uptime_pct: number
  avg_ms: number
  checks: number
}

export interface MonthlyRank {
  site_id: string
  month: string
  keyword: string
  best_position: number | null // null = not in the top 50
}

export type Pillar = "found" | "speed" | "trust"

/** One item in the plain-English action plan attached to the latest audit. */
export interface Recommendation {
  site_id: string
  month: string
  position: number
  pillar: Pillar
  kind: "fix" | "opportunity"
  severity: "high" | "medium" | "low"
  title: string
  why: string
  found: string
}

export interface WorkItem {
  id: string
  client_id: string
  done_on: string
  title: string
  detail: string
  category: "seo" | "design" | "security" | "content" | "maintenance"
}

export interface DashboardData {
  clients: Client[]
  sites: Site[]
  scores: MonthlyScore[]
  traffic: MonthlyTraffic[]
  uptime: MonthlyUptime[]
  ranks: MonthlyRank[]
  recommendations: Recommendation[]
  work: WorkItem[]
}
