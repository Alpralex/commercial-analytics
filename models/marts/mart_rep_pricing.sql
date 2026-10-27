-- Q2 Who gives margin away? Discount and margin by rep, Jan 2024 to the snapshot date.
-- extra_discount_eur: what the rep's discount cost above the average of all other reps, at the rep's gross sales.
with by_rep as (
    select rep_id,
           sum(gross_amount) as gross_amount, sum(net_amount) as net_revenue, sum(cost_amount) as cost_amount,
           count(distinct customer_id) as customers_served,
           sum(gross_amount) filter (where year(order_date) = year(date '{{ var("as_of") }}')) as gross_ytd,
           sum(net_amount) filter (where year(order_date) = year(date '{{ var("as_of") }}'))   as net_ytd,
           sum(cost_amount) filter (where year(order_date) = year(date '{{ var("as_of") }}'))  as cost_ytd
    from {{ ref('fct_sales_lines') }}
    group by all
),
peers as (
    select a.rep_id, 1 - sum(b.net_revenue) / sum(b.gross_amount) as peer_discount_pct,
           sum(b.net_revenue - b.cost_amount) / sum(b.net_revenue)  as peer_margin_pct
    from by_rep a join by_rep b on b.rep_id <> a.rep_id
    group by all
)
select
    r.rep_id,
    d.rep_name,
    d.region,
    d.is_active,
    r.gross_amount,
    r.net_revenue,
    r.cost_amount,
    1 - r.net_revenue / r.gross_amount                    as discount_pct,
    (r.net_revenue - r.cost_amount) / r.net_revenue       as margin_pct,
    p.peer_discount_pct,
    p.peer_margin_pct,
    greatest(0, r.gross_amount * ((1 - r.net_revenue / r.gross_amount) - p.peer_discount_pct)) as extra_discount_eur,
    r.customers_served,
    r.net_revenue / r.customers_served                    as revenue_per_customer,
    1 - r.net_ytd / r.gross_ytd                           as discount_pct_ytd,
    (r.net_ytd - r.cost_ytd) / r.net_ytd                  as margin_pct_ytd
from by_rep r
join peers p using (rep_id)
join {{ ref('dim_rep') }} d using (rep_id)
