#!/usr/bin/env python3
"""Build a small, reviewed branch-menu enrichment snapshot."""
import gzip
import hashlib
import json
from pathlib import Path


CHECKED = "2026-10-12"
SOURCE_KEY = "official:sd-food-e66d16b463fe11b57fe7"
SOURCE_URL = "https://stores.burgerking.in/burger-king-fast-food-restaurant-kurla-west-mumbai-179368/Home"


def stable_id(prefix, value):
    return f"{prefix}-{hashlib.sha256(value.encode()).hexdigest()[:20]}"


def item(name, price):
    return {
        "external_id": stable_id("sd-menu", f"{SOURCE_KEY}|{name}|{price}"),
        "brand": "Burger King",
        "name": name,
        "menu_category": "Official outlet promotion",
        "portion": None,
        "price_inr": float(price),
        "is_veg": True,
        "veg_evidence": "The official outlet-page promotion explicitly labels the item Veg",
        "source_url": SOURCE_URL,
        "price_scope": "Displayed promotion price on this official outlet page",
        "branch_availability": "published_on_outlet_page",
        "tax_included": None,
        "retrieved_on": CHECKED,
        "recommendation_eligible": False,
        "publish_ready": False,
    }


menu_set_id = stable_id("mall-outlet", SOURCE_KEY)
items = [item("Crispy Veg Meal", 99), item("Veg Whopper Deluxe Meal", 149)]
batch = {
    "batch_id": "maharashtra-mall-menu-followup-2026-10-12",
    "retrieved_on": CHECKED,
    "businesses": [],
    "menu_items": [],
    "menu_sets": {
        menu_set_id: {
            "kind": "outlet_page",
            "brand": "Burger King",
            "source_url": SOURCE_URL,
            "items": items,
        }
    },
    "menu_associations": [
        {
            "sourceKey": SOURCE_KEY,
            "brand": "Burger King",
            "outlet_menu_set_id": menu_set_id,
        }
    ],
    "research_scope": {
        "state": "Maharashtra",
        "city": "Mumbai",
        "locality": "Kurla West",
        "mall": "Phoenix Marketcity, Kurla",
        "target_records": 1,
        "checked_records": 1,
        "outlet_menus_observed": 1,
        "new_outlet_rows": 0,
        "menu_entries": 2,
        "published_prices": 2,
        "recommendation_eligible_items": 0,
        "complete_city_census": False,
        "source_checks": [
            {
                "sourceKey": SOURCE_KEY,
                "brand": "Burger King",
                "source_url": SOURCE_URL,
                "checked_on": CHECKED,
                "menu_items": 2,
                "published_prices": 2,
                "status": "outlet_promotions_observed",
                "reason": "Two named, priced promotions were visible on the official branch page; current stock, tax treatment and recommendation eligibility remain unconfirmed.",
            }
        ],
    },
}

output = Path(__file__).resolve().parents[1] / "api/source-batches/maharashtra-mall-menu-followup-2026-10-12.json.gz"
payload = json.dumps(batch, ensure_ascii=False, separators=(",", ":")).encode()
output.write_bytes(gzip.compress(payload, mtime=0))
print(output)
