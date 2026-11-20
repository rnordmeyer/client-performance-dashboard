import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import ReportsDashboard from "./reports/ReportsDashboardV2"

// The production dashboard, rendered in demo mode: invented data, no network requests for data.
createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <ReportsDashboard
            demoMode
            signInPath="https://nordmeyercreative.com/reports"
            contactPath="https://nordmeyercreative.com/contact"
            plansPath="https://nordmeyercreative.com/solutions"
            aboutPath="https://nordmeyercreative.com/sucher"
            style={{ width: "100%", minHeight: "100vh" }}
        />
    </StrictMode>,
)
