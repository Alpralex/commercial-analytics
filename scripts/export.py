"""Export the dbt marts: Parquet files for Power BI (powerbi/data/) and compact JSON for the web page (web/data/).

Power BI gets the sales lines aggregated to customer x rep x category x day (about a third of the order-line
rows), so the folder stays small while every master measure, YTD comparison and slicer still works.
Run from the project root after `dbt build --profiles-dir .`.
"""
import json
import os
import duckdb

DB = os.environ.get("COMMERCIAL_DB_PATH", "data/commercial.duckdb")
AS_OF = "2026-09-30"
con = duckdb.connect(DB, read_only=True)

# ---------------------------------------------------------------- Power BI
PBI = "powerbi/data"
os.makedirs(PBI, exist_ok=True)
pbi = {
    "dim_date": """
        select date_day, year_number, quarter_label, month_number, month_name, month_start, year_month,
               weekday_number, season
        from dim_date""",
    "dim_customer": """
        select customer_id, customer_name, segment, region, district, account_rep_id, customer_since,
               payment_terms_days, last_visit_date, last_order_date, days_since_visit, days_since_order,
               days_since_visit_band, visit_recency, customer_status, revenue_l12m
        from dim_customer""",
    "dim_rep": "select rep_id, rep_name, region as rep_region, left_on, is_active from dim_rep",
    "dim_category": """
        select category, count(*) as sku_count, avg(list_margin_pct) as avg_list_margin_pct
        from dim_product group by all""",
    "fct_sales": """
        select order_date as date_day, customer_id, rep_id, category,
               count(*)::int as order_lines, sum(quantity)::int as quantity,
               round(sum(gross_amount), 2) as gross_amount, round(sum(net_amount), 2) as net_amount,
               round(sum(cost_amount), 2) as cost_amount
        from fct_sales_lines group by all order by 1, 2, 4""",
    "fct_visits": "select visit_date as date_day, customer_id, rep_id, visit_type from fct_visits order by 1, 2",
    "fct_invoices": """
        select invoice_id, invoice_date as date_day, customer_id, rep_id, due_date, payment_date,
               invoice_amount, open_amount, days_late, days_overdue, aging_bucket,
               case aging_bucket when 'Paid' then 0 when 'Not due' then 1 when '1-30' then 2
                    when '31-60' then 3 when '61-90' then 4 else 5 end as aging_sort
        from fct_invoices order by 2, 1""",
}
total = 0
for name, sql in pbi.items():
    path = f"{PBI}/{name}.parquet"
    con.execute(f"copy ({sql}) to '{path}' (format parquet, compression zstd)")
    n = con.execute(f"select count(*) from '{path}'").fetchone()[0]
    size = os.path.getsize(path)
    total += size
    print(f"powerbi/{name}: {n:,} rows, {size / 1e6:.2f} MB")
print(f"powerbi/data total: {total / 1e6:.1f} MB")

# ---------------------------------------------------------------- Web
WEB = "web/data"
os.makedirs(WEB, exist_ok=True)


def rows(sql):
    return [list(r) for r in con.execute(sql).fetchall()]


# Period keys used by the page: current window and the window it is compared with.
PERIODS = {
    "ytd": ("2026-01-01", "2026-09-30", "2025-01-01", "2025-09-30"),
    "l12m": ("2025-10-01", "2026-09-30", "2024-10-01", "2025-09-30"),
    "y2025": ("2025-01-01", "2025-12-31", "2024-01-01", "2024-12-31"),
    "all": ("2024-01-01", "2026-09-30", None, None),
}

web = {
    # month, region, rep, category, gross, net, cost (euros, excl. VAT)
    "sales": """
        select strftime(s.order_date, '%Y-%m'), c.region, s.rep_id, s.category,
               round(sum(s.gross_amount)), round(sum(s.net_amount)), round(sum(s.cost_amount))
        from fct_sales_lines s join dim_customer c using (customer_id)
        group by all order by 1, 2, 3, 4""",
    # month, region, rep, visits
    "visits": """
        select strftime(v.visit_date, '%Y-%m'), c.region, v.rep_id, count(*)
        from fct_visits v join dim_customer c using (customer_id)
        group by all order by 1, 2, 3""",
    # rank, customer, name, segment, region, district, account rep, last visit, days since visit,
    # last order, status, revenue last 12 months
    "call_list": """
        select call_rank, customer_id, customer_name, segment, region, district, account_rep_id,
               strftime(last_visit_date, '%Y-%m-%d'), days_since_visit, strftime(last_order_date, '%Y-%m-%d'),
               customer_status, round(revenue_l12m)
        from mart_call_list order by call_rank""",
    # region, days-since-visit band start (0, 30, 60, ...), customers
    "recency": """
        select region, least(days_since_visit // 30 * 30, 180), count(*)
        from dim_customer group by all order by 1, 2""",
    # region, segment, aging bucket, open invoices, open amount (euros incl. VAT)
    "aging": """
        select region, segment, aging_bucket, open_invoices, round(open_amount)
        from mart_receivables_aging order by 1, 2, 3""",
    # region, segment, billed, open, overdue 90+, sum of days late, paid invoices
    "payments": """
        select c.region, c.segment, round(sum(i.invoice_amount)), round(sum(i.open_amount)),
               round(coalesce(sum(i.open_amount) filter (where i.aging_bucket = '90+'), 0)),
               coalesce(sum(i.days_late), 0), count(i.days_late)
        from fct_invoices i join dim_customer c using (customer_id)
        group by all order by 1, 2""",
}
for name, sql in web.items():
    data = rows(sql)
    with open(f"{WEB}/{name}.json", "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print(f"web/{name}: {len(data):,} rows, {os.path.getsize(f'{WEB}/{name}.json') / 1e3:.0f} KB")

# Distinct buying customers cannot be summed across months, so they are computed per period here:
# [period, 'cur' | 'prev', region ('' = all), rep ('' = all regions' reps), buyers]
buyers = []
for key, (a, b, pa, pb) in PERIODS.items():
    for tag, lo, hi in (("cur", a, b), ("prev", pa, pb)):
        if lo is None:
            continue
        buyers += rows(f"""
            select '{key}', '{tag}', coalesce(c.region, ''), coalesce(s.rep_id, ''), count(distinct s.customer_id)
            from fct_sales_lines s join dim_customer c using (customer_id)
            where s.order_date between date '{lo}' and date '{hi}'
            group by grouping sets ((), (c.region), (s.rep_id))""")
with open(f"{WEB}/buyers.json", "w") as f:
    json.dump(buyers, f, separators=(",", ":"))

meta = {
    "as_of": AS_OF,
    "periods": PERIODS,
    "regions": ["Norte", "Centro", "Lisboa e Vale do Tejo", "Sul"],
    "reps": rows("select rep_id, rep_name, region, strftime(left_on, '%Y-%m-%d') from dim_rep order by 1"),
    "customers": rows("select region, count(*) from dim_customer group by 1 order by 1"),
    "fact_rows": rows("select count(*) from fct_sales_lines")[0][0],
}
with open(f"{WEB}/meta.json", "w") as f:
    json.dump(meta, f, separators=(",", ":"))
print("web/buyers:", len(buyers), "rows; meta written")
