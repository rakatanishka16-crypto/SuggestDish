#!/usr/bin/env python3
"""Fetch and build the bounded deferred Sambhajinagar OSM follow-up batch."""

import argparse
import json
import time
import urllib.request
from pathlib import Path


USER_AGENT = "SuggestDish-data-collector/1.0 (https://www.suggestdish.com)"


def fetch_json(url, cache_path):
    if cache_path.exists():
        return json.loads(cache_path.read_text())
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    with urllib.request.urlopen(request, timeout=30) as response:
        payload = json.load(response)
    cache_path.parent.mkdir(parents=True, exist_ok=True)
    cache_path.write_text(json.dumps(payload, ensure_ascii=False) + "\n")
    time.sleep(1)
    return payload


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--prior-batch", required=True)
    parser.add_argument("--cache-dir", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--retrieved-on", required=True)
    args = parser.parse_args()

    import gzip

    with gzip.open(args.prior_batch, "rt") as source:
        prior = json.load(source)
    cache_dir = Path(args.cache_dir)
    elements = []
    for source_id in prior["deferred_source_ids"]:
        element_type, element_id = source_id.split("/", 1)
        suffix = "/full.json" if element_type == "way" else ".json"
        url = f"https://api.openstreetmap.org/api/0.6/{element_type}/{element_id}{suffix}"
        payload = fetch_json(url, cache_dir / f"{element_type}-{element_id}.json")
        root = next(
            item for item in payload["elements"]
            if item["type"] == element_type and str(item["id"]) == element_id
        )
        if element_type == "way":
            coordinates = {
                item["id"]: (item["lat"], item["lon"])
                for item in payload["elements"] if item["type"] == "node"
            }
            points = [coordinates[node_id] for node_id in root.get("nodes", []) if node_id in coordinates]
            if points:
                root["center"] = {
                    "lat": (min(p[0] for p in points) + max(p[0] for p in points)) / 2,
                    "lon": (min(p[1] for p in points) + max(p[1] for p in points)) / 2,
                }
        # Retain only public feature data needed by the catalog, not mapper metadata.
        elements.append({key: root[key] for key in ("type", "id", "lat", "lon", "center", "tags") if key in root})

    envelope = {
        "retrieved_on": args.retrieved_on,
        "endpoint": "https://api.openstreetmap.org/api/0.6/",
        "query": "Exact element identities deferred from chhatrapati-sambhajinagar-open-data-2026-10-12",
        "response": {"elements": elements, "osm3s": {}},
    }
    Path(args.output).write_text(json.dumps(envelope, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"fetched": len(elements), "output": args.output}))


if __name__ == "__main__":
    main()
