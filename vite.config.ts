import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath } from "node:url"

export default defineConfig({
    plugins: [react()],
    base: "./",
    resolve: {
        // The components were written for Framer; a small shim stands in for its runtime.
        alias: { framer: fileURLToPath(new URL("./src/shims/framer.ts", import.meta.url)) },
    },
})
