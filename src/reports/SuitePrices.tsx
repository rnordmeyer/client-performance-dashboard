export type SuiteKey = "klarwerk" | "grundwerk" | "meisterwerk" | "klarwerk-store" | "grundwerk-store" | "meisterwerk-store"
export const SUITES: Record<
    SuiteKey,
    {
        name: string
        price: number
        month13: number
        pages: number
        products: number | null
    }
> = {
    klarwerk: { name: "Klarwerk", price: 199, month13: 129, pages: 5, products: null },
    grundwerk: { name: "Grundwerk", price: 349, month13: 249, pages: 10, products: null },
    meisterwerk: { name: "Meisterwerk", price: 599, month13: 449, pages: 15, products: null },
    "klarwerk-store": { name: "Klarwerk Store", price: 399, month13: 299, pages: 10, products: 25 },
    "grundwerk-store": { name: "Grundwerk Store", price: 549, month13: 399, pages: 15, products: 100 },
    "meisterwerk-store": { name: "Meisterwerk Store", price: 899, month13: 699, pages: 20, products: 500 },
}
export const perMo = (n: number) => `$${n} / mo`
export const priceLine = (k: SuiteKey) => `$${SUITES[k].price} a month, then $${SUITES[k].month13} from month 13`
export const upTo = (n: number | null) => (n == null ? "" : `Up to ${n}`)
