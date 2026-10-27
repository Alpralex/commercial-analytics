-- Q5 Season against winter (Dec, Jan, Feb of the same year) for each category, complete years 2024 and 2025.
select
    category,
    avg(avg_monthly_revenue) filter (where season = 'Winter') as winter_avg_revenue,
    avg(avg_monthly_revenue) filter (where season = 'Spring') as spring_avg_revenue,
    avg(avg_monthly_revenue) filter (where season = 'Summer') as summer_avg_revenue,
    avg(avg_monthly_revenue) filter (where season = 'Autumn') as autumn_avg_revenue,
    avg(avg_monthly_revenue) filter (where season = 'Spring') / avg(avg_monthly_revenue) filter (where season = 'Winter') as spring_vs_winter,
    avg(avg_monthly_revenue) filter (where season = 'Summer') / avg(avg_monthly_revenue) filter (where season = 'Winter') as summer_vs_winter,
    max(seasonal_index) / min(seasonal_index) as peak_to_trough
from {{ ref('mart_seasonality') }}
group by all
