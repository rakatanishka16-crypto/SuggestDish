"""Publish explicitly reviewed source branches without guessing legacy DB identity.

Usage: python scripts/build-jalna-menu-followup.py ORIGINAL_CACHE FOLLOWUP_CACHE
The review fixes the provider ID, requested menu URL, city and full address.
Any changed identity fails closed. Source branches are never merged into a
same-name legacy restaurant merely to clear an import hold.
"""
import gzip
import importlib.util
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("priced_builder", ROOT / "scripts/build-jalna-priced-menus.py")
base = importlib.util.module_from_spec(spec)
spec.loader.exec_module(base)


def build(folders):
    reviews = json.loads((ROOT / "api/source-batches/jalna-menu-branch-reviews-2026-10-27.json").read_text())["reviews"]
    requested = {name: base.outlet_url("https://www.zomato.com/jalna/" + path) for name, path in json.loads((ROOT / "api/source-batches/jalna-menu-request-scope-2026-10-27.json").read_text())["listings"]}
    businesses, items, outcomes = [], [], []
    for review in reviews:
        id = review["provider_id"]
        def load(kind):
            paths = [pathlib.Path(folder) / (id + "." + kind + ".json") for folder in folders]
            return json.loads(next(p for p in paths if p.exists()).read_text())
        detail, menu = load("detail"), load("menu")
        address = detail.get("address") or {}
        upstream = base.outlet_url(menu.get("source_url"))
        if (detail.get("id") != id or menu.get("restaurant") != id or
                address.get("city") != review["expected_city"] or address.get("street") != review["expected_address"] or
                upstream != requested[review["requested_name"]] or upstream != base.outlet_url(review["expected_upstream_url"]) or
                detail.get("status") == "closed" or
                not any(base.outlet_url(s.get("url")) == upstream for s in detail.get("sources", []))):
            raise ValueError("Reviewed branch identity changed: " + id)
        key = "directory:jalna-menu-branch-" + id.removeprefix("IRR-").lower()
        safe, rejected = base.priced_items(menu, key, id)
        if not safe:
            raise ValueError("Reviewed branch has no usable prices: " + id)
        if not menu.get("url", "").startswith("https://indiarestros.com/r/"):
            raise ValueError("Missing provider menu provenance: " + id)
        name = review["requested_name"]
        if review["branch_label"].casefold() not in name.casefold():
            name += " — " + review["branch_label"]
        category = "amenity:cafe" if "cafe" in name.casefold() else "amenity:fast_food" if any(t in name.casefold() for t in ("vada pav", "dosa", "idli", "pav bhaji")) else "amenity:restaurant"
        b = {"sourceKey": key, "external_id": id, "name": name, "city": "Jalna", "state": "Maharashtra", "district": "Jalna", "category": category, "address": address["street"], "locality": address.get("locality"), "pincode": address.get("pincode"), "latitude": None, "longitude": None, "source_urls": [detail["url"]], "source_types": ["restaurant_directory"], "menu_source_urls": [menu["url"]], "retrieved_on": base.DATE, "menu_provider": "IndiaRestros API", "menu_upstream_source": menu.get("source"), "menu_upstream_url": menu["source_url"], "menu_source_updated_at": menu.get("updated"), "menu_retrieved_on": base.DATE, "menu_attribution": "Menu provided by IndiaRestros; original source: " + str(menu.get("source") or "not specified") + ".", "attribution": "Branch details and menu facts supplied by IndiaRestros; current operation is unconfirmed.", "requested_outlet_url": upstream, "existing_database_association": "unresolved_not_merged", "branch_review": review, "recommendation_eligible": False, "publish_ready": False, "directory_publish_ready": True}
        businesses.append(b)
        items.extend(safe)
        outcomes.append({"name": review["requested_name"], "status": "published_menu", "source_key": key, "provider_id": id, "priced_items": len(safe), "held_items": len(rejected), "source_url": menu["url"], "source_updated_at": menu.get("updated"), "resolution": "independent_source_branch"})
    return {"batch_id": "jalna-priced-menu-followup-2026-10-27", "retrieved_on": base.DATE, "provider": "IndiaRestros API", "terms_url": "https://indiarestros.com/terms", "businesses": businesses, "menu_items": items, "request_outcomes": outcomes, "summary": {"additionalMenuProfiles": len(businesses), "additionalPricedMenuItems": len(items), "newSourceProfiles": len(businesses), "photosCopied": 0, "contactsCopied": 0, "recommendationDishesPromoted": 0}, "notice": "Independently identified source branches. Similar legacy database listings remain separate until their identity can be corroborated. Branch labels identify the source address, not a verified owner claim."}


if __name__ == "__main__":
    result = build(sys.argv[1:])
    (ROOT / "api/source-batches/jalna-priced-menu-followup-2026-10-27.json.gz").write_bytes(gzip.compress((json.dumps(result, ensure_ascii=False, indent=2) + "\n").encode(), mtime=0))
    print(json.dumps(result["summary"], indent=2))
