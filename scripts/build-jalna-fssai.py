"""Build the directory-only FoSCoS batch from the reviewed, deduplicated report.

Usage: python3 scripts/build-jalna-fssai.py /absolute/path/to/reviewed-report.md
No requests, geocoding, menu inference, or database writes are performed.
"""
import collections
import gzip
import hashlib
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
SOURCE = "https://foscos.fssai.gov.in/advance-fbo-search"
TOWNS = {"Jalna City": "Jalna", "Bhokardan": "Bhokardan", "Ambad": "Ambad", "Badnapur": "Badnapur", "Partur": "Partur", "Ghanswnagi": "Ghansawangi", "Jafrabad": "Jafrabad", "Mantha": "Mantha"}
BAR = re.compile(r"\b(bar|baar|beer|beear|bear|permit\s*room|parmit\s*room|wines?|liquor|restrobar|restobar|pub)\b|(?<!\w)(?:बीअर|बिअर|बार)(?!\w)", re.I)
INSTITUTION = re.compile(r"\b(?:schools?|shala|vidh?yal\w*|anganw?adi|anganvadi|icds|madarsa|madrasa)\b|\bz\W*p\W*p?\W*s\b|शाळा|अंगणवाडी", re.I)
MEDICAL = re.compile(r"\b(?:medical|pharma|pharmacy|chemist|drug)\b", re.I)
BAKERY = re.compile(r"baker|\bbakes?\b|\bbakars?\b|cake|बेकरी|बेकर्स|केक", re.I)
FOOD_RETAIL = re.compile(r"\b(?:kirana|ration|provision|general stores?|traders?|trading|dairy|dudh|doodh|papad|masala|flour mill|aqua|water purifier|water suppl\w*)\b", re.I)


def norm(value):
    return "".join(c for c in value.casefold() if c.isalnum())


def build(path):
    text = pathlib.Path(path).read_text()
    body = text.split("## Jalna City-tagged records\n\n", 1)[1]
    approved = {}
    for line in body.splitlines():
        if not line.startswith("| "):
            continue
        cells = [c.strip().replace(r"\|", "|") for c in re.split(r"(?<!\\)\|", line)[1:-1]]
        if len(cells) == 6 and re.fullmatch(r"\d{14}", cells[2]):
            if cells[2] in approved:
                raise ValueError("Duplicate FSSAI number in main listing")
            approved[cells[2]] = cells
    if len(approved) != 3346:
        raise ValueError("Expected the approved 3,346-record report")
    records, held, profiles = [], [], {}
    for name, address, number, kind, status, searches in approved.values():
        if status != "Active" or kind not in {"Registration", "State License", "Central License"}:
            raise ValueError("Unexpected registry status/type")
        tag = address.split(",")[-3].strip()
        checked = "2026-10-27" if any(s in searches for s in ["Hawkers/", "Bakery/"]) else "2026-10-26"
        record = {"number": number, "registeredName": name, "premisesAddress": address, "type": kind, "status": status, "checkedOn": checked, "district": "Jalna", "localityTag": tag, "searchCategories": searches.split("; "), "sourceUrl": SOURCE}
        records.append(record)
        reason = None
        alcohol_name = re.sub(r"\b(?:juice|salad|coffee|chocolate)\s+bar\b", "", name, flags=re.I)
        if BAR.search(alcohol_name):
            reason = "bar_related_name"
        elif tag not in TOWNS:
            reason = "conflicting_district_locality"
        elif INSTITUTION.search(name):
            reason = "institution_not_public_food_outlet"
        elif MEDICAL.search(name):
            reason = "medical_store_not_public_food_outlet"
        if reason:
            held.append({"record": record, "reason": reason})
            continue
        city = TOWNS[tag]
        if BAKERY.search(name):
            category = "shop:bakery"
        elif FOOD_RETAIL.search(name) and not re.search(r"restaurant|hotel|cafe|nashta|nasta|tea|snacks?|chinese|chainees|bhojan", name, re.I):
            category = "shop:deli"
        elif "Restaurants" in searches:
            category = "amenity:restaurant"
        elif "Hotels" in searches:
            category = "tourism:hotel"
        else:
            category = "amenity:fast_food"
        identity = (norm(name), norm(address), city)
        if identity in profiles:
            profiles[identity]["fssai_records"].append(record)
            continue
        profiles[identity] = {"sourceKey": "official:fssai-" + number, "name": name, "brand": name, "category": category, "city": city, "district": "Jalna", "state": "Maharashtra", "locality": tag, "address": address, "latitude": None, "longitude": None, "phone": None, "restaurant_rating": None, "opening_hours": None, "operating_status": None, "license_status": "active_on_foscos", "fssai_records": [record], "source_urls": [SOURCE], "source_types": ["fssai_foscos"], "retrieved_on": checked, "source_license": None, "recommendation_eligible": False, "service_note": "FSSAI registry record. Registered names and administrative locality tags may differ from trading names and municipal boundaries. No menu or opening status confirmed."}
    businesses = list(profiles.values())
    summary = {"approvedRegistryRecords": len(records), "publishedRegistryRecords": sum(len(b["fssai_records"]) for b in businesses), "directoryProfiles": len(businesses), "sameIdentityRecordsMerged": sum(len(b["fssai_records"]) - 1 for b in businesses), "heldRecords": len(held), "heldReasons": dict(collections.Counter(r["reason"] for r in held)), "cityProfiles": dict(collections.Counter(b["city"] for b in businesses)), "bakeryProfiles": sum(b["category"] == "shop:bakery" for b in businesses), "menuItemsAdded": 0, "completeDistrictCensus": False}
    batch = {"batch_id": "jalna-fssai-2026-10-27", "retrieved_on": "2026-10-27", "report_sha256": hashlib.sha256(text.encode()).hexdigest(), "source_url": SOURCE, "summary": summary, "registry_records": records, "held_records": held, "businesses": businesses, "menu_items": [], "notice": "Active licence/registration status observed in FoSCoS on the stated date. This does not verify opening status, ownership, menus, prices, dietary preparation or food safety. Coverage is partial; bar-related names excluded."}
    target = ROOT / "api/source-batches/jalna-fssai-2026-10-27.json.gz"
    target.write_bytes(gzip.compress(json.dumps(batch, ensure_ascii=False, separators=(",", ":")).encode(), mtime=0))
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    build(sys.argv[1])
