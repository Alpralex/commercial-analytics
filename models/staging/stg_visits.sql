select
    cast(visit_date as date) as visit_date,
    customer_id,
    rep_id,
    visit_type
from read_csv('{{ var("raw_path") }}/visits.csv', header = true, all_varchar = true)
