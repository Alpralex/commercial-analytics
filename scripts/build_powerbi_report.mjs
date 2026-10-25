// Generates the PBIR pages, visuals and "CommercialAnalytics" theme for powerbi/CommercialAnalytics.Report.
// Run from the repo root: node scripts/build_powerbi_report.mjs
// The script owns every page listed below and the CommercialAnalytics theme; it rewrites them on each run.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

const REPORT = path.resolve("powerbi/CommercialAnalytics.Report");
const DEF = path.join(REPORT, "definition");
const VISUAL_SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/visualContainer/2.9.0/schema.json";
const PAGE_SCHEMA = "https://developer.microsoft.com/json-schemas/fabric/item/report/definition/page/2.1.0/schema.json";

// Same visual style as the AtlanticaFPA report in finance-fpa-analytics.
const C = {
  page: "#F7F8F9", card: "#FFFFFF", border: "#DCE0E5", text: "#1B2430", muted: "#5D6876", grid: "#ECEFF2",
  blue: "#2A78D6", orange: "#EB6834", green: "#1F7A35", amber: "#B25B00", grey: "#5D6876", red: "#B42318",
  greenSoft: "#E3F1E6", redSoft: "#FBE4E1", subtotal: "#EEF1F4",
};

// ---------- expression helpers ----------
const lit = (v) => ({ expr: { Literal: { Value: v } } });
const str = (s) => lit(`'${s.replace(/'/g, "''")}'`);
const num = (n) => lit(`${n}D`);
const int = (n) => lit(`${n}L`);
const bool = (b) => lit(b ? "true" : "false");
const fill = (hex) => ({ solid: { color: lit(`'${hex}'`) } });
const col = (entity, prop) => ({ Column: { Expression: { SourceRef: { Entity: entity } }, Property: prop } });
const proj = (field) => {
  const f = field.Column || field.Measure;
  const entity = f.Expression.SourceRef.Entity;
  return { field, queryRef: `${entity}.${f.Property}`, nativeQueryRef: f.Property };
};
const named = (field, displayName) => ({ ...proj(field), displayName });
const ref = (field) => proj(field).queryRef;
const id = (...parts) => crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 20);
const filterId = (...parts) => "Filter" + crypto.createHash("sha1").update(parts.join("|")).digest("hex").slice(0, 24);

// Basic visual-level filter: column IN (literals).
function inFilter(page, key, field, literals) {
  const c = field.Column;
  const entity = c.Expression.SourceRef.Entity;
  return {
    name: filterId(page, key),
    field,
    type: "Categorical",
    filter: {
      Version: 2,
      From: [{ Name: "f", Entity: entity, Type: 0 }],
      Where: [{
        Condition: {
          In: {
            Expressions: [{ Column: { Expression: { SourceRef: { Source: "f" } }, Property: c.Property } }],
            Values: literals.map((v) => [{ Literal: { Value: v } }]),
          },
        },
      }],
    },
    howCreated: "User",
  };
}

// Column NOT IN (literals).
function notInFilter(page, key, field, literals) {
  const f = inFilter(page, key, field, literals);
  f.filter.Where[0].Condition = { Not: { Expression: f.filter.Where[0].Condition } };
  return f;
}


// ---------- fields ----------
// Home table of every measure (PBIR references a measure through its table).
const MEASURE_TABLE = {
  "Customers": "dim_customer", "Customers Without Visit 60+": "dim_customer", "Customers at Risk": "dim_customer",
  "Billed Amount": "fct_invoices", "Billing Share": "fct_invoices", "Open Receivables": "fct_invoices",
  "Overdue 90+": "fct_invoices", "Overdue 90+ Share": "fct_invoices", "Avg Days Late": "fct_invoices",
  "Visits": "fct_visits", "Visits YTD": "fct_visits", "Visits YTD vs PY %": "fct_visits",
};
const meas = (prop) => ({ Measure: { Expression: { SourceRef: { Entity: MEASURE_TABLE[prop] || "fct_sales" } }, Property: prop } });
const cust = (name) => col("dim_customer", name);

const F = {
  region: cust("region"),
  segment: cust("segment"),
  category: col("dim_category", "category"),
  rep: col("dim_rep", "rep_name"),
  monthName: col("dim_date", "month_name"),
  monthStart: col("dim_date", "month_start"),
  year: col("dim_date", "year_number"),
  aging: col("fct_invoices", "aging_bucket"),
};

const scopeOf = (field, value) => ({
  data: [{ scopeId: { Comparison: { ComparisonKind: 0, Left: field, Right: { Literal: { Value: `'${value}'` } } } } }],
});

// Region buttons plus segment, category and rep dropdowns, synced across pages.
function slicers(page) {
  const region = container(page, "slicer_region", { x: 552, y: 16, w: 280, h: 80 }, {
    visualType: "advancedSlicerVisual",
    syncGroup: { groupName: "RegionSync", fieldChanges: true, filterChanges: true },
    query: { queryState: { Values: { projections: [proj(F.region)] } } },
    objects: { layout: [{ properties: { rowCount: int(1), columnCount: int(4) } }] },
    visualContainerObjects: {
      title: [{ properties: { show: bool(true), text: str("Region") } }],
      general: [{ properties: { altText: str("Region filter buttons. Applies to every page.") } }],
      padding: [vcoPadding(8)],
    },
  });
  const dropdown = (key, field, label, x) => container(page, key, { x, y: 16, w: 128, h: 80 }, {
    visualType: "slicer",
    syncGroup: { groupName: `${key}Sync`, fieldChanges: true, filterChanges: true },
    query: { queryState: { Values: { projections: [proj(field)] } } },
    objects: {
      data: [{ properties: { mode: str("Dropdown") } }],
      header: [{ properties: { show: bool(true), text: str(label) } }],
    },
    visualContainerObjects: {
      general: [{ properties: { altText: str(`${label} filter dropdown. Applies to every page.`) } }],
      padding: [vcoPadding(8)],
    },
  });
  return [
    region,
    dropdown("slicer_segment", F.segment, "Segment", 848),
    dropdown("slicer_category", F.category, "Category", 992),
    dropdown("slicer_rep", F.rep, "Sales rep", 1136),
  ];
}

function table(page, key, pos, columns, title, alt, subtitle, opts = {}) {
  return container(page, key, pos, {
    visualType: "tableEx",
    query: {
      queryState: { Values: { projections: columns.map(([f, n]) => named(f, n)) } },
      ...(opts.sort ? { sortDefinition: { sort: [{ field: opts.sort, direction: opts.direction || "Descending" }], isDefaultSort: true } } : {}),
    },
    objects: {
      columnHeaders: [{ properties: { columnAdjustment: str("growToFit"), autoSizeColumnWidth: bool(true) } }],
      total: [{ properties: { totals: bool(false) } }],
    },
    visualContainerObjects: chartVcos(title, alt, subtitle),
  }, opts.filters ? { filterConfig: { filters: opts.filters } } : {});
}

// ---------- pages ----------
const PAGE_IDS = { overview: "b1c2d3e4f5a6b7c8d901", coverage: "b1c2d3e4f5a6b7c8d902", pricing: "b1c2d3e4f5a6b7c8d903", receivables: "b1c2d3e4f5a6b7c8d904" };

function overviewPage() {
  const p = PAGE_IDS.overview;
  z = 0;
  const pos = (i) => ({ x: 16 + i * 253, y: 112, w: 236, h: 128 });
  const cards = [
    card(p, "card_revenue_ytd", pos(0), meas("Revenue YTD"), "Revenue YTD", {
      units: "1000000", precision: 2,
      reference: { field: meas("Revenue YTD vs PY %"), title: "vs last year", signColor: true },
      alt: "Net revenue year to date, with the change against the same months of last year.",
    }),
    card(p, "card_margin", pos(1), meas("Gross Margin %"), "Gross margin %", { alt: "Gross margin as a share of net revenue." }),
    card(p, "card_buyers", pos(2), meas("Buying Customers"), "Buying customers", { units: "1", alt: "Number of customers who bought." }),
    card(p, "card_no_visit", pos(3), meas("Customers Without Visit 60+"), "Customers without a visit in 60+ days", {
      units: "1", reference: { field: meas("Revenue L12M at Risk"), title: "revenue at risk", units: "1000000", precision: 2 },
      alt: "Customers not visited in more than 60 days, and their revenue in the last 12 months.",
    }),
    card(p, "card_overdue", pos(4), meas("Overdue 90+"), "Receivables overdue 90+ days", {
      units: "1000000", precision: 2, alt: "Unpaid invoices more than 90 days past due on the snapshot date.",
    }),
  ];
  const trend = container(p, "line_revenue_month", { x: 16, y: 256, w: 816, h: 448 }, {
    visualType: "lineChart",
    query: {
      queryState: {
        Category: { projections: [named(F.monthName, "Month")] },
        Y: { projections: [named(meas("Net Revenue"), "Net revenue")] },
        Series: { projections: [named(F.year, "Year")] },
      },
    },
    objects: {
      lineStyles: [{ properties: { strokeWidth: num(2), lineChartType: str("linear"), areaShow: bool(false) } }],
      legend: legendTop,
      labels: [{ properties: { show: bool(false) } }],
      categoryAxis: [{ properties: { ...axisOn } }],
      valueAxis: [{ properties: { ...axisOn, gridlineShow: bool(true), gridlineColor: fill(C.grid), labelDisplayUnits: num(1000000) } }],
    },
    visualContainerObjects: chartVcos("Net revenue by month, one line per year",
      "Line chart of monthly net revenue, one line per year, so each month compares with the same month of other years.",
      "€ millions, excluding VAT. 2026 runs to September"),
  });
  const ytd = meas("Revenue YTD vs PY %");
  const byRegion = container(p, "bar_region_ytd", { x: 848, y: 256, w: 416, h: 448 }, {
    visualType: "clusteredBarChart",
    query: {
      queryState: {
        Category: { projections: [named(F.region, "Region")] },
        Y: { projections: [named(ytd, "Revenue YTD vs last year")] },
      },
      sortDefinition: { sort: [{ field: ytd, direction: "Ascending" }], isDefaultSort: true },
    },
    objects: {
      dataPoint: [{ properties: { fill: { solid: { color: signCases(ytd, C.green, C.red) } } }, selector: { data: [{ dataViewWildcard: { matchingOption: 1 } }] } }],
      labels: [{ properties: { show: bool(true), fontSize: num(10), color: fill(C.text) } }],
      categoryAxis: [{ properties: { ...axisOn } }],
      valueAxis: [{ properties: { show: bool(false), gridlineShow: bool(false), showAxisTitle: bool(false) } }],
      legend: [{ properties: { show: bool(false) } }],
    },
    visualContainerObjects: chartVcos("Revenue year to date against last year, by region",
      "Bar chart of the change in revenue year to date against the same months of last year, by customer region; the South is the only region below zero.",
      "January to September, against the same months of 2025"),
  });
  return {
    name: p, displayName: "Overview",
    visuals: [...header(p, "How are we doing this year?", "Agricultural supplies distributor, sales to 30 September 2026"),
      ...slicers(p), ...cards, trend, byRegion],
  };
}

function coveragePage() {
  const p = PAGE_IDS.coverage;
  z = 0;
  const combo = container(p, "combo_visits_buyers", { x: 16, y: 112, w: 616, h: 296 }, {
    visualType: "lineClusteredColumnComboChart",
    query: {
      queryState: {
        Category: { projections: [named(F.monthStart, "Month")] },
        Y: { projections: [named(meas("Visits"), "Visits")] },
        Y2: { projections: [named(meas("Buying Customers"), "Buying customers")] },
      },
    },
    objects: {
      dataPoint: [
        { properties: { fill: fill(C.blue) }, selector: { metadata: ref(meas("Visits")) } },
        { properties: { fill: fill(C.orange) }, selector: { metadata: ref(meas("Buying Customers")) } },
      ],
      legend: legendTop,
      labels: [{ properties: { show: bool(false) } }],
      categoryAxis: [{ properties: { ...axisOn } }],
      valueAxis: [{ properties: { ...axisOn, gridlineShow: bool(true), gridlineColor: fill(C.grid), secShow: bool(true) } }],
    },
    visualContainerObjects: chartVcos("South: visits and buying customers by month",
      "Combined chart of monthly visits (columns) and buying customers (line) in the South; visits halve from January 2026, when rep REP12 left.",
      "Visits halve from January 2026, when REP12 left"),
  });
  const reps = table(p, "table_reps", { x: 648, y: 112, w: 616, h: 296 }, [
    [F.rep, "Sales rep"], [meas("Visits"), "Visits"], [meas("Revenue per Visit"), "Revenue per visit"],
    [meas("Buying Customers"), "Buying customers"], [meas("Coverage %"), "Coverage"],
  ], "Sales reps in the South", "Table of sales reps with visits, revenue per visit, buying customers and coverage of their accounts.",
  "Coverage = buying customers ÷ customers assigned to the rep", { sort: meas("Visits") });
  const bands = container(p, "column_visit_bands", { x: 16, y: 424, w: 400, h: 280 }, {
    visualType: "columnChart",
    query: {
      queryState: {
        Category: { projections: [named(cust("days_since_visit_band"), "Days since last visit")] },
        Y: { projections: [named(meas("Customers"), "Customers")] },
      },
      sortDefinition: { sort: [{ field: cust("days_since_visit_band"), direction: "Ascending" }], isDefaultSort: true },
    },
    objects: {
      dataPoint: [{ properties: { fill: fill(C.blue) } }],
      labels: [{ properties: { show: bool(true), fontSize: num(9), color: fill(C.text) } }],
      categoryAxis: [{ properties: { ...axisOn } }],
      valueAxis: [{ properties: { show: bool(false), gridlineShow: bool(false), showAxisTitle: bool(false) } }],
      legend: [{ properties: { show: bool(false) } }],
    },
    visualContainerObjects: chartVcos("Customers by days since last visit",
      "Column chart of the number of customers by days since their last visit, in 30-day bands.", "On 30 September 2026"),
  });
  const callList = table(p, "table_call_list", { x: 432, y: 424, w: 832, h: 280 }, [
    [cust("customer_name"), "Customer"], [F.region, "Region"], [cust("account_rep_id"), "Account rep"],
    [cust("last_visit_date"), "Last visit"], [cust("days_since_visit"), "Days"], [cust("revenue_l12m"), "Revenue L12M"],
  ], "Call list: customers without a visit in 60+ days",
  "Table of customers not visited in more than 60 days, with region, account rep, last visit, days since and revenue in the last 12 months, largest revenue first.",
  "Largest revenue in the last 12 months first", {
    sort: cust("revenue_l12m"),
    filters: [inFilter(p, "no_visit_60", cust("visit_recency"), ["'No visit 60+ days'"])],
  });
  return {
    name: p, displayName: "Coverage and visits",
    filters: [inFilter(p, "page_region_sul", F.region, ["'Sul'"])],
    visuals: [...header(p, "Why is the South falling?", "Visits and customer coverage in the South (page filtered to Region = Sul)"),
      ...slicers(p), combo, reps, bands, callList],
  };
}

function pricingPage() {
  const p = PAGE_IDS.pricing;
  z = 0;
  const scatter = container(p, "scatter_rep_pricing", { x: 16, y: 112, w: 816, h: 592 }, {
    visualType: "scatterChart",
    query: {
      queryState: {
        Category: { projections: [named(F.rep, "Sales rep")] },
        X: { projections: [named(meas("Discount %"), "Discount %")] },
        Y: { projections: [named(meas("Gross Margin %"), "Gross margin %")] },
        Size: { projections: [named(meas("Net Revenue"), "Net revenue")] },
      },
    },
    objects: {
      dataPoint: [{ properties: { fill: fill(C.blue) } }],
      categoryLabels: [{ properties: { show: bool(true), fontSize: num(10), color: fill(C.text) } }],
      categoryAxis: [{ properties: { ...axisOn, showAxisTitle: bool(true), gridlineShow: bool(true), gridlineColor: fill(C.grid) } }],
      valueAxis: [{ properties: { ...axisOn, showAxisTitle: bool(true), gridlineShow: bool(true), gridlineColor: fill(C.grid) } }],
      legend: [{ properties: { show: bool(false) } }],
    },
    visualContainerObjects: chartVcos("Discount against gross margin, by sales rep",
      "Scatter plot with one bubble per sales rep: discount percent on the horizontal axis, gross margin percent on the vertical axis, bubble size by net revenue. REP07 sits alone with the highest discount and lowest margin.",
      "Bubble size = net revenue. Select a rep to filter the category chart"),
  });
  const disc = meas("Discount %");
  const byCategory = container(p, "bar_discount_category", { x: 848, y: 112, w: 416, h: 440 }, {
    visualType: "clusteredBarChart",
    query: {
      queryState: {
        Category: { projections: [named(F.category, "Category")] },
        Y: { projections: [named(disc, "Discount %")] },
      },
      sortDefinition: { sort: [{ field: disc, direction: "Descending" }], isDefaultSort: true },
    },
    objects: {
      dataPoint: [{ properties: { fill: fill(C.orange) } }],
      labels: [{ properties: { show: bool(true), fontSize: num(10), color: fill(C.text) } }],
      categoryAxis: [{ properties: { ...axisOn } }],
      valueAxis: [{ properties: { show: bool(false), gridlineShow: bool(false), showAxisTitle: bool(false) } }],
      legend: [{ properties: { show: bool(false) } }],
    },
    visualContainerObjects: chartVcos("Discount by product category",
      "Bar chart of discount percent by product category, highest first.", "Discount = (gross − net) ÷ gross"),
  });
  const perCustomer = card(p, "card_revenue_customer", { x: 848, y: 568, w: 416, h: 136 }, meas("Revenue per Customer"), "Revenue per buying customer", {
    units: "1000", precision: 1,
    reference: { field: meas("Discount %"), title: "at a discount of" },
    alt: "Net revenue per buying customer, with the discount percent: a bigger discount does not buy more volume.",
  });
  return {
    name: p, displayName: "Pricing",
    visuals: [...header(p, "Who gives margin away?", "Discount and gross margin by sales rep and category"),
      ...slicers(p), scatter, byCategory, perCustomer],
  };
}

function receivablesPage() {
  const p = PAGE_IDS.receivables;
  z = 0;
  const open = meas("Open Receivables");
  const BUCKETS = { "Not due": "#B6BDC5", "1-30": "#F6C9B0", "31-60": "#F09A6C", "61-90": C.orange, "90+": C.red };
  const aging = container(p, "bar_aging_segment", { x: 16, y: 112, w: 736, h: 296 }, {
    visualType: "barChart",
    query: {
      queryState: {
        Category: { projections: [named(F.segment, "Segment")] },
        Y: { projections: [named(open, "Open receivables")] },
        Series: { projections: [named(F.aging, "Days past due")] },
      },
      sortDefinition: { sort: [{ field: open, direction: "Descending" }], isDefaultSort: true },
    },
    objects: {
      dataPoint: Object.entries(BUCKETS).map(([b, c]) => ({ properties: { fill: fill(c) }, selector: scopeOf(F.aging, b) })),
      legend: legendTop,
      labels: [{ properties: { show: bool(false) } }],
      categoryAxis: [{ properties: { ...axisOn } }],
      valueAxis: [{ properties: { ...axisOn, gridlineShow: bool(true), gridlineColor: fill(C.grid), labelDisplayUnits: num(1000000) } }],
    },
    visualContainerObjects: chartVcos("Open receivables by segment and days past due",
      "Stacked bar chart of unpaid invoices by customer segment, split by days past due from not yet due (grey) to over 90 days (red).",
      "€ millions on 30 September 2026, including VAT"),
  }, { filterConfig: { filters: [notInFilter(p, "not_paid", F.aging, ["'Paid'"])] } });
  const bySegment = table(p, "table_segment", { x: 768, y: 112, w: 496, h: 296 }, [
    [F.segment, "Segment"], [meas("Billing Share"), "Share of billing"], [meas("Overdue 90+ Share"), "Share of 90+ overdue"], [meas("Avg Days Late"), "Avg days late"],
  ], "Payment behaviour by segment",
  "Table by customer segment with its share of billing, its share of receivables overdue more than 90 days and the average days paid late.",
  "Livestock farms hold most of the 90+ overdue", { sort: meas("Overdue 90+ Share") });
  const byCustomer = table(p, "table_customers_overdue", { x: 16, y: 424, w: 1248, h: 280 }, [
    [cust("customer_name"), "Customer"], [F.segment, "Segment"], [open, "Open receivables"], [meas("Overdue 90+"), "Overdue 90+"], [meas("Avg Days Late"), "Avg days late"],
  ], "Customers with the most overdue receivables",
  "Table of customers with their open receivables, the part overdue more than 90 days and the average days paid late, largest overdue first.",
  "Largest 90+ overdue first", { sort: meas("Overdue 90+") });
  return {
    name: p, displayName: "Receivables",
    visuals: [...header(p, "Where is the cash stuck?", "Unpaid invoices on 30 September 2026, by segment and customer"),
      ...slicers(p), aging, bySegment, byCustomer],
  };
}


// ---------- visual builders ----------
let z = 0;
function container(page, key, pos, visual, extra = {}) {
  z += 1000;
  return {
    $schema: VISUAL_SCHEMA,
    name: id(page, key),
    position: { x: pos.x, y: pos.y, z, height: pos.h, width: pos.w, tabOrder: z },
    visual,
    ...extra,
  };
}

const vcoPadding = (p) => ({ properties: { top: num(p), bottom: num(p), left: num(p), right: num(p) } });

function chartVcos(title, alt, subtitle) {
  return {
    title: [{ properties: { show: bool(true), text: str(title) } }],
    general: [{ properties: { altText: str(alt) } }],
    padding: [vcoPadding(12)],
    // Without an explicit subtitle Desktop shows an auto-generated one in the UI language.
    subTitle: [{ properties: subtitle ? { show: bool(true), text: str(subtitle) } : { show: bool(false) } }],
  };
}

function textbox(page, key, pos, text, style) {
  return container(page, key, pos, {
    visualType: "textbox",
    objects: {
      general: [{
        properties: {
          paragraphs: [{ textRuns: [{ value: text, textStyle: style }], horizontalTextAlignment: "left" }],
        },
      }],
    },
    visualContainerObjects: {
      background: [{ properties: { show: bool(false) } }],
      border: [{ properties: { show: bool(false) } }],
      padding: [vcoPadding(0)],
    },
  });
}

function header(page, title, subtitle) {
  return [
    textbox(page, "title", { x: 16, y: 16, w: 520, h: 40 }, title,
      { fontFamily: "Segoe UI Semibold", fontSize: "22px", color: C.text }),
    textbox(page, "subtitle", { x: 16, y: 58, w: 520, h: 40 }, subtitle,
      { fontFamily: "Segoe UI", fontSize: "13px", color: C.muted }),
  ];
}

// Entity (multi-select dropdown) and fiscal year (single select, preset to 2026), synced across pages.
function card(page, key, pos, field, label, opts = {}) {
  const objects = {
    value: [{
      properties: {
        fontSize: num(20),
        ...(opts.units ? { labelDisplayUnits: str(opts.units) } : {}),
        ...(opts.precision !== undefined ? { labelPrecision: int(opts.precision) } : {}),
      },
      selector: { id: "default" },
    }],
    label: [{ properties: { show: bool(true), text: str(label), fontSize: num(11), fontColor: fill(C.muted) }, selector: { id: "default" } }],
    padding: [{ properties: { paddingUniform: num(8) }, selector: { id: "default" } }],
    layout: [{ properties: { paddingUniform: num(0) }, selector: { id: "default" } }],
    outline: [{ properties: { show: bool(false) }, selector: { id: "default" } }],
    divider: [{ properties: { show: bool(false) }, selector: { id: "default" } }],
  };
  if (opts.reference) {
    const refId = id(page, key, "ref");
    const sel = { data: [{ dataViewWildcard: { matchingOption: 0 } }], metadata: ref(field), id: refId, order: 0 };
    const partSel = { data: [{ dataViewWildcard: { matchingOption: 1 } }], metadata: ref(field), id: refId };
    objects.referenceLabel = [{ properties: { value: { expr: opts.reference.field } }, selector: sel }];
    const titleProps = { show: bool(true), titleContentType: str("custom"), titleText: str(opts.reference.title), titleFontColor: fill(C.muted) };
    objects.referenceLabelTitle = [
      { properties: titleProps, selector: { id: "default" } },
      { properties: titleProps, selector: partSel },
    ];
    const valueProps = { show: bool(true), valueFontColor: opts.reference.signColor ? signFont(opts.reference.field) : fill(C.text), valueBold: bool(true) };
    if (opts.reference.units) valueProps.valueDisplayUnits = str(opts.reference.units);
    if (opts.reference.precision !== undefined) valueProps.valuePrecision = int(opts.reference.precision);
    objects.referenceLabelValue = [{ properties: valueProps, selector: partSel }];
  }
  return container(page, key, pos, {
    visualType: "cardVisual",
    query: { queryState: { Data: { projections: [proj(field)] } } },
    objects,
    visualContainerObjects: {
      title: [{ properties: { show: bool(false) } }],
      general: [{ properties: { altText: str(opts.alt || label) } }],
      padding: [vcoPadding(8)],
      spacing: [{ properties: { customizeSpacing: bool(true), verticalSpacing: num(2) }, selector: { id: "default" } }],
    },
  });
}

// Green when the measure is above zero, red when below (the reporting sign makes > 0 favourable on every line).
function signCases(field, pos, neg) {
  return {
    expr: {
      Conditional: {
        Cases: [
          { Condition: { Comparison: { ComparisonKind: 1, Left: field, Right: { Literal: { Value: "0D" } } } }, Value: { Literal: { Value: `'${pos}'` } } },
          { Condition: { Comparison: { ComparisonKind: 3, Left: field, Right: { Literal: { Value: "0D" } } } }, Value: { Literal: { Value: `'${neg}'` } } },
        ],
      },
    },
  };
}
const signFont = (field) => ({ solid: { color: signCases(field, C.green, C.red) } });
const signBack = (field) => ({ solid: { color: signCases(field, C.greenSoft, C.redSoft) } });

const axisOn = { show: bool(true), fontSize: num(10), labelColor: fill(C.muted), showAxisTitle: bool(false) };
const legendTop = [{ properties: { show: bool(true), position: str("Top"), fontSize: num(10), labelColor: fill(C.muted) } }];

function lineChart(page, key, pos, category, series, title, alt, opts = {}) {
  return container(page, key, pos, {
    visualType: "lineChart",
    query: {
      queryState: {
        Category: { projections: [proj(category)] },
        Y: { projections: series.map((s) => named(s.field, s.name)) },
      },
    },
    objects: {
      dataPoint: series.map((s) => ({ properties: { fill: fill(s.color) }, selector: { metadata: ref(s.field) } })),
      lineStyles: [
        { properties: { strokeWidth: num(2), lineChartType: str("linear"), areaShow: bool(false) } },
        ...series.filter((s) => s.dashed).map((s) => ({ properties: { lineStyle: str("dashed") }, selector: { metadata: ref(s.field) } })),
      ],
      legend: legendTop,
      labels: [{ properties: { show: bool(false) } }],
      categoryAxis: [{ properties: { ...axisOn } }],
      valueAxis: [{ properties: { ...axisOn, gridlineShow: bool(true), gridlineColor: fill(C.grid), ...(opts.units ? { labelDisplayUnits: str(opts.units) } : {}) } }],
    },
    visualContainerObjects: chartVcos(title, alt, opts.subtitle),
  }, opts.filters ? { filterConfig: { filters: opts.filters } } : {});
}


// ---------- theme ----------
function theme(name) {
  const axis = { gridlineColor: { solid: { color: C.grid } }, labelColor: { solid: { color: C.muted } } };
  return {
    $schema: "https://raw.githubusercontent.com/microsoft/powerbi-desktop-samples/main/Report%20Theme%20JSON%20Schema/reportThemeSchema-2.153.json",
    name,
    dataColors: [C.blue, C.orange, C.green, C.amber, C.grey],
    good: C.green, neutral: C.grey, bad: C.red,
    maximum: "#256ABF", center: "#79A6DD", minimum: "#CDE2FB", null: C.grey,
    foreground: C.text, foregroundNeutralSecondary: C.muted, foregroundNeutralTertiary: C.muted,
    background: C.card, backgroundLight: C.grid, backgroundNeutral: C.border, tableAccent: C.blue,
    textClasses: {
      callout: { fontSize: 20, fontFace: "Segoe UI Semibold", color: C.text },
      title: { fontSize: 12, fontFace: "Segoe UI Semibold", color: C.text },
      header: { fontSize: 12, fontFace: "Segoe UI Semibold", color: C.text },
      label: { fontSize: 10, fontFace: "Segoe UI", color: C.text },
    },
    visualStyles: {
      "*": {
        "*": {
          background: [{ show: true, color: { solid: { color: C.card } }, transparency: 0 }],
          border: [{ show: true, color: { solid: { color: C.border } }, radius: 6, width: 1 }],
          dropShadow: [{ show: false }],
          padding: [{ top: 8, bottom: 8, left: 8, right: 8 }],
          title: [{ show: true, fontFamily: "Segoe UI Semibold", fontSize: 12, fontColor: { solid: { color: C.text } } }],
          subTitle: [{ fontFamily: "Segoe UI", fontSize: 10, fontColor: { solid: { color: C.muted } } }],
          categoryAxis: [{ ...axis, gridlineStyle: "solid" }],
          valueAxis: [{ ...axis, gridlineStyle: "solid" }],
          legend: [{ labelColor: { solid: { color: C.muted } } }],
        },
      },
      textbox: { "*": { padding: [{ top: 0, bottom: 0, left: 0, right: 0 }], background: [{ show: false }], border: [{ show: false }] } },
      cardVisual: { "*": { value: [{ bold: true, $id: "default" }], label: [{ show: true, $id: "default" }], title: [{ show: false }] } },
      slicer: {
        "*": {
          header: [{ fontFamily: "Segoe UI Semibold", textSize: 10, fontColor: { solid: { color: C.text } }, outlineStyle: 0 }],
          items: [{ fontFamily: "Segoe UI", textSize: 10, fontColor: { solid: { color: C.text } }, outlineStyle: 0, padding: 2 }],
        },
      },
      tableEx: {
        "*": {
          columnHeaders: [{ autoSizeColumnWidth: true, columnAdjustment: "growToFit", backColor: { solid: { color: C.page } }, fontColor: { solid: { color: C.text } }, bold: true }],
          values: [{ backColorPrimary: { solid: { color: C.card } }, backColorSecondary: { solid: { color: "#FAFBFC" } }, fontColorPrimary: { solid: { color: C.text } }, fontColorSecondary: { solid: { color: C.text } } }],
        },
      },
      pivotTable: {
        "*": {
          columnHeaders: [{ autoSizeColumnWidth: true, columnAdjustment: "growToFit", backColor: { solid: { color: C.page } }, fontColor: { solid: { color: C.text } }, bold: true }],
          rowHeaders: [{ fontColor: { solid: { color: C.text } } }],
          values: [{ backColorPrimary: { solid: { color: C.card } }, backColorSecondary: { solid: { color: C.card } }, fontColorPrimary: { solid: { color: C.text } }, fontColorSecondary: { solid: { color: C.text } } }],
        },
      },
    },
  };
}

// ---------- write ----------
const write = (file, obj) => {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, JSON.stringify(obj, null, 2) + "\n");
};

const pages = [overviewPage(), coveragePage(), pricingPage(), receivablesPage()];
for (const page of pages) {
  const dir = path.join(DEF, "pages", page.name);
  fs.rmSync(path.join(dir, "visuals"), { recursive: true, force: true });
  write(path.join(dir, "page.json"), {
    $schema: PAGE_SCHEMA,
    name: page.name,
    displayName: page.displayName,
    displayOption: "FitToPage",
    height: 720,
    width: 1280,
    objects: {
      background: [{ properties: { color: fill(C.page), transparency: num(0) } }],
      outspace: [{ properties: { color: fill(C.page), transparency: num(0) } }],
    },
    ...(page.filters ? { filterConfig: { filters: page.filters } } : {}),
  });
  for (const v of page.visuals) write(path.join(dir, "visuals", v.name, "visual.json"), v);
}

const pagesJsonPath = path.join(DEF, "pages", "pages.json");
const pagesJson = JSON.parse(fs.readFileSync(pagesJsonPath, "utf8"));
pagesJson.pageOrder = pages.map((p) => p.name);
pagesJson.activePageName = pages[0].name;
write(pagesJsonPath, pagesJson);

// Theme: rotate the file name on every run so Desktop does not serve a cached copy.
const regDir = path.join(REPORT, "StaticResources", "RegisteredResources");
fs.mkdirSync(regDir, { recursive: true });
for (const f of fs.readdirSync(regDir)) if (/^CommercialAnalytics-[0-9a-f]+\.json$/.test(f)) fs.rmSync(path.join(regDir, f));
const themeName = `CommercialAnalytics-${crypto.randomBytes(4).toString("hex")}.json`;
write(path.join(regDir, themeName), theme(themeName));

const reportPath = path.join(DEF, "report.json");
const report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
report.themeCollection.customTheme = {
  name: themeName,
  reportVersionAtImport: report.themeCollection.baseTheme.reportVersionAtImport,
  type: "RegisteredResources",
};
report.resourcePackages = report.resourcePackages.filter((r) => r.type !== "RegisteredResources");
report.resourcePackages.push({
  name: "RegisteredResources",
  type: "RegisteredResources",
  items: [{ name: themeName, path: themeName, type: "CustomTheme" }],
});
write(reportPath, report);

console.log(`Wrote ${pages.length} pages, ${pages.reduce((n, p) => n + p.visuals.length, 0)} visuals, theme ${themeName}`);
