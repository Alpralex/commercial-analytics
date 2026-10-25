-- One payment per paid invoice, for the full amount. Unpaid invoices have no row.
select
    invoice_id,
    cast(payment_date as date) as payment_date,
    cast(amount_eur as double) as amount_eur
from read_csv('{{ var("raw_path") }}/payments.csv', header = true, all_varchar = true)
