# Commercial analytics for a distributor (Qlik Sense)

A sales-director app for an animal-health distributor in Portugal: revenue, customer coverage,
rep visits, discounting and receivables. It reproduces the kind of app I relied on for seven
years as commercial director of a distributor in Brazil, rebuilt on synthetic data so it can be public.

**Stack:** Python (data generator) · Qlik Sense load script · set analysis · master items.
A Power BI version of the same model is planned.

## The questions it answers

| Question | What the data shows (Jan–Sep 2026 vs 2025) |
|---|---|
| Which region is falling, and why? | Sul revenue −16.6% while the other regions grew 5–10%. Visits in Sul halved (2,722 → 1,426) after a rep left in January 2026. |
| Who gives margin away? | REP07 discounts 15.1% vs ~6% for peers, so gross margin is 13.6% vs ~21.8%, with *lower* revenue per customer. About €0.95M of extra discount over the period. |
| Which customers should we call this week? | 225 customers have had no visit for 60+ days. They bought €5.4M in the last 12 months. |
| Where is the cash stuck? | Livestock farms are 17% of billing but ~84% of receivables more than 90 days overdue, and pay 29 days late on average (3 for other segments). |
| What is seasonal? | Vaccines sell ~1.9× more in spring than winter; parasiticides ~2.3× more in summer. |

These answers come from rules written into the generator (below). They are planted on purpose:
the point of the app is to make them easy to find, and you can check that it does.

## Data

`generator/generate.py` writes eight CSV files to `data/` (seed fixed, ~35 s, ~50 MB):

| File | Rows | Grain |
|---|---|---|
| customers.csv | 1,800 | customer: segment, region, district, account rep, payment terms |
| products.csv | 400 | SKU in six categories, list price and cost |
| reps.csv | 12 | sales rep and region |
| orders.csv | ~130,600 | order header |
| order_lines.csv | ~951,000 | order line: quantity, list price, net price, cost |
| visits.csv | ~67,800 | rep visit to a customer |
| invoices.csv | ~130,600 | invoice with due date (30 or 60 days) |
| payments.csv | ~125,000 | payment date (unpaid invoices have none) |

Period: Jan 2024 to Sep 2026; snapshot date 30 Sep 2026. Regions follow mainland NUTS II
(Norte, Centro, Lisboa e Vale do Tejo, Sul), with districts. Amounts in euros; invoices include 23% VAT.

**Rules in the generator**

1. Customers order more often in the 10 days after a visit.
2. With no visit for 60+ days their order rate decays.
3. Sul loses one of its two reps on 1 Jan 2026; its customers are visited half as often.
4. REP07 adds about 9 points of discount with no volume effect.
5. Livestock farms pay late (most 20–60 days past due, about 7% over 90 days) and buy in larger lots.
6. Vaccines peak in spring, parasiticides in summer; other categories are flat.

## Run it

```bash
pip install numpy
python generator/generate.py          # writes data/*.csv
```

Qlik Cloud: create an app, upload the CSVs to the space's **DataFiles**, paste `qlik/load_script.qvs`
into the data load editor (each `///$tab` is a section) and reload. On Qlik Sense Desktop, point `vPath` to
a folder connection. Then create the master items in [`qlik/master_items.md`](qlik/master_items.md) and the
sheets in [`qlik/sheets.md`](qlik/sheets.md).

## Data model

One concatenated fact table (`FactType` = Sale, Visit or Invoice) keyed on CustomerID, RepID, SKU and %Date,
with Customers, Products, Reps and a master calendar around it. This avoids synthetic keys and loops
between sales and visits, which share customer and rep. Recency, churn status and aging are calculated in the
script against the snapshot date, so chart expressions stay simple and the results do not change on reload.
YTD and rolling-12-month flags live in the calendar for set analysis.

## Files

```
generator/generate.py     synthetic data, rules documented in the docstring
qlik/load_script.qvs      load script: dimensions, facts, customer flags, calendar, variables
qlik/master_items.md      16 master measures and the dimensions
qlik/sheets.md            four sheets and the demo bookmarks
```
