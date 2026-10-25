select
    sku,
    category,
    cast(list_price_eur as double) as list_price_eur,
    cast(unit_cost_eur as double)  as unit_cost_eur
from read_csv('{{ var("raw_path") }}/products.csv', header = true, all_varchar = true)
