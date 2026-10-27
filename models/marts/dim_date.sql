-- Daily calendar from the first day of data to the snapshot date. Flags are relative to the snapshot,
-- like _YTD, _PYTD, _L12M and _P12M in the Qlik master calendar.
{% set as_of = "date '" ~ var('as_of') ~ "'" %}
with days as (
    select cast(d as date) as date_day
    from range(date '2024-01-01', {{ as_of }} + interval 1 day, interval 1 day) t(d)
)
select
    date_day,
    year(date_day)                                     as year_number,
    quarter(date_day)                                  as quarter_number,
    'Q' || quarter(date_day)                           as quarter_label,
    month(date_day)                                    as month_number,
    strftime(date_day, '%b')                           as month_name,
    cast(date_trunc('month', date_day) as date)        as month_start,
    strftime(date_day, '%Y-%m')                        as year_month,
    isodow(date_day)                                   as weekday_number,
    isodow(date_day) <= 5                              as is_weekday,
    case when month(date_day) in (12, 1, 2) then 'Winter'
         when month(date_day) in (3, 4, 5)  then 'Spring'
         when month(date_day) in (6, 7, 8)  then 'Summer'
         else 'Autumn' end                             as season,
    year(date_day) = year({{ as_of }})                 as is_ytd,
    year(date_day) = year({{ as_of }}) - 1
        and date_day <= cast({{ as_of }} - interval 1 year as date) as is_pytd,
    date_day > {{ as_of }} - 365                       as is_l12m,
    date_day > {{ as_of }} - 730
        and date_day <= {{ as_of }} - 365              as is_p12m
from days
