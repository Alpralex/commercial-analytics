# Master items

Create these under **Master items** after the first reload. Every measure starts from
`FactType`, because sales, visits and invoices share one fact table.

## Measures

| Name | Expression | Format |
|---|---|---|
| Net Revenue | `Sum({<FactType={'Sale'}>} NetAmount)` | Money, `#.##0 €` |
| Gross Margin | `Sum({<FactType={'Sale'}>} NetAmount - CostAmount)` | Money |
| Gross Margin % | `Sum({<FactType={'Sale'}>} NetAmount - CostAmount) / Sum({<FactType={'Sale'}>} NetAmount)` | `0,0%` |
| Discount % | `1 - Sum({<FactType={'Sale'}>} NetAmount) / Sum({<FactType={'Sale'}>} GrossAmount)` | `0,0%` |
| Revenue YTD | `Sum({<FactType={'Sale'}, _YTD={1}, Year=, Month=, YearMonth=, Quarter=>} NetAmount)` | Money |
| Revenue PYTD | `Sum({<FactType={'Sale'}, _PYTD={1}, Year=, Month=, YearMonth=, Quarter=>} NetAmount)` | Money |
| Revenue YTD vs PY % | `[Revenue YTD] / [Revenue PYTD] - 1` (or repeat the two expressions) | `+0,0%;-0,0%` |
| Buying Customers | `Count({<FactType={'Sale'}>} DISTINCT CustomerID)` | `#.##0` |
| Coverage % (positivação) | `Count({<FactType={'Sale'}>} DISTINCT CustomerID) / Count({<FactType=, %Date=, Year=, Month=, YearMonth=, Quarter=>} DISTINCT Customer)`: buyers in the period over all customers in the selected region, segment or rep | `0,0%` |
| Visits | `Sum({<FactType={'Visit'}>} VisitCount)` | `#.##0` |
| Revenue per Visit | `Sum({<FactType={'Sale'}>} NetAmount) / Sum({<FactType={'Visit'}>} VisitCount)` | Money |
| Customers at Risk | `Count({<[Visit Recency]={'No visit 60+ days'}, [Customer Status]={'Active','Lapsing'}>} DISTINCT CustomerID)` | `#.##0` |
| Revenue L12M at Risk | `Sum({<FactType={'Sale'}, _L12M={1}, [Visit Recency]={'No visit 60+ days'}, Year=, Month=, YearMonth=, Quarter=>} NetAmount)` | Money |
| Open Receivables | `Sum({<FactType={'Invoice'}, %Date=, Year=, Month=, YearMonth=, Quarter=>} OpenAmount)` | Money |
| Overdue 90+ | `Sum({<FactType={'Invoice'}, [Aging Bucket]={'90+'}, %Date=, Year=, Month=, YearMonth=, Quarter=>} OpenAmount)` | Money |
| Avg Days Late | `Avg({<FactType={'Invoice'}>} DaysLate)` | `0,0` |

Receivables measures ignore date selections on purpose: aging is a snapshot on 30 Sep 2026.

## Dimensions

- **Geography** (drill-down): Region → District → Customer
- **Time** (drill-down): Year → Quarter → YearMonth
- **Product**: Category → SKU
- Segment, Sales Rep, Aging Bucket, Customer Status, Days Since Visit Band

## Colours

Assign master colours to `Region` and `Aging Bucket` so every sheet uses the same ones
(aging: Not due grey, 1-30 light, 31-60 mid, 61-90 strong, 90+ red).
