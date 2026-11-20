/**
 * Where the dashboard gets its rows.
 *
 * Demo mode (the default) builds invented data in the browser and makes no
 * network requests at all. Live mode reads from a Supabase (PostgREST) API
 * with plain fetch calls, no SDK. The browser only ever holds the publishable
 * key plus the signed-in user's token; row level security on the database
 * (db/schema.sql) decides which client's rows that user may read. There are
 * no write paths from the browser.
 */
import { buildDemo } from "./demo"
import type { DashboardData } from "./types"

export interface DataSource {
  mode: "demo" | "live"
  load(): Promise<DashboardData>
}

export const demoSource: DataSource = {
  mode: "demo",
  load: async () => buildDemo(),
}

export function liveSource(url: string, publishableKey: string, accessToken: string): DataSource {
  const base = url.replace(/\/+$/, "")

  async function get<T>(path: string): Promise<T> {
    const res = await fetch(`${base}/rest/v1/${path}`, {
      headers: {
        apikey: publishableKey,
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
    })
    // Fail loudly. An error must never render as an empty, normal-looking report.
    if (!res.ok) throw new Error(`Could not load ${path.split("?")[0]} (HTTP ${res.status}).`)
    return (await res.json()) as T
  }

  return {
    mode: "live",
    load: async () => {
      const [clients, sites, scores, traffic, uptime, ranks, recommendations, work] = await Promise.all([
        get<DashboardData["clients"]>("clients?select=id,name"),
        get<DashboardData["sites"]>("sites?select=id,client_id,domain,site_name"),
        get<DashboardData["scores"]>("monthly_scores?select=*&order=month.asc"),
        get<DashboardData["traffic"]>("monthly_traffic?select=*&order=month.asc"),
        get<DashboardData["uptime"]>("monthly_uptime?select=*&order=month.asc"),
        get<DashboardData["ranks"]>("monthly_ranks?select=*"),
        get<DashboardData["recommendations"]>("latest_recommendations?select=*&order=position.asc"),
        get<DashboardData["work"]>("work_log?select=*&order=done_on.desc&limit=200"),
      ])
      return { clients, sites, scores, traffic, uptime, ranks, recommendations, work }
    },
  }
}
