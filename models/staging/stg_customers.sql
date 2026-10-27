select
    customer_id,
    customer_name,
    segment,
    region,
    district,
    rep_id                          as account_rep_id,
    cast(customer_since as date)    as customer_since,
    cast(payment_terms_days as int) as payment_terms_days
from read_csv('{{ var("raw_path") }}/customers.csv', header = true, all_varchar = true)
