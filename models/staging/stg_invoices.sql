-- Amounts include 23% VAT.
select
    invoice_id,
    order_id,
    cast(invoice_date as date)  as invoice_date,
    cast(due_date as date)      as due_date,
    cast(amount_eur as double)  as amount_eur
from read_csv('{{ var("raw_path") }}/invoices.csv', header = true, all_varchar = true)
