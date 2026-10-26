"""Build directory-only Jalna observations from saved public API responses.

Usage: python scripts/build-jalna-menu-listings.py INVENTORY DETAILS_DIR EXISTING_DIRECTORY EXISTING_SOURCES
No menu text, photos, ratings, contacts, dietary labels or prices are copied.
"""
import difflib
import hashlib
import gzip
import json
import math
import pathlib
import re
import sys
from urllib.parse import urlsplit

DATE = "2026-10-26"
ROOT = pathlib.Path(__file__).resolve().parents[1]


def norm(value):
    return re.sub(r"[^a-z0-9]", "", str(value or "").lower().replace("jalna", ""))


def tokens(value):
    common = {"jalna", "maharashtra", "india", "road", "rd", "shop", "no", "ground", "floor", "locality", "near", "opposite", "restaurant", "family", "hotel", "cafe", "the", "and", "kitchen"}
    return {x for x in re.findall(r"[a-z]+", str(value or "").lower()) if len(x)>2 and x not in common}


def nearby(a, b):
    values = [a.get("latitude"), a.get("longitude"), b.get("latitude"), b.get("longitude")]
    if not all(isinstance(v, (float, int)) for v in values):
        return False
    lat1, lon1, lat2, lon2 = map(math.radians, values)
    h = math.sin((lat2-lat1)/2)**2+math.cos(lat1)*math.cos(lat2)*math.sin((lon2-lon1)/2)**2
    return 6371*2*math.asin(min(1, math.sqrt(h))) < .25


def address_match(a, b):
    aa, bb = tokens(a), tokens(b)
    return len(aa & bb)>=2 and len(aa & bb)/max(1, min(len(aa), len(bb))) >= .4


def category(name, kind):
    if re.search(r"cake|baker", name, re.I):
        return "shop:bakery"
    return {"cafe":"amenity:cafe", "bar":"amenity:bar", "bakery":"shop:bakery", "sweets":"shop:confectionery", "fast-food":"amenity:fast_food", "cloud-kitchen":"amenity:fast_food", "food-court":"amenity:food_court"}.get(kind, "amenity:restaurant")


def canonical_url(url):
    u = urlsplit(url)
    return u.netloc.lower()+re.sub(r"/(order|menu|delivery)/?$", "", u.path.lower()).rstrip("/")


def build(inventory, details_dir, existing, sources):
    rows = json.loads(pathlib.Path(inventory).read_text())
    live = json.loads(pathlib.Path(existing).read_text())
    source_profiles = json.loads(pathlib.Path(sources).read_text())
    selected, held, records = {}, [], []
    for row in rows:
        if not row.get("menu_items", 0):
            continue
        reason = "unclear_business_identity" if row["name"] == "cb" else "source_marks_permanently_closed" if "Permanently Closed" in row["name"] else "conflicting_city_locality" if row.get("locality") == "Narnaul Locality" else None
        if reason:
            held.append({"name":row["name"], "source_url":row["url"], "reason":reason})
            continue
        selected.setdefault(norm(row["name"]), row)
    for row in selected.values():
        file = pathlib.Path(details_dir)/(row["id"]+".json")
        if not file.exists():
            held.append({"name":row["name"], "source_url":row["url"], "reason":"detail_lookup_incomplete"})
            continue
        detail = json.loads(file.read_text())
        address = detail.get("address") or {}
        if address.get("city", "").lower() != "jalna" or detail.get("status") == "closed":
            held.append({"name":row["name"], "source_url":row["url"], "reason":"city_or_operating_status_conflict"})
            continue
        street = address.get("street") or None
        lat, lon = detail.get("lat"), detail.get("lon")
        if not isinstance(lat, (float, int)) or not isinstance(lon, (float, int)) or not (19.70<lat<20.05 and 75.7<lon<76.1):
            lat = lon = None
        name = re.sub(r"^✅", "", row["name"]).strip()
        if "| Best Cake Shop" in name:
            name = name.split(" - Best Bakery")[0].strip()
        key = "directory:jalna-menu-"+row["id"].removeprefix("IRR-").lower()
        item = {"sourceKey":key, "external_id":row["id"], "name":name, "brand":None, "category":category(name, row["kind"]), "city":"Jalna", "district":"Jalna", "state":"Maharashtra", "address":street, "locality":address.get("locality"), "pincode":address.get("pincode"), "latitude":lat, "longitude":lon, "coordinate_type":"third_party_directory_unverified" if lat is not None else None, "source_urls":[row["url"]], "source_types":["restaurant_directory"], "menu_source_urls":[row["url"]], "directory_menu_entries_reported":row["menu_items"], "retrieved_on":DATE, "license_status":"not_checked", "source_license":None, "attribution":"Outlet listing via IndiaRestros; menu accuracy and current operation are unconfirmed.", "directory_attribution":"IndiaRestros public API observation dated 26 October 2026; not owner verification.", "operating_status":None, "restaurant_rating":None, "review_count":None, "phone":None, "opening_hours":None, "recommendation_eligible":False, "publish_ready":False, "directory_publish_ready":True, "service_note":"Online menu listing found. Dishes, prices, ingredients and current operation have not been independently verified. Source map pins may be inaccurate."}
        aliases = {norm(x) for x in [row["name"], *detail.get("names", [])] if norm(x)}
        matches, uncertain = [], []
        for old in live:
            identity = norm(old["name"])
            exact = identity in aliases
            if "khatirdari" in identity and "khatirdari" not in norm(name) and "siddharth" in norm(name):
                uncertain.append(old)
                continue
            similarity = max(difflib.SequenceMatcher(None, identity, a).ratio() for a in aliases)
            shared = tokens(name) & tokens(old["name"])
            address_ok = address_match(street, old.get("address")) or nearby(item, old)
            if (exact or similarity>=.65 and shared) and address_ok:
                matches.append(old)
            elif exact or similarity>=.88 and shared:
                uncertain.append(old)
        # Multiple known records remain distinct. Do not guess which one to enrich.
        matches = {r["id"]:r for r in matches}
        if len(matches)>1 or not matches and uncertain:
            held.append({"name":name, "source_url":row["url"], "reason":"possible_existing_outlet_or_address_conflict", "possible_matches":[r["id"] for r in (list(matches.values()) or uncertain)]})
            continue
        if matches:
            old = next(iter(matches.values()))
            matched_source = old.get("sourceProfileId") or (old["id"] if any(s["sourceKey"]==old["id"] for s in source_profiles) else None)
            if matched_source:
                item["matched_source_key"] = matched_source
            else:
                item["existingBusinessId"] = old["id"]
            item["match_evidence"] = "Name/alias plus matching address tokens or source map pins within 250m. Existing facts retained."
        # Hold source duplicates with near-identical names and the same address/pin.
        duplicate = next((r for r in records if norm(r["name"])==norm(name) and (address_match(street,r.get("address")) or nearby(item,r))), None)
        if duplicate:
            duplicate["menu_source_urls"] = list(dict.fromkeys(duplicate["menu_source_urls"]+item["menu_source_urls"]))
            held.append({"name":name,"source_url":row["url"],"reason":"duplicate_source_outlet","matched_source_key":duplicate["sourceKey"]})
            continue
        records.append(item)
    extras = json.loads((ROOT/"api/source-batches/jalna-additional-menu-leads-2026-10-26.json").read_text())["leads"]
    linked_extras, added_extras = 0, 0
    for lead in extras:
        url = lead["menu_source_url"]
        aliases = []
        for row in selected.values():
            f = pathlib.Path(details_dir)/(row["id"]+".json")
            if f.exists():
                d = json.loads(f.read_text())
                if any(canonical_url(source.get("url", ""))==canonical_url(url) for source in d.get("sources", [])):
                    aliases.append(row)
        linked = next((r for r in records if norm(r["name"])==norm(lead["name"]) or any(x["url"] in r["source_urls"] for x in aliases)), None)
        if linked:
            linked["menu_source_urls"] = list(dict.fromkeys(linked["menu_source_urls"]+[url]))
            linked_extras += 1
            continue
        if aliases:
            held.append({"name":lead["name"],"source_url":url,"reason":"additional_menu_alias_of_held_listing"})
            continue
        item = dict(records[0])
        for key in ["matched_source_key", "existingBusinessId", "match_evidence"]:
            item.pop(key, None)
        item.update({"sourceKey":"directory:jalna-menu-index-"+hashlib.sha256(url.encode()).hexdigest()[:16], "external_id":None, "name":lead["name"], "brand":None, "category":category(lead["name"],"cafe" if "cafe" in lead["name"].lower() else "restaurant"), "address":None, "locality":None, "pincode":None, "latitude":None, "longitude":None, "coordinate_type":None, "source_urls":[url], "menu_source_urls":[url], "directory_menu_entries_reported":None, "retrieval_method":"public_search_index", "attribution":"Menu listing discovered through public web search; current menu and operation are unconfirmed.", "directory_attribution":"Public search-index menu observation dated 26 October 2026; not owner verification."})
        records.append(item)
        added_extras += 1
    return {"batch_id":"jalna-menu-listings-"+DATE, "retrieved_on":DATE, "attribution":"Outlet identities and menu links via IndiaRestros public API. No photos, reviews, menu text, prices or dietary labels copied.", "source_terms_url":"https://indiarestros.com/terms", "source_api_docs":"https://indiarestros.com/api/docs", "source_terms_observed":"Website/API use permitted for personal and commercial purposes within published rate limits; facts supplied as-is.", "businesses":records, "menu_items":[], "held_records":held, "summary":{"menuListedSourceRecords":sum(r.get("menu_items",0)>0 for r in rows), "selectedNames":len(selected), "additionalMenuLeads":len(extras), "additionalLeadsLinked":linked_extras, "additionalListingsAdded":added_extras, "publishedObservations":len(records), "existingSourceProfilesEnriched":sum(bool(r.get("matched_source_key")) for r in records), "existingDirectoryRecordsMatched":sum(bool(r.get("existingBusinessId")) for r in records), "newDirectoryProfiles":sum(not r.get("existingBusinessId") and not r.get("matched_source_key") for r in records), "heldRecords":len(held), "newRecommendationDishes":0, "photosCopied":0}, "notice":"Partial Jalna city menu-link coverage. Directory observations are not ownership, licence, menu-price or operating-status verification."}


if __name__ == "__main__":
    result = build(*sys.argv[1:5])
    target = ROOT/"api/source-batches/jalna-menu-listings-2026-10-26.json.gz"
    target.write_bytes(gzip.compress((json.dumps(result, ensure_ascii=False, indent=2)+"\n").encode(), mtime=0))
    print(json.dumps(result["summary"], indent=2))
