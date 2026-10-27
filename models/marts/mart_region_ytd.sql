-- Q1 Year to date (Jan to the snapshot month) against the same months of the previous year, by region.
with sales as (
    select c.region,
           sum(s.net_amount) filter (where d.is_ytd)  as revenue_ytd,
           sum(s.net_amount) filter (where d.is_pytd) as revenue_pytd,
           count(distinct s.customer_id) filter (where d.is_ytd)  as buyers_ytd,
           count(distinct s.customer_id) filter (where d.is_pytd) as buyers_pytd
    from {{ ref('fct_sales_lines') }} s
    join {{ ref('dim_customer') }} c using (customer_id)
    join {{ ref('dim_date') }} d on d.date_day = s.order_date
    group by all
),
visits as (
    select c.region,
           count(*) filter (where d.is_ytd)  as visits_ytd,
           count(*) filter (where d.is_pytd) as visits_pytd
    from {{ ref('fct_visits') }} v
    join {{ ref('dim_customer') }} c using (customer_id)
    join {{ ref('dim_date') }} d on d.date_day = v.visit_date
    group by all
)
select
    region,
    revenue_ytd,
    revenue_pytd,
    revenue_ytd / revenue_pytd - 1 as revenue_yoy_pct,
    buyers_ytd,
    buyers_pytd,
    visits_ytd,
    visits_pytd,
    visits_ytd / visits_pytd - 1   as visits_yoy_pct
from sales join visits using (region)
