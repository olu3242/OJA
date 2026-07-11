# Row-Level Security Report

Model: **deny by default**. RLS is enabled on every table; `service_role`
(backend) bypasses RLS; `authenticated` traffic passes through the policies
below; tables with no policy are fully invisible to end users.

Total policies: 353 across 124 tables.

| Table                    | Policies                                                                                                |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| activity_logs            | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| admin_actions            | `admin_read` (SELECT)                                                                                   |
| api_keys                 | `admin_read` (SELECT)                                                                                   |
| audit_logs               | `admin_read` (SELECT)                                                                                   |
| avatars                  | `self_select` (SELECT)<br>`self_update` (UPDATE)<br>`self_write` (INSERT)                               |
| background_jobs          | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| business_accounts        | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| business_locations       | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| campaigns                | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| canonical_migrations     | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| carrier_rates            | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| cohort_analysis          | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| container_items          | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| containers               | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| country_pricing          | `reference_read` (SELECT)<br>`tenant_insert` (INSERT)<br>`tenant_update` (UPDATE)                       |
| credit_notes             | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| credits                  | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| currencies               | `reference_read` (SELECT)<br>`tenant_insert` (INSERT)<br>`tenant_update` (UPDATE)                       |
| customer_addresses       | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| customer_ltv             | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| customers                | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| customs_documents        | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| daily_metrics            | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| dead_letter_queue        | `admin_read` (SELECT)                                                                                   |
| delivery_clusters        | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| delivery_routes          | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| delivery_windows         | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| devices                  | `self_select` (SELECT)<br>`self_update` (UPDATE)<br>`self_write` (INSERT)                               |
| discounts                | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| documents                | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| drop_locations           | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| email_queue              | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| event_failures           | `admin_read` (SELECT)                                                                                   |
| event_handlers           | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| event_replays            | `admin_read` (SELECT)                                                                                   |
| events                   | `admin_read` (SELECT)                                                                                   |
| exchange_rates           | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| family_members           | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| feature_flags            | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| files                    | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| forecast_inputs          | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| forecast_metrics         | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| forecast_models          | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| forecast_overrides       | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| forecast_results         | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| forecast_runs            | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| group_order_events       | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| group_order_items        | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| group_order_members      | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| group_orders             | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| households               | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| import_shipments         | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| inventory                | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| inventory_movements      | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| invoice_items            | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| invoices                 | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| kpi_snapshots            | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| landing_pages            | `landing_public_read` (SELECT)<br>`tenant_insert` (INSERT)<br>`tenant_update` (UPDATE)                  |
| login_history            | `self_select` (SELECT)<br>`self_update` (UPDATE)<br>`self_write` (INSERT)                               |
| media_assets             | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| monthly_metrics          | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| notification_preferences | `self_select` (SELECT)<br>`self_update` (UPDATE)<br>`self_write` (INSERT)                               |
| notification_templates   | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| notifications            | `self_select` (SELECT)<br>`self_update` (UPDATE)<br>`self_write` (INSERT)                               |
| oauth_accounts           | `self_select` (SELECT)<br>`self_update` (UPDATE)<br>`self_write` (INSERT)                               |
| order_items              | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| orders                   | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| organization_invitations | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| organization_members     | `members_admin_insert` (INSERT)<br>`members_admin_update` (UPDATE)<br>`members_select` (SELECT)         |
| organizations            | `orgs_admin_update` (UPDATE)<br>`orgs_create` (INSERT)<br>`orgs_member_select` (SELECT)                 |
| payment_attempts         | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| payment_events           | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| payment_methods          | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| payments                 | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| permissions              | `rbac_admin_update` (UPDATE)<br>`rbac_admin_write` (INSERT)<br>`rbac_read` (SELECT)                     |
| pos_events               | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| pos_integrations         | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| price_books              | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| pricing_rules            | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| product_categories       | `reference_read` (SELECT)<br>`tenant_insert` (INSERT)<br>`tenant_update` (UPDATE)                       |
| product_variants         | `reference_read` (SELECT)<br>`tenant_insert` (INSERT)<br>`tenant_update` (UPDATE)                       |
| products                 | `reference_read` (SELECT)<br>`tenant_insert` (INSERT)<br>`tenant_update` (UPDATE)                       |
| profiles                 | `profiles_self_select` (SELECT)<br>`profiles_self_update` (UPDATE)                                      |
| promo_codes              | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| purchase_order_items     | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| purchase_orders          | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| push_queue               | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| rebates                  | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| referral_rewards         | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| referrals                | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| refunds                  | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| returns                  | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| role_permissions         | `rbac_admin_update` (UPDATE)<br>`rbac_admin_write` (INSERT)<br>`rbac_read` (SELECT)                     |
| roles                    | `rbac_admin_update` (UPDATE)<br>`rbac_admin_write` (INSERT)<br>`rbac_read` (SELECT)                     |
| scheduled_tasks          | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| security_events          | `admin_read` (SELECT)                                                                                   |
| sell_through_events      | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| service_accounts         | `admin_read` (SELECT)                                                                                   |
| sessions                 | `self_select` (SELECT)<br>`self_update` (UPDATE)<br>`self_write` (INSERT)                               |
| shipment_items           | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| shipments                | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| sla_credits              | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| sms_queue                | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| standing_order_items     | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| standing_orders          | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| subscription_deliveries  | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| subscription_items       | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| subscriptions            | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| supplier_forecasts       | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| supplier_invoices        | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| supplier_products        | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| supplier_shipments       | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| supplier_users           | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| suppliers                | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| system_settings          | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| tax_rates                | `reference_read` (SELECT)<br>`tenant_insert` (INSERT)<br>`tenant_update` (UPDATE)                       |
| tracking_events          | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| user_roles               | `user_roles_admin_update` (UPDATE)<br>`user_roles_admin_write` (INSERT)<br>`user_roles_select` (SELECT) |
| waitlists                | `tenant_update` (UPDATE)<br>`waitlist_admin_read` (SELECT)<br>`waitlist_join` (INSERT)                  |
| wallets                  | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| warehouse_inventory      | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| warehouses               | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| weekly_metrics           | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
| wholesale_accounts       | `tenant_insert` (INSERT)<br>`tenant_select` (SELECT)<br>`tenant_update` (UPDATE)                        |
