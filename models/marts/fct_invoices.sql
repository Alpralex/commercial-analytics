-- One row per invoice with its payment, and aging of what is still open on the snapshot date.
{% set as_of = "date '" ~ var('as_of') ~ "'" %}
select
    i.invoice_id,
    i.order_id,
    o.customer_id,
    o.rep_id,
    i.invoice_date,
    i.due_date,
    p.payment_date,
    i.amount_eur                                          as invoice_amount,
    case when p.payment_date is null then i.amount_eur else 0 end as open_amount,
    p.payment_date is not null                            as is_paid,
    p.payment_date - i.due_date                           as days_late,
    case when p.payment_date is null then {{ as_of }} - i.due_date end as days_overdue,
    case
        when p.payment_date is not null           then 'Paid'
        when {{ as_of }} <= i.due_date            then 'Not due'
        when {{ as_of }} - i.due_date <= 30       then '1-30'
        when {{ as_of }} - i.due_date <= 60       then '31-60'
        when {{ as_of }} - i.due_date <= 90       then '61-90'
        else '90+'
    end                                                   as aging_bucket
from {{ ref('stg_invoices') }} i
join {{ ref('stg_orders') }} o using (order_id)
left join {{ ref('stg_payments') }} p using (invoice_id)
