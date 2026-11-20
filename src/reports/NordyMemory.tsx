import { useEffect, useState } from "react"
import type { ComponentType } from "react"
import { addPropertyControls, ControlType } from "framer"
const KEY_STEP = "nordy-step-v1"
const KEY_MSG = "nordy-msg-v2"
function put(k: string, v: string) {
    if (typeof window === "undefined" || !v) return
    try {
        window.localStorage.setItem(k, v)
    } catch (e) {}
}
function get(k: string): string | null {
    if (typeof window === "undefined") return null
    try {
        return window.localStorage.getItem(k)
    } catch (e) {
        return null
    }
}
function drop(k: string) {
    if (typeof window === "undefined") return
    try {
        window.localStorage.removeItem(k)
    } catch (e) {}
}
export default function NordyStep(props: { step?: string; message?: string }) {
    const { step, message } = props
    useEffect(() => {
        if (step) put(KEY_STEP, step)
        if (message) put(KEY_MSG, message)
    }, [step, message])
    return <div style={{ width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
}
NordyStep.defaultProps = { step: "", message: "" }
addPropertyControls(NordyStep, {
    step: { type: ControlType.String, title: "Step", defaultValue: "" },
    message: { type: ControlType.String, title: "Message", defaultValue: "" },
})
export function withNordyMemory(Component: any): ComponentType {
    return (props: any) => {
        const [step, setStep] = useState<string | null>(null)
        useEffect(() => {
            const saved = get(KEY_STEP)
            if (saved && saved !== "0 Bubble") setStep(saved)
        }, [])
        if (!step) return <Component {...props} />
        return <Component {...props} variant={step} />
    }
}
export function withNordyReset(Component: any): ComponentType {
    return (props: any) => (
        <Component
            {...props}
            onTap={(e: any) => {
                drop(KEY_STEP)
                props.onTap?.(e)
            }}
        />
    )
}
export function NordyPrefill() {
    useEffect(() => {
        if (typeof window === "undefined") return
        let msg = get(KEY_MSG)
        if (!msg) {
            try {
                msg = new URLSearchParams(window.location.search).get("m")
            } catch (e) {}
        }
        if (!msg) return
        const fill = () => {
            const els = Array.from(document.querySelectorAll("textarea")) as HTMLTextAreaElement[]
            const el = els.find((t) => !t.value)
            if (!el) return false
            const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set
            if (setter) setter.call(el, msg as string)
            else el.value = msg as string
            el.dispatchEvent(new Event("input", { bubbles: true }))
            el.dispatchEvent(new Event("change", { bubbles: true }))
            drop(KEY_MSG)
            return true
        }
        if (fill()) return
        let n = 0
        const t = setInterval(() => {
            n += 1
            if (fill() || n > 50) clearInterval(t)
        }, 100)
        return () => clearInterval(t)
    }, [])
    return <div style={{ width: 1, height: 1, opacity: 0, pointerEvents: "none" }} />
}
