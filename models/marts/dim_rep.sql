select
    rep_id,
    rep_name,
    region,
    left_on,
    left_on is null as is_active
from {{ ref('stg_reps') }}
