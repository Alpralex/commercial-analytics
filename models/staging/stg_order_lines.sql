select
    order_id,
    sku,
    cast(quantity as int)          as quantity,
    cast(list_price_eur as double) as list_price_eur,
    cast(net_price_eur as double)  as net_price_eur,
    cast(unit_cost_eur as double)  as unit_cost_eur
from read_csv('{{ var("raw_path") }}/order_lines.csv', header = true, all_varchar = true)
