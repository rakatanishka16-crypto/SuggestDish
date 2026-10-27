"""Fetch the requested menu facts through IndiaRestros' permitted read API.

Usage: python scripts/fetch-jalna-priced-menus.py CHECKPOINT_DIR
Requests are rate-limited below the API's documented 120/minute limit. This
script never requests Zomato pages or saves photos, descriptions or contacts.
"""
import concurrent.futures
import difflib
import gzip
import json
import pathlib
import re
import threading
import time
import urllib.request
from importlib.util import module_from_spec, spec_from_file_location

ROOT = pathlib.Path(__file__).resolve().parents[1]
spec = spec_from_file_location("builder", ROOT / "scripts/build-jalna-priced-menus.py")
builder = module_from_spec(spec)
spec.loader.exec_module(builder)
scope = json.loads((ROOT / "api/source-batches/jalna-menu-request-scope-2026-10-27.json").read_text())["listings"]
targets = {builder.outlet_url("https://www.zomato.com/jalna/" + path): name for name, path in scope}
old = json.loads(gzip.decompress((ROOT / "api/source-batches/jalna-menu-listings-2026-10-26.json.gz").read_bytes()))
out = pathlib.Path(__import__("sys").argv[1])
out.mkdir(parents=True, exist_ok=True)


def norm(value):
    return re.sub(r"[^a-z0-9]", "", value.lower().replace("jalna", ""))


rows = {b["external_id"]: {"id": b["external_id"], "name": b["name"]} for b in old["businesses"] if (b.get("external_id") or "").startswith("IRR-")}
for h in old["held_records"]:
    match = re.search(r"-([a-z0-9]{10})$", h.get("source_url", ""))
    if match:
        id = "IRR-" + match.group(1).upper()
        rows[id] = {"id": id, "name": h["name"]}
candidates = {}
for name, _ in scope:
    n = norm(name)
    scored = sorted(((difflib.SequenceMatcher(None, n, norm(r["name"])).ratio(), r) for r in rows.values()), key=lambda pair: -pair[0])[:3]
    for score, row in scored:
        if score >= .65:
            candidates[row["id"]] = row
    for row in rows.values():
        if n in norm(row["name"]) or norm(row["name"]) in n:
            candidates[row["id"]] = row
for id in ("IRR-SCP3MSJ22F", "IRR-JAE08BYS1H", "IRR-5ZZJ4S3XFS", "IRR-YP0B5X5A00", "IRR-B3DWWZ0JF5"):
    if id in rows:
        candidates[id] = rows[id]
lock, last = threading.Lock(), [0.0]


def get(id, menu=False):
    path = out / (id + (".menu.json" if menu else ".detail.json"))
    if path.exists():
        return json.loads(path.read_text())
    with lock:
        time.sleep(max(0, .75 - (time.monotonic() - last[0])))
        last[0] = time.monotonic()
    url = "https://indiarestros.com/api/v1/restaurants/" + id + ("/menu" if menu else "")
    data = json.load(urllib.request.urlopen(url, timeout=35))
    if menu:
        data = {k: data.get(k) for k in ("restaurant", "name", "url", "source", "source_url", "updated", "sections")}
        for section in data.get("sections") or []:
            section.pop("desc", None)
            section["items"] = [{k: item.get(k) for k in ("name", "price", "veg")} for item in section.get("items", [])]
    else:
        data = {k: data.get(k) for k in ("id", "name", "names", "url", "address", "status", "sources", "updated")}
    path.write_text(json.dumps(data, ensure_ascii=False))
    return data


def fetch(row):
    id = row["id"]
    try:
        detail = get(id)
        matching = [targets[builder.outlet_url(s.get("url"))] for s in detail.get("sources") or [] if builder.outlet_url(s.get("url")) in targets]
        menu = get(id, True)
        upstream = builder.outlet_url(menu.get("source_url"))
        if upstream not in targets:
            return {"id": id, "status": "menu_upstream_does_not_match_requested_branch", "detail_matches": matching}
        return {"id": id, "name": targets[upstream], "status": "menu_retrieved"}
    except Exception as error:
        return {"id": id, "status": "fetch_error", "error": str(error)}


results = []
with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
    for result in pool.map(fetch, candidates.values()):
        results.append(result)
        (out / "fetch-results.json").write_text(json.dumps(results, indent=2))
        if len(results) % 10 == 0:
            print("Checked", len(results), "of", len(candidates), "outlet candidates; menus:", sum(r["status"] == "menu_retrieved" for r in results), flush=True)
print(json.dumps({"checked": len(results), "matching_menus": sum(r["status"] == "menu_retrieved" for r in results), "errors": [r for r in results if r["status"] == "fetch_error"]}, indent=2))
