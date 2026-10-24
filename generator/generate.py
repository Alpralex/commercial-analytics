"""Synthetic data for a Portuguese animal-health distributor, Jan 2024 to Sep 2026.

Every number is generated from the rules below with a fixed seed, so the data set is
reproducible and the business behaviour it contains is documented, not hidden:

  R1  Customers order more often in the weeks after a sales-rep visit.
  R2  Customers with no visit for 60+ days start to lapse (their order rate decays).
  R3  The South region lost one rep in Jan 2026; its customers are visited half as often.
  R4  Rep REP07 gives deeper discounts than the rest (about 9 points more), with no volume gain.
  R5  Livestock farms pay late: most invoices settle 20-60 days after the due date, and about
      7% slip 90-200 days, so the 90+ aging bucket is dominated by farms.
  R6  Vaccines peak in spring (Mar-May); pet food is flat; parasiticides peak in summer.

The app's job is to surface these patterns from the data alone.
Output: CSV files in ../data (UTF-8, comma-separated, ISO dates).
"""
import csv
import datetime as dt
import os
import numpy as np

SEED = 20261024
START, END = dt.date(2024, 1, 1), dt.date(2026, 9, 30)
OUT = os.path.join(os.path.dirname(__file__), "..", "data")
rng = np.random.default_rng(SEED)

REGIONS = {
    "Norte": ["Porto", "Braga", "Viana do Castelo", "Vila Real"],
    "Centro": ["Coimbra", "Aveiro", "Viseu", "Leiria"],
    "Lisboa e Vale do Tejo": ["Lisboa", "Setúbal", "Santarém"],
    "Sul": ["Évora", "Beja", "Faro", "Portalegre"],
}
SEGMENTS = {  # share of customers, orders per month at full engagement, mean lines per order
    "Veterinary clinic": (0.42, 2.6, 6),
    "Pet shop": (0.30, 1.8, 8),
    "Livestock farm": (0.18, 0.9, 4),
    "Farm supply store": (0.10, 1.4, 10),
}
CATEGORIES = {  # number of SKUs, price range EUR, gross margin, segments that buy it (weight)
    "Vaccines": (40, (18, 90), 0.24, {"Veterinary clinic": 3, "Livestock farm": 3, "Farm supply store": 1}),
    "Parasiticides": (70, (9, 55), 0.31, {"Veterinary clinic": 3, "Pet shop": 3, "Livestock farm": 2, "Farm supply store": 2}),
    "Pharmaceuticals": (110, (6, 120), 0.27, {"Veterinary clinic": 4, "Livestock farm": 2, "Farm supply store": 1}),
    "Pet food": (90, (12, 75), 0.19, {"Veterinary clinic": 2, "Pet shop": 4, "Farm supply store": 2}),
    "Accessories": (60, (3, 40), 0.42, {"Pet shop": 4, "Veterinary clinic": 1, "Farm supply store": 2}),
    "Hygiene": (30, (4, 25), 0.36, {"Pet shop": 2, "Veterinary clinic": 2, "Farm supply store": 1}),
}
SEASON = {  # multiplier by month (1-12)
    "Vaccines": [0.7, 0.8, 1.4, 1.6, 1.5, 1.0, 0.8, 0.7, 0.9, 1.0, 0.9, 0.7],
    "Parasiticides": [0.6, 0.6, 0.8, 1.0, 1.3, 1.5, 1.6, 1.5, 1.1, 0.8, 0.6, 0.6],
}
REPS_PER_REGION = {"Norte": 3, "Centro": 3, "Lisboa e Vale do Tejo": 4, "Sul": 2}
QTY_MULT = {"Veterinary clinic": 1.0, "Pet shop": 1.0, "Livestock farm": 4.0, "Farm supply store": 1.5}  # farms buy herd-sized lots
TERMS = {"Veterinary clinic": 30, "Pet shop": 30, "Livestock farm": 60, "Farm supply store": 60}


def daterange(a, b):
    d = a
    while d <= b:
        yield d
        d += dt.timedelta(days=1)


def write(name, header, rows):
    with open(os.path.join(OUT, name), "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(header)
        w.writerows(rows)
    print(f"{name}: {len(rows):,} rows")


def main():
    os.makedirs(OUT, exist_ok=True)

    # Reps
    reps, n = [], 1
    for region, k in REPS_PER_REGION.items():
        for _ in range(k):
            reps.append({"rep_id": f"REP{n:02d}", "region": region})
            n += 1
    south_reps = [r["rep_id"] for r in reps if r["region"] == "Sul"]
    departed = south_reps[-1]  # R3: leaves on 2026-01-01, customers move to the remaining South rep
    write("reps.csv", ["rep_id", "rep_name", "region", "left_on"],
          [[r["rep_id"], f"Sales rep {r['rep_id'][-2:]}", r["region"], "2026-01-01" if r["rep_id"] == departed else ""] for r in reps])

    # Products
    products, pid = [], 1
    for cat, (k, (lo, hi), margin, _) in CATEGORIES.items():
        for _ in range(k):
            price = round(float(np.exp(rng.uniform(np.log(lo), np.log(hi)))), 2)
            cost = round(price * (1 - margin + rng.normal(0, 0.03)), 2)
            products.append({"sku": f"SKU{pid:04d}", "category": cat, "price": price, "cost": cost,
                             "pop": rng.pareto(1.6) + 0.2})
            pid += 1
    write("products.csv", ["sku", "category", "list_price_eur", "unit_cost_eur"],
          [[p["sku"], p["category"], p["price"], p["cost"]] for p in products])

    # Customers
    seg_names = list(SEGMENTS)
    seg_p = np.array([SEGMENTS[s][0] for s in seg_names])
    customers = []
    for i in range(1, 1801):
        region = rng.choice(list(REGIONS), p=[0.30, 0.22, 0.33, 0.15])
        seg = rng.choice(seg_names, p=seg_p)
        region_reps = [r["rep_id"] for r in reps if r["region"] == region]
        customers.append({
            "id": f"C{i:04d}", "segment": seg, "region": region,
            "district": rng.choice(REGIONS[region]), "rep": rng.choice(region_reps),
            "size": float(rng.lognormal(0, 0.6)),
            "since": START - dt.timedelta(days=int(rng.integers(0, 3000))) if rng.random() < 0.85
            else START + dt.timedelta(days=int(rng.integers(0, 900))),
            "late_payer": seg == "Livestock farm" and rng.random() < 0.7,  # R5
        })
    write("customers.csv", ["customer_id", "customer_name", "segment", "region", "district", "rep_id", "customer_since", "payment_terms_days"],
          [[c["id"], f"Customer {c['id'][1:]}", c["segment"], c["region"], c["district"], c["rep"], c["since"].isoformat(), TERMS[c["segment"]]] for c in customers])

    # Products each segment buys, weighted by popularity
    seg_catalog = {}
    for seg in seg_names:
        w = np.array([p["pop"] * CATEGORIES[p["category"]][3].get(seg, 0) for p in products])
        seg_catalog[seg] = w / w.sum()

    # Simulate day by day
    visits, orders, lines, invoices, payments = [], [], [], [], []
    last_visit = {c["id"]: START - dt.timedelta(days=int(rng.integers(0, 30))) for c in customers}
    order_no = 0
    for day in daterange(START, END):
        weekday = day.weekday() < 5
        for c in customers:
            if day < c["since"]:
                continue
            rep = c["rep"]
            if c["region"] == "Sul" and rep == departed and day >= dt.date(2026, 1, 1):
                rep = south_reps[0]
            # Visits: every 2-3 weeks on weekdays; South after Jan 2026 half as often (R3)
            visit_p = 1 / 16 if c["segment"] != "Livestock farm" else 1 / 28
            if c["region"] == "Sul" and day >= dt.date(2026, 1, 1):
                visit_p /= 2
            if weekday and rng.random() < visit_p:
                visits.append([day.isoformat(), c["id"], rep, rng.choice(["Planned", "Planned", "Planned", "Follow-up"])])
                last_visit[c["id"]] = day
            # Ordering propensity
            gap = (day - last_visit[c["id"]]).days
            engagement = 1.0
            if gap <= 10:
                engagement *= 1.6                      # R1
            if gap > 60:
                engagement *= np.exp(-(gap - 60) / 45)  # R2
            rate = SEGMENTS[c["segment"]][1] / 22 * c["size"] ** 0.5 * engagement
            if not weekday or rng.random() >= rate:
                continue
            order_no += 1
            oid = f"O{order_no:07d}"
            n_lines = max(1, int(rng.poisson(SEGMENTS[c["segment"]][2] * c["size"] ** 0.3)))
            skus = rng.choice(len(products), size=n_lines, replace=False, p=seg_catalog[c["segment"]])
            base_disc = rng.uniform(0.02, 0.10)
            if rep == "REP07":
                base_disc += 0.09                      # R4
            total = 0.0
            for j in skus:
                p = products[j]
                season = SEASON.get(p["category"], [1] * 12)[day.month - 1]
                qty = max(1, int(rng.poisson(2.5 * QTY_MULT[c["segment"]] * c["size"] * season)))
                disc = min(0.35, max(0.0, base_disc + rng.normal(0, 0.02)))
                net = round(p["price"] * (1 - disc), 2)
                lines.append([oid, p["sku"], qty, p["price"], net, p["cost"]])
                total += qty * net
            orders.append([oid, day.isoformat(), c["id"], rep])
            due = day + dt.timedelta(days=TERMS[c["segment"]])
            invoices.append([f"I{order_no:07d}", oid, day.isoformat(), due.isoformat(), round(total * 1.23, 2)])  # 23% VAT
            # Payment behaviour (R5); unpaid if it would land after END
            u = rng.random()
            if c["late_payer"] and u < 0.10:
                delay = int(rng.integers(90, 201))
            elif c["late_payer"] and u < 0.80:
                delay = int(rng.integers(20, 61))
            elif u < 0.003:
                delay = int(rng.integers(90, 201))  # occasional bad payer in any segment
            else:
                delay = int(rng.integers(-5, 12))
            paid = due + dt.timedelta(days=delay)
            if paid <= END:
                payments.append([f"I{order_no:07d}", paid.isoformat(), round(total * 1.23, 2)])

    write("visits.csv", ["visit_date", "customer_id", "rep_id", "visit_type"], visits)
    write("orders.csv", ["order_id", "order_date", "customer_id", "rep_id"], orders)
    write("order_lines.csv", ["order_id", "sku", "quantity", "list_price_eur", "net_price_eur", "unit_cost_eur"], lines)
    write("invoices.csv", ["invoice_id", "order_id", "invoice_date", "due_date", "amount_eur"], invoices)
    write("payments.csv", ["invoice_id", "payment_date", "amount_eur"], payments)


if __name__ == "__main__":
    main()
