# Commercial analytics for a distributor

A sales-director app for an animal-health distributor in Portugal: revenue, customer coverage,
rep visits, discounting and receivables. It reproduces the kind of app I relied on for seven
years in sales leadership at a distributor in Brazil, rebuilt on synthetic data so it can be public.
The same data model is built four ways: Qlik Sense, dbt on DuckDB, Power BI and a static web page.

**Stack:** Python (data generator) · Qlik Sense load script, set analysis, master items · dbt + DuckDB
(SQL star schema, 23 models, 64 tests) · Power BI (PBIP, TMDL semantic model, DAX) · HTML/SVG web dashboard.

## The questions it answers

| Question | What the data shows |
|---|---|
| Which region is falling, and why? | Sul revenue −16.5% in Jan–Sep 2026 against Jan–Sep 2025, while the other regions grew 5–10%. Visits in Sul halved (2,722 → 1,426) after a rep left in January 2026. |
| Who gives margin away? | REP07 discounts 15.1% vs ~6% for peers, so gross margin is 13.6% vs ~21.8%, with *lower* revenue per customer. About €0.96M of extra discount from Jan 2024 to Sep 2026. |
| Which customers should we call this week? | 225 customers have had no visit for 60+ days. They bought €5.4M in the last 12 months. |
| Where is the cash stuck? | Livestock farms are 17% of billing but ~84% of receivables more than 90 days overdue, and pay 29 days late on average (3 for other segments). |
| What is seasonal? | Vaccines sell ~2.0× more per month in spring than in winter; parasiticides ~2.3× more in summer (complete years 2024 and 2025). |

These answers come from rules written into the generator (below). They are planted on purpose:
the point of the app is to make them easy to find, and you can check that it does. Every number
in the table is recomputed by the dbt marts (`mart_region_ytd`, `mart_rep_pricing`, `mart_call_list`,
`mart_payment_by_segment`, `mart_category_seasons`).

## Data

`generator/generate.py` writes eight CSV files to `data/` (seed fixed, ~35 s, ~50 MB):

| File | Rows | Grain |
|---|---|---|
| customers.csv | 1,800 | customer: segment, region, district, account rep, payment terms |
| products.csv | 400 | SKU in six categories, list price and cost |
| reps.csv | 12 | sales rep and region |
| orders.csv | 130,589 | order header |
| order_lines.csv | 951,489 | order line: quantity, list price, net price, cost |
| visits.csv | 67,836 | rep visit to a customer |
| invoices.csv | 130,589 | invoice with due date (30 or 60 days) |
| payments.csv | 125,000 | payment date (unpaid invoices have none) |

Period: Jan 2024 to Sep 2026; snapshot date 30 Sep 2026. Regions follow mainland NUTS II
(Norte, Centro, Lisboa e Vale do Tejo, Sul), with districts. Amounts in euros; invoices include 23% VAT.

**Rules in the generator**

1. Customers order more often in the 10 days after a visit.
2. With no visit for 60+ days their order rate decays.
3. Sul loses one of its two reps on 1 Jan 2026; its customers are visited half as often.
4. REP07 adds about 9 points of discount with no volume effect.
5. Livestock farms pay late (most 20–60 days past due, about 7% over 90 days) and buy in larger lots.
6. Vaccines peak in spring, parasiticides in summer; other categories are flat.

## Model (dbt + DuckDB)

```
data/*.csv            staging (views)                marts (tables)
customers.csv ──────▶ stg_customers ──────┐
products.csv ───────▶ stg_products ───────┼────────▶ dim_customer   recency, status, revenue L12M on 30 Sep 2026
reps.csv ───────────▶ stg_reps ───────────┤          dim_product    SKU, category, list price, cost
orders.csv ─────────▶ stg_orders ─────────┤          dim_rep        rep, region, left_on
order_lines.csv ────▶ stg_order_lines ────┤          dim_date       daily, YTD / PYTD / L12M flags
visits.csv ─────────▶ stg_visits ─────────┤          fct_sales_lines order line: gross, net, cost
invoices.csv ───────▶ stg_invoices ───────┤          fct_visits     one row per visit
payments.csv ───────▶ stg_payments ───────┘          fct_invoices   payment, days late, aging bucket on 30 Sep 2026

question marts        Q1 mart_region_monthly, mart_region_ytd      Q2 mart_rep_pricing
                      Q3 mart_call_list                            Q4 mart_receivables_aging, mart_payment_by_segment
                      Q5 mart_seasonality, mart_category_seasons
```

- 23 models (8 staging views, 7 star-schema tables, 8 question marts) and 64 tests: unique and not-null keys,
  a `unique_combination` test for composite grains (order × SKU, visit date × customer, region × month),
  relationships from every fact to its dimensions, and accepted values for segment, region, category,
  visit type, aging bucket and customer status.
- The snapshot date is a dbt variable (`as_of`), so recency and aging are reproducible, as `vAsOf` is in Qlik.
- Discount = 1 − net ÷ list-price sales; gross margin = (net − cost) ÷ net; both exclude VAT.
  Receivables and days late use invoice amounts with VAT.

## Run it

```bash
pip install numpy dbt-duckdb==1.9.1 duckdb
python generator/generate.py          # writes data/*.csv
dbt build --profiles-dir .            # builds data/commercial.duckdb and runs the tests (seconds)
python scripts/export.py              # powerbi/data/*.parquet and web/data/*.json
```

`COMMERCIAL_RAW_PATH` and `COMMERCIAL_DB_PATH` override the CSV folder and the DuckDB file.
The CSVs and the DuckDB file are not in Git; the exported Parquet and JSON files are small enough to keep.

**Web:** open `web/index.html` through any static server (`cd web && python -m http.server`). It loads
`web/data/*.json` and answers the five questions with filters for region and period; no framework.

**Power BI:** open `powerbi/CommercialAnalytics.pbip` in Power BI Desktop and set the `DataFolder` parameter
to the `powerbi/data` folder. The fact table is aggregated to customer × rep × category × day (454,353 rows,
about 7 MB for all files). Measures reproduce the Qlik master items; see [`powerbi/README.md`](powerbi/README.md)
for the measure list and the report pages to build.

**Qlik:** Qlik Cloud: create an app, upload the CSVs to the space's **DataFiles**, paste `qlik/load_script.qvs`
into the data load editor (each `///$tab` is a section) and reload. On Qlik Sense Desktop, point `vPath` to
a folder connection. Then create the master items in [`qlik/master_items.md`](qlik/master_items.md) and the
sheets in [`qlik/sheets.md`](qlik/sheets.md).

## Qlik data model

One concatenated fact table (`FactType` = Sale, Visit or Invoice) keyed on CustomerID, RepID, SKU and %Date,
with Customers, Products, Reps and a master calendar around it. This avoids synthetic keys and loops
between sales and visits, which share customer and rep. Recency, churn status and aging are calculated in the
script against the snapshot date, so chart expressions stay simple and the results do not change on reload.
YTD and rolling-12-month flags live in the calendar for set analysis.

The dbt and Power BI versions use a star schema instead: separate sales, visit and invoice facts sharing
conformed customer, rep and date dimensions. Power BI handles several fact tables without the synthetic-key
problem that the concatenated fact solves in Qlik.

## Files

```
generator/generate.py     synthetic data, rules documented in the docstring
qlik/load_script.qvs      load script: dimensions, facts, customer flags, calendar, variables
qlik/master_items.md      16 master measures and the dimensions
qlik/sheets.md            four sheets and the demo bookmarks
dbt_project.yml           dbt project (profiles.yml: DuckDB path from COMMERCIAL_DB_PATH)
models/staging/           8 views reading the CSVs
models/marts/             star schema and question marts, tests in _marts.yml
tests/generic/            unique_combination test
scripts/export.py         Parquet for Power BI, JSON for the web page
powerbi/                  PBIP: TMDL semantic model, report scaffold, Parquet data, TMDL-view fallback script
web/index.html            static dashboard; data in web/data/
```
