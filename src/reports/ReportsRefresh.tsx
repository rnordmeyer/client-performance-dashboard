import * as React from "react"
import { useCallback, useEffect, useRef, useState } from "react"
export interface RefreshRow {
    id: string
    site_id: string
    status: "pending" | "running" | "done" | "failed"
    requested_at?: string
    started_at?: string | null
    finished_at?: string | null
    message?: string | null
}
export interface RefreshOptions {
    demo: boolean
    staff: boolean
    reload: () => Promise<void>
    siteIds: () => string[]
    request: (sid: string) => Promise<RefreshRow>
    poll: (ids: string[]) => Promise<RefreshRow[]>
    audience?: "staff" | "client"
}
export interface RefreshStatus {
    text: string
    tone: "info" | "ok" | "bad"
    detail?: string
}
const POLL_MS = 5000
const GIVE_UP_MS = 10 * 60 * 1000
const MIN_SPIN_MS = 650
function sleep(ms: number) {
    return new Promise<void>((r) => setTimeout(r, ms))
}
export function updatedLabel(at: number | null, now: number): string {
    if (at == null) return ""
    const mins = Math.floor(Math.max(0, now - at) / 60000)
    if (mins < 1) return "Updated just now"
    if (mins < 60) return "Updated " + mins + " min ago"
    const hrs = Math.floor(mins / 60)
    return "Updated " + hrs + (hrs === 1 ? " hour ago" : " hours ago")
}
export function useDashboardRefresh(opts: RefreshOptions) {
    const o = useRef(opts)
    o.current = opts
    const alive = useRef(true)
    const [busy, setBusy] = useState(false)
    const [updatedAt, setUpdatedAt] = useState<number | null>(null)
    const [now, setNow] = useState(0)
    const [status, setStatus] = useState<RefreshStatus | null>(null)
    const [announce, setAnnounce] = useState("")
    const inflight = useRef<Promise<boolean> | null>(null)
    const poll = useRef<{
        ids: string[]
        started: number
        timer: number
    } | null>(null)
    const hideTimer = useRef(0)
    const stopPoll = () => {
        if (poll.current) window.clearTimeout(poll.current.timer)
        poll.current = null
    }
    useEffect(() => {
        alive.current = true
        return () => {
            alive.current = false
            stopPoll()
            window.clearTimeout(hideTimer.current)
        }
    }, [])
    useEffect(() => {
        if (updatedAt == null) return
        setNow(Date.now())
        const t = window.setInterval(() => setNow(Date.now()), 30000)
        return () => window.clearInterval(t)
    }, [updatedAt])
    const show = (s: RefreshStatus | null, hideAfter = 0) => {
        if (!alive.current) return
        window.clearTimeout(hideTimer.current)
        setStatus(s)
        if (s) setAnnounce(s.detail ? s.text + ". " + s.detail : s.text)
        if (s && hideAfter) hideTimer.current = window.setTimeout(() => alive.current && setStatus(null), hideAfter)
    }
    const markLoaded = useCallback(() => {
        setUpdatedAt(Date.now())
    }, [])
    const reloadOnce = (): Promise<boolean> => {
        if (inflight.current) return inflight.current
        const started = Date.now()
        setBusy(true)
        const p = (async () => {
            let ok = true
            try {
                await o.current.reload()
            } catch (e) {
                ok = false
                console.warn("[Refresh] reload failed", e)
            }
            const wait = MIN_SPIN_MS - (Date.now() - started)
            if (wait > 0) await sleep(wait)
            inflight.current = null
            if (alive.current) {
                setBusy(false)
                if (ok) setUpdatedAt(Date.now())
            }
            return ok
        })()
        inflight.current = p
        return p
    }
    const schedule = () => {
        const cur = poll.current
        if (cur) cur.timer = window.setTimeout(tick, POLL_MS)
    }
    const tick = async () => {
        const cur = poll.current
        if (!cur || !alive.current) return
        const client = o.current.audience === "client"
        if (Date.now() - cur.started > GIVE_UP_MS) {
            stopPoll()
            show(
                client
                    ? {
                          tone: "bad",
                          text: "The fresh pull is taking longer than usual",
                          detail: "The numbers on screen are the latest we have. Please try again later.",
                      }
                    : {
                          tone: "bad",
                          text: "Fresh pull not picked up",
                          detail: "The Mac helper did not pick this up within 10 minutes. The Mac may be asleep or offline.",
                      },
            )
            return
        }
        let rows: RefreshRow[] = []
        try {
            rows = (await o.current.poll(cur.ids)) || []
        } catch (e) {
            console.warn("[Refresh] could not read refresh_requests; will try again", e)
            if (poll.current === cur) schedule()
            return
        }
        if (poll.current !== cur) return
        const open = rows.filter((r) => r.status === "pending" || r.status === "running")
        if (!rows.length || open.length) {
            const running = open.some((r) => r.status === "running")
            show({
                tone: "info",
                text: client
                    ? "Pulling fresh numbers…"
                    : running
                      ? "Pulling fresh traffic…"
                      : "Fresh pull queued, waiting for the Mac helper…",
            })
            schedule()
            return
        }
        stopPoll()
        const failed = rows.filter((r) => r.status === "failed")
        if (rows.some((r) => r.status === "done")) {
            show({ tone: "info", text: "Loading the fresh data…" })
            await reloadOnce()
        }
        if (failed.length) {
            const msgs = failed.map((r) => (r.message || "").trim()).filter(Boolean)
            show(
                client
                    ? {
                          tone: "bad",
                          text: "The fresh pull did not finish",
                          detail: "The numbers on screen are the latest we have. Please try again later.",
                      }
                    : { tone: "bad", text: "Fresh pull failed", detail: msgs.length ? msgs.join("; ") : "The helper gave no reason." },
            )
        } else {
            show({ tone: "ok", text: "Fresh data pulled" }, 8000)
        }
    }
    const refresh = useCallback(async () => {
        const { demo, staff } = o.current
        const queued = { on: false }
        let limited = false
        const reload = reloadOnce()
        if (staff && !demo) {
            const ids = Array.from(new Set(o.current.siteIds().filter(Boolean)))
            if (ids.length) {
                try {
                    const rows = await Promise.all(ids.map((id) => o.current.request(id)))
                    const reqIds = rows.map((r) => (r && r.id) || "").filter(Boolean)
                    if (reqIds.length) {
                        stopPoll()
                        poll.current = { ids: reqIds, started: Date.now(), timer: 0 }
                        queued.on = true
                        show({
                            tone: "info",
                            text:
                                o.current.audience === "client"
                                    ? "Pulling fresh numbers…"
                                    : "Fresh pull queued, waiting for the Mac helper…",
                        })
                        schedule()
                    }
                } catch (e: any) {
                    limited = /per hour/i.test(String((e && e.message) || ""))
                    if (!limited) console.warn("[Refresh] request_refresh failed; doing a plain reload only.", e)
                }
            }
        }
        if (!queued.on) show({ tone: "info", text: "Refreshing…" })
        const ok = await reload
        if (queued.on || poll.current) return
        if (ok && limited)
            show({ tone: "info", text: "Updated just now", detail: "One fresh pull per hour. The latest numbers were reloaded." }, 8000)
        else if (ok) show({ tone: "ok", text: "Updated just now" }, 4000)
        else show({ tone: "bad", text: "Refresh did not finish", detail: "Please try again in a moment." }, 10000)
    }, [])
    return { busy, updatedAt, updatedText: updatedLabel(updatedAt, now || Date.now()), status, announce, refresh, markLoaded }
}
export type DashboardRefresh = ReturnType<typeof useDashboardRefresh>
function RefreshGlyph() {
    return (
        <svg
            width={20}
            height={20}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.75}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            focusable="false"
        >
            <path d="M19.5 10.5A7.75 7.75 0 0 0 6 6.3L4.5 7.8" />
            <path d="M4.5 3.8v4h4" />
            <path d="M4.5 13.5A7.75 7.75 0 0 0 18 17.7l1.5-1.5" />
            <path d="M19.5 20.2v-4h-4" />
        </svg>
    )
}
export function RefreshControl({ rf, variant = "v2", note }: { rf: DashboardRefresh; variant?: "v1" | "v2"; note?: string }) {
    const when = (rf.busy ? "Refreshing…" : rf.updatedText || "Reload the latest numbers") + (note ? ". " + note : "")
    const s = rf.status
    return (
        <div className={"ncr-rf ncr-rf-" + variant + (s ? " has-note" : "")}>
            <button
                type="button"
                className={"ncr-rf-btn" + (rf.busy ? " is-busy" : "")}
                aria-label="Refresh data"
                aria-describedby="ncr-rf-when"
                aria-busy={rf.busy}
                onClick={() => void rf.refresh()}
            >
                <RefreshGlyph />
            </button>
            <span className="ncr-rf-tip" role="tooltip">
                <span className="ncr-rf-tip-t" aria-hidden="true">
                    Refresh data
                </span>
                <span id="ncr-rf-when">{when}</span>
            </span>
            {s ? (
                <div className={"ncr-rf-note is-" + s.tone}>
                    <strong>{s.text}</strong>
                    {s.detail ? <span>{s.detail}</span> : null}
                </div>
            ) : null}
            <span className="ncr-sr" role="status" aria-live="polite">
                {rf.announce}
            </span>
        </div>
    )
}
export const REFRESH_CSS = [
    ".ncr-rf{position:relative;display:inline-flex;flex:none}",
    ".ncr-rf-btn{display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;padding:0;border:0;border-radius:999px;background:var(--ncr-surface);color:var(--ncr-ink);cursor:pointer;box-shadow:var(--ncr-v2-pill-shadow,none);transition:background-color 180ms ease,color 180ms ease,transform 100ms ease-out;-webkit-tap-highlight-color:transparent}",
    ".ncr-rf-v1 .ncr-rf-btn{width:44px;height:44px;box-shadow:inset 0 0 0 1px var(--ncr-border)}",
    ".ncr-rf-btn:hover{background:var(--ncr-surface-2)}",
    ".ncr-rf-btn:active{transform:scale(0.94)}",
    ".ncr-rf-btn svg{display:block}",
    ".ncr-rf-btn.is-busy{color:var(--ncr-accent-text)}",
    ".ncr-rf-btn.is-busy svg{animation:ncr-rf-spin 900ms linear infinite}",
    "@keyframes ncr-rf-spin{to{transform:rotate(360deg)}}",
    ".ncr-rf-tip{position:absolute;top:calc(100% + 8px);right:0;z-index:9;display:flex;flex-direction:column;gap:1px;white-space:nowrap;padding:8px 11px;border-radius:10px;background:var(--ncr-ink);color:var(--ncr-bg);font-size:12.5px;line-height:1.3;opacity:0;visibility:hidden;transform:translateY(-3px);pointer-events:none;transition:opacity 160ms ease,transform 160ms ease,visibility 0s linear 160ms}",
    ".ncr-rf-tip-t{font-weight:600}",
    ".ncr-rf-btn:hover+.ncr-rf-tip,.ncr-rf-btn:focus-visible+.ncr-rf-tip{opacity:1;visibility:visible;transform:none;transition:opacity 160ms ease,transform 160ms ease}",
    ".ncr-rf.has-note .ncr-rf-tip{opacity:0;visibility:hidden}",
    ".ncr-rf-note{position:absolute;top:calc(100% + 8px);right:0;z-index:9;display:flex;flex-direction:column;gap:2px;width:max-content;max-width:300px;padding:10px 14px;border-radius:14px;background:var(--ncr-surface);color:var(--ncr-ink);box-shadow:var(--ncr-shadow),inset 0 0 0 1px var(--ncr-border);font-size:13px;line-height:1.35;text-align:left}",
    ".ncr-rf-note strong{font-weight:600}",
    ".ncr-rf-note span{color:var(--ncr-body);overflow-wrap:anywhere}",
    ".ncr-rf-note.is-bad strong{color:var(--ncr-bad)}",
    ".ncr-rf-v1 .ncr-rf-note{right:auto;left:0}",
    "@media (max-width: 1023.98px), (hover: none) and (pointer: coarse){.ncr-rf-v2 .ncr-rf-btn{width:48px;height:48px}.ncr-rf-tip{display:none}}",
    "@media (max-width: 599.98px){.ncr-rf-note,.ncr-rf-v1 .ncr-rf-note{position:fixed;top:auto;left:calc(16px + env(safe-area-inset-left));right:calc(96px + env(safe-area-inset-right));bottom:calc(20px + env(safe-area-inset-bottom));width:auto;max-width:none}}",
    "@media (prefers-reduced-motion: reduce){.ncr-rf-btn.is-busy svg{animation:none}.ncr-rf-btn,.ncr-rf-tip{transition:none}.ncr-rf-btn:active{transform:none}}",
].join("\n")
