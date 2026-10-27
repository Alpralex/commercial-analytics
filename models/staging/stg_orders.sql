-- rep_id is the rep who took the order: after REP12 left, Sul orders move to REP11.
select
    order_id,
    cast(order_date as date) as order_date,
    customer_id,
    rep_id
from read_csv('{{ var("raw_path") }}/orders.csv', header = true, all_varchar = true)
