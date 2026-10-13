#!/usr/bin/env python3
"""Build the thirteenth reviewed mall branch-menu enrichment snapshot."""
import gzip, hashlib, json
from pathlib import Path

CHECKED = "2026-10-13"
BRANCHES = [
    ("official:sd-food-2f858bdd5f3b28f56e0c", "https://www.dominos.co.in/store-location/pune/phoenix-market-city-pune/menu", "Viman Nagar", "Phoenix Marketcity"),
    ("official:sd-food-d3a2b33f7535b00062d9", "https://www.dominos.co.in/store-location/pune/nexus-westend-mall-pune-maharashtra/menu", "Aundh", "Nexus Westend Mall"),
]

def stable_id(prefix, value): return f"{prefix}-{hashlib.sha256(value.encode()).hexdigest()[:20]}"

menu_sets, associations, checks = {}, [], []
for source_key, source_url, locality, mall in BRANCHES:
    menu_set_id = stable_id("mall-outlet", source_key)
    item = {"external_id": stable_id("sd-menu", f"{source_key}|2 Regular Pizzas|99 each|{CHECKED}"), "brand": "Domino's Pizza", "name": "2 Regular Pizzas", "menu_category": "Official branch-menu offer", "portion": "2 regular pizzas; ₹99 each", "price_inr": 99.0, "is_veg": None, "veg_evidence": None, "source_url": source_url, "price_scope": "Price per Regular Pizza in the two-pizza offer displayed on this official branch-menu page", "branch_availability": "official_branch_menu_offer_observed", "tax_included": None, "retrieved_on": CHECKED, "observed_promotion_date": None, "recommendation_eligible": False, "publish_ready": False}
    menu_sets[menu_set_id] = {"kind": "outlet_page", "brand": "Domino's Pizza", "source_url": source_url, "items": [item]}
    associations.append({"sourceKey": source_key, "brand": "Domino's Pizza", "outlet_menu_set_id": menu_set_id})
    checks.append({"sourceKey": source_key, "brand": "Domino's Pizza", "city": "Pune", "locality": locality, "mall": mall, "source_url": source_url, "checked_on": CHECKED, "menu_items": 1, "published_prices": 1, "status": "official_branch_menu_offer_observed", "reason": "The official exact-branch menu URL displays a two-Regular-Pizza offer at ₹99 each. Dietary type, final checkout price and current availability are not confirmed."})

batch = {"batch_id": "maharashtra-mall-menu-followup-13-2026-10-13", "retrieved_on": CHECKED, "businesses": [], "menu_items": [], "menu_sets": menu_sets, "menu_associations": associations, "research_scope": {"state": "Maharashtra", "cities": ["Pune"], "localities": ["Viman Nagar", "Aundh"], "malls": ["Phoenix Marketcity", "Nexus Westend Mall"], "target_records": 2, "checked_records": 2, "outlet_menus_observed": 2, "new_outlet_rows": 0, "menu_entries": 2, "published_prices": 2, "recommendation_eligible_items": 0, "complete_city_census": False, "source_checks": checks}}
output = Path(__file__).resolve().parents[1] / "api/source-batches/maharashtra-mall-menu-followup-13-2026-10-13.json.gz"
output.write_bytes(gzip.compress(json.dumps(batch, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0))
print(output)
