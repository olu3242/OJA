// GAARII Garri plans — the only pricing in the MVP.
// All-in prices: supplier cost, packaging, shipping, payment fees,
// spoilage/loss allowance, and margin included (docs/PRICING_STRATEGY.md).
export type PlanTier = "STARTER" | "FAMILY" | "STOCK_UP";

export const PLANS: Record<
  PlanTier,
  {
    label: string;
    blurb: string;
    lbsMin: number;
    lbsMax: number;
    defaultLbs: number;
    priceMinCents: number;
    priceMaxCents: number;
    defaultPriceCents: number;
    hero: boolean;
  }
> = {
  STARTER: {
    label: "Starter",
    blurb: "3–5 lb of Premium Garri · best for singles/couples",
    lbsMin: 3,
    lbsMax: 5,
    defaultLbs: 4,
    priceMinCents: 2400,
    priceMaxCents: 3400,
    defaultPriceCents: 2900,
    hero: false,
  },
  FAMILY: {
    label: "Family",
    blurb: "10–15 lb of Premium Garri · best for families",
    lbsMin: 10,
    lbsMax: 15,
    defaultLbs: 12,
    priceMinCents: 4900,
    priceMaxCents: 7900,
    defaultPriceCents: 6400,
    hero: true,
  },
  STOCK_UP: {
    label: "Stock-Up",
    blurb: "20–25 lb of Premium Garri · best for bulk households",
    lbsMin: 20,
    lbsMax: 25,
    defaultLbs: 22,
    priceMinCents: 8900,
    priceMaxCents: 11900,
    defaultPriceCents: 10400,
    hero: false,
  },
};

export const GARRI_SKU_CODES = {
  WHITE_IJEBU: "GAR-WHT-IJEBU",
  YELLOW: "GAR-YEL",
} as const;

export const MARGIN_FLOOR = 0.3; // no shipped plan below 30% GM after shipping
export const FIRST_DELIVERY_DISCOUNT = 0.1; // 10% (range 10–15%), first delivery only

// Zone-economics guardrail (MARGIN_AND_SHIPPING_MODEL.md rule 3): expensive
// zones carry a surcharge so no zone ships below the margin floor.
const SURCHARGE_STATES: Record<string, number> = {
  AK: 1500,
  HI: 1500,
  PR: 1500,
};

export function zoneSurchargeCents(state: string): number {
  return SURCHARGE_STATES[state.toUpperCase()] ?? 0;
}

/** Gross margin after shipping for a shipped order. */
export function grossMargin(
  priceCents: number,
  allInCostCents: number,
): number {
  if (priceCents <= 0) return 0;
  return (priceCents - allInCostCents) / priceCents;
}

export function meetsMarginFloor(
  priceCents: number,
  allInCostCents: number,
): boolean {
  return grossMargin(priceCents, allInCostCents) >= MARGIN_FLOOR;
}

// ---- Canada readiness (task 5.3, Phase 3) ----
// CAD prices carry an FX + brokerage buffer over USD (PRICING_STRATEGY §9:
// build a buffer rather than passing every FX swing to customers).
export const SUPPORTED_COUNTRIES = ["US", "CA"] as const;
export type Country = (typeof SUPPORTED_COUNTRIES)[number];
export const CAD_MULTIPLIER = 1.45;
const CA_SURCHARGE_REGIONS: Record<string, number> = {
  YT: 2000,
  NT: 2000,
  NU: 2000,
};

export function planPrice(
  plan: PlanTier,
  country: Country,
): { currency: string; cents: number } {
  const usd = PLANS[plan].defaultPriceCents;
  if (country === "CA") {
    return {
      currency: "CAD",
      cents: Math.round((usd * CAD_MULTIPLIER) / 100) * 100,
    };
  }
  return { currency: "USD", cents: usd };
}

export function regionSurchargeCents(country: Country, region: string): number {
  if (country === "CA") return CA_SURCHARGE_REGIONS[region.toUpperCase()] ?? 0;
  return zoneSurchargeCents(region);
}
