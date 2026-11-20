// Minimal stand-ins for the Framer runtime so the components run in a plain
// React app. In Framer, these power the editor's property panel.
export function addPropertyControls(_component: unknown, _controls: unknown) {}
export const ControlType = new Proxy({} as Record<string, string>, { get: (_t, k) => String(k) })
export function useIsStaticRenderer() {
    return false
}
export function useRouter() {
    return null
}
