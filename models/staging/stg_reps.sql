select
    rep_id,
    rep_name,
    region,
    cast(nullif(left_on, '') as date) as left_on
from read_csv('{{ var("raw_path") }}/reps.csv', header = true, all_varchar = true)
