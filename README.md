# Client Reports Dashboard

The monthly website report I designed and built for the clients of my web studio, [Nordmeyer Creative](https://nordmeyercreative.com). This is the **production code** behind the public demo, running here on invented data for a fictional business, "Harbor & Pine Bakery."

**[Open the live demo](https://rnordmeyer.github.io/client-performance-dashboard/)**

![Dashboard screenshot](docs/screenshot.png)

## The problem

Small-business owners pay for website care but rarely see what it does. Typical SEO and analytics reports are long PDFs full of jargon that go unread, and the client is left asking, "Is my website OK?"

## What it does

- **One health score** (0 to 100, with a grade) that combines search basics, speed, accessibility, best practices, on-page setup and security.
- **Every number shows its change** from last month, in words and with an arrow, never color alone. A month in progress is compared as a daily average.
- **Sections for each concern:** health, traffic, search positions across four engines, AI search visibility, uptime from 5-minute checks, a work log, and a plain-English plan of what to fix next.
- **Notices** for what matters this month, such as an outage or a search that reached page one.
- **Monthly PDF** of any month, generated in the browser.
- **Plan-aware:** each client sees the sections their plan includes. Staff can preview any plan.
- **Guided tour** from Nordy, the studio's assistant, for first-time visitors.
- **Accessible:** WCAG 2.1 AA contrast in light and dark themes, full keyboard support, a table view for every chart, reduced-motion support.

## How it is built

- **React and TypeScript**, written as Framer code components and run here in a plain Vite app. A small shim (`src/shims/framer.ts`) stands in for the Framer runtime.
- **Data:** Postgres on Supabase, read with plain `fetch` calls. Clients only ever hold a publishable key and their own session; row level security decides which client's rows each login can read, and the browser has no write access. [`db/schema.sql`](db/schema.sql) is a simplified version of the core schema.
- **Demo mode** builds all sample data in the browser and sends no data requests.
- No UI or chart libraries: charts, icons and the score ring are hand-written SVG. `framer-motion` handles transitions; `jsPDF` is loaded only when a PDF is requested.

## Run it

```bash
npm install
npm run dev
```

## What is not here

The audit engine that produces the scores, the lead-management desk, lead capture, and all client data are private. The lead desk and lead capture are replaced with empty stubs, and code comments were removed for publication.

---

© 2026 Ryan Nordmeyer. Shared for portfolio review; not licensed for reuse.
