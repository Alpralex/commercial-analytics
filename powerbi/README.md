# Commercial analytics in Power BI

**Live report (Publish to web):** https://app.powerbi.com/view?r=eyJrIjoiOWFmNmE3ZDctOTIyZS00ODM1LWFmMTgtMzBlMmMxZTkyNWQzIiwidCI6IjY2MDMwOWU1LWI1YWEtNDQzNS1iMDU2LTJhYmViOGZmNDZjNyJ9

The same model as the Qlik app, the dbt marts and the web page, as a Power BI project (PBIP). The semantic model is written in TMDL, so every table, relationship and DAX measure is readable in Git. The measures reproduce the Qlik master items in [`../qlik/master_items.md`](../qlik/master_items.md).

## Open it

1. Build the data first (from the project root): `python generator/generate.py`, `dbt build --profiles-dir .`, `python scripts/export.py`. This writes the Parquet files to `powerbi/data/` (about 7 MB).
2. Copy the project folder to the Windows machine (in Parallels, for example `C:\commercial-analytics`).
3. Open `powerbi/CommercialAnalytics.pbip` in Power BI Desktop. If Desktop asks, turn on the PBIP preview in *Options > Preview features*.
4. In *Transform data > Manage parameters*, set **DataFolder** to the folder that holds the Parquet files, with a trailing backslash, for example `C:\commercial-analytics\powerbi\data\`.
5. Select **Refresh**. The model loads about 650,000 rows in a few seconds.

If Desktop refuses the report scaffold, open a blank report instead, go to **TMDL view**, paste the whole of `tmdl-view-script.tmdl` and select **Apply**. That creates the same tables, parameter, relationships and measures.

## Model

Star schema. `dim_date` is daily, marked as the date table, and ends on the snapshot date (30 Sep 2026), so `DATESYTD` with no date filter returns 1 Jan to 30 Sep 2026 and `SAMEPERIODLASTYEAR` the same months of 2025.

```
dim_date ─────┬── fct_sales      (customer × rep × category × day, 454,353 rows, from 951,489 order lines)
dim_customer ─┼── fct_visits     (one row per visit, 67,836 rows)
dim_rep ──────┤── fct_invoices   (one row per invoice, 130,589 rows, aging on 30 Sep 2026)
dim_category ─┘   (fct_sales only)
```

`dim_customer[account_rep_id]` is not related to `dim_rep`: the facts carry the rep who took the order or made the visit, and a second path from customers to reps would make the model ambiguous. Region on the slicers is the customer's region (`dim_customer[region]`).

| Measure | Definition | Qlik master item |
| --- | --- | --- |
| Net Revenue, Gross Sales, Cost of Sales | Sums over fct_sales, excluding VAT | Net Revenue |
| Gross Margin, Gross Margin % | Net − cost, and ÷ net | Gross Margin, Gross Margin % |
| Discount Amount, Discount % | Gross − net, and ÷ gross | Discount % |
| Revenue YTD, Revenue PYTD, Revenue YTD vs PY % | `DATESYTD`, and `SAMEPERIODLASTYEAR ( DATESYTD (…) )` | Revenue YTD, Revenue PYTD, Revenue YTD vs PY % |
| Revenue PY, Revenue vs PY % | `SAMEPERIODLASTYEAR`, for charts by month | |
| Buying Customers, Coverage % | Distinct buyers; ÷ customers in the selected region, segment or account rep | Buying Customers, Coverage % |
| Visits, Visits YTD, Visits PYTD, Visits YTD vs PY % | Rows of fct_visits | Visits |
| Revenue per Visit, Revenue per Customer | Net revenue ÷ visits or buyers | Revenue per Visit |
| Customers Without Visit 60+ | Customers whose last visit is more than 60 days before the snapshot | |
| Customers at Risk | The same, still Active or Lapsing | Customers at Risk |
| Revenue L12M, Revenue L12M at Risk | 365 days to the snapshot, whatever the date filter; at risk = no visit 60+ days | Revenue L12M at Risk |
| Open Receivables, Overdue 90+ | Unpaid on the snapshot date; ignore date filters, as in Qlik | Open Receivables, Overdue 90+ |
| Billed Amount, Billing Share, Overdue 90+ Share | Invoiced amount with VAT; shares of all customers | |
| Avg Days Late | Payment date − due date, paid invoices | Avg Days Late |

No measure shares a name with a column of its table (Power BI names are case-insensitive): the quantity column is summed by **Units Sold**, the invoice amount by **Billed Amount**.

Expected values with no filters, to check the refresh: Revenue YTD vs PY % for Sul −16.5%; Discount % for REP07 15.1% and Gross Margin % 13.6%; Customers Without Visit 60+ = 225 with Revenue L12M at Risk €5,371,041; Overdue 90+ Share for Livestock farm 83.6%; Avg Days Late 29.2 for farms.

## Report to build (four pages, 1280 × 720)

Slicers on every page: `dim_customer[region]` (buttons), `dim_customer[segment]`, `dim_category[category]`, `dim_rep[rep_name]` (dropdowns). Sync them across pages.

**1. Overview: how are we doing this year?**
1. Cards: Revenue YTD (Revenue YTD vs PY % as subtitle), Gross Margin %, Buying Customers, Customers Without Visit 60+, Overdue 90+.
2. Line chart: `dim_date[month_name]` on the axis, Net Revenue, `dim_date[year_number]` as the legend.
3. Bar chart: Revenue YTD vs PY % by `dim_customer[region]`, sorted ascending. Sul is the only bar below zero.

**2. Coverage and visits: why is the South falling?**
1. Column and line chart by `dim_date[month_start]`: Visits (columns) and Buying Customers (line). Filter the page to Region = Sul: visits halve from January 2026, when REP12 left.
2. Table by `dim_rep[rep_name]`: Visits, Revenue per Visit, Buying Customers, Coverage %.
3. Column chart: Customers by `dim_customer[days_since_visit_band]`.
4. Table "Call list": customer_name, region, account_rep_id, last_visit_date, days_since_visit, revenue_l12m, filtered to visit_recency = No visit 60+ days, sorted by revenue_l12m descending.

**3. Pricing: who gives margin away?**
1. Scatter chart: `dim_rep[rep_name]` as values, x = Discount %, y = Gross Margin %, size = Net Revenue. REP07 sits alone at 15.1% and 13.6%.
2. Bar chart: Discount % by `dim_category[category]`; select REP07 in the scatter to filter it.
3. Card: Revenue per Customer, to show the discount buys no volume.

**4. Receivables: where is the cash stuck?**
1. Stacked bar: Open Receivables by `dim_customer[segment]`, legend `fct_invoices[aging_bucket]` (filter out Paid; the bucket sorts by aging_sort). Colours: Not due grey, 1-30 light, 31-60 mid, 61-90 strong, 90+ red.
2. Table by segment: Billing Share, Overdue 90+ Share, Avg Days Late.
3. Table: customer_name, segment, Open Receivables, Overdue 90+, Avg Days Late, sorted by Overdue 90+.

Publish with *Publish to web* from your own Fabric workspace and put the link in the portfolio.
