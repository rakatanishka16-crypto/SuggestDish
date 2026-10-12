#!/usr/bin/env python3
"""Build the ninth reviewed mall branch-menu enrichment snapshot."""
import gzip
import hashlib
import json
from pathlib import Path

CHECKED = "2026-10-13"
SOURCE_KEY = "official:sd-food-a6fd30b4929fa5097139"
SOURCE_URL = "https://www.dominos.co.in/store-location/pune/amanora-mall/menu"


def stable_id(prefix, value):
    return f"{prefix}-{hashlib.sha256(value.encode()).hexdigest()[:20]}"


menu_set_id = stable_id("mall-outlet", SOURCE_KEY)
item = {
    "external_id": stable_id("sd-menu", f"{SOURCE_KEY}|2 Regular Pizzas|99 each|{CHECKED}"),
    "brand": "Domino's Pizza",
    "name": "2 Regular Pizzas",
    "menu_category": "Official branch-menu offer",
    "portion": "2 regular pizzas; ₹99 each",
    "price_inr": 99.0,
    "is_veg": None,
    "veg_evidence": None,
    "source_url": SOURCE_URL,
    "price_scope": "Price per Regular Pizza in the two-pizza offer displayed on this official branch-menu page",
    "branch_availability": "official_branch_menu_offer_observed",
    "tax_included": None,
    "retrieved_on": CHECKED,
    "observed_promotion_date": None,
    "recommendation_eligible": False,
    "publish_ready": False,
}

batch = {
    "batch_id": "maharashtra-mall-menu-followup-9-2026-10-13",
    "retrieved_on": CHECKED,
    "businesses": [],
    "menu_items": [],
    "menu_sets": {
        menu_set_id: {
            "kind": "outlet_page",
            "brand": "Domino's Pizza",
            "source_url": SOURCE_URL,
            "items": [item],
        }
    },
    "menu_associations": [{
        "sourceKey": SOURCE_KEY,
        "brand": "Domino's Pizza",
        "outlet_menu_set_id": menu_set_id,
    }],
    "research_scope": {
        "state": "Maharashtra",
        "cities": ["Pune"],
        "localities": ["Amanora Park Township, Hadapsar"],
        "malls": ["Amanora Mall"],
        "target_records": 1,
        "checked_records": 1,
        "outlet_menus_observed": 1,
        "new_outlet_rows": 0,
        "menu_entries": 1,
        "published_prices": 1,
        "recommendation_eligible_items": 0,
        "complete_city_census": False,
        "source_checks": [{
            "sourceKey": SOURCE_KEY,
            "brand": "Domino's Pizza",
            "city": "Pune",
            "locality": "Amanora Park Township, Hadapsar",
            "mall": "Amanora Mall",
            "source_url": SOURCE_URL,
            "checked_on": CHECKED,
            "menu_items": 1,
            "published_prices": 1,
            "status": "official_branch_menu_offer_observed",
            "reason": "The official exact-branch menu page displays a two-Regular-Pizza offer at ₹99 each. Dietary type, final checkout price and current stock are not confirmed.",
        }],
    },
}

output = Path(__file__).resolve().parents[1] / "api/source-batches/maharashtra-mall-menu-followup-9-2026-10-13.json.gz"
output.write_bytes(gzip.compress(json.dumps(batch, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0))
print(output)
