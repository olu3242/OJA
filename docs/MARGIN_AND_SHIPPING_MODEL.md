# GAARII — Margin and Shipping Protection Model

## Purpose

This document protects GAARII from launching a Garri subscription at a price that looks attractive but loses money after shipping, packaging, payment processing, and customer acquisition.

## Market Anchor

Observed U.S. online garri pricing indicates roughly:

| Pack Size | Market Anchor | Implied Price/lb |
| --------- | ------------: | ---------------: |
| 5 lb      |       ~$12.99 |        ~$2.60/lb |
| 10 lb     |       ~$25.99 |        ~$2.60/lb |
| 20 lb     |       ~$49.99 |        ~$2.50/lb |

GAARII should not compete as the cheapest garri seller — it is the reliable monthly pantry-staple subscription. The subscription is selling availability, convenience, predictability, and authentic supply — not commodity cassava alone.

## Shipping Reality

Garri is heavy. A household subscription must treat shipping as a first-class cost, not an afterthought.

Planning assumptions for MVP:

| Shipment | Conservative Shipping Buffer | Notes                                                 |
| -------- | ---------------------------: | ----------------------------------------------------- |
| 3–5 lb   |                      $10–$14 | USPS/commercial parcel or local route equivalent      |
| 10–15 lb |                      $14–$24 | Zone and dimensional weight sensitive                 |
| 20–25 lb |                      $22–$35 | Better per-lb shipping efficiency, still needs buffer |

## Updated Household Subscription Pricing

| Tier     |   Weight | Cadence                 |            Price | Guardrail                         |
| -------- | -------: | ----------------------- | ---------------: | --------------------------------- |
| Starter  |   3–5 lb | Monthly                 |  $24–$34 shipped | Never below 30% GM after shipping |
| Family   | 10–15 lb | Monthly / every 3 weeks |  $49–$79 shipped | Default hero plan                 |
| Stock-Up | 20–25 lb | Monthly / bi-weekly     | $89–$119 shipped | Best per-lb value                 |

## Unit Economics Formula

```text
Price = Product Cost + Packaging + Shipping + Payment Fee + Shrink Allowance + CAC Amortization + Target Margin
```

## Margin Protection Rules

1. No shipped household order should be sold below a 30% gross-margin floor after shipping.
2. Shipping is included only when the household falls within the planned delivery economics.
3. For expensive zones, checkout should apply one of these controls:
   - delivery-zone surcharge,
   - higher minimum order,
   - slower cadence,
   - local pickup/community drop,
   - or route-only availability.
4. Discounts should apply to the first delivery only, not permanently reduce recurring price.
5. Referral credits should be capped and funded from CAC budget, not product margin.

## Launch Recommendation

Launch with the Family tier as the hero plan. It gives enough weight to make shipping efficient while still fitting normal household consumption. Starter is useful for acquisition but must be watched closely because shipping can consume the margin quickly. Stock-Up should be promoted to high-consumption households and community buyers because it creates better per-pound economics.
