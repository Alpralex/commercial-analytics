-- Q5 What is seasonal? Average monthly net revenue by category and calendar month over the complete
-- years 2024 and 2025, and a seasonal index (1.0 = the category's average month).
with monthly as (
    select category, year(order_date) as year_number, month(order_date) as month_number, sum(net_amount) as net_revenue
    from {{ ref('fct_sales_lines') }}
    where year(order_date) in (2024, 2025)
    group by all
),
avg_month as (
    select category, month_number, avg(net_revenue) as avg_monthly_revenue
    from monthly group by all
)
select
    category,
    month_number,
    avg_monthly_revenue,
    avg_monthly_revenue / avg(avg_monthly_revenue) over (partition by category) as seasonal_index,
    case when month_number in (12, 1, 2) then 'Winter'
         when month_number in (3, 4, 5)  then 'Spring'
         when month_number in (6, 7, 8)  then 'Summer'
         else 'Autumn' end as season
from avg_month
