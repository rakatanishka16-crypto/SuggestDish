#!/usr/bin/env python3
"""Build the fourth reviewed mall branch-menu enrichment snapshot."""
import gzip
import hashlib
import json
from pathlib import Path

CHECKED = "2026-10-12"
POSTED = "2026-10-07"
TARGETS = [
    {
        "sourceKey": "official:sd-food-546f105843a8e1347c32",
        "city": "Chhatrapati Sambhajinagar",
        "locality": "Chikalthana",
        "mall": "Prozone Mall",
        "source_url": "https://stores.burgerking.in/burger-king-fast-food-restaurant-chikalthana-aurangabad-179369/Home",
    },
    {
        "sourceKey": "official:sd-food-37aeb8e2939674abe250",
        "city": "Thane",
        "locality": "Subhash Nagar",
        "mall": "Viviana Mall",
        "source_url": "https://stores.burgerking.in/burger-king-fast-food-restaurant-subhash-nagar-thane-179292/Home",
    },
    {
        "sourceKey": "official:sd-food-f28c27da38e038228206",
        "city": "Navi Mumbai",
        "locality": "Sector 30A, Vashi",
        "mall": "Inorbit Mall, Vashi",
        "source_url": "https://stores.burgerking.in/burger-king-fast-food-restaurant-sector-30a-vashi-navi-mumbai-179350/Home",
    },
]


def stable_id(prefix, value):
    return f"{prefix}-{hashlib.sha256(value.encode()).hexdigest()[:20]}"


menu_sets = {}
associations = []
checks = []
for target in TARGETS:
    source_key = target["sourceKey"]
    menu_set_id = stable_id("mall-outlet", source_key)
    item = {
        "external_id": stable_id("sd-menu", f"{source_key}|2 Crispy Veg Burgers|79|{POSTED}"),
        "brand": "Burger King",
        "name": "2 Crispy Veg Burgers",
        "menu_category": "Official outlet-page promotion",
        "portion": "2 burgers",
        "price_inr": 79.0,
        "is_veg": True,
        "veg_evidence": "The official outlet-page promotion explicitly says Crispy Veg Burgers",
        "source_url": target["source_url"],
        "price_scope": f"Promotion displayed on this official outlet page; posted {POSTED}",
        "branch_availability": "historical_promotion_observed",
        "tax_included": None,
        "retrieved_on": CHECKED,
        "observed_promotion_date": POSTED,
        "recommendation_eligible": False,
        "publish_ready": False,
    }
    menu_sets[menu_set_id] = {
        "kind": "outlet_page", "brand": "Burger King",
        "source_url": target["source_url"], "items": [item],
    }
    associations.append({
        "sourceKey": source_key, "brand": "Burger King",
        "outlet_menu_set_id": menu_set_id,
    })
    checks.append({
        "sourceKey": source_key, "brand": "Burger King",
        "city": target["city"], "locality": target["locality"], "mall": target["mall"],
        "source_url": target["source_url"], "checked_on": CHECKED,
        "menu_items": 1, "published_prices": 1,
        "status": "dated_outlet_promotion_observed",
        "reason": "The official branch page retains a dated two-burger promotion. Current price, stock and branch availability are not confirmed.",
    })

batch = {
    "batch_id": "maharashtra-mall-menu-followup-4-2026-10-12",
    "retrieved_on": CHECKED,
    "businesses": [], "menu_items": [],
    "menu_sets": menu_sets,
    "menu_associations": associations,
    "research_scope": {
        "state": "Maharashtra",
        "cities": ["Chhatrapati Sambhajinagar", "Thane", "Navi Mumbai"],
        "localities": ["Chikalthana", "Subhash Nagar", "Sector 30A, Vashi"],
        "malls": ["Prozone Mall", "Viviana Mall", "Inorbit Mall, Vashi"],
        "target_records": 3, "checked_records": 3,
        "outlet_menus_observed": 3, "new_outlet_rows": 0,
        "menu_entries": 3, "published_prices": 3,
        "recommendation_eligible_items": 0,
        "complete_city_census": False,
        "source_checks": checks,
    },
}

output = Path(__file__).resolve().parents[1] / "api/source-batches/maharashtra-mall-menu-followup-4-2026-10-12.json.gz"
payload = json.dumps(batch, ensure_ascii=False, separators=(",", ":")).encode()
output.write_bytes(gzip.compress(payload, mtime=0))
print(output)
