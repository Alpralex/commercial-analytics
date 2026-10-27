select
    visit_date,
    customer_id,
    rep_id,
    visit_type
from {{ ref('stg_visits') }}
