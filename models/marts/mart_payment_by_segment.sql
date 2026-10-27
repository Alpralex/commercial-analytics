-- Q4 Billing, open and 90+ overdue receivables and payment delay by segment (all invoices, Jan 2024 to the snapshot).
with s as (
    select
        c.segment,
        sum(i.invoice_amount)                                             as billed_amount,
        sum(i.open_amount)                                                as open_amount,
        coalesce(sum(i.open_amount) filter (where i.aging_bucket = '90+'), 0) as overdue_90_amount,
        avg(i.days_late)                                                  as avg_days_late,
        count(*)                                                          as invoices,
        count(*) filter (where i.days_late > 0)                           as invoices_paid_late
    from {{ ref('fct_invoices') }} i
    join {{ ref('dim_customer') }} c using (customer_id)
    group by all
)
select
    segment,
    billed_amount,
    billed_amount / sum(billed_amount) over ()         as billed_share,
    open_amount,
    overdue_90_amount,
    overdue_90_amount / sum(overdue_90_amount) over () as overdue_90_share,
    avg_days_late,
    invoices,
    invoices_paid_late
from s
