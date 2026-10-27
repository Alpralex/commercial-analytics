select
    sku,
    category,
    list_price_eur,
    unit_cost_eur,
    1 - unit_cost_eur / list_price_eur as list_margin_pct
from {{ ref('stg_products') }}
