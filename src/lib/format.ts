const monthFmt = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric" })
const shortMonthFmt = new Intl.DateTimeFormat("en-US", { month: "short" })
const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" })
const numFmt = new Intl.NumberFormat("en-US")

/** Parses a YYYY-MM-DD string as a local date (avoids the UTC off-by-one). */
export function parseDay(s: string): Date {
  const [y, m, d] = s.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export const monthLabel = (s: string) => monthFmt.format(parseDay(s))
export const shortMonth = (s: string) => shortMonthFmt.format(parseDay(s))
export const dayLabel = (s: string) => dayFmt.format(parseDay(s))
export const num = (n: number) => numFmt.format(n)

export function grade(score: number): string {
  return score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F"
}

/** Signed change with words, so meaning never depends on color alone. */
export function delta(current: number, previous: number | undefined, unit = "", higherIsBetter = true) {
  if (previous === undefined) return { text: "First month", tone: "neutral" as const }
  const diff = Math.round((current - previous) * 10) / 10
  if (diff === 0) return { text: "No change", tone: "neutral" as const }
  return {
    text: `${diff > 0 ? "Up" : "Down"} ${num(Math.abs(diff))}${unit} from last month`,
    tone: diff > 0 === higherIsBetter ? ("good" as const) : ("bad" as const),
  }
}
