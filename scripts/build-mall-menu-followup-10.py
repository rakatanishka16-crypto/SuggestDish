#!/usr/bin/env python3
"""Build the tenth reviewed mall branch-menu enrichment snapshot."""
import gzip
import hashlib
import json
from pathlib import Path

CHECKED = "2026-10-13"
SOURCE_KEY = "official:sd-food-022918f8c6f84bc12ff2"
SOURCE_URL = "https://www.dominos.co.in/store-locations/aurangabad/prozone-mall-aurangabad/menu"


def stable_id(prefix, value):
    return f"{prefix}-{hashlib.sha256(value.encode()).hexdigest()[:20]}"


GROUPS = [
    ("Bestsellers", [
        "The Unthinkable Pizza", "The Cheese Dominator", "The 4 Cheese Pizza", "Margherita",
        "Double Cheese Margherita", "Farmhouse", "Mexican Green Wave", "Deluxe Veggie",
        "Veg Extravaganza", "Chicken Golden Delight", "Chicken Pepperoni", "Non Veg Supreme",
        "Chicken Fiesta", "Chicken Dominator", "Pepper Barbecue Chicken", "Chicken Sausage",
        "Pepper Barbecue & Onion", "Indi Chicken Tikka",
    ]),
    ("New Launches", [
        "Paneer Tikka Stuffed Garlic Bread", "Chicken Pepperoni Stuffed Garlic Bread",
        "Creamy Tomato Pasta Pizza - Veg",
    ]),
    ("Pizza Mania", ["Non Veg Loaded", "Veg Loaded", "Paneer & Onion", "Cheesy"]),
    ("Speciality Chicken", ["Peppy Chicken Nuggets", "Moroccan Spice Chicken Chunks", "Cheesy Meatballs"]),
    ("Sides", [
        "Creamy Tomato Pasta Veg", "Cheesy Jalapeno Pasta Veg", "Tikka Masala Pasta Veg",
        "Moroccan Spice Pasta Veg", "Creamy Tomato Pasta Non Veg", "Cheesy Jalapeno Pasta Non Veg",
    ]),
    ("Beverages", [
        "Mountain Dew Ice (500ml)", "Pepsi (500ml)", "7Up (500ml)",
        "B Natural Alphonsos from Ratnagiri (300 ml)",
        "B Natural Pink Guavas from Dakshin India (300 ml)",
        "B Natural Mixed Fruit from Himalayas (300 ml)",
    ]),
    ("Dessert", ["Choco Lava Cake", "Butterscotch Mousse Cake", "Brownie Fantasy"]),
    ("Meals & Combos", [
        "Clean Bowled Classic Veg Combo", "Clean Bowled Spicy Combo", "Clean Bowled Golden Corn Combo",
        "Clean Bowled Paneer Special Combo", "Clean Bowled Cheesy Combo", "Clean Bowled Sausage Combo",
    ]),
    ("Menu", ["Cheese n Corn", "Pepper Barbeque Chicken"]),
]

items = []
for category, names in GROUPS:
    for name in names:
        explicitly_veg = True if name == "The Unthinkable Pizza" else None
        items.append({
            "external_id": stable_id("sd-menu", f"{SOURCE_KEY}|{category}|{name}"),
            "brand": "Domino's Pizza",
            "name": name,
            "menu_category": category,
            "portion": None,
            "price_inr": None,
            "is_veg": explicitly_veg,
            "veg_evidence": "Official description explicitly says 100% Vegetarian" if explicitly_veg else None,
            "source_url": SOURCE_URL,
            "price_scope": "No explicit item price published on the observed branch menu page",
            "branch_availability": "branch_menu_observed",
            "tax_included": None,
            "retrieved_on": CHECKED,
            "recommendation_eligible": False,
            "publish_ready": False,
        })

menu_set_id = stable_id("mall-outlet", SOURCE_KEY)
batch = {
    "batch_id": "maharashtra-mall-menu-followup-10-2026-10-13",
    "retrieved_on": CHECKED,
    "businesses": [],
    "menu_items": [],
    "menu_sets": {menu_set_id: {
        "kind": "outlet_page", "brand": "Domino's Pizza", "source_url": SOURCE_URL, "items": items,
    }},
    "menu_associations": [{
        "sourceKey": SOURCE_KEY, "brand": "Domino's Pizza", "outlet_menu_set_id": menu_set_id,
    }],
    "research_scope": {
        "state": "Maharashtra",
        "cities": ["Chhatrapati Sambhajinagar"],
        "localities": ["Chikalthana Industrial Estate"],
        "malls": ["Prozone Mall"],
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
            "city": "Chhatrapati Sambhajinagar",
            "locality": "Chikalthana Industrial Estate",
            "mall": "Prozone Mall",
            "source_url": SOURCE_URL,
            "checked_on": CHECKED,
            "menu_items": len(items),
            "published_prices": 0,
            "status": "official_branch_menu_observed",
            "reason": "The official exact-branch page identifies the Prozone Mall outlet and lists these unique menu names. No explicit item prices were published on the observed page.",
        }],
    },
}

output = Path(__file__).resolve().parents[1] / "api/source-batches/maharashtra-mall-menu-followup-10-2026-10-13.json.gz"
output.write_bytes(gzip.compress(json.dumps(batch, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0))
print(f"{output} ({len(items)} items)")
