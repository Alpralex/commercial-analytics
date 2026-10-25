# Sheet guide

Four sheets, each answering one question a sales director asks on Monday morning.
Build them in this order; each takes 20 to 40 minutes with the master items in place.

## 1. Overview: "How are we doing this year?"
- KPIs: Revenue YTD, Revenue YTD vs PY %, Gross Margin %, Buying Customers, Overdue 90+.
- Line chart: Net Revenue by YearMonth, one line per Year (dimension `Month`, alternate `Year`).
- Bar chart: Revenue YTD vs PY % by Region. **Sul is the only region down (−16.5%).**
- Filter pane: Region, Segment, Category, Sales Rep.

## 2. Coverage and visits: "Why is the South falling?"
- Combo chart by YearMonth: Visits (bars) and Buying Customers (line), filtered to Region = Sul.
  Visits halve from Jan 2026, when a rep left (`Rep Left On`); revenue follows.
- Table by Sales Rep: Visits, Revenue per Visit, Buying Customers, Coverage %.
- Histogram: customers by Days Since Visit Band.
- Straight table "Call list": Customer, Region, Sales Rep, Last Visit, Days Since Visit,
  Revenue L12M at Risk, filtered to `Visit Recency = No visit 60+ days`, sorted by revenue.

## 3. Pricing: "Who gives margin away?"
- Scatter: Sales Rep, x = Discount %, y = Gross Margin %, bubble = Net Revenue.
  **REP07 sits alone at ~15% discount and 13.6% margin vs ~6% and ~21.8% for peers**, with lower
  revenue per customer than the other three Lisbon reps, so the discount buys no volume.
- Bar: Discount % by Category for the selected rep.

## 4. Receivables: "Where is the cash stuck?"
- Stacked bar: Open Receivables by Segment, stacked by Aging Bucket.
  **Livestock farms are 17% of billing but ~84% of the 90+ bucket.**
- KPI: Avg Days Late by Segment (farms ~29 days vs ~3 for the rest).
- Table: Customer, Segment, Open Receivables, Overdue 90+, Avg Days Late, sorted by Overdue 90+.

## Bookmarks for the demo video
1. "South drop": Region = Sul, Year = 2026.
2. "REP07": Sales Rep = REP07 on the pricing sheet.
3. "Farms 90+": Segment = Livestock farm on the receivables sheet.
