-- Customers with recency on the snapshot date (the Qlik "Customer flags" tab).
{% set as_of = "date '" ~ var('as_of') ~ "'" %}
with visits as (
    select customer_id, max(visit_date) as last_visit_date, count(*) as visits_total
    from {{ ref('fct_visits') }}
    group by all
),
sales as (
    select customer_id,
           max(order_date) as last_order_date,
           sum(net_amount) filter (where order_date > {{ as_of }} - 365) as revenue_l12m
    from {{ ref('fct_sales_lines') }}
    group by all
)
select
    c.customer_id,
    c.customer_name,
    c.segment,
    c.region,
    c.district,
    c.account_rep_id,
    c.customer_since,
    c.payment_terms_days,
    v.last_visit_date,
    s.last_order_date,
    {{ as_of }} - v.last_visit_date                               as days_since_visit,
    {{ as_of }} - s.last_order_date                               as days_since_order,
    case when v.last_visit_date is null then 'No visit'
         else lpad(cast(({{ as_of }} - v.last_visit_date) // 30 * 30 as varchar), 3, '0') || '-'
              || lpad(cast(({{ as_of }} - v.last_visit_date) // 30 * 30 + 29 as varchar), 3, '0') || ' days'
    end                                                           as days_since_visit_band,
    case when v.last_visit_date is null or {{ as_of }} - v.last_visit_date > 60
         then 'No visit 60+ days' else 'Visited in last 60 days' end as visit_recency,
    case when s.last_order_date is null then 'Never ordered'
         when {{ as_of }} - s.last_order_date <= 90  then 'Active'
         when {{ as_of }} - s.last_order_date <= 180 then 'Lapsing'
         else 'Lost' end                                          as customer_status,
    coalesce(s.revenue_l12m, 0)                                   as revenue_l12m,
    coalesce(v.visits_total, 0)                                   as visits_total
from {{ ref('stg_customers') }} c
left join visits v using (customer_id)
left join sales s using (customer_id)
