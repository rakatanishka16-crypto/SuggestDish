"""Build the requested Jalna priced menus from saved, permitted API responses.

Usage: python scripts/build-jalna-priced-menus.py RESPONSES_DIR
Only exact upstream outlet URLs match the request. No platform pages, photos,
descriptions, ratings, reviews or contacts are copied. Ambiguous identities stay held.
"""
import gzip
import hashlib
import json
import math
import pathlib
import re
import sys
from collections import Counter
from urllib.parse import urlsplit

ROOT = pathlib.Path(__file__).resolve().parents[1]
DATE = "2026-10-27"


def outlet_url(value):
    try:
        u = urlsplit(value)
        if u.scheme != "https" or u.hostname not in ("www.zomato.com", "zomato.com") or u.username or u.password:
            return None
        parts = [p for p in u.path.split("/") if p]
        if "jalna" not in parts:
            return None
        parts = parts[parts.index("jalna"):]
        if parts[-1] in ("order", "menu", "info", "reviews"):
            parts.pop()
        return "/".join(parts) if len(parts) == 2 else None
    except (ValueError, TypeError):
        return None


def priced_items(menu, source_key, provider_id):
    """Keep only exact prices; conflicting duplicate names are not resolved by guessing."""
    seen, held = {}, []
    for section in menu.get("sections", []):
        for item in section.get("items", []):
            name, price = item.get("name"), item.get("price")
            if not isinstance(name, str) or not name.strip() or type(price) not in (int, float) or not math.isfinite(price) or not 0 < price <= 100000:
                held.append({"name": name, "reason": "missing_explicit_positive_price"})
                continue
            key = re.sub(r"\s+", " ", name.strip()).casefold()
            veg = item.get("veg") if type(item.get("veg")) is bool else None
            if key in seen:
                previous = seen[key]
                if previous["price_inr"] != price or previous["is_veg"] != veg:
                    previous["data_conflict"] = True
                    held.append({"name": name, "reason": "conflicting_duplicate_price_or_diet"})
                continue
            digest = hashlib.sha256((provider_id + "|" + key).encode()).hexdigest()[:18]
            seen[key] = {
                "external_id": "jalna-priced-" + digest,
                "source_business_id": source_key,
                "name": name.strip(), "price_inr": price, "is_veg": veg,
                "menu_category": section.get("name"), "portion": None,
                "brand": None, "retrieved_on": DATE,
                "source_url": menu["url"],
                "source_provider": "IndiaRestros API",
                "upstream_source": menu.get("source"),
                "upstream_source_url": menu["source_url"],
                "source_updated_at": menu.get("updated"),
                "verification_status": "third_party_menu_observation",
                "availability_confirmed": False,
                "recommendation_eligible": False,
                "tax_included": None
            }
    return [m for m in seen.values() if not m.get("data_conflict")], held


def build(folder):
    scope = json.loads((ROOT / "api/source-batches/jalna-menu-request-scope-2026-10-27.json").read_text())
    requested = {outlet_url("https://www.zomato.com/jalna/" + path): name for name, path in scope["listings"]}
    old = json.loads(gzip.decompress((ROOT / "api/source-batches/jalna-menu-listings-2026-10-26.json.gz").read_bytes()))
    previous = {b["external_id"]: b for b in old["businesses"]}
    prior_held = {h["source_url"]: h for h in old["held_records"]}
    businesses, items, held, outcomes = [], [], [], {}
    files = sorted(pathlib.Path(folder).glob("*.menu.json"))
    upstream_counts = Counter(outlet_url(json.loads(f.read_text()).get("source_url")) for f in files)
    for file in files:
        provider_id = file.name.split(".")[0]
        menu = json.loads(file.read_text())
        upstream = outlet_url(menu.get("source_url"))
        if upstream not in requested:
            continue
        detail_file = pathlib.Path(folder) / (provider_id + ".detail.json")
        if not detail_file.exists():
            continue
        detail = json.loads(detail_file.read_text())
        name = requested[upstream]
        def reject(reason):
            held.append({"name": name, "provider_id": provider_id, "source_url": detail.get("url"), "reason": reason})
            outcomes.setdefault(upstream, {"name": name, "status": "held", "reason": reason})
        if upstream_counts[upstream] > 1:
            reject("multiple_api_profiles_for_same_upstream_outlet")
            continue
        if menu.get("restaurant") != provider_id or detail.get("id") != provider_id:
            reject("detail_and_menu_outlet_identity_conflict")
            continue
        if detail.get("address", {}).get("city", "").casefold() != "jalna" or detail.get("status") == "closed":
            reject("city_or_operating_status_conflict")
            continue
        if detail.get("url") in prior_held:
            reject(prior_held[detail["url"]]["reason"])
            continue
        old_entry = previous.get(provider_id)
        if old_entry is None:
            reject("outlet_identity_not_previously_reviewed")
            continue
        if upstream in {b["requested_outlet_url"] for b in businesses}:
            reject("multiple_api_profiles_for_same_upstream_outlet")
            continue
        source_key = old_entry.get("matched_source_key") or old_entry["sourceKey"]
        safe_items, rejected_items = priced_items(menu, source_key, provider_id)
        if not safe_items:
            reject("no_unambiguous_priced_menu_items")
            continue
        if not isinstance(menu.get("url"), str) or not menu["url"].startswith("https://indiarestros.com/r/"):
            reject("missing_provider_menu_url")
            continue
        entry = {k: old_entry.get(k) for k in ("sourceKey", "external_id", "existingBusinessId", "name", "category", "city", "state", "district", "address", "locality", "pincode", "source_urls", "source_types", "menu_source_urls", "attribution", "directory_attribution", "retrieved_on")}
        entry.update({"sourceKey": source_key, "menu_provider": "IndiaRestros API", "menu_upstream_source": menu.get("source"), "menu_upstream_url": menu["source_url"], "menu_source_updated_at": menu.get("updated"), "menu_retrieved_on": DATE, "requested_outlet_url": upstream, "menu_source_urls": list(dict.fromkeys([menu["url"], *old_entry.get("menu_source_urls", [])])), "menu_attribution": "Menu provided by IndiaRestros; original source: " + str(menu.get("source") or "not specified") + ".", "recommendation_eligible": False, "publish_ready": False, "directory_publish_ready": True})
        businesses.append(entry)
        items.extend(safe_items)
        outcomes[upstream] = {"name": name, "status": "published_menu", "source_key": source_key, "provider_id": provider_id, "priced_items": len(safe_items), "held_items": len(rejected_items), "source_url": menu["url"], "source_updated_at": menu.get("updated")}
    for url, name in requested.items():
        outcomes.setdefault(url, {"name": name, "status": "pending", "reason": "no_exact_outlet_priced_menu_from_permitted_api"})
    return {"batch_id": "jalna-priced-menus-" + DATE, "retrieved_on": DATE, "provider": "IndiaRestros API", "terms_url": "https://indiarestros.com/terms", "api_docs_url": "https://indiarestros.com/api/docs", "notice": "Dated third-party menu facts with exact prices, not owner verification or confirmation of current availability. Upstream platforms are attributed, not accessed by the import script. No photos, descriptions, ratings, reviews or contacts copied.", "businesses": businesses, "menu_items": items, "held_records": held, "request_outcomes": list(outcomes.values()), "summary": {"requestedListings": len(requested), "publishedMenuProfiles": len(businesses), "pricedMenuItems": len(items), "pendingOrHeldListings": sum(o["status"] != "published_menu" for o in outcomes.values()), "photosCopied": 0, "contactsCopied": 0, "recommendationDishesPromoted": 0}}


if __name__ == "__main__":
    batch = build(sys.argv[1])
    target = ROOT / ("api/source-batches/jalna-priced-menus-" + DATE + ".json.gz")
    target.write_bytes(gzip.compress((json.dumps(batch, ensure_ascii=False, indent=2) + "\n").encode(), mtime=0))
    print(json.dumps(batch["summary"], indent=2))
