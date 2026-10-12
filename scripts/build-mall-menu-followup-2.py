#!/usr/bin/env python3
"""Build the second reviewed mall branch-menu enrichment snapshot."""
import gzip
import hashlib
import json
from pathlib import Path

CHECKED = "2026-10-12"
SOURCE_KEY = "official:sd-food-fff9c9d5c17382f409e1"
SOURCE_URL = "https://stores.burgerking.in/burger-king-fast-food-restaurant-shahid-mangal-pandey-road-thane-179357/Home"


def stable_id(prefix, value):
    return f"{prefix}-{hashlib.sha256(value.encode()).hexdigest()[:20]}"


menu_set_id = stable_id("mall-outlet", SOURCE_KEY)
item = {
    "external_id": stable_id("sd-menu", f"{SOURCE_KEY}|Veg Whopper Deluxe|139"),
    "brand": "Burger King",
    "name": "Veg Whopper Deluxe",
    "menu_category": "Official outlet-page app promotion",
    "portion": None,
    "price_inr": 139.0,
    "is_veg": True,
    "veg_evidence": "The official outlet-page promotion explicitly names the item Veg Whopper Deluxe",
    "source_url": SOURCE_URL,
    "price_scope": "Burger King App promotion displayed on this official outlet page; posted 2026-08-29",
    "branch_availability": "historical_promotion_observed",
    "tax_included": None,
    "retrieved_on": CHECKED,
    "observed_promotion_date": "2026-08-29",
    "recommendation_eligible": False,
    "publish_ready": False,
}
batch = {
    "batch_id": "maharashtra-mall-menu-followup-2-2026-10-12",
    "retrieved_on": CHECKED,
    "businesses": [],
    "menu_items": [],
    "menu_sets": {menu_set_id: {"kind": "outlet_page", "brand": "Burger King", "source_url": SOURCE_URL, "items": [item]}},
    "menu_associations": [{"sourceKey": SOURCE_KEY, "brand": "Burger King", "outlet_menu_set_id": menu_set_id}],
    "research_scope": {
        "state": "Maharashtra", "city": "Thane", "locality": "Shahid Mangal Pandey Road", "mall": "Korum Mall",
        "target_records": 1, "checked_records": 1, "outlet_menus_observed": 1, "new_outlet_rows": 0,
        "menu_entries": 1, "published_prices": 1, "recommendation_eligible_items": 0, "complete_city_census": False,
        "source_checks": [{
            "sourceKey": SOURCE_KEY, "brand": "Burger King", "source_url": SOURCE_URL, "checked_on": CHECKED,
            "menu_items": 1, "published_prices": 1, "status": "dated_outlet_promotion_observed",
            "reason": "The official branch page retains a dated app promotion. Current price, stock and branch availability are not confirmed."
        }],
    },
}

output = Path(__file__).resolve().parents[1] / "api/source-batches/maharashtra-mall-menu-followup-2-2026-10-12.json.gz"
payload = json.dumps(batch, ensure_ascii=False, separators=(",", ":")).encode()
output.write_bytes(gzip.compress(payload, mtime=0))
print(output)
