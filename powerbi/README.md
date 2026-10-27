# Commercial analytics in Power BI

**Live report (Publish to web):** https://app.powerbi.com/view?r=eyJrIjoiN2IzMWEwZWUtNmQxYy00NGQ0LTgzZjctYzJhNzk0MDk3MmUxIiwidCI6IjY2MDMwOWU1LWI1YWEtNDQzNS1iMDU2LTJhYmViOGZmNDZjNyJ9

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

## Time view (calculation group)

`Time view` applies one time comparison to any measure, so the model does not need a YTD, PY and YoY copy of every measure. Put `Time view[Time view]` on the columns of a matrix, or in a slicer, with any measure as the value:

| Item | Expression |
| --- | --- |
| Current | `SELECTEDMEASURE()` |
| Prior year | `CALCULATE(SELECTEDMEASURE(), SAMEPERIODLASTYEAR(dim_date[date_day]))` |
| vs PY / vs PY % | Current minus prior year, and the same as a share of prior year (format string `+0.0%`) |
| YTD / Prior YTD / YTD vs PY % | `DATESYTD`, its prior year, and the relative change |

A calculation group requires *discourage implicit measures*, which is on: every visual uses explicit measures. The explicit time measures (`Revenue YTD`, `Visits PYTD`...) stay, because the report pages and the Qlik comparison use them.

## Row-level security

Three roles in `definition/roles/`, driven by `security_user_access`, a hidden calculated table of fictional users (no relationship; each role reads it with `USERPRINCIPALNAME()`):

- **Sales rep**: `dim_rep` filtered to the user's rep and `dim_customer` to the customers that rep owns, so sales, visits and invoices follow.
- **Regional manager**: `dim_rep` and `dim_customer` filtered to the user's regions.
- **Sales director**: no filter.

Test it in Desktop with *Modeling > View as*, tick **Other user**, type the user and tick the role. Net Revenue for the whole period (Jan 2024 to Sep 2026):

| User | Role | Sees | Net Revenue |
| --- | --- | --- | ---: |
| rep01@northwind.example | Sales rep | REP01, 188 customers | 13,601,408 € |
| rep07@northwind.example | Sales rep | REP07 | 8,952,289 € |
| norte.manager@northwind.example | Regional manager | Norte | 36,981,935 € |
| south.manager@northwind.example | Regional manager | Lisboa e Vale do Tejo, Sul | 56,431,887 € |
| anyone else | Sales rep | nothing | blank |

Checked in Desktop on 27 Oct 2026 (Revenue YTD 4.12 M€ for rep01 and 10.82 M€ for the Norte manager, against 34.92 M€ unfiltered):

![View as Sales rep](screenshots/RLS%20Sales%20rep.png)
![View as Regional manager](screenshots/RLS%20Regional%20manager.png)

In production the calculated table becomes a table loaded from the CRM or HR system, and the roles get Entra ID groups as members in the workspace.

### Public copy without RLS

*Publish to web* refuses models with row-level security, so the public link comes from `public/CommercialAnalytics_Public.pbip`: the same report and model without the roles and `security_user_access`. It is generated, not edited: after changing the report or the model run `node scripts/make_powerbi_public_copy.mjs`.

## Automated model checks

Every push that touches `powerbi/` runs `.github/workflows/model-checks.yml` on a Windows runner: Tabular Editor 2 loads both TMDL models (a syntax error fails the run) and applies Microsoft's Best Practice Analyzer rules (`bpa-rules.json`, from [microsoft/Analysis-Services](https://github.com/microsoft/Analysis-Services/tree/master/BestPracticeRules)). Severity 3 rules fail the run; warnings appear as annotations on the commit.

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
