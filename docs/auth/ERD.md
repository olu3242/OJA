# Canonical Schema — ERD & Database Diagram

123 tables across 18 domains, one convention: every table carries
`id (uuid) · created_at · updated_at · deleted_at · organization_id · created_by · updated_by`,
an `updated_at` trigger, RLS, and indexed FKs (enforced mechanically by
migration 0001 §Z and proven by `npm run canonical:verify`).

## Domain map

```mermaid
flowchart LR
    subgraph Identity
        AUTH[auth.users<br/>Supabase] --> PRO[profiles]
        PRO --> OAU[oauth_accounts]
        PRO --> UR[user_roles] --> RO[roles] --> RP[role_permissions] --> PE[permissions]
        ORG[organizations] --> OM[organization_members] --> PRO
        ORG --> OI[organization_invitations]
        PRO --> SES[sessions] & DEV[devices] & LH[login_history]
    end
    subgraph Commerce
        CUS[customers] --> SUB[subscriptions] --> SI[subscription_items]
        SUB --> SD[subscription_deliveries] --> ORD[orders] --> OIT[order_items]
        ORD --> SHP[shipments] --> TE[tracking_events]
        CUS --> WAL[wallets] --> CRD[credits]
        CUS --> REF[referrals] --> RR[referral_rewards]
        GO[group_orders] --> GOM[group_order_members] --> GOI[group_order_items]
    end
    subgraph Supply
        SUP[suppliers] --> PO[purchase_orders] --> POI[purchase_order_items] --> INV[inventory]
        INV --> IM[inventory_movements]
        CON[containers] --> CI[container_items]
        WH[warehouses] --> WI[warehouse_inventory]
    end
    subgraph Intelligence
        FM[forecast_models] --> FR[forecast_runs] --> FRS[forecast_results] --> FO[forecast_overrides]
        POSI[pos_integrations] --> POSE[pos_events] --> STE[sell_through_events] --> FI[forecast_inputs]
        EV[events store] --> EH[event_handlers] --> DLQ[dead_letter_queue]
    end
    Identity --- Commerce
    Commerce --- Supply
    Supply --- Intelligence
    ORG -. tenant scope on every table .-> Commerce & Supply & Intelligence
```

## Identity core (key relationships)

```mermaid
erDiagram
    auth_users ||--|| profiles : "1:1 — no duplicate users"
    profiles ||--o{ oauth_accounts : "unique (provider, subject)"
    profiles ||--o{ organization_members : joins
    organizations ||--o{ organization_members : has
    profiles ||--o{ user_roles : granted
    roles ||--o{ user_roles : ""
    roles ||--o{ role_permissions : ""
    permissions ||--o{ role_permissions : ""
    profiles ||--o{ login_history : emits
    profiles ||--o| legacy_account : "legacy_account_id → Prisma Account"
    organizations ||--o{ customers : owns
    customers ||--o{ subscriptions : holds
```

## Convergence map (legacy Prisma app schema → canonical)

| Legacy (Prisma, `oja_dev`) | Canonical (`public`, Supabase)                           |
| -------------------------- | -------------------------------------------------------- |
| `Account`                  | `profiles` (+ `customers` / `business_accounts` by role) |
| `Sku`                      | `products` + `product_variants`                          |
| `Subscription`, `Cycle`    | `subscriptions`, `subscription_deliveries`               |
| `Order`, `OrderLine`       | `orders`, `order_items`                                  |
| `Lot`, `InventoryTxn`      | `inventory`, `inventory_movements`                       |
| `PurchaseOrder`, `PoLine`  | `purchase_orders`, `purchase_order_items`                |
| `Forecast` (+ overrides)   | `forecast_runs`/`forecast_results`/`forecast_overrides`  |
| `DemandEvent`              | `events` (canonical event store) + `sell_through_events` |
| `GroupOrder*`              | `group_orders`/`group_order_members`/`group_order_items` |
| `WholesaleLead`            | `waitlists (kind='wholesale')` → `business_accounts`     |
| `NotificationLog`          | `notifications` + channel queues                         |

Identity is live on the canonical schema today (`profiles.legacy_account_id`
bridges both worlds); commerce tables migrate domain-by-domain behind it.
