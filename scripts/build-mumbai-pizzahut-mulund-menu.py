#!/usr/bin/env python3
"""Archive the exact official Pizza Hut R Mall Mulund branch menu."""

import gzip
import hashlib
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "api/source-batches/mumbai-pizzahut-r-mall-menu-2026-10-13.json.gz"
SOURCE_KEY = "official:sd-food-cd832e85898cd156a795"
SOURCE_URL = "https://restaurants.pizzahut.co.in/pizza-hut-mulund-west-pizza-restaurant-mulund-west-mumbai-1135/Menu"


def decode(value):
    return json.loads('"' + value.replace('"', '\\"') + '"')


request = urllib.request.Request(SOURCE_URL, headers={"User-Agent": "SuggestDish source research/1.0"})
with urllib.request.urlopen(request, timeout=60) as response:
    html = response.read().decode("utf-8")

pattern = re.compile(
    r'\\"section\\":\\"([^"<]*?)\\".*?'
    r'\\"items\\":\\"([^"<]*?)\\".*?'
    r'\\"is_nonVeg\\":(true|false).*?\\"is_veg\\":(true|false)'
)
observed = []
seen = set()
for section, name, nonveg, veg in pattern.findall(html):
    section, name = decode(section), decode(name)
    key = (section, name)
    if key in seen:
        continue
    seen.add(key)
    observed.append((section, name, nonveg == "true", veg == "true"))

if len(observed) != 135:
    raise RuntimeError(f"Expected 135 distinct branch-menu items, observed {len(observed)}")

items = []
for section, name, nonveg, veg in observed:
    digest = hashlib.sha256(f"{SOURCE_KEY}|{section}|{name}".encode()).hexdigest()[:20]
    dietary = True if veg else False if nonveg else None
    items.append({
        "external_id": f"sd-menu-{digest}", "brand": "Pizza Hut", "name": name,
        "menu_category": section, "portion": None, "price_inr": None,
        "is_veg": dietary, "veg_evidence": SOURCE_URL if dietary is not None else None,
        "source_url": SOURCE_URL, "price_scope": "Price not published on observed menu page",
        "branch_availability": "published_on_outlet_page", "tax_included": None,
        "retrieved_on": "2026-10-13", "recommendation_eligible": False, "publish_ready": False,
    })

menu_set_id = "mumbai-outlet-" + hashlib.sha256(SOURCE_KEY.encode()).hexdigest()[:20]
payload = {
    "batch_id": "mumbai-pizzahut-r-mall-menu-2026-10-13", "retrieved_on": "2026-10-13",
    "businesses": [], "menu_items": [],
    "menu_sets": {menu_set_id: {"kind": "outlet_page", "brand": "Pizza Hut", "source_url": SOURCE_URL, "items": items}},
    "menu_associations": [{"sourceKey": SOURCE_KEY, "brand": "Pizza Hut", "outlet_menu_set_id": menu_set_id}],
    "research_scope": {
        "state": "Maharashtra", "cities": ["Mumbai"], "localities": ["R Mall, Mulund West"],
        "target_records": 1, "checked_records": 1, "outlet_menus_observed": 1,
        "new_outlet_rows": 0, "menu_entries": len(items), "published_prices": 0,
        "recommendation_eligible_items": 0, "held_duplicate_candidates": 0,
        "complete_city_census": False,
        "source_checks": [{
            "sourceKey": SOURCE_KEY, "brand": "Pizza Hut", "city": "Mumbai",
            "locality": "R Mall, Mulund West", "source_url": SOURCE_URL,
            "checked_on": "2026-10-13", "menu_items": len(items), "published_prices": 0,
            "status": "official_branch_menu_observed",
            "reason": "Exact official branch page publishes names, sections and some explicit dietary icons, but no menu prices."
        }]
    }
}

encoded = json.dumps(payload, ensure_ascii=False, separators=(",", ":")).encode()
with OUT.open("wb") as raw:
    with gzip.GzipFile(fileobj=raw, mode="wb", mtime=0) as archive:
        archive.write(encoded)
print(f"wrote {OUT.relative_to(ROOT)}: {len(items)} items")
