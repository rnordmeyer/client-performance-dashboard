import { useEffect, useRef, useState, type CSSProperties } from "react"
import * as FramerRuntime from "framer"
import { addPropertyControls, ControlType } from "framer"
const useRouterSafe: () => any = (FramerRuntime as any).useRouter || (() => null)
import { sendLead, registerLeadKey } from "./LeadIntake.tsx"
import { priceLine } from "./SuitePrices.tsx"
const NORDY_CSS =
    ".nc-nordy-qr:focus-visible{outline:2px solid currentColor;outline-offset:2px}.nc-nordy-qr:hover{filter:brightness(0.97)}@keyframes nordy-spin{to{transform:rotate(360deg)}}@keyframes nordy-rise{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}.nc-nordy-ring{animation:nordy-spin 4.5s linear infinite}.nc-nordy-rise{animation:nordy-rise .28s ease-out}@media (prefers-reduced-motion: reduce){.nc-nordy-ring,.nc-nordy-rise{animation:none!important}}"
const KEY_STEP = "nordy-step-v2"
const KEY_MSG = "nordy-msg-v2"
const KEY_NUDGE = "nordy-nudge-v1"
const KEY_WELCOME = "nordy-welcome-session"
const WELCOME_DELAY_MS = 4000
const WELCOME_SCROLL_PX = 120
const WELCOME_TITLE = "Hi, I’m Nordy. Welcome to Nordmeyer Creative!"
const WELCOME_BODY = "Here to help you find your way around. What brings you here today?"
function markWelcomeSeen() {
    try {
        window.sessionStorage.setItem(KEY_WELCOME, "1")
    } catch (e) {}
}
function welcomeSeen(): boolean {
    try {
        return window.sessionStorage.getItem(KEY_WELCOME) === "1"
    } catch (e) {
        return false
    }
}
const KEY_WORK = "nordy-business"
const NUDGE_LIMIT = 10
const DWELL_MS = 5000
const MARK =
    "data:image/png;base64,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"
const ACCENT = "#8B3DFF"
const PINK = "#D04C9A"
const LILAC = "#B98CFF"
const ACCENT_HOVER = "#7A33E6"
function ls(): Storage | null {
    try {
        return typeof window === "undefined" ? null : window.localStorage
    } catch (e) {
        return null
    }
}
type Step =
    | "bubble"
    | "intro"
    | "shop"
    | "work"
    | "job"
    | "cat"
    | "klarwerk"
    | "grundwerk"
    | "kraftmarke"
    | "meisterwerk"
    | "enterprise"
    | "store-goal"
    | "store-goal-100"
    | "klarwerk-store"
    | "grundwerk-store"
    | "meisterwerk-store"
const ADDONS_HREF = "/services#add-ons"
const RESULTS: Record<
    string,
    {
        tier: string
        price: string
        blurb: string
        msg: string
    }
> = {
    klarwerk: {
        tier: "'Klarwerk'",
        price: priceLine("klarwerk"),
        blurb: "Get online. A clean, credible custom website, up to 5 pages, with hosting, security and care included, plus basic analytics so you can see who's visiting your site.",
        msg: "Hello! I'm interested in learning more about the Klarwerk Suite. I'm mainly looking to have a solid, credible presence online.",
    },
    grundwerk: {
        tier: "'Grundwerk'",
        price: priceLine("grundwerk"),
        blurb: "Look established. Everything in Klarwerk, with a custom website up to 10 pages, a logo, colors and type made for you, your Google Business Profile set up and optimized, advanced SEO setup at launch (AEO and GEO monthly work can be added for $99 a month), 3 Google searches tracked quarterly, advanced analytics that show where visitors come from and what they view, and a monthly progress report.",
        msg: "Hello! I'm interested in learning more about the Grundwerk Suite. I'd like my business to look established and bring in new work.",
    },
    meisterwerk: {
        tier: "'Meisterwerk'",
        price: priceLine("meisterwerk"),
        blurb: "Win more customers. Everything in Grundwerk, with a custom website up to 15 pages, advanced SEO, AEO and GEO setup plus monthly work to help you get found on Google and in AI answers, 25 Google searches tracked monthly, trend reporting plus a monthly AI visibility report so you can see what's working, lead management so you never miss an inquiry, market research refreshed every quarter so you know who is searching and what they want, a growth plan reviewed with you every quarter, and priority support so your changes are handled first.",
        msg: "Hello! I'm interested in learning more about the Meisterwerk Suite. I'd like to win more customers, with a plan and monthly marketing work behind it.",
    },
    "klarwerk-store": {
        tier: "'Klarwerk Store'",
        price: priceLine("klarwerk-store"),
        blurb: "Everything in Klarwerk, including basic analytics, with a custom website up to 10 pages and an online store for up to 25 products, payments, checkout and customer accounts set up for you. Product pages, cart and checkout don't count toward your page limit.",
        msg: "Hello! I'm interested in learning more about the Klarwerk Store Suite. I'd like to get my store open online, with up to twenty-five products.",
    },
    "grundwerk-store": {
        tier: "'Grundwerk Store'",
        price: priceLine("grundwerk-store"),
        blurb: "Everything in Grundwerk, including your Google Business Profile set up and optimized, advanced SEO setup at launch (AEO and GEO monthly work can be added for $99 a month), 3 Google searches tracked quarterly, advanced analytics and a monthly progress report, with a custom website up to 15 pages and an online store for up to 100 products, payments, checkout and customer accounts set up for you. Product pages, cart and checkout don't count toward your page limit.",
        msg: "Hello! I'm interested in learning more about the Grundwerk Store Suite. I'd like an established-looking store, with up to a hundred products.",
    },
    "meisterwerk-store": {
        tier: "'Meisterwerk Store'",
        price: priceLine("meisterwerk-store"),
        blurb: "Everything in Meisterwerk, including advanced SEO, AEO and GEO setup plus monthly work, 25 tracked searches, priority support, trend reporting with a monthly AI visibility report, lead management and market research refreshed every quarter, with a custom website up to 20 pages and an online store for up to 500 products, payments, checkout and customer accounts set up for you. Product pages, cart and checkout don't count toward your page limit.",
        msg: "Hello! I'm interested in learning more about the Meisterwerk Store Suite. I'd like to grow my store, with up to five hundred products.",
    },
    enterprise: {
        tier: "Let us talk",
        price: "Bigger than a plan",
        blurb: "More than five hundred products is its own conversation. Tell Ryan what you are running and he will scope it properly.",
        msg: "Hello! I have more than five hundred products, and Nordy suggested I get in touch so we can scope something properly.",
    },
}
RESULTS.kraftmarke = RESULTS["grundwerk-store"]
const WORK_OTHER = "Something else entirely"
const WORK = [
    "Trades and home services",
    "Health, wellness or care",
    "Food, retail or hospitality",
    "Professional services",
    "Nonprofit or community",
    WORK_OTHER,
]
const PROMPT_PACKAGE = "Need help deciding on a package?"
const PROMPT_SHOP = "Want a shop like this one?"
const SHOP_NEXT_STEP: Step = "cat"
const PRICING = '[data-framer-name="Business Suite Pricing"]'
function siteContext(): "package" | "shop" | "welcome" | null {
    if (typeof document === "undefined") return null
    if (isShopContext()) return "shop"
    if (document.querySelector(PRICING)) return "package"
    if (isHome()) return "welcome"
    return null
}
let routerSaysHome = false
function isHome(): boolean {
    if (routerSaysHome) return true
    if (typeof window === "undefined") return false
    const p = window.location.pathname.replace(/\/+$/, "")
    return p === "" || p === "/index.html"
}
function isShopContext(): boolean {
    if (typeof window === "undefined") return false
    if (/^\/shop(\/|$)/.test(window.location.pathname)) return true
    return Boolean(document.getElementById("sell-your-own"))
}
export type NordyTourView =
    | {
          kind: "offer"
      }
    | {
          kind: "step"
          index: number
          total: number
          title: string
          body: string
      }
    | {
          kind: "checkin"
      }
export type NordyTourAction = "start" | "next" | "back" | "end" | "checkin-close"
export default function Nordy(props: {
    contactPath?: string
    alwaysShow?: boolean
    mode?: "site" | "reports"
    tour?: NordyTourView | null
    onTour?: (a: NordyTourAction) => void
    onFootprint?: (px: number) => void
    onOpenChange?: (open: boolean) => void
    plansPath?: string
    suppressed?: boolean
    sample?: boolean
    leadIntakeKey?: string
}) {
    const contactPath = props.contactPath || "/contact"
    const alwaysShow = props.alwaysShow === true
    const reports = props.mode === "reports"
    const router: any = useRouterSafe()
    const routeId: string | undefined = router && router.currentRouteId
    const routeInfo: any = routeId && router && router.routes ? router.routes[routeId] : null
    routerSaysHome = !!routeInfo && (routeInfo.path === "/" || routeInfo.path === "")
    const tour = reports ? props.tour || null : null
    const [step, setStep] = useState<Step>("bubble")
    const [hover, setHover] = useState(false)
    const [resume, setResume] = useState<Step | null>(null)
    const [dark, setDark] = useState(false)
    const [nudge, setNudge] = useState<null | "package" | "shop" | "welcome">(null)
    const [phone, setPhone] = useState(false)
    const ready = useRef(false)
    const launcherRef = useRef<HTMLButtonElement | null>(null)
    const openedHere = useRef(false)
    const [route, setRoute] = useState(typeof window === "undefined" ? "/" : window.location.pathname)
    const [modalOpen, setModalOpen] = useState(false)
    const [context, setContext] = useState<"package" | "shop" | "welcome" | null>(null)
    useEffect(() => registerLeadKey(props.leadIntakeKey), [props.leadIntakeKey])
    const [ask, setAsk] = useState(false)
    const [lead, setLead] = useState({ name: "", reach: "", note: "", trap: "" })
    const [leadErr, setLeadErr] = useState<{
        name?: string
        reach?: string
    }>({})
    const [leadState, setLeadState] = useState<"idle" | "sending" | "done">("idle")
    const leadNameRef = useRef<HTMLInputElement | null>(null)
    const leadReachRef = useRef<HTMLInputElement | null>(null)
    useEffect(() => {
        const s = ls()?.getItem(KEY_STEP)
        if (s && s !== "bubble") setResume(s as Step)
        ready.current = true
        const phoneMq = window.matchMedia("(max-width: 809.98px)")
        const syncPhone = () => setPhone(phoneMq.matches)
        syncPhone()
        phoneMq.addEventListener?.("change", syncPhone)
        const mq = window.matchMedia("(prefers-color-scheme: dark)")
        const sync = () => {
            const root = document.documentElement
            const attr = root.getAttribute("data-nc-theme") || root.getAttribute("data-framer-theme")
            setDark(attr ? attr === "dark" : true)
        }
        sync()
        mq.addEventListener?.("change", sync)
        window.addEventListener("nc-theme-change", sync)
        const mo = new MutationObserver(sync)
        mo.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["data-nc-theme", "data-framer-theme"],
        })
        return () => {
            phoneMq.removeEventListener?.("change", syncPhone)
            mq.removeEventListener?.("change", sync)
            window.removeEventListener("nc-theme-change", sync)
            mo.disconnect()
        }
    }, [])
    useEffect(() => {
        if (step !== "bubble") {
            openedHere.current = true
            setNudge(null)
        }
        if (!ready.current) return
        if (step === "bubble") return
        if (step === "shop") return
        ls()?.setItem(KEY_STEP, step)
        setResume(step)
    }, [step])
    useEffect(() => {
        if (reports) return
        const msg = ls()?.getItem(KEY_MSG)
        if (!msg) return
        let n = 0
        const fill = () => {
            const el = (Array.from(document.querySelectorAll("textarea")) as HTMLTextAreaElement[]).find((t) => !t.value)
            if (!el) return false
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
            if (setter) setter.call(el, msg)
            else el.value = msg
            el.dispatchEvent(new Event("input", { bubbles: true }))
            el.dispatchEvent(new Event("change", { bubbles: true }))
            ls()?.removeItem(KEY_MSG)
            return true
        }
        if (fill()) return
        const t = setInterval(() => {
            n += 1
            if (fill() || n > 60) clearInterval(t)
        }, 150)
        return () => clearInterval(t)
    }, [])
    useEffect(() => {
        if (typeof window === "undefined") return
        const onKey = (e: KeyboardEvent) => {
            if (e.key !== "Escape") return
            if (reports) {
                if (tour) {
                    if (cardHasFocus()) launcherFocusPending.current = true
                    props.onTour?.(tour.kind === "checkin" ? "checkin-close" : "end")
                } else if (menuOpen) {
                    launcherFocusPending.current = true
                    setMenuOpen(false)
                }
                return
            }
            if (step !== "bubble") {
                setStep("bubble")
                launcherRef.current?.focus()
            } else if (nudge) {
                if (nudge === "welcome") markWelcomeSeen()
                setNudge(null)
                launcherRef.current?.focus()
            }
        }
        window.addEventListener("keydown", onKey)
        return () => window.removeEventListener("keydown", onKey)
    })
    useEffect(() => {
        if (typeof window === "undefined") return
        const onModal = (e: Event) => setModalOpen(Boolean((e as CustomEvent).detail?.open))
        window.addEventListener("nc:inquiry-state", onModal as EventListener)
        return () => window.removeEventListener("nc:inquiry-state", onModal as EventListener)
    }, [])
    useEffect(() => {
        if (typeof window === "undefined") return
        let last = window.location.pathname
        const check = () => {
            if (window.location.pathname === last) return
            last = window.location.pathname
            setRoute(last)
        }
        window.addEventListener("popstate", check)
        const nav = (window as any).navigation
        let iv = 0
        if (nav && typeof nav.addEventListener === "function") {
            nav.addEventListener("currententrychange", check)
        } else {
            iv = window.setInterval(check, 400)
        }
        return () => {
            window.removeEventListener("popstate", check)
            if (nav && typeof nav.removeEventListener === "function") nav.removeEventListener("currententrychange", check)
            if (iv) window.clearInterval(iv)
        }
    }, [])
    useEffect(() => {
        if (typeof window === "undefined" || reports) return
        setContext(siteContext())
        let n = 0
        const iv = window.setInterval(() => {
            n += 1
            const c = siteContext()
            setContext(c)
            if (c || n > 40) window.clearInterval(iv)
        }, 250)
        return () => window.clearInterval(iv)
    }, [route, routeId])
    useEffect(() => {
        if (typeof window === "undefined") return
        openedHere.current = false
        setNudge(null)
        if (reports) return
        const shown = Number(ls()?.getItem(KEY_NUDGE) || 0) || 0
        const capped = !alwaysShow && shown >= NUDGE_LIMIT
        let tick = 0
        let poll = 0
        let dwelled = 0
        let scrolled = window.scrollY > 0
        let solutionsTimer: ReturnType<typeof setTimeout> | null = null
        let welcomeScroll: (() => void) | null = null
        const onScroll = () => {
            scrolled = true
        }
        const scrollOffset = () => window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0
        const fire = (kind: "package" | "shop") => () => {
            cleanup()
            if (openedHere.current) return
            if (!alwaysShow) ls()?.setItem(KEY_NUDGE, String(shown + 1))
            setNudge(kind)
        }
        const engaged = (el: Element) => {
            const r = el.getBoundingClientRect()
            const vh = window.innerHeight
            const visible = Math.min(r.bottom, vh) - Math.max(r.top, 0)
            if (visible <= 0) return false
            return visible >= Math.min(vh * 0.5, r.height * 0.6)
        }
        const watchPricing = (el: Element) => {
            tick = window.setInterval(() => {
                if (!scrolled && scrollOffset() > 0) scrolled = true
                if (scrolled && engaged(el)) {
                    dwelled += 250
                    if (dwelled >= DWELL_MS) fire("package")()
                } else {
                    dwelled = 0
                }
            }, 250)
        }
        function cleanup() {
            window.removeEventListener("scroll", onScroll)
            window.removeEventListener("touchmove", onScroll)
            if (tick) window.clearInterval(tick)
            if (poll) window.clearInterval(poll)
            if (solutionsTimer) clearTimeout(solutionsTimer)
            if (welcomeScroll) {
                window.removeEventListener("scroll", welcomeScroll)
                window.removeEventListener("touchmove", welcomeScroll)
                welcomeScroll = null
            }
            tick = 0
            poll = 0
            solutionsTimer = null
        }
        const start = () => {
            if (isHome() && !isShopContext() && !document.querySelector(PRICING)) {
                if (!alwaysShow && welcomeSeen()) return true
                const show = () => {
                    cleanup()
                    if (openedHere.current) return
                    setNudge("welcome")
                }
                solutionsTimer = setTimeout(show, WELCOME_DELAY_MS)
                welcomeScroll = () => {
                    if (scrollOffset() > WELCOME_SCROLL_PX) show()
                }
                window.addEventListener("scroll", welcomeScroll, { passive: true })
                window.addEventListener("touchmove", welcomeScroll, { passive: true })
                return true
            }
            if (capped) return true
            if (isShopContext()) {
                solutionsTimer = setTimeout(fire("shop"), DWELL_MS)
                return true
            }
            const pricing = document.querySelector(PRICING)
            if (!pricing) return false
            if (document.querySelector('[data-framer-name="Plans"]')) {
                solutionsTimer = setTimeout(fire("package"), DWELL_MS)
                return true
            }
            window.addEventListener("scroll", onScroll, { passive: true })
            window.addEventListener("touchmove", onScroll, { passive: true })
            watchPricing(pricing.closest('[data-framer-name="Pricing"]') || pricing)
            return true
        }
        if (!start()) {
            let n = 0
            poll = window.setInterval(() => {
                n += 1
                if (start() || n > 40) {
                    window.clearInterval(poll)
                    poll = 0
                }
            }, 250)
        }
        return cleanup
    }, [alwaysShow, route, routeId])
    const [blocked, setBlocked] = useState(false)
    useEffect(() => {
        if (typeof window === "undefined" || nudge !== "welcome") {
            setBlocked(false)
            return
        }
        const check = () => {
            const vw = window.innerWidth
            const vh = window.innerHeight
            const w = Math.min(300, vw - 32)
            const launcher = phone ? 48 : 62
            const zone = { left: vw - 22 - w, right: vw, top: vh - 22 - launcher - 10 - 300, bottom: vh }
            const els = document.querySelectorAll(
                '[data-framer-name="CTAs"] a, [data-framer-name="CTAs"] button, form button, form [type="submit"]',
            )
            let hit = false
            els.forEach((el) => {
                const r = (el as HTMLElement).getBoundingClientRect()
                if (r.width === 0 || r.height === 0) return
                if (r.right > zone.left && r.left < zone.right && r.bottom > zone.top && r.top < zone.bottom) hit = true
            })
            setBlocked(hit)
        }
        check()
        window.addEventListener("scroll", check, { passive: true })
        window.addEventListener("resize", check)
        return () => {
            window.removeEventListener("scroll", check)
            window.removeEventListener("resize", check)
        }
    }, [nudge, phone])
    const size = phone ? 48 : 62
    const surface = dark ? "#171A1F" : "#FFFFFF"
    const ink = dark ? "#F2F0F7" : "#1F1B2E"
    const body = dark ? "#B8B4C4" : "#4A4458"
    const line = dark ? "#2E333C" : "#E4E0F0"
    const soft = dark ? "#1F242B" : "#F4F1FB"
    const open = step !== "bubble"
    const [menuOpen, setMenuOpen] = useState(false)
    const [spoken, setSpoken] = useState("")
    const cardRef = useRef<HTMLDivElement | null>(null)
    const titleRef = useRef<HTMLDivElement | null>(null)
    const prevTour = useRef<NordyTourView | null>(null)
    const focusInCard = useRef(false)
    function cardHasFocus() {
        const a = typeof document !== "undefined" ? document.activeElement : null
        return focusInCard.current || Boolean(a && cardRef.current && cardRef.current.contains(a))
    }
    const reportsCard = reports && !props.suppressed && (Boolean(tour) || menuOpen)
    const lastView = useRef<{
        tour: NordyTourView | null
        menu: boolean
    }>({ tour: null, menu: false })
    if (reportsCard) lastView.current = { tour, menu: menuOpen }
    const [exitView, setExitView] = useState<{
        tour: NordyTourView | null
        menu: boolean
    } | null>(null)
    const wasOpen = useRef(false)
    const launcherFocusPending = useRef(false)
    const launcherPulsePending = useRef(false)
    const reduceMotion = () =>
        typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const originFor = (el: HTMLElement) => {
        const r = el.getBoundingClientRect()
        el.style.transformOrigin = `${r.width - size / 2}px ${r.height - size / 2}px`
        return { sx: size / Math.max(1, r.width), sy: size / Math.max(1, r.height) }
    }
    useEffect(() => {
        if (!reports) return
        const el = cardRef.current
        if (reportsCard && !wasOpen.current && el && el.animate) {
            if (reduceMotion()) el.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" })
            else {
                const { sx, sy } = originFor(el)
                el.animate(
                    [
                        { transform: `scale(${sx}, ${sy})`, opacity: 0 },
                        { opacity: 1, offset: 0.35 },
                        { transform: "scale(1, 1)", opacity: 1 },
                    ],
                    { duration: 320, easing: "cubic-bezier(0.32, 0.72, 0, 1)" },
                )
            }
        }
        if (!reportsCard && wasOpen.current && !props.suppressed) setExitView(lastView.current)
        wasOpen.current = reportsCard
    }, [reports, reportsCard, props.suppressed])
    useEffect(() => {
        if (!exitView) return
        const el = cardRef.current
        const done = () => {
            launcherPulsePending.current = true
            setExitView(null)
        }
        if (!el || !el.animate) return done()
        let anim: Animation
        if (reduceMotion()) anim = el.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-in", fill: "forwards" })
        else {
            const { sx, sy } = originFor(el)
            anim = el.animate(
                [
                    { transform: "scale(1, 1)", opacity: 1 },
                    { opacity: 1, offset: 0.55 },
                    { transform: `scale(${sx}, ${sy})`, opacity: 0 },
                ],
                { duration: 300, easing: "cubic-bezier(0.32, 0, 0.67, 0)", fill: "forwards" },
            )
        }
        anim.onfinish = done
        anim.oncancel = done
        return () => anim.cancel()
    }, [exitView])
    useEffect(() => {
        if (!reports || exitView || reportsCard) return
        const l = launcherRef.current
        if (!l) return
        if (launcherPulsePending.current) {
            launcherPulsePending.current = false
            if (!reduceMotion() && l.animate)
                l.animate([{ transform: "scale(1)" }, { transform: "scale(1.09)" }, { transform: "scale(1)" }], {
                    duration: 260,
                    easing: "cubic-bezier(0.33, 1, 0.68, 1)",
                })
        }
        if (launcherFocusPending.current) {
            launcherFocusPending.current = false
            l.focus({ preventScroll: true })
        }
    })
    useEffect(() => {
        if (!reports) return
        const prev = prevTour.current
        prevTour.current = tour
        const focusTitle = () => requestAnimationFrame(() => titleRef.current?.focus({ preventScroll: true }))
        if (tour && tour.kind === "step") {
            setMenuOpen(false)
            if (!prev || prev.kind !== "step") {
                focusTitle()
            } else if (prev.index !== tour.index) {
                setSpoken(`Step ${tour.index + 1} of ${tour.total}. ${tour.title}. ${tour.body}`)
                requestAnimationFrame(() => {
                    const a = document.activeElement
                    if (!a || !cardRef.current || !cardRef.current.contains(a)) titleRef.current?.focus({ preventScroll: true })
                })
            }
        } else if (tour && tour.kind === "offer" && (!prev || prev.kind !== "offer")) {
            setSpoken(
                props.sample
                    ? "Nordy: Hi, I’m Nordy. This is an example business with made-up numbers. Want a quick tour?"
                    : "Nordy: Hi, I’m Nordy. Want a quick tour of your reports?",
            )
        } else if (tour && tour.kind === "checkin" && (!prev || prev.kind !== "checkin")) {
            setSpoken("Nordy: Enjoying the look around? Every Business Suite plan comes with a dashboard like this for your own site.")
        } else if (!tour && prev) {
            setSpoken("")
            if (focusInCard.current) launcherFocusPending.current = true
            focusInCard.current = false
        }
    }, [reports, tour && tour.kind, tour && tour.kind === "step" ? tour.index : -1])
    useEffect(() => {
        if (!reports) return
        props.onOpenChange?.(menuOpen)
    }, [reports, menuOpen])
    useEffect(() => {
        if (!reports || typeof window === "undefined") return
        if (props.suppressed) {
            props.onFootprint?.(0)
            return
        }
        const card = cardRef.current
        if (!card || typeof ResizeObserver === "undefined") {
            props.onFootprint?.(size + 22)
            return
        }
        const set = () => props.onFootprint?.(Math.ceil(card.getBoundingClientRect().height) + 22)
        set()
        const ro = new ResizeObserver(set)
        ro.observe(card)
        return () => ro.disconnect()
    }, [reports, reportsCard, props.suppressed, size, tour && tour.kind, tour && tour.kind === "step" ? tour.index : -1])
    const go = (s: Step) => setStep(s)
    const sendDetails = async () => {
        const r = RESULTS[step]
        const name = lead.name.trim()
        const reach = lead.reach.trim()
        const errs: {
            name?: string
            reach?: string
        } = {}
        if (!name) errs.name = "Add your name so Ryan knows who to ask for."
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(reach)
        const digits = reach.replace(/\D/g, "")
        if (!reach) errs.reach = "Add an email address or a phone number."
        else if (!isEmail && digits.length < 7)
            errs.reach = "That does not look like an email or a phone number yet. Check it and try again."
        setLeadErr(errs)
        if (errs.name) {
            leadNameRef.current?.focus()
            return
        }
        if (errs.reach) {
            leadReachRef.current?.focus()
            return
        }
        if (lead.trap.trim()) {
            setLeadState("done")
            return
        }
        setLeadState("sending")
        const work = ls()?.getItem(KEY_WORK) || ""
        await sendLead(
            {
                name,
                ...(isEmail ? { email: reach } : { phone: reach }),
                message: [r ? `Nordy suggested ${r.tier.replace(/['‘’]/g, "")} (${r.price}).` : "", lead.note.trim()]
                    .filter(Boolean)
                    .join(" "),
                ...(work ? { work } : {}),
                ...(r ? { plan: r.tier.replace(/['‘’]/g, "") } : {}),
            },
            "Nordy",
            props.leadIntakeKey,
        )
        setLeadState("done")
    }
    const rememberWork = (w: string) => {
        if (w === WORK_OTHER) ls()?.removeItem(KEY_WORK)
        else ls()?.setItem(KEY_WORK, w)
    }
    const contact = () => {
        const r = RESULTS[step]
        if (r) ls()?.setItem(KEY_MSG, r.msg)
        ls()?.removeItem(KEY_STEP)
        setResume(null)
        const known = [
            "klarwerk",
            "grundwerk",
            "meisterwerk",
            "klarwerk-store",
            "grundwerk-store",
            "meisterwerk-store",
            "kraftmarke",
            "enterprise",
        ]
        if (typeof window !== "undefined" && known.indexOf(step) !== -1) {
            setStep("bubble")
            const slug = step === "kraftmarke" ? "grundwerk-store" : step
            window.dispatchEvent(new CustomEvent("nc:inquire", { detail: { slug } }))
            return
        }
        window.location.href = contactPath
    }
    const Ring = ({ radius, soft }: { radius: number; soft?: boolean }) => (
        <div style={{ position: "absolute", inset: 0, borderRadius: radius, overflow: "hidden", zIndex: 0 }}>
            <div style={{ position: "absolute", inset: 0, background: LILAC }} />
            <div
                className="nc-nordy-ring"
                style={{
                    position: "absolute",
                    left: "-75%",
                    top: "-75%",
                    width: "250%",
                    height: "250%",
                    background: soft
                        ? `conic-gradient(from 0deg at 50% 50%, ${LILAC} 0deg, ${ACCENT} 72deg, ${PINK} 144deg, ${PINK} 216deg, ${ACCENT} 288deg, ${LILAC} 360deg)`
                        : `conic-gradient(from 0deg at 50% 50%, ${LILAC} 0deg, ${PINK} 110deg, ${PINK} 250deg, ${LILAC} 360deg)`,
                    filter: soft ? "blur(14px)" : undefined,
                }}
            />
        </div>
    )
    const Opt = ({ label, onClick }: { label: string; onClick: () => void }) => (
        <button
            onClick={onClick}
            style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                cursor: "pointer",
                padding: "13px 16px",
                borderRadius: 10,
                border: `1px solid ${line}`,
                background: surface,
                color: ink,
                font: "500 14.5px/1.35 Poppins, system-ui, sans-serif",
                transition: "background .15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.background = soft)}
            onMouseLeave={(e) => (e.currentTarget.style.background = surface)}
        >
            {label}
        </button>
    )
    if (reports) {
        if (props.suppressed) return null
        const srOnly: CSSProperties = {
            position: "absolute",
            width: 1,
            height: 1,
            overflow: "hidden",
            clipPath: "inset(50%)",
            whiteSpace: "nowrap",
        }
        const pill: CSSProperties = {
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            minHeight: 44,
            cursor: "pointer",
            border: "none",
            borderRadius: 999,
            padding: "0 20px",
            background: ACCENT,
            color: "#fff",
            font: "600 14px/1 Poppins, system-ui, sans-serif",
            textDecoration: "none",
            outlineOffset: 3,
        }
        const quiet: CSSProperties = {
            display: "inline-flex",
            alignItems: "center",
            minHeight: 44,
            cursor: "pointer",
            border: "none",
            background: "transparent",
            padding: "0 4px",
            color: body,
            font: "500 13.5px/1.2 Poppins, system-ui, sans-serif",
            textDecoration: "underline",
            textUnderlineOffset: 3,
            outlineOffset: 3,
        }
        const titleId = "nordy-reports-title"
        const bodyId = "nordy-reports-body"
        const view = reportsCard ? { tour, menu: menuOpen } : exitView
        const vt = view ? view.tour : null
        const exiting = !reportsCard && !!exitView
        const isStep = vt && vt.kind === "step"
        return (
            <>
                <style>{NORDY_CSS}</style>

                <div role="status" aria-live="polite" style={srOnly}>
                    {spoken}
                </div>
                <div
                    style={{
                        position: "fixed",
                        right: 22,
                        bottom: 22,
                        zIndex: 50,
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-end",
                        gap: 10,
                    }}
                >
                    {reportsCard || exiting ? (
                        <div
                            ref={cardRef}
                            aria-hidden={exiting ? true : undefined}
                            role={vt && vt.kind === "checkin" ? "region" : "dialog"}
                            aria-modal={vt && vt.kind === "checkin" ? undefined : false}
                            aria-labelledby={titleId}
                            aria-describedby={bodyId}
                            onFocus={() => (focusInCard.current = true)}
                            onBlur={(e) => {
                                if (!cardRef.current || !cardRef.current.contains(e.relatedTarget as Node | null))
                                    focusInCard.current = false
                            }}
                            style={{
                                position: "relative",
                                width: "min(340px, calc(100vw - 32px))",
                                maxHeight: "calc(100vh - 44px)",
                                overflowY: "auto",
                                pointerEvents: exiting ? "none" : undefined,
                                willChange: "transform, opacity",
                                borderRadius: 16,
                                boxShadow: "0 10px 40px rgba(0,0,0,.18)",
                            }}
                        >
                            <Ring radius={16} />
                            <div
                                style={{
                                    position: "relative",
                                    zIndex: 1,
                                    margin: 3,
                                    borderRadius: 13,
                                    background: surface,
                                    padding: "20px 20px 14px",
                                }}
                            >
                                <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 14 }}>
                                    <div
                                        aria-hidden="true"
                                        style={{
                                            width: 42,
                                            height: 42,
                                            borderRadius: 999,
                                            background: ACCENT,
                                            display: "flex",
                                            alignItems: "center",
                                            justifyContent: "center",
                                            flex: "0 0 auto",
                                        }}
                                    >
                                        <img
                                            src={MARK}
                                            alt=""
                                            width={20}
                                            height={32}
                                            style={{ width: "40%", height: "auto", display: "block" }}
                                        />
                                    </div>
                                    <div>
                                        <div style={{ font: "600 15px/1.2 Poppins, system-ui, sans-serif", color: ink }}>Nordy</div>
                                        <div style={{ font: "400 12.5px/1.35 Poppins, system-ui, sans-serif", color: body }}>
                                            {isStep ? `Step ${(vt as any).index + 1} of ${(vt as any).total}` : "Nordmeyer Creative"}
                                        </div>
                                    </div>
                                </div>
                                {isStep ? (
                                    <>
                                        <div
                                            id={titleId}
                                            ref={titleRef}
                                            tabIndex={-1}
                                            role="heading"
                                            aria-level={2}
                                            style={{
                                                font: "600 18.5px/1.35 Poppins, system-ui, sans-serif",
                                                color: ink,
                                                marginBottom: 8,
                                                outline: "none",
                                            }}
                                        >
                                            {(vt as any).title}
                                        </div>
                                        <div
                                            id={bodyId}
                                            style={{ font: "400 14px/1.55 Poppins, system-ui, sans-serif", color: body, marginBottom: 14 }}
                                        >
                                            {(vt as any).body}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 14px" }}>
                                            {(vt as any).index < (vt as any).total - 1 ? (
                                                <button type="button" style={pill} onClick={() => props.onTour?.("next")}>
                                                    Next
                                                </button>
                                            ) : (
                                                <button type="button" style={pill} onClick={() => props.onTour?.("end")}>
                                                    Finish
                                                </button>
                                            )}
                                            {(vt as any).index > 0 ? (
                                                <button type="button" style={quiet} onClick={() => props.onTour?.("back")}>
                                                    Back
                                                </button>
                                            ) : null}
                                            {(vt as any).index < (vt as any).total - 1 ? (
                                                <button type="button" style={quiet} onClick={() => props.onTour?.("end")}>
                                                    Skip the tour
                                                </button>
                                            ) : null}
                                        </div>
                                    </>
                                ) : vt && vt.kind === "checkin" ? (
                                    <>
                                        <div
                                            id={titleId}
                                            style={{ font: "600 18.5px/1.35 Poppins, system-ui, sans-serif", color: ink, marginBottom: 8 }}
                                        >
                                            Enjoying the look around?
                                        </div>
                                        <div
                                            id={bodyId}
                                            style={{ font: "400 14px/1.55 Poppins, system-ui, sans-serif", color: body, marginBottom: 14 }}
                                        >
                                            Every Business Suite plan comes with a dashboard like this for your own site.
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 14px" }}>
                                            <a href={props.plansPath || "/solutions"} style={pill}>
                                                See Business Suite plans
                                            </a>
                                            <button type="button" style={quiet} onClick={() => props.onTour?.("checkin-close")}>
                                                Keep exploring
                                            </button>
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div
                                            id={titleId}
                                            style={{ font: "600 18.5px/1.35 Poppins, system-ui, sans-serif", color: ink, marginBottom: 8 }}
                                        >
                                            {vt && vt.kind === "offer"
                                                ? props.sample
                                                    ? "Hi, I’m Nordy. Want a quick tour?"
                                                    : "Hi, I’m Nordy. Want a quick tour of your reports?"
                                                : props.sample
                                                  ? "Hi, I’m Nordy. I can show you around."
                                                  : "Hi, I’m Nordy. I can show you around your reports."}
                                        </div>
                                        <div
                                            id={bodyId}
                                            style={{ font: "400 14px/1.55 Poppins, system-ui, sans-serif", color: body, marginBottom: 14 }}
                                        >
                                            {props.sample
                                                ? "This is an example business with made-up numbers. A few short stops show what each part of a monthly report means."
                                                : "A few short stops, one for each part of your monthly report. Leave any time."}
                                        </div>
                                        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "4px 14px" }}>
                                            <button
                                                type="button"
                                                style={pill}
                                                onClick={() => {
                                                    setMenuOpen(false)
                                                    props.onTour?.("start")
                                                }}
                                            >
                                                Show me around
                                            </button>
                                            <button
                                                type="button"
                                                style={quiet}
                                                onClick={() => {
                                                    if (tour) props.onTour?.("end")
                                                    setMenuOpen(false)
                                                    if (cardHasFocus()) launcherFocusPending.current = true
                                                }}
                                            >
                                                {vt ? "Not now" : "Close"}
                                            </button>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    ) : (
                        <button
                            ref={launcherRef}
                            type="button"
                            aria-label="Open Nordy"
                            aria-expanded={false}
                            onClick={() => {
                                setMenuOpen(true)
                                requestAnimationFrame(() => {
                                    const first = cardRef.current?.querySelector("button")
                                    ;(first as HTMLButtonElement | null)?.focus()
                                })
                            }}
                            onMouseEnter={() => setHover(true)}
                            onMouseLeave={() => setHover(false)}
                            style={{
                                position: "relative",
                                width: size,
                                height: size,
                                borderRadius: 999,
                                border: "none",
                                padding: 0,
                                cursor: "pointer",
                                background: "transparent",
                                boxShadow: "0 6px 20px rgba(139,61,255,0.35)",
                            }}
                        >
                            <Ring radius={999} />
                            <div
                                style={{
                                    position: "absolute",
                                    inset: 3,
                                    borderRadius: 999,
                                    background: hover ? ACCENT_HOVER : ACCENT,
                                    transition: "background .18s ease",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    zIndex: 1,
                                }}
                            >
                                <img
                                    src={MARK}
                                    alt=""
                                    aria-hidden="true"
                                    width={20}
                                    height={32}
                                    style={{ width: "30%", height: "auto", display: "block" }}
                                />
                            </div>
                        </button>
                    )}
                </div>
            </>
        )
    }
    const res = RESULTS[step]
    if (modalOpen) return null
    if (!context) return null
    const qr: CSSProperties = {
        display: "flex",
        alignItems: "center",
        minHeight: 44,
        width: "100%",
        boxSizing: "border-box",
        padding: "10px 14px",
        borderRadius: 10,
        border: "1px solid " + line,
        background: surface,
        color: ink,
        font: "500 13.5px/1.3 Poppins, system-ui, sans-serif",
        textAlign: "left",
        textDecoration: "none",
        cursor: "pointer",
    }
    const closeWelcome = () => {
        markWelcomeSeen()
        setNudge(null)
        launcherRef.current?.focus()
    }
    return (
        <>
            <style>{NORDY_CSS}</style>
            {open && (
                <div onClick={() => go("bubble")} style={{ position: "fixed", inset: 0, zIndex: 2147483000, background: "transparent" }} />
            )}
            <div
                style={{
                    position: "fixed",
                    right: 22,
                    bottom: 22,
                    zIndex: 2147483001,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "flex-end",
                    gap: 10,
                }}
            >
                {!open && nudge === "welcome" && !blocked && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="nc-nordy-rise"
                        style={{
                            position: "relative",
                            width: "min(300px, calc(100vw - 32px))",
                            textAlign: "left",
                            borderRadius: 14,
                            boxShadow: "0 8px 26px rgba(0,0,0,.14)",
                        }}
                    >
                        <Ring radius={14} soft />
                        <div
                            style={{
                                position: "relative",
                                zIndex: 1,
                                margin: 2,
                                borderRadius: 12,
                                background: surface,
                                padding: "14px 14px 14px",
                                color: ink,
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 10, paddingRight: 36, marginBottom: 8 }}>
                                <div
                                    aria-hidden="true"
                                    style={{
                                        width: 28,
                                        height: 28,
                                        borderRadius: 999,
                                        background: ACCENT,
                                        flex: "0 0 auto",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                    }}
                                >
                                    <img
                                        src={MARK}
                                        alt=""
                                        aria-hidden="true"
                                        width={20}
                                        height={32}
                                        style={{ width: "30%", height: "auto", display: "block" }}
                                    />
                                </div>
                                <div style={{ font: "600 14.5px/1.35 Poppins, system-ui, sans-serif", color: ink }}>{WELCOME_TITLE}</div>
                            </div>
                            <div style={{ font: "400 13.5px/1.5 Poppins, system-ui, sans-serif", color: body, marginBottom: 12 }}>
                                {WELCOME_BODY}
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                                <button
                                    type="button"
                                    className="nc-nordy-qr"
                                    style={qr}
                                    onClick={() => {
                                        markWelcomeSeen()
                                        setNudge(null)
                                        go(resume || "intro")
                                    }}
                                >
                                    Find the right plan
                                </button>
                                <a className="nc-nordy-qr" href="/services" style={qr} onClick={() => markWelcomeSeen()}>
                                    See individual services
                                </a>
                                <button type="button" className="nc-nordy-qr" style={qr} onClick={closeWelcome}>
                                    Just looking around
                                </button>
                            </div>
                            <button
                                type="button"
                                className="nc-nordy-qr"
                                aria-label="Dismiss this message"
                                onClick={closeWelcome}
                                style={{
                                    position: "absolute",
                                    top: 2,
                                    right: 2,
                                    width: 44,
                                    height: 44,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    border: "none",
                                    background: "transparent",
                                    cursor: "pointer",
                                    color: body,
                                    font: "400 17px/1 Poppins, system-ui, sans-serif",
                                    borderRadius: 10,
                                }}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )}
                {!open && nudge && nudge !== "welcome" && (
                    <div
                        role="status"
                        aria-live="polite"
                        className="nc-nordy-rise"
                        style={{
                            position: "relative",
                            maxWidth: 266,
                            textAlign: "left",
                            borderRadius: 14,
                            boxShadow: "0 8px 26px rgba(0,0,0,.14)",
                        }}
                    >
                        <Ring radius={14} soft />
                        <div
                            style={{
                                position: "relative",
                                zIndex: 1,
                                margin: 2,
                                borderRadius: 12,
                                background: surface,
                                display: "flex",
                                alignItems: "center",
                                gap: 10,
                                padding: "11px 30px 11px 12px",
                                color: ink,
                            }}
                        >
                            <div
                                aria-hidden="true"
                                style={{
                                    width: 28,
                                    height: 28,
                                    borderRadius: 999,
                                    background: ACCENT,
                                    flex: "0 0 auto",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                }}
                            >
                                <img
                                    src={MARK}
                                    alt=""
                                    aria-hidden="true"
                                    width={20}
                                    height={32}
                                    style={{ width: "30%", height: "auto", display: "block" }}
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => {
                                    const kind = nudge
                                    setNudge(null)
                                    go(kind === "shop" ? "shop" : resume || "intro")
                                }}
                                style={{
                                    flex: "1 1 auto",
                                    textAlign: "left",
                                    cursor: "pointer",
                                    border: "none",
                                    background: "transparent",
                                    padding: "3px 0",
                                    color: ink,
                                    font: "500 13.5px/1.4 Poppins, system-ui, sans-serif",
                                    outlineOffset: 3,
                                }}
                            >
                                {nudge === "shop" ? PROMPT_SHOP : PROMPT_PACKAGE}
                            </button>
                            <button
                                type="button"
                                aria-label="Dismiss this message"
                                onClick={() => setNudge(null)}
                                style={{
                                    position: "absolute",
                                    top: 1,
                                    right: 1,
                                    width: 26,
                                    height: 26,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    border: "none",
                                    background: "transparent",
                                    cursor: "pointer",
                                    color: body,
                                    font: "400 15px/1 Poppins, system-ui, sans-serif",
                                    outlineOffset: 3,
                                }}
                            >
                                ×
                            </button>
                        </div>
                    </div>
                )}
                {!open && (
                    <button
                        ref={launcherRef}
                        aria-label="Open Nordy"
                        onClick={() => {
                            if (nudge === "welcome") markWelcomeSeen()
                            go(resume || "intro")
                        }}
                        onMouseEnter={() => setHover(true)}
                        onMouseLeave={() => setHover(false)}
                        style={{
                            position: "relative",
                            width: size,
                            height: size,
                            borderRadius: 999,
                            border: "none",
                            padding: 0,
                            cursor: "pointer",
                            background: "transparent",
                            boxShadow: "0 6px 20px rgba(139,61,255,0.35)",
                        }}
                    >
                        <Ring radius={999} />
                        <div
                            style={{
                                position: "absolute",
                                inset: 3,
                                borderRadius: 999,
                                background: hover ? ACCENT_HOVER : ACCENT,
                                transition: "background .18s ease",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                zIndex: 1,
                            }}
                        >
                            <img
                                src={MARK}
                                alt=""
                                aria-hidden="true"
                                width={20}
                                height={32}
                                style={{ width: "30%", height: "auto", display: "block" }}
                            />
                        </div>
                    </button>
                )}
                {open && (
                    <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                            position: "relative",
                            width: "min(340px, calc(100vw - 32px))",
                            maxHeight: "calc(100vh - 44px)",
                            overflowY: "auto",
                            borderRadius: 16,
                            boxShadow: "0 10px 40px rgba(0,0,0,.18)",
                        }}
                    >
                        <Ring radius={16} />
                        <div
                            style={{
                                position: "relative",
                                zIndex: 1,
                                margin: 3,
                                borderRadius: 13,
                                background: surface,
                                padding: "22px 20px 18px",
                            }}
                        >
                            <div style={{ display: "flex", alignItems: "center", gap: 11, marginBottom: 16 }}>
                                <div
                                    style={{
                                        width: 42,
                                        height: 42,
                                        borderRadius: 999,
                                        background: ACCENT,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flex: "0 0 auto",
                                    }}
                                >
                                    <img
                                        src={MARK}
                                        alt=""
                                        aria-hidden="true"
                                        width={20}
                                        height={32}
                                        style={{ width: "40%", height: "auto", display: "block" }}
                                    />
                                </div>
                                <div>
                                    <div style={{ font: "600 15px/1.2 Poppins, system-ui, sans-serif", color: ink }}>Nordy</div>
                                    <div style={{ font: "400 12.5px/1.35 Poppins, system-ui, sans-serif", color: body }}>
                                        Nordmeyer Creative
                                    </div>
                                </div>
                            </div>

                            {step === "intro" && (
                                <>
                                    <P ink={ink}>
                                        Hey, I'm Nordy. Three quick questions and I'll tell you which plan fits, and roughly what it costs.
                                    </P>
                                    <Stack>
                                        <Opt label="Go on then" onClick={() => go("work")} />
                                    </Stack>
                                </>
                            )}

                            {step === "shop" && (
                                <>
                                    <P ink={ink}>This shop runs on a site we built. Want one like it?</P>
                                    <Stack>
                                        <Opt label="Yes, show me what that takes" onClick={() => go(SHOP_NEXT_STEP)} />
                                        <Opt label="Just having a look, thanks" onClick={() => go("bubble")} />
                                    </Stack>
                                </>
                            )}

                            {step === "work" && (
                                <>
                                    <P ink={ink}>First things first. What line of work are you in?</P>
                                    <Stack>
                                        {WORK.map((w) => (
                                            <Opt
                                                key={w}
                                                label={w}
                                                onClick={() => {
                                                    rememberWork(w)
                                                    go("job")
                                                }}
                                            />
                                        ))}
                                    </Stack>
                                </>
                            )}

                            {step === "job" && (
                                <>
                                    <P ink={ink}>Right. So what do you actually need it to do?</P>
                                    <Stack>
                                        <Opt label="Just be there, somewhere solid people can find" onClick={() => go("klarwerk")} />
                                        <Opt label="Look established and bring in new business" onClick={() => go("grundwerk")} />
                                        <Opt label="Win more customers, with a plan behind it" onClick={() => go("meisterwerk")} />
                                        <Opt label="Sell things online" onClick={() => go("cat")} />
                                    </Stack>
                                </>
                            )}

                            {step === "cat" && (
                                <>
                                    <P ink={ink}>Nice. Roughly how big is the catalogue?</P>
                                    <Stack>
                                        <Opt label="Up to 25 items" onClick={() => go("store-goal")} />
                                        <Opt label="Between 25 and 100" onClick={() => go("store-goal-100")} />
                                        <Opt label="Between 100 and 500" onClick={() => go("meisterwerk-store")} />
                                        <Opt label="More than five hundred" onClick={() => go("enterprise")} />
                                    </Stack>
                                </>
                            )}

                            {step === "store-goal" && (
                                <>
                                    <P ink={ink}>Good size. What does the store need to do for you?</P>
                                    <Stack>
                                        <Opt label="Just get the store open and selling" onClick={() => go("klarwerk-store")} />
                                        <Opt label="Look established, with a proper brand" onClick={() => go("grundwerk-store")} />
                                        <Opt label="Win more customers, with a plan behind it" onClick={() => go("meisterwerk-store")} />
                                    </Stack>
                                </>
                            )}

                            {step === "store-goal-100" && (
                                <>
                                    <P ink={ink}>Good size. What does the store need to do for you?</P>
                                    <Stack>
                                        <Opt label="Look established, with a proper brand" onClick={() => go("grundwerk-store")} />
                                        <Opt label="Win more customers, with a plan behind it" onClick={() => go("meisterwerk-store")} />
                                    </Stack>
                                </>
                            )}

                            {res && (
                                <>
                                    <P ink={ink}>Here is where I would put you.</P>
                                    <div style={{ background: soft, border: `1px solid ${ACCENT}`, borderRadius: 12, padding: 18 }}>
                                        <div
                                            style={{
                                                font: "500 11.5px/1.2 'Geist Mono', ui-monospace, monospace",
                                                letterSpacing: ".13em",
                                                textTransform: "uppercase",
                                                color: ACCENT,
                                            }}
                                        >
                                            {res.tier}
                                        </div>
                                        <div
                                            style={{ font: "600 24px/1.2 Poppins, system-ui, sans-serif", color: ink, margin: "7px 0 8px" }}
                                        >
                                            {res.price}
                                        </div>
                                        <div
                                            style={{
                                                font: "400 13.5px/1.55 Poppins, system-ui, sans-serif",
                                                color: body,
                                                marginBottom: 14,
                                            }}
                                        >
                                            {res.blurb}
                                        </div>
                                        <div
                                            style={{ font: "400 12.5px/1.5 Poppins, system-ui, sans-serif", color: body, marginBottom: 14 }}
                                        >
                                            Every add-on and its price is on the{" "}
                                            <a
                                                href={ADDONS_HREF}
                                                style={{ color: ink, fontWeight: 600, textDecoration: "underline", textUnderlineOffset: 3 }}
                                            >
                                                services page
                                            </a>
                                            .
                                        </div>
                                        <button
                                            onClick={contact}
                                            style={{
                                                cursor: "pointer",
                                                border: "none",
                                                borderRadius: 999,
                                                padding: "11px 20px",
                                                background: ACCENT,
                                                color: "#fff",
                                                font: "600 14px/1 Poppins, system-ui, sans-serif",
                                            }}
                                        >
                                            Let us talk it through →
                                        </button>
                                        <div style={{ font: "400 11.5px/1.5 Poppins, system-ui, sans-serif", color: body, marginTop: 12 }}>
                                            Already have a site? Send me the link and I will tell you what is wrong with it, free, no
                                            strings.
                                        </div>
                                    </div>
                                    {!reports &&
                                        (leadState === "done" ? (
                                            <div
                                                role="status"
                                                style={{
                                                    marginTop: 14,
                                                    font: "400 13.5px/1.55 Poppins, system-ui, sans-serif",
                                                    color: ink,
                                                }}
                                            >
                                                Thank you{lead.name.trim() ? `, ${lead.name.trim().split(/\s+/)[0]}` : ""}. Ryan will be in
                                                touch within one business day.
                                            </div>
                                        ) : !ask ? (
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setAsk(true)
                                                    window.setTimeout(() => leadNameRef.current?.focus(), 0)
                                                }}
                                                style={{
                                                    marginTop: 12,
                                                    background: "none",
                                                    border: "none",
                                                    padding: "6px 0",
                                                    minHeight: 44,
                                                    textAlign: "left",
                                                    cursor: "pointer",
                                                    color: ink,
                                                    textDecoration: "underline",
                                                    textUnderlineOffset: 3,
                                                    font: "500 13.5px/1.4 Poppins, system-ui, sans-serif",
                                                }}
                                            >
                                                Or leave your details and Ryan will reach out
                                            </button>
                                        ) : (
                                            <form
                                                noValidate
                                                data-jager-skip=""
                                                aria-label="Leave your details"
                                                onSubmit={(e) => {
                                                    e.preventDefault()
                                                    if (leadState !== "sending") void sendDetails()
                                                }}
                                                style={{ marginTop: 14, display: "flex", flexDirection: "column", gap: 10 }}
                                            >
                                                <label
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 5,
                                                        font: "500 13px/1.3 Poppins, system-ui, sans-serif",
                                                        color: ink,
                                                    }}
                                                >
                                                    Your name
                                                    <input
                                                        ref={leadNameRef}
                                                        name="name"
                                                        autoComplete="name"
                                                        value={lead.name}
                                                        onChange={(e) => setLead({ ...lead, name: e.target.value })}
                                                        onBlur={() => {
                                                            if (leadErr.name && lead.name.trim())
                                                                setLeadErr({ ...leadErr, name: undefined })
                                                        }}
                                                        aria-invalid={leadErr.name ? true : undefined}
                                                        aria-describedby={leadErr.name ? "nordy-lead-name-err" : undefined}
                                                        maxLength={120}
                                                        style={{
                                                            width: "100%",
                                                            boxSizing: "border-box",
                                                            padding: "10px 12px",
                                                            minHeight: 44,
                                                            borderRadius: 10,
                                                            border: `1px solid ${line}`,
                                                            background: surface,
                                                            color: ink,
                                                            font: "400 16px/1.4 Poppins, system-ui, sans-serif",
                                                            outlineOffset: 2,
                                                        }}
                                                    />
                                                </label>
                                                {leadErr.name && (
                                                    <div
                                                        id="nordy-lead-name-err"
                                                        style={{
                                                            font: "400 12.5px/1.4 Poppins, system-ui, sans-serif",
                                                            color: dark ? "#FFB4AB" : "#B3261E",
                                                        }}
                                                    >
                                                        {leadErr.name}
                                                    </div>
                                                )}
                                                <label
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 5,
                                                        font: "500 13px/1.3 Poppins, system-ui, sans-serif",
                                                        color: ink,
                                                    }}
                                                >
                                                    Email or phone
                                                    <input
                                                        ref={leadReachRef}
                                                        name="reach"
                                                        autoComplete="email"
                                                        inputMode="email"
                                                        value={lead.reach}
                                                        onChange={(e) => setLead({ ...lead, reach: e.target.value })}
                                                        onBlur={() => {
                                                            if (leadErr.reach && lead.reach.trim())
                                                                setLeadErr({ ...leadErr, reach: undefined })
                                                        }}
                                                        aria-invalid={leadErr.reach ? true : undefined}
                                                        aria-describedby={leadErr.reach ? "nordy-lead-reach-err" : undefined}
                                                        maxLength={160}
                                                        style={{
                                                            width: "100%",
                                                            boxSizing: "border-box",
                                                            padding: "10px 12px",
                                                            minHeight: 44,
                                                            borderRadius: 10,
                                                            border: `1px solid ${line}`,
                                                            background: surface,
                                                            color: ink,
                                                            font: "400 16px/1.4 Poppins, system-ui, sans-serif",
                                                            outlineOffset: 2,
                                                        }}
                                                    />
                                                </label>
                                                {leadErr.reach && (
                                                    <div
                                                        id="nordy-lead-reach-err"
                                                        style={{
                                                            font: "400 12.5px/1.4 Poppins, system-ui, sans-serif",
                                                            color: dark ? "#FFB4AB" : "#B3261E",
                                                        }}
                                                    >
                                                        {leadErr.reach}
                                                    </div>
                                                )}
                                                <label
                                                    style={{
                                                        display: "flex",
                                                        flexDirection: "column",
                                                        gap: 5,
                                                        font: "500 13px/1.3 Poppins, system-ui, sans-serif",
                                                        color: ink,
                                                    }}
                                                >
                                                    Anything Ryan should know (optional)
                                                    <textarea
                                                        name="note"
                                                        rows={2}
                                                        value={lead.note}
                                                        onChange={(e) => setLead({ ...lead, note: e.target.value })}
                                                        maxLength={2000}
                                                        style={
                                                            {
                                                                ...{
                                                                    width: "100%",
                                                                    boxSizing: "border-box",
                                                                    padding: "10px 12px",
                                                                    minHeight: 44,
                                                                    borderRadius: 10,
                                                                    border: `1px solid ${line}`,
                                                                    background: surface,
                                                                    color: ink,
                                                                    font: "400 16px/1.4 Poppins, system-ui, sans-serif",
                                                                    outlineOffset: 2,
                                                                },
                                                                resize: "vertical",
                                                            } as CSSProperties
                                                        }
                                                    />
                                                </label>
                                                <input
                                                    name="website_url"
                                                    tabIndex={-1}
                                                    aria-hidden="true"
                                                    autoComplete="off"
                                                    value={lead.trap}
                                                    onChange={(e) => setLead({ ...lead, trap: e.target.value })}
                                                    style={{
                                                        position: "absolute",
                                                        left: 0,
                                                        top: 0,
                                                        width: 1,
                                                        height: 1,
                                                        opacity: 0,
                                                        transform: "scale(0)",
                                                        pointerEvents: "none",
                                                    }}
                                                />
                                                <span
                                                    role="status"
                                                    aria-live="polite"
                                                    style={{
                                                        position: "absolute",
                                                        width: 1,
                                                        height: 1,
                                                        overflow: "hidden",
                                                        clipPath: "inset(50%)",
                                                        whiteSpace: "nowrap",
                                                    }}
                                                >
                                                    {leadErr.name || leadErr.reach || (leadState === "sending" ? "Sending" : "")}
                                                </span>
                                                <button
                                                    type="submit"
                                                    disabled={leadState === "sending"}
                                                    aria-disabled={leadState === "sending"}
                                                    style={{
                                                        cursor: leadState === "sending" ? "progress" : "pointer",
                                                        border: "none",
                                                        borderRadius: 999,
                                                        padding: "11px 20px",
                                                        minHeight: 44,
                                                        background: ACCENT,
                                                        color: "#fff",
                                                        opacity: leadState === "sending" ? 0.7 : 1,
                                                        font: "600 14px/1 Poppins, system-ui, sans-serif",
                                                        alignSelf: "flex-start",
                                                        transition: "opacity .18s ease",
                                                    }}
                                                >
                                                    {leadState === "sending" ? "Sending…" : "Have Ryan reach out"}
                                                </button>
                                                <div style={{ font: "400 12px/1.5 Poppins, system-ui, sans-serif", color: body }}>
                                                    Sent to Ryan, never to a third party.
                                                </div>
                                            </form>
                                        ))}
                                </>
                            )}

                            <div style={{ display: "flex", gap: 16, marginTop: 14 }}>
                                <Small onClick={() => go("bubble")} color={body}>
                                    Close
                                </Small>
                                {step !== "intro" && (
                                    <Small
                                        onClick={() => {
                                            ls()?.removeItem(KEY_STEP)
                                            ls()?.removeItem(KEY_MSG)
                                            ls()?.removeItem(KEY_WORK)
                                            setResume(null)
                                            setStep("intro")
                                        }}
                                        color={body}
                                    >
                                        Start over
                                    </Small>
                                )}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </>
    )
}
const P = ({ children, ink }: any) => (
    <div style={{ font: "600 18.5px/1.35 Poppins, system-ui, sans-serif", color: ink, marginBottom: 16 }}>{children}</div>
)
const Stack = ({ children }: any) => <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>{children}</div>
const Small = ({ children, onClick, color }: any) => (
    <button
        onClick={onClick}
        style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            font: "500 10px/1 'Geist Mono', ui-monospace, monospace",
            letterSpacing: ".09em",
            textTransform: "uppercase",
            color,
        }}
    >
        {children}
    </button>
)
Nordy.defaultProps = { contactPath: "/contact", alwaysShow: false }
addPropertyControls(Nordy, {
    contactPath: { type: ControlType.String, title: "Contact path", defaultValue: "/contact" },
    leadIntakeKey: {
        type: ControlType.String,
        title: "Lead intake key",
        defaultValue: "",
        description: "Per-site key for lead capture (not used in the public build).",
    },
    alwaysShow: {
        type: ControlType.Boolean,
        title: "Test nudge",
        defaultValue: false,
        description: "Ignores the once-per-visitor limit so the prompt can be retested.",
    },
})
