-- Order-line grain. Amounts are excluding VAT: gross at list price, net after discount, cost at unit cost.
select
    l.order_id,
    l.sku,
    o.order_date,
    o.customer_id,
    o.rep_id,
    p.category,
    l.quantity,
    l.list_price_eur,
    l.net_price_eur,
    l.unit_cost_eur,
    l.quantity * l.list_price_eur  as gross_amount,
    l.quantity * l.net_price_eur   as net_amount,
    l.quantity * l.unit_cost_eur   as cost_amount
from {{ ref('stg_order_lines') }} l
join {{ ref('stg_orders') }} o using (order_id)
join {{ ref('stg_products') }} p using (sku)
