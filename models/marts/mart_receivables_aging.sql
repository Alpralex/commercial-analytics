-- Q4 Where is the cash stuck? Open receivables on the snapshot date by customer segment and aging bucket.
select
    c.segment,
    c.region,
    i.aging_bucket,
    count(*)              as open_invoices,
    sum(i.open_amount)    as open_amount
from {{ ref('fct_invoices') }} i
join {{ ref('dim_customer') }} c using (customer_id)
where not i.is_paid
group by all
