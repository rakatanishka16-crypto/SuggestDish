#!/usr/bin/env python3
"""Build a bounded Chhatrapati Sambhajinagar food-outlet batch from cached OSM data."""

import argparse
import difflib
import json
import math
import re
import unicodedata
from pathlib import Path


ATTRIBUTION = "© OpenStreetMap contributors; https://www.openstreetmap.org/copyright"


def normalize(value):
    value = unicodedata.normalize("NFKD", value or "").encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", " ", value.lower()).strip()


def distance_m(lat1, lon1, lat2, lon2):
    if None in (lat1, lon1, lat2, lon2):
        return math.inf
    a, b, c, d = map(math.radians, (lat1, lon1, lat2, lon2))
    h = math.sin((c - a) / 2) ** 2 + math.cos(a) * math.cos(c) * math.sin((d - b) / 2) ** 2
    return 12_742_000 * math.asin(math.sqrt(min(1, h)))


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--raw", required=True)
    parser.add_argument("--existing", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--limit", type=int, default=50)
    args = parser.parse_args()

    raw = json.loads(Path(args.raw).read_text())
    existing = json.loads(Path(args.existing).read_text())
    known_source_ids = {
        (row.get("existingBusinessId") or "").removeprefix("osm:")
        for row in existing
        if (row.get("existingBusinessId") or "").startswith("osm:")
    }
    city_existing = [
        row for row in existing
        if normalize(row.get("city")) in {"aurangabad", "chhatrapati sambhajinagar"}
    ]

    businesses = []
    held = []
    duplicates = []
    deferred = []
    for element in sorted(raw["response"]["elements"], key=lambda item: (item["type"], item["id"])):
        tags = element.get("tags", {})
        source_id = f'{element["type"]}/{element["id"]}'
        name = tags.get("name") or tags.get("name:en")
        location = element if element["type"] == "node" else element.get("center", {})
        lat, lon = location.get("lat"), location.get("lon")
        if not name or lat is None or lon is None:
            held.append({"source_id": source_id, "reason": "missing_business_name_or_coordinates"})
            continue
        if normalize(name).endswith(" chowk"):
            held.append({"source_id": source_id, "reason": "place_name_like_label_requires_identity_review"})
            continue
        if source_id in known_source_ids:
            duplicates.append({"source_id": source_id, "reason": "exact_osm_identity_already_present", "automatic_merge": False})
            continue
        matches = []
        for row in city_existing:
            meters = distance_m(lat, lon, row.get("latitude"), row.get("longitude"))
            similarity = max(
                difflib.SequenceMatcher(None, normalize(name), normalize(row.get(key)), autojunk=False).ratio()
                for key in ("name", "brand")
            )
            if meters <= 100 and similarity >= 0.88:
                matches.append({"profile_id": row["id"], "distance_m": round(meters, 1), "similarity": round(similarity, 3)})
        if matches:
            duplicates.append({"source_id": source_id, "candidate_profiles": matches, "automatic_merge": False})
            continue
        if len(businesses) >= args.limit:
            deferred.append(source_id)
            continue

        address_fields = {key: value for key, value in tags.items() if key.startswith("addr:")}
        address = tags.get("addr:full") or ", ".join(
            tags[key] for key in ("addr:housenumber", "addr:street", "addr:suburb", "addr:city", "addr:postcode")
            if tags.get(key)
        ) or None
        directions_url = (
            "https://www.openstreetmap.org/directions?engine=fossgis_osrm_car&route=%3B"
            f"{lat}%2C{lon}"
        )
        businesses.append({
            "sourceKey": f'open:osm_{source_id.replace("/", "_")}',
            "external_id": f'open:osm_{source_id.replace("/", "_")}',
            "existingBusinessId": f"osm:{source_id}",
            "name": name,
            "name_en": tags.get("name:en"),
            "brand": tags.get("brand"),
            "city": "Chhatrapati Sambhajinagar",
            "district": "Chhatrapati Sambhajinagar",
            "state": "Maharashtra",
            "locality": tags.get("addr:suburb") or tags.get("addr:neighbourhood") or tags.get("addr:place"),
            "category": f'amenity:{tags.get("amenity")}',
            "address": address,
            "address_fields": address_fields,
            "latitude": lat,
            "longitude": lon,
            "coordinate_type": "node" if element["type"] == "node" else "way_bbox_center",
            "directions_url": directions_url,
            "cuisine": tags.get("cuisine"),
            "website": tags.get("website") or tags.get("contact:website"),
            "phone": tags.get("phone") or tags.get("contact:phone"),
            "opening_hours": tags.get("opening_hours"),
            "source_urls": [f"https://www.openstreetmap.org/{source_id}"],
            "source_types": ["openstreetmap"],
            "source_id": source_id,
            "retrieved_on": raw["retrieved_on"][:10],
            "source_license": "ODbL-1.0",
            "attribution": ATTRIBUTION,
            "license_status": "not_checked",
            "verification_status": "source_observed",
            "operating_status": None,
            "restaurant_rating": None,
            "review_count": None,
            "recommendation_eligible": False,
            "directory_publish_ready": True,
            "publish_ready": False,
            "outlet_menu_set_id": None,
            "reference_menu_set_id": None,
            "service_note": "OSM source observation only; operation, menu, quality and dietary preparation are unconfirmed. Way centers are not verified entrances."
        })

    output = {
        "batch_id": "chhatrapati-sambhajinagar-open-data-2026-10-12",
        "retrieved_on": raw["retrieved_on"][:10],
        "businesses": businesses,
        "menu_items": [],
        "scope": {
            "state": "Maharashtra",
            "district": "Chhatrapati Sambhajinagar",
            "city": "Chhatrapati Sambhajinagar",
            "relation_id": 10344404,
            "complete_census": False,
        },
        "input_records": len(raw["response"]["elements"]),
        "named_records": sum(bool(e.get("tags", {}).get("name") or e.get("tags", {}).get("name:en")) for e in raw["response"]["elements"]),
        "held_records": held,
        "duplicate_candidates": duplicates,
        "deferred_source_ids": deferred,
        "dataset_license": "ODbL-1.0",
        "attribution": ATTRIBUTION,
        "query": raw["query"],
        "source_url": raw["endpoint"],
        "osm_timestamp": raw["response"].get("osm3s", {}).get("timestamp_osm_base"),
        "complete_city_census": False,
        "notice": "Source observations do not confirm current operation, menus, prices, ratings, food quality, dietary preparation or licence validity."
    }
    Path(args.output).write_text(json.dumps(output, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"added": len(businesses), "held": len(held), "duplicates": len(duplicates), "deferred": len(deferred)}))


if __name__ == "__main__":
    main()
