import { useCallback, useEffect, useState } from "react"
export type ThemeMode = "light" | "dark"
export const THEME_KEY = "nc-theme-v2"
export const THEME_EVENT = "nc-theme-change"
export function readStoredTheme(): ThemeMode | null {
    if (typeof window === "undefined") return null
    try {
        const v = window.localStorage.getItem(THEME_KEY)
        return v === "light" || v === "dark" ? v : null
    } catch (e) {
        return null
    }
}
function systemTheme(): ThemeMode {
    return "dark"
}
export function useNcTheme(manage: boolean) {
    const [mode, setMode] = useState<ThemeMode>("dark")
    useEffect(() => {
        if (typeof document === "undefined") return
        const root = document.documentElement
        const apply = (next: ThemeMode) => {
            if (manage) root.setAttribute("data-nc-theme", next)
            setMode(next)
        }
        const current = root.getAttribute("data-nc-theme")
        apply(readStoredTheme() ?? (current === "light" || current === "dark" ? (current as ThemeMode) : systemTheme()))
        const onEvent = (event: Event) => {
            const next = (event as CustomEvent<ThemeMode>).detail
            if (next === "light" || next === "dark") apply(next)
        }
        const mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null
        const onSystem = () => {
            if (!readStoredTheme()) apply(systemTheme())
        }
        window.addEventListener(THEME_EVENT, onEvent)
        mq?.addEventListener?.("change", onSystem)
        return () => {
            window.removeEventListener(THEME_EVENT, onEvent)
            mq?.removeEventListener?.("change", onSystem)
        }
    }, [manage])
    const toggle = useCallback(() => {
        const next: ThemeMode = mode === "dark" ? "light" : "dark"
        if (typeof document !== "undefined") document.documentElement.setAttribute("data-nc-theme", next)
        try {
            window.localStorage.setItem(THEME_KEY, next)
        } catch (e) {}
        setMode(next)
        window.dispatchEvent(new CustomEvent<ThemeMode>(THEME_EVENT, { detail: next }))
    }, [mode])
    return { mode, toggle }
}
export const SESSION_KEY = "nc-reports-session"
export interface StoredSession {
    access_token: string
    refresh_token: string
    expires_at: number
}
export function readSession(): StoredSession | null {
    if (typeof window === "undefined") return null
    try {
        const raw = window.sessionStorage.getItem(SESSION_KEY)
        if (!raw) return null
        const p = JSON.parse(raw)
        if (typeof p?.access_token !== "string" || !p.access_token) return null
        return {
            access_token: p.access_token,
            refresh_token: typeof p.refresh_token === "string" ? p.refresh_token : "",
            expires_at: typeof p.expires_at === "number" ? p.expires_at : 0,
        }
    } catch (e) {
        return null
    }
}
export function writeSession(s: StoredSession | null) {
    if (typeof window === "undefined") return
    try {
        if (s) window.sessionStorage.setItem(SESSION_KEY, JSON.stringify(s))
        else window.sessionStorage.removeItem(SESSION_KEY)
    } catch (e) {}
}
export function sessionFromPayload(p: any): StoredSession | null {
    if (!p || typeof p.access_token !== "string" || !p.access_token) return null
    const expiresIn = Number(p.expires_in) || 3600
    const expiresAt = Number(p.expires_at) ? Number(p.expires_at) * 1000 : Date.now() + expiresIn * 1000
    return { access_token: p.access_token, refresh_token: p.refresh_token || "", expires_at: expiresAt }
}
export function cleanUrl(url: string): string {
    return (url || "").trim().replace(/\/+$/, "")
}
export async function refreshSession(url: string, key: string, s: StoredSession): Promise<StoredSession | null> {
    if (!s.refresh_token) return null
    try {
        const res = await fetch(`${url}/auth/v1/token?grant_type=refresh_token`, {
            method: "POST",
            headers: { apikey: key, "Content-Type": "application/json" },
            body: JSON.stringify({ refresh_token: s.refresh_token }),
        })
        if (!res.ok) return null
        const next = sessionFromPayload(await res.json().catch(() => null))
        if (next) writeSession(next)
        return next
    } catch (e) {
        return null
    }
}
export async function liveSession(url: string, key: string): Promise<StoredSession | null> {
    const s = readSession()
    if (!s) return null
    if (s.expires_at && Date.now() > s.expires_at - 60000) {
        const next = await refreshSession(url, key, s)
        if (!next) writeSession(null)
        return next
    }
    return s
}
export class ReportsError extends Error {
    status: number
    constructor(message: string, status: number) {
        super(message)
        this.status = status
    }
}
export async function authGet<T = any>(url: string, key: string, path: string): Promise<T> {
    let s = await liveSession(url, key)
    if (!s) throw new ReportsError("Your session has ended. Please sign in again.", 401)
    const go = (token: string) =>
        fetch(`${url}${path}`, { headers: { apikey: key, Authorization: `Bearer ${token}`, Accept: "application/json" } })
    let res = await go(s.access_token)
    if (res.status === 401) {
        s = await refreshSession(url, key, s)
        if (!s) {
            writeSession(null)
            throw new ReportsError("Your session has ended. Please sign in again.", 401)
        }
        res = await go(s.access_token)
    }
    if (!res.ok) {
        let detail = ""
        try {
            const body = await res.json()
            detail = body?.message || body?.error_description || body?.hint || ""
        } catch (e) {}
        throw new ReportsError(`The report data could not be loaded (${res.status}${detail ? `: ${detail}` : ""}).`, res.status)
    }
    return (await res.json()) as T
}
export async function signOutRemote(url: string, key: string) {
    const s = readSession()
    writeSession(null)
    if (!s || !url || !key) return
    try {
        await fetch(`${url}/auth/v1/logout`, {
            method: "POST",
            headers: { apikey: key, Authorization: `Bearer ${s.access_token}` },
        })
    } catch (e) {}
}
const POPPINS =
    "https://framerusercontent.com/third-party-assets/fontshare/wf/DXWQGUHDKBI6OC6VABLBIH32VNWJYNX7/AHNAY7DQAEGE2SZPLPBG5BENKLEA34XN/KYQLPR2735WAT5CT22Y22PYHV3W52QJO.woff2"
const GEIST = "https://fonts.gstatic.com/s/geist/v5/gyByhwUxId8gMHweElSvO5Tc.woff2"
const GEIST_MONO = "https://fonts.gstatic.com/s/geistmono/v6/or3yQ6H-1_WfwkMZI_qYPLs1a-t7PU0AbeEPKJ5W7ihaO_CS.woff2"
export const FONT_CSS = `
@font-face{font-family:"NCR Poppins";src:url("${POPPINS}") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}
@font-face{font-family:"NCR Geist";src:url("${GEIST}") format("woff2");font-weight:100 900;font-style:normal;font-display:swap}
@font-face{font-family:"NCR Geist Mono";src:url("${GEIST_MONO}") format("woff2");font-weight:500;font-style:normal;font-display:swap}
`
export const F_HEAD = `"NCR Poppins","Poppins Variable",Poppins,system-ui,sans-serif`
export const F_BODY = `"NCR Geist","Geist Variable",Geist,system-ui,sans-serif`
export const F_MONO = `"NCR Geist Mono","Geist Mono",ui-monospace,monospace`
const LIGHT = `
--ncr-bg:#f6f4ef;--ncr-surface:#ffffff;--ncr-surface-2:#f1edf7;
--ncr-ink:#16181c;--ncr-body:#3a3f47;--ncr-muted:#5d6470;
--ncr-border:#e2dcec;--ncr-hair:rgba(22,24,28,0.08);--ncr-field:#7d838e;
--ncr-accent:#8b3dff;--ncr-accent-text:#7a2ee6;--ncr-on-accent:#ffffff;--ncr-accent-wash:rgba(139,61,255,0.10);
--ncr-good:#1a7a48;--ncr-bad:#b3261e;--ncr-warn:#8a5a00;
--ncr-series-2:#5d6470;--ncr-grid:rgba(22,24,28,0.09);
--ncr-chrome:rgba(246,244,239,0.82);--ncr-chrome-heavy:rgba(237,234,227,0.90);
--ncr-scrim:rgba(22,24,28,0.40);--ncr-shadow:0 1px 2px rgba(22,24,28,0.05),0 8px 24px rgba(60,40,110,0.06);
color-scheme:light;
`
const DARK = `
--ncr-bg:#0f1114;--ncr-surface:#171a1f;--ncr-surface-2:#1f242b;
--ncr-ink:#f2f2f0;--ncr-body:rgba(255,255,255,0.82);--ncr-muted:#98a0ac;
--ncr-border:#2a2f37;--ncr-hair:rgba(255,255,255,0.10);--ncr-field:#6e7684;
--ncr-accent:#a16bff;--ncr-accent-text:#b48bff;--ncr-on-accent:#16181c;--ncr-accent-wash:rgba(161,107,255,0.14);
--ncr-good:#5ccf8f;--ncr-bad:#ffb4ab;--ncr-warn:#f0b44c;
--ncr-series-2:#98a0ac;--ncr-grid:rgba(255,255,255,0.08);
--ncr-chrome:rgba(15,17,20,0.80);--ncr-chrome-heavy:rgba(23,26,31,0.90);
--ncr-scrim:rgba(0,0,0,0.55);--ncr-shadow:0 1px 2px rgba(0,0,0,0.25);
color-scheme:dark;
`
export const THEME_CSS = `
.ncr{${LIGHT}}
html[data-nc-theme="dark"] .ncr{${DARK}}
html[data-nc-theme="light"] .ncr{${LIGHT}}
@media (prefers-contrast: more){
  .ncr{--ncr-border:var(--ncr-field);--ncr-hair:var(--ncr-field);--ncr-chrome:var(--ncr-bg);--ncr-chrome-heavy:var(--ncr-bg);}
}
`
export default function ReportsShared() {
    return null
}
