-- Q3 Which customers should we call this week? No visit for more than 60 days on the snapshot date,
-- ranked by what they bought in the last 12 months.
select
    row_number() over (order by c.revenue_l12m desc, c.customer_id) as call_rank,
    c.customer_id,
    c.customer_name,
    c.segment,
    c.region,
    c.district,
    c.account_rep_id,
    r.rep_name                as account_rep_name,
    r.is_active               as account_rep_active,
    c.last_visit_date,
    c.days_since_visit,
    c.last_order_date,
    c.days_since_order,
    c.customer_status,
    c.revenue_l12m
from {{ ref('dim_customer') }} c
left join {{ ref('dim_rep') }} r on r.rep_id = c.account_rep_id
where c.visit_recency = 'No visit 60+ days'
