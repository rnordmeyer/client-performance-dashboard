import {
    healthPair,
    trafficChange,
    headlineMove,
    moveText,
    moveTone,
    posText,
    scoreText,
    fmtPct,
    dayShort,
    dayFull,
    monthLabel,
    parseDay,
    reportFileBase,
    ENGINE_NAMES,
    PILLAR_ROWS,
    CATEGORY_NAMES,
    type MsReport,
    type MsSnap,
    type Move,
} from "./ReportsMilestones.tsx"
import {
    POPPINS_SEMIBOLD,
    GEIST_REGULAR,
    GEIST_SEMIBOLD,
    NC_LOGO_PNG,
    NC_LOGO_RATIO,
    SUCHER_LOGO_PNG,
    SUCHER_LOGO_RATIO,
} from "./ReportsPdfFonts.tsx"
const JSPDF_URL = "https://esm.sh/jspdf@2.5.2"
const AUTOTABLE_URL = "https://esm.sh/jspdf-autotable@3.8.4?deps=jspdf@2.5.2"
type RGB = [number, number, number]
const hex = (h: string): RGB => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
const INK = hex("#16181c")
const BODY = hex("#3a3f47")
const MUTED = hex("#5d6470")
const HAIR = hex("#e2dcec")
const PURPLE = hex("#8b3dff")
const PURPLE_TEXT = hex("#7a2ee6")
const WASH = hex("#f7f4fc")
const ZEBRA = hex("#faf8fd")
const GOOD = hex("#1a7a48")
const BAD = hex("#b3261e")
const G_FROM = hex("#b98cff")
const G_TO = hex("#d04c9a")
const W = 612
const H = 792
const M = 54
const CW = W - 2 * M
const BOTTOM = H - M - 12
const TOP_NEXT = M + 14
const int = (n: number) => Math.round(n).toLocaleString("en-US")
const num = (v: any): number | null => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Number(v))
export interface PdfOptions {
    businessName: string
    domain: string
    demo: boolean
    now: Date
    history?: {
        key: string
        date: string
        overall: number
    }[]
}
export async function buildReportPdf(
    r: MsReport,
    o: PdfOptions,
): Promise<{
    name: string
    blob: Blob
}> {
    const [jsMod, atMod]: any[] = await Promise.all([import(JSPDF_URL), import(AUTOTABLE_URL)])
    const JsPDF = jsMod.jsPDF || jsMod.default
    const autoTable = atMod.default || atMod.autoTable
    if (typeof JsPDF !== "function" || typeof autoTable !== "function") throw new Error("The PDF tools did not load.")
    const doc = new JsPDF({ unit: "pt", format: "letter", orientation: "portrait", compress: true })
    doc.addFileToVFS("Poppins-SemiBold.ttf", POPPINS_SEMIBOLD)
    doc.addFont("Poppins-SemiBold.ttf", "Poppins", "bold")
    doc.addFileToVFS("Geist-Regular.ttf", GEIST_REGULAR)
    doc.addFont("Geist-Regular.ttf", "Geist", "normal")
    doc.addFileToVFS("Geist-SemiBold.ttf", GEIST_SEMIBOLD)
    doc.addFont("Geist-SemiBold.ttf", "Geist", "bold")
    const p = r.period
    const kind = p.kind === "quarter" ? "quarter" : p.kind === "month" ? "month" : "year"
    const client = o.businessName || "Your business"
    const isoToday = `${o.now.getFullYear()}-${String(o.now.getMonth() + 1).padStart(2, "0")}-${String(o.now.getDate()).padStart(2, "0")}`
    const prepared = o.now.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
    doc.setProperties({
        title: `${p.title}: ${client}`,
        subject: `${p.kind === "quarter" ? "Quarterly" : "Annual"} website report, ${p.dates}`,
        author: "Nordmeyer Creative",
        creator: "Nordmeyer Creative reports",
    })
    try {
        doc.setLanguage("en-US")
    } catch (e) {}
    let y = M
    const color = (c: RGB) => doc.setTextColor(c[0], c[1], c[2])
    const fill = (c: RGB) => doc.setFillColor(c[0], c[1], c[2])
    const stroke = (c: RGB) => doc.setDrawColor(c[0], c[1], c[2])
    const head = (size: number) => {
        doc.setFont("Poppins", "bold")
        doc.setFontSize(size)
    }
    const body = (size: number, bold = false) => {
        doc.setFont("Geist", bold ? "bold" : "normal")
        doc.setFontSize(size)
    }
    const text = (s: string, x: number, yy: number, opts: any = {}) => doc.text(s, x, yy, { baseline: "top", ...opts })
    const need = (h: number) => {
        if (y + h > BOTTOM) {
            doc.addPage()
            y = TOP_NEXT
        }
    }
    const gradient = (x: number, yy: number, w: number, h: number) => {
        const steps = 120
        const sw = w / steps
        for (let i = 0; i < steps; i++) {
            const t = i / (steps - 1)
            fill([0, 1, 2].map((k) => Math.round(G_FROM[k] + (G_TO[k] - G_FROM[k]) * t)) as RGB)
            doc.rect(x + i * sw, yy, sw + 0.6, h, "F")
        }
    }
    const para = (s: string, size = 10, c: RGB = BODY, width = CW, x = M, lh = 1.45, bold = false) => {
        body(size, bold)
        color(c)
        const lines: string[] = doc.splitTextToSize(s, width)
        const step = size * lh
        lines.forEach((ln) => {
            need(step)
            text(ln, x, y)
            y += step
        })
    }
    const HEAD_H2 = 45
    const HEAD_H3 = 18
    const TABLE_HEAD = 22
    const ROW = 24
    const KEEP_TABLE = TABLE_HEAD + 2 * ROW
    const h2 = (title: string, after = KEEP_TABLE) => {
        need(HEAD_H2 + after)
        y += 8
        head(15)
        color(INK)
        text(title, M, y)
        y += 23
        gradient(M, y, 32, 2.5)
        y += 14
    }
    const h3 = (title: string, after = KEEP_TABLE) => {
        need(HEAD_H3 + after)
        head(11.5)
        color(INK)
        text(title, M, y)
        y += 18
    }
    const changeWords = (
        from: number | null,
        to: number | null,
        unit: "pts" | "ms" | "count",
        better: "up" | "down" = "up",
    ): {
        t: string
        c: RGB
    } => {
        if (from === null || to === null) return { t: "No earlier figure", c: MUTED }
        const d = Math.round(to - from)
        if (d === 0) return { t: "No change", c: MUTED }
        const n = Math.abs(d)
        const u = unit === "pts" ? (n === 1 ? " pt" : " pts") : unit === "ms" ? " ms" : ""
        const good = better === "up" ? d > 0 : d < 0
        if (unit === "ms") return { t: `${n.toLocaleString("en-US")} ms ${d < 0 ? "faster" : "slower"}`, c: good ? GOOD : BAD }
        return { t: `${d > 0 ? "Up" : "Down"} ${n}${u}`, c: good ? GOOD : BAD }
    }
    const moveCell = (m: Move) => {
        const tone = moveTone(m)
        return { content: moveText(m), styles: { textColor: tone === "good" ? GOOD : tone === "bad" ? BAD : MUTED } }
    }
    const table = (headRow: string[], rows: any[][], extra: any = {}) => {
        need((headRow.length ? TABLE_HEAD : 0) + Math.min(2, rows.length) * ROW)
        autoTable(doc, {
            startY: y,
            head: headRow.length ? [headRow] : undefined,
            body: rows,
            theme: "plain",
            margin: { left: M, right: M, top: TOP_NEXT, bottom: H - BOTTOM },
            rowPageBreak: "avoid",
            styles: {
                font: "Geist",
                fontStyle: "normal",
                fontSize: 9,
                textColor: INK,
                cellPadding: { top: 5, bottom: 5, left: 6, right: 6 },
                overflow: "linebreak",
                valign: "middle",
                lineWidth: 0,
            },
            headStyles: { font: "Geist", fontStyle: "bold", fontSize: 8, textColor: MUTED, fillColor: [255, 255, 255] },
            alternateRowStyles: { fillColor: ZEBRA },
            didDrawCell: (d: any) => {
                if (d.section === "head") {
                    stroke(PURPLE)
                    doc.setLineWidth(0.8)
                    doc.line(d.cell.x, d.cell.y + d.cell.height, d.cell.x + d.cell.width, d.cell.y + d.cell.height)
                }
            },
            ...extra,
        })
        y = (doc as any).lastAutoTable.finalY + 14
    }
    const statBoxes = (
        items: {
            label: string
            value: string
            sub?: string
            subColor?: RGB
        }[],
    ) => {
        const gap = 12
        const bw = (CW - gap * (items.length - 1)) / items.length
        const bh = 64
        need(bh + 10)
        items.forEach((it, i) => {
            const x = M + i * (bw + gap)
            stroke(HAIR)
            doc.setLineWidth(0.8)
            doc.roundedRect(x, y, bw, bh, 6, 6, "S")
            body(8)
            color(MUTED)
            text(it.label, x + 12, y + 10, { maxWidth: bw - 24 })
            head(18)
            color(INK)
            text(it.value, x + 12, y + 23, { maxWidth: bw - 24 })
            if (it.sub) {
                body(7.5)
                color(it.subColor || MUTED)
                text((doc.splitTextToSize(it.sub, bw - 24) as string[])[0], x + 12, y + 47)
            }
        })
        y += bh + 14
    }
    const bullets = (items: string[], size = 10, c: RGB = INK, dot: RGB = PURPLE) => {
        body(size)
        items.forEach((s) => {
            const lines: string[] = doc.splitTextToSize(s, CW - 16)
            const step = size * 1.45
            need(step * lines.length + 4)
            fill(dot)
            doc.circle(M + 3.5, y + size * 0.62, 2, "F")
            color(c)
            lines.forEach((ln, i) => text(ln, M + 14, y + i * step))
            y += step * lines.length + 4
        })
    }
    const hatchRect = (x: number, yy: number, w: number, h: number) => {
        doc.saveGraphicsState()
        doc.rect(x, yy, w, h, null)
        doc.clip()
        doc.discardPath()
        stroke(PURPLE)
        doc.setLineWidth(1.1)
        for (let d = -h; d < w + h; d += 3) doc.line(x + d, yy + h, x + d + h, yy)
        doc.restoreGraphicsState()
        stroke(PURPLE)
        doc.setLineWidth(0.8)
        doc.rect(x, yy, w, h, "S")
    }
    const monthTick = (key: string) => parseDay(key).toLocaleDateString("en-US", { month: "short" })
    const sinceCaption = (
        series: MsReport["health"]["series"],
    ): {
        t: string
        c: RGB
    } | null => {
        if (series.length < 2) return null
        const a = series[0]
        const b = series[series.length - 1]
        const d = b.overall - a.overall
        const when = parseDay(a.date).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        if (d === 0) return { t: `No change since ${when}`, c: MUTED }
        return {
            t: `${d > 0 ? "Up" : "Down"} ${Math.abs(d)} ${Math.abs(d) === 1 ? "point" : "points"} since ${when}`,
            c: d > 0 ? GOOD : BAD,
        }
    }
    const scoreChart = (series: MsReport["health"]["series"], x: number, yy: number, w: number, h: number) => {
        const axisW = 22
        const x0 = x + axisW
        const cw2 = w - axisW
        const yOf = (v: number) => yy + h - (v / 100) * h
        ;[0, 50, 100].forEach((v) => {
            stroke(hex("#e6e3ec"))
            doc.setLineWidth(0.6)
            doc.line(x0, yOf(v), x0 + cw2, yOf(v))
            body(6.5)
            color(MUTED)
            text(`${v}`, x0 - 5, yOf(v) - 3.2, { align: "right" })
        })
        const n = series.length
        if (!n) return
        const band = cw2 / n
        const cx = (i: number) => x0 + band * i + band / 2
        const labelAll = band >= 14
        if (n <= 12) {
            const bw = Math.min(22, band * 0.56)
            series.forEach((pt, i) => {
                const bh = Math.max(1.5, (pt.overall / 100) * h)
                fill(PURPLE)
                doc.rect(cx(i) - bw / 2, yy + h - bh, bw, bh, "F")
            })
        } else {
            stroke(PURPLE)
            doc.setLineWidth(1.4)
            for (let i = 1; i < n; i++) doc.line(cx(i - 1), yOf(series[i - 1].overall), cx(i), yOf(series[i].overall))
            series.forEach((pt, i) => {
                fill(PURPLE)
                doc.circle(cx(i), yOf(pt.overall), 1.8, "F")
            })
        }
        series.forEach((pt, i) => {
            if (labelAll || i === 0 || i === n - 1) {
                body(band >= 20 ? 6.5 : 6)
                color(BODY)
                text(`${pt.overall}`, cx(i), yOf(pt.overall) - 9, { align: "center" })
            }
            if (labelAll || i % 2 === 0 || i === n - 1) {
                const d = parseDay(pt.key)
                body(6.5)
                color(MUTED)
                text(monthTick(pt.key), cx(i), yy + h + 4, { align: "center" })
                if (i === 0 || d.getMonth() === 0) text(`${d.getFullYear()}`, cx(i), yy + h + 12, { align: "center" })
            }
        })
    }
    const logoH = 26
    doc.addImage(NC_LOGO_PNG, "PNG", M, M, logoH * NC_LOGO_RATIO, logoH)
    const sH = 20
    doc.addImage(SUCHER_LOGO_PNG, "PNG", W - M - sH * SUCHER_LOGO_RATIO, M + 3, sH * SUCHER_LOGO_RATIO, sH)
    y = M + 46
    gradient(M, y, CW, 2.5)
    y += 26
    body(8.5, true)
    color(PURPLE_TEXT)
    doc.setCharSpace(1.4)
    text(p.kind === "quarter" ? "QUARTERLY REPORT" : p.kind === "month" ? "MONTHLY REPORT" : "ANNUAL REPORT", M, y)
    doc.setCharSpace(0)
    y += 16
    head(30)
    color(INK)
    text(p.title, M, y)
    y += 42
    body(12, true)
    color(INK)
    text(client, M, y)
    const cw = doc.getTextWidth(client)
    if (o.domain) {
        body(12)
        color(BODY)
        text(`  ·  ${o.domain}`, M + cw, y)
    }
    y += 19
    body(9.5)
    color(MUTED)
    text(`${p.long}  ·  ${p.dates}`, M, y)
    y += 14
    text(`${p.closed ? "Closed" : "In progress"}  ·  Prepared ${prepared}`, M, y)
    y += 14
    if (o.demo) {
        body(9, true)
        color(PURPLE_TEXT)
        text("Sample report made from invented data for a demo business.", M, y)
        y += 14
    }
    y += 12
    const hp = healthPair(r)
    const series = o.history && o.history.length > r.health.series.length ? o.history : r.health.series
    const panelH = series.length >= 2 ? 214 : 112
    fill(WASH)
    stroke(HAIR)
    doc.setLineWidth(0.8)
    doc.roundedRect(M, y, CW, panelH, 8, 8, "FD")
    const px = M + 20
    const rx = M + CW * 0.6
    body(8.5, true)
    color(MUTED)
    text("OVERALL HEALTH", px, y + 16, { charSpace: 0.8 })
    const to = num(hp.to?.overall)
    if (to === null) {
        head(16)
        color(INK)
        text("No complete check in this period", px, y + 36)
    } else {
        head(38)
        color(INK)
        text(`${to}`, px, y + 30)
        const bx = px + doc.getTextWidth(`${to}`) + 12
        head(13)
        text(`Grade ${hp.to?.grade || "none"}`, bx, y + 47)
        body(8)
        color(MUTED)
        text(`At the check on ${dayShort(hp.to!.run_date)}`, px, y + 76)
        if (series.length >= 2) {
            scoreChart(series, px, y + 104, rx - 36 - px, 60)
            const cap = sinceCaption(series)
            if (cap) {
                body(8.5, true)
                color(cap.c)
                text(cap.t, px, y + panelH - 20)
            }
        } else {
            body(8.5)
            color(MUTED)
            text("One check so far, so there is no history to chart yet.", px, y + 90)
        }
    }
    stroke(HAIR)
    doc.line(rx - 18, y + 16, rx - 18, y + panelH - 16)
    const facts: [string, string][] = [
        [
            "Google page one now",
            r.search.tracked && r.search.pageOne.now !== null
                ? `${r.search.pageOne.now} of ${r.search.counts.now} keywords`
                : "Not tracked yet",
        ],
        [p.closed ? "Visits" : "Visits so far", r.traffic.visits === null ? "No data" : int(r.traffic.visits)],
        ["Uptime", fmtPct(r.uptime.pct)],
    ]
    facts.forEach(([k, v], i) => {
        const fy = y + 16 + i * 30
        body(8)
        color(MUTED)
        text(k, rx, fy)
        body(12, true)
        color(INK)
        text(v, rx, fy + 11)
    })
    y += panelH + 22
    h2("In short", 3 * 19)
    bullets(r.summary, 10.5)
    const hh = r.health
    const histH = hh.series.length >= 2 ? 150 : 0
    h2("Site health", hh.end ? 46 + histH + TABLE_HEAD + 7 * ROW : 30)
    if (!hh.end) {
        para(`No complete site check ran in this ${kind}.`)
    } else {
        head(30)
        color(INK)
        const endScore = num(hh.end.overall)
        const endText = endScore === null ? "No data" : `${endScore}`
        text(endText, M, y)
        const endW = doc.getTextWidth(endText)
        head(12)
        text(`Grade ${hh.end.grade || "none"}`, M + endW + 10, y + 13)
        body(8.5)
        color(MUTED)
        text(`Overall health at the check on ${dayFull(hh.end.run_date)}`, M, y + 36)
        y += 50
        if (series.length >= 2) {
            body(9, true)
            color(INK)
            text("Overall health at each monthly check", M, y)
            y += 22
            scoreChart(series, M, y, CW, 84)
            y += 84 + 20
            const cap = sinceCaption(series)
            if (cap) {
                body(8.5, true)
                color(cap.c)
                text(cap.t, M, y)
                y += 18
            }
        }
        const single = !hh.start || hh.start.id === hh.end.id
        const fromSnap = hp.from
        const fromLabel = fromSnap ? `${fromSnap === hh.before ? "Before" : "Start"} (${dayShort(fromSnap.run_date)})` : ""
        const headRow = fromSnap
            ? ["Score", fromLabel, `${single ? "Only check" : "End"} (${dayShort(hh.end.run_date)})`, "Change"]
            : ["Score", `Check (${dayShort(hh.end.run_date)})`]
        const v = (x: MsSnap | null, k: keyof MsSnap) => (x ? num(x[k]) : null)
        const rows = [{ key: "overall" as keyof MsSnap, label: "Overall" }, ...PILLAR_ROWS].map(({ key, label }) => {
            const a = v(fromSnap, key)
            const b = v(hh.end, key)
            const ch = changeWords(a, b, "pts")
            const cells: any[] = [{ content: label, styles: { fontStyle: key === "overall" ? "bold" : "normal" } }]
            if (fromSnap) cells.push(a === null ? "No data" : `${a}`)
            cells.push({ content: b === null ? "No data" : `${b}`, styles: { fontStyle: "bold" } })
            if (fromSnap) cells.push({ content: ch.t, styles: { textColor: ch.c } })
            return cells
        })
        table(headRow, rows, { pageBreak: "avoid" })
        para(
            "The overall score combines search basics, speed, accessibility, best practices, on-page setup and security. It does not include rankings or traffic.",
            8.5,
            MUTED,
        )
        if (hh.before && fromSnap !== hh.before)
            para(`Before this ${kind} began, on ${dayShort(hh.before.run_date)}, overall health was ${scoreText(hh.before)}.`, 8.5, MUTED)
    }
    const s = r.search
    h2("Search engines: where you started and where you are now", 2 * 14 + 84)
    if (!s.tracked) para("No keywords are being tracked for this site yet.")
    else if (s.noRunInPeriod)
        para(`No keyword checks ran in this ${kind}. Keyword tracking for this site began on ${dayFull(s.firstRun || "")}.`)
    else {
        const multi = s.startRun !== s.nowRun
        para(
            `${multi ? `Start is the check on ${dayFull(s.startRun || "")}; now is the check on ${dayFull(s.nowRun || "")}.` : `One check ran, on ${dayFull(s.nowRun || "")}.`} The headline figures use Google. Position 1 is the top result and positions 1 to 10 are page one. We check the top 50 results on each search engine.`,
            9,
            BODY,
        )
        y += 6
        const pgCh = changeWords(s.pageOne.start, s.pageOne.now, "count")
        statBoxes([
            {
                label: `On Google page one at the start`,
                value: multi ? `${s.pageOne.start ?? 0} of ${s.counts.start}` : "Same check",
                sub: multi ? `Check on ${dayShort(s.startRun || "")}` : "Only one check this period",
            },
            {
                label: "On Google page one now",
                value: `${s.pageOne.now ?? 0} of ${s.counts.now}`,
                sub: multi ? `${pgCh.t} this ${kind}` : `Check on ${dayShort(s.nowRun || "")}`,
                subColor: multi ? pgCh.c : MUTED,
            },
            {
                label: "At your first check",
                value: `${s.pageOne.first ?? 0} of ${s.counts.first}`,
                sub: `On ${dayShort(s.firstRun || "")}`,
            },
        ])
        const best = headlineMove(r)
        need((best ? 18 : 0) + 4 + TABLE_HEAD + Math.min(2, s.rows.length) * ROW)
        if (best)
            para(
                `Biggest Google move: “${best.keyword}”, from ${best.start === null ? "not in the top 50" : `position ${best.start}`} to position ${best.now}.`,
                9.5,
                INK,
                CW,
                M,
                1.45,
                true,
            )
        y += 4
        table(
            ["Keyword", "Start", "Now", `This ${kind}`, "First check", "Since first check"],
            s.rows.map((k) => [
                k.keyword,
                posText(k.start),
                { content: posText(k.now), styles: { fontStyle: "bold" } },
                moveCell(k.move),
                posText(k.first),
                moveCell(k.moveAll),
            ]),
            {
                columnStyles: {
                    0: { cellWidth: 112 },
                    1: { cellWidth: 70 },
                    2: { cellWidth: 70 },
                    3: { cellWidth: 91 },
                    4: { cellWidth: 70 },
                    5: { cellWidth: 91 },
                },
            },
        )
        doc.addPage()
        y = TOP_NEXT
        h3("Every search engine", 30 + KEEP_TABLE)
        para(
            `${multi ? "Start to now" : "Positions"} on each search engine. Only Google counts toward page one in this report. Not checked means that search engine could not be read at that check.`,
            9,
            BODY,
        )
        y += 6
        table(
            ["Keyword", ...ENGINE_NAMES.map(([, n]) => n)],
            s.rows.map((k) => [
                k.keyword,
                ...ENGINE_NAMES.map(([e]) => {
                    const a = k.startBy ? k.startBy[e] : undefined
                    const b = k.nowBy ? k.nowBy[e] : undefined
                    return multi ? `${posText(a)} to ${posText(b)}` : posText(b)
                }),
            ]),
            {
                columnStyles: {
                    0: { cellWidth: 112 },
                    1: { cellWidth: 98 },
                    2: { cellWidth: 98 },
                    3: { cellWidth: 98 },
                    4: { cellWidth: 98 },
                },
            },
        )
    }
    const t = r.traffic
    h2("Traffic", 84)
    if (t.visits === null) para(`No traffic data was recorded for this ${kind}${p.closed ? "" : " yet"}.`)
    else {
        const cmp = (f: "visits" | "unique") => {
            const ch = trafficChange(r, f)
            if (!ch) return { sub: `No data for ${p.prevName} to compare`, c: MUTED }
            if (ch.pct === 0) return { sub: `Level with ${p.prevName}`, c: MUTED }
            return {
                sub: `${ch.pct > 0 ? "Up" : "Down"} ${Math.abs(ch.pct).toLocaleString("en-US", { maximumFractionDigits: 1 })}% on ${p.prevName}${ch.perDay ? " per day" : ""}`,
                c: ch.pct > 0 ? GOOD : BAD,
            }
        }
        const cv = cmp("visits")
        const cu = cmp("unique")
        statBoxes([
            { label: p.closed ? "Visits" : "Visits so far", value: int(t.visits), sub: cv.sub, subColor: cv.c },
            {
                label: p.closed ? "Unique visitors" : "Unique visitors so far",
                value: t.unique === null ? "No data" : int(t.unique),
                sub: cu.sub,
                subColor: cu.c,
            },
        ])
        if (t.prev)
            para(
                `${p.prevName.charAt(0).toUpperCase()}${p.prevName.slice(1)}: ${t.prev.visits === null ? "no data" : int(t.prev.visits)} visits and ${t.prev.unique === null ? "no data" : int(t.prev.unique)} unique visitors.`,
                8.5,
                MUTED,
            )
        y += 6
        const chartH = 132
        need(chartH + 64)
        body(9, true)
        color(INK)
        text("Visits by month", M, y)
        y += 18
        const axisW = 34
        const x0 = M + axisW
        const cwid = CW - axisW
        const vals = t.months.map((m) => m.visits || 0)
        const rawMax = Math.max(1, ...vals)
        const pow = Math.pow(10, Math.floor(Math.log10(rawMax)))
        const top = ([1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10].find((k) => rawMax * 1.08 <= k * pow) || 10) * pow
        const yOf = (v: number) => y + chartH - (v / top) * chartH
        ;[0, 0.5, 1].forEach((f) => {
            const ly = yOf(top * f)
            stroke(hex("#e6e3ec"))
            doc.setLineWidth(0.6)
            doc.line(x0, ly, x0 + cwid, ly)
            body(7)
            color(MUTED)
            text(int(top * f), x0 - 6, ly - 3.5, { align: "right" })
        })
        const band = cwid / t.months.length
        const bw = Math.min(26, band * 0.56)
        t.months.forEach((m, i) => {
            const cx = x0 + band * i + band / 2
            if (m.visits !== null) {
                const bh = Math.max(1.5, (m.visits / top) * chartH)
                if (m.days < m.total) hatchRect(cx - bw / 2, y + chartH - bh, bw, bh)
                else {
                    fill(PURPLE)
                    doc.rect(cx - bw / 2, y + chartH - bh, bw, bh, "F")
                }
                if (band >= 24) {
                    body(6.5)
                    color(BODY)
                    text(int(m.visits), cx, y + chartH - bh - 9, { align: "center" })
                }
            } else {
                body(6.5)
                color(MUTED)
                text(m.key > `${isoToday.slice(0, 7)}-01` ? "Not yet" : "No data", cx, y + chartH - 10, { align: "center" })
            }
            const d = parseDay(m.key)
            body(7.5)
            color(MUTED)
            text(d.toLocaleDateString("en-US", { month: "short" }), cx, y + chartH + 5, { align: "center" })
            if (i === 0 || d.getMonth() === 0) text(`${d.getFullYear()}`, cx, y + chartH + 15, { align: "center" })
        })
        y += chartH + 30
        fill(PURPLE)
        doc.rect(M, y, 8, 8, "F")
        body(8)
        color(BODY)
        text("Visits in the month", M + 12, y)
        if (t.partial.length) {
            hatchRect(M + 112, y, 8, 8)
            body(8)
            color(BODY)
            text("Striped bars are partial months", M + 124, y)
        }
        y += 22
        table(
            ["Month", "Visits", "Unique visitors", "Days counted"],
            t.months.map((m) => [
                monthLabel(m.key),
                m.visits === null ? "No data" : int(m.visits),
                m.unique === null ? "No data" : int(m.unique),
                m.visits === null ? "None" : `${m.days} of ${m.total}`,
            ]),
            { pageBreak: "avoid" },
        )
        const notes: string[] = []
        if (t.missing.length) notes.push(`No traffic data for ${t.missing.map(monthLabel).join(", ")}.`)
        t.partial.forEach((m) => notes.push(`${monthLabel(m.key)}: traffic counted for ${m.days} of ${m.total} days.`))
        if (trafficChange(r, "visits")?.perDay)
            notes.push("The two periods have a different number of days counted, so the change is a daily average.")
        notes.forEach((n) => para(n, 8.5, MUTED))
    }
    const u = r.uptime
    h2("Uptime", 3 * ROW)
    const upRows: any[][] = []
    if (u.pct === null) upRows.push(["Uptime", `No uptime checks were recorded for this ${kind}`])
    else {
        upRows.push(["Uptime", { content: fmtPct(u.pct), styles: { fontStyle: "bold" } }])
        upRows.push([
            "Days with an outage",
            u.outageDays
                ? { content: `${u.outageDays} (at least one check missed)`, styles: { textColor: BAD } }
                : "0, every check found the site up",
        ])
    }
    if (u.respStart && u.respEnd) {
        const rc = changeWords(u.respStart.ms, u.respEnd.ms, "ms", "down")
        upRows.push([
            "Response time at monthly check",
            u.respStart.date === u.respEnd.date
                ? `${int(u.respEnd.ms)} ms on ${dayShort(u.respEnd.date)}`
                : {
                      content: `${int(u.respStart.ms)} ms (${dayShort(u.respStart.date)}) to ${int(u.respEnd.ms)} ms (${dayShort(u.respEnd.date)}), ${rc.t.toLowerCase()}`,
                      styles: { textColor: INK },
                  },
        ])
    } else upRows.push(["Response time at monthly check", `Not measured in this ${kind}`])
    table([], upRows, { pageBreak: "avoid", columnStyles: { 0: { cellWidth: 170, textColor: MUTED } } })
    const iss = r.issues
    h2("Issues fixed", 3 * 15 + HEAD_H3 + 2 * 16)
    if (!iss.from || !iss.to) para("Only one site check, or none, so there is nothing to compare yet.")
    else {
        const ic = changeWords(num(iss.from.issues_count), num(iss.to.issues_count), "count", "down")
        para(
            `Issues found: ${num(iss.from.issues_count) ?? "no data"} on ${dayShort(iss.from.run_date)} to ${num(iss.to.issues_count) ?? "no data"} on ${dayShort(iss.to.run_date)}.`,
            10,
            INK,
        )
        const i0 = num(iss.from.issues_count)
        const i1 = num(iss.to.issues_count)
        if (i0 !== null && i1 !== null)
            para(
                i1 === i0
                    ? "No change in the number of issues."
                    : `${Math.abs(i1 - i0)} ${i1 < i0 ? "fewer" : "more"} ${Math.abs(i1 - i0) === 1 ? "issue" : "issues"} than at the start.`,
                9,
                ic.c,
                CW,
                M,
                1.45,
                true,
            )
        y += 6
        h3(`Resolved (${iss.resolved.length})`, 2 * 16)
        if (iss.resolved.length) bullets(iss.resolved, 9.5, INK, GOOD)
        else para("No plan items were resolved between these two checks.", 9, MUTED)
        y += 4
        h3(`Still open (${iss.open.length})`, 2 * 16)
        if (iss.open.length) bullets(iss.open, 9.5, BODY, MUTED)
        else para("Nothing from the start of the period is still open.", 9, MUTED)
        if (iss.added)
            para(`${iss.added} new ${iss.added === 1 ? "item was" : "items were"} added to the plan during the ${kind}.`, 8.5, MUTED)
    }
    const wk = r.work
    h2("Work completed", 18 + HEAD_H3 + 2 * 36)
    para(
        `${wk.done.length} ${wk.done.length === 1 ? "thing" : "things"} done${wk.carried !== null ? `, ${wk.carried} ${p.closed ? "carried into the next period" : "still open"}` : ""}.`,
        9.5,
        BODY,
    )
    y += 4
    if (!wk.groups.length) para(`No finished work was logged in this ${kind}${p.closed ? "" : " yet"}.`, 9, MUTED)
    wk.groups.forEach((g) => {
        h3(`${CATEGORY_NAMES[g.category] || "Other updates"} (${g.items.length})`, Math.min(2, g.items.length) * 36)
        const rows: any[][] = []
        g.items.forEach((w) => {
            const date = parseDay(w.done_on).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
            if (w.detail) {
                rows.push([
                    { content: date, rowSpan: 2, styles: { textColor: MUTED, valign: "top" } },
                    { content: w.title, styles: { fontStyle: "bold", cellPadding: { top: 6, bottom: 1, left: 6, right: 6 } } },
                ])
                rows.push([
                    {
                        content: w.detail,
                        styles: { textColor: BODY, fontSize: 8.5, cellPadding: { top: 1, bottom: 7, left: 6, right: 6 } },
                    },
                ])
            } else
                rows.push([
                    { content: date, styles: { textColor: MUTED } },
                    { content: w.title, styles: { fontStyle: "bold" } },
                ])
        })
        table([], rows, { alternateRowStyles: {}, columnStyles: { 0: { cellWidth: 84 } }, rowPageBreak: "avoid" })
    })
    need(64)
    y += 10
    stroke(HAIR)
    doc.setLineWidth(0.6)
    doc.line(M, y, M + CW, y)
    y += 10
    para(
        "Scores are point-in-time measurements from public testing tools such as Google Lighthouse. They help us find and fix problems, but they are not a guarantee of security, accessibility, or search rankings.",
        8,
        MUTED,
    )
    para("Questions about this report: hello@nordmeyercreative.com", 8, MUTED)
    const total = doc.getNumberOfPages()
    const footer = `Prepared by Nordmeyer Creative for ${client}  ·  nordmeyercreative.com  ·  hello@nordmeyercreative.com`
    for (let i = 1; i <= total; i++) {
        doc.setPage(i)
        gradient(0, 0, W, 4)
        if (i > 1) {
            body(7.5)
            color(MUTED)
            text(`${p.title}  ·  ${client}`, M, M - 24)
        }
        stroke(HAIR)
        doc.setLineWidth(0.6)
        doc.line(M, H - M + 6, W - M, H - M + 6)
        body(7.5)
        color(MUTED)
        const pageLabel = `Page ${i} of ${total}`
        const pw = doc.getTextWidth(pageLabel)
        const line = (doc.splitTextToSize(footer, CW - pw - 18) as string[])[0]
        text(line, M, H - M + 14)
        text(pageLabel, W - M, H - M + 14, { align: "right" })
    }
    const blob: Blob = doc.output("blob")
    return { name: `${reportFileBase(r, client)}.pdf`, blob }
}
export default function ReportsPdf() {
    return null
}
