-- Q1 Which region is falling, and why? Revenue, buyers and visits by customer region and month.
with sales as (
    select c.region, cast(date_trunc('month', s.order_date) as date) as month_start,
           sum(s.net_amount) as net_revenue, sum(s.gross_amount) as gross_amount, sum(s.cost_amount) as cost_amount,
           count(distinct s.customer_id) as buying_customers, count(distinct s.order_id) as orders
    from {{ ref('fct_sales_lines') }} s join {{ ref('dim_customer') }} c using (customer_id)
    group by all
),
visits as (
    select c.region, cast(date_trunc('month', v.visit_date) as date) as month_start, count(*) as visits
    from {{ ref('fct_visits') }} v join {{ ref('dim_customer') }} c using (customer_id)
    group by all
),
customers as (
    select region, count(*) as customers from {{ ref('dim_customer') }} group by all
)
select
    region,
    month_start,
    coalesce(s.net_revenue, 0)      as net_revenue,
    coalesce(s.gross_amount, 0)     as gross_amount,
    coalesce(s.cost_amount, 0)      as cost_amount,
    coalesce(s.buying_customers, 0) as buying_customers,
    coalesce(s.orders, 0)           as orders,
    coalesce(v.visits, 0)           as visits,
    k.customers,
    coalesce(s.buying_customers, 0) / k.customers as coverage_pct
from sales s
full join visits v using (region, month_start)
join customers k using (region)
