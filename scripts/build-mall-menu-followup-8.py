#!/usr/bin/env python3
"""Build the eighth reviewed mall branch-menu enrichment snapshot."""
import gzip
import hashlib
import json
from pathlib import Path

CHECKED = "2026-10-13"
SOURCE_KEY = "official:sd-food-edbfc77c66961c46673c"
SOURCE_URL = "https://www.dominos.co.in/store-location/navi-mumbai/inorbit-mall-vashi-mumbai/menu"


def stable_id(prefix, value):
    return f"{prefix}-{hashlib.sha256(value.encode()).hexdigest()[:20]}"


GROUPS = [
    ("Veg Pizza's", True, [
        "Veg Extravaganza", "Cloud 9", "Chef's Veg Wonder", "Peppy Paneer",
        "Deluxe Veggie", "5 Pepper", "Veggie Paradise", "Country Special",
        "Farmhouse", "Mexican Green Wave", "Double Cheese Margherita",
        "Spicy Triple Tango", "Margherita",
    ]),
    ("Non Veg Pizza's", False, [
        "Non Veg Supreme", "Chicken Dominator", "Barbeque Chicken",
        "Chicken Fiesta", "Chicken Mexicana", "Chicken Golden Delight",
        "Chef's Chicken Choice", "Cheese & Bbq Chicken", "Chicken Salami Special",
    ]),
    ("Burger Pizza's", True, ["Burger Pizza- Classic Veg", "Burger Pizza- Premium Veg"]),
    ("Burger Pizza's", False, ["Burger Pizza- Classic Non Veg", "Burger Pizza- Premium Non Veg"]),
    ("Pizza Mania", True, [
        "VEG LOADED", "VEG SPICY", "CHEESY", "VEG HERBY", "PANEER & ONION",
        "CAPSICUM", "ONION", "GOLDEN CORN",
    ]),
    ("Pizza Mania", False, [
        "NON VEG LOADED", "NON VEG SPICY", "NON VEG HERBY", "BBQ CHICKEN", "CHUNKY CHICKEN",
    ]),
    ("Sides", True, ["WHITE PASTA ITALIANO VEG", "VEG PARCEL", "TACO MEXICANA VEG"]),
    ("Sides", False, [
        "WHITE PASTA ITALIANO NON-VEG", "CHICKEN PARCEL", "CHICKEN WINGS",
        "TACO MEXICANA NON VEG", "CRISPY CHICKEN STRIPS",
    ]),
    ("Sides", None, [
        "GARLIC BREADSTICKS", "STUFFED GARLIC BREADSTICKS", "LAVA CAKE",
        "CHEESE JALAPENO DIP", "CHEESY DIP", "CHOCO PIZZA",
    ]),
]

items = []
for category, dietary, names in GROUPS:
    for name in names:
        items.append({
            "external_id": stable_id("sd-menu", f"{SOURCE_KEY}|{category}|{name}"),
            "brand": "Domino's Pizza",
            "name": name,
            "menu_category": category,
            "portion": None,
            "price_inr": None,
            "is_veg": dietary,
            "veg_evidence": f"Listed in the official branch menu section: {category}" if dietary is not None else None,
            "source_url": SOURCE_URL,
            "price_scope": "No explicit item price published in the observed branch menu text",
            "branch_availability": "branch_menu_observed",
            "tax_included": None,
            "retrieved_on": CHECKED,
            "recommendation_eligible": False,
            "publish_ready": False,
        })

menu_set_id = stable_id("mall-outlet", SOURCE_KEY)
batch = {
    "batch_id": "maharashtra-mall-menu-followup-8-2026-10-13",
    "retrieved_on": CHECKED,
    "businesses": [],
    "menu_items": [],
    "menu_sets": {
        menu_set_id: {
            "kind": "outlet_page",
            "brand": "Domino's Pizza",
            "source_url": SOURCE_URL,
            "items": items,
        }
    },
    "menu_associations": [{
        "sourceKey": SOURCE_KEY,
        "brand": "Domino's Pizza",
        "outlet_menu_set_id": menu_set_id,
    }],
    "research_scope": {
        "state": "Maharashtra",
        "cities": ["Navi Mumbai"],
        "localities": ["Sector 30A, Vashi"],
        "malls": ["Inorbit Mall, Vashi"],
        "target_records": 1,
        "checked_records": 1,
        "outlet_menus_observed": 1,
        "new_outlet_rows": 0,
        "menu_entries": len(items),
        "published_prices": 0,
        "recommendation_eligible_items": 0,
        "complete_city_census": False,
        "source_checks": [{
            "sourceKey": SOURCE_KEY,
            "brand": "Domino's Pizza",
            "city": "Navi Mumbai",
            "locality": "Sector 30A, Vashi",
            "mall": "Inorbit Mall, Vashi",
            "source_url": SOURCE_URL,
            "checked_on": CHECKED,
            "menu_items": len(items),
            "published_prices": 0,
            "status": "official_branch_menu_observed",
            "reason": "The official page names and addresses this exact outlet and lists the menu. No explicit item prices were present in the observed text.",
        }],
    },
}

output = Path(__file__).resolve().parents[1] / "api/source-batches/maharashtra-mall-menu-followup-8-2026-10-13.json.gz"
output.write_bytes(gzip.compress(json.dumps(batch, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0))
print(f"{output} ({len(items)} items)")
