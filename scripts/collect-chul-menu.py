"""Extract factual menu observations from an inspected official Hotel Chul page.

Usage: python scripts/collect-chul-menu.py --html /path/to/menu.html
Fetch robots.txt and the public menu separately before running. No images,
reviews, marketing descriptions, inferred dietary types or coordinates copied.
"""
import argparse
import gzip
import hashlib
import json
import re
from html.parser import HTMLParser
from pathlib import Path

URL = 'https://chul.in/menu'
KEY = 'official:sd-food-13ce8839d72d9bf20b4d'
DATE = '2026-10-13'
BATCH = 'sambhajinagar-chul-priced-menu-2026-10-13'

class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.script = False
        self.json_script = False
        self.buffer = []
        self.documents = []
        self.visible = []

    def handle_starttag(self, tag, attrs):
        if tag == 'script':
            self.script = True
            self.json_script = dict(attrs).get('type') == 'application/ld+json'
            self.buffer = []

    def handle_data(self, value):
        if self.json_script:
            self.buffer.append(value)
        elif not self.script:
            self.visible.append(value)

    def handle_endtag(self, tag):
        if tag == 'script':
            if self.json_script:
                self.documents.append(json.loads(''.join(self.buffer)))
            self.script = self.json_script = False

def extract(raw):
    page = Page()
    page.feed(raw)
    menus = [d for d in page.documents if d.get('@type') == 'Menu' and d.get('url') == URL]
    assert len(menus) == 1, 'Expected one official branch menu'
    visible = ' '.join(page.visible)
    assert 'Gut No. 385' in visible and 'Prices subject to change' in visible
    rows = []
    seen = set()

    def walk(section, parents=()):
        category = section.get('name')
        if category == 'Beverages':
            return
        for item in section.get('hasMenuItem', []):
            name = item['name']
            assert name in visible, 'Structured dish absent from visible menu'
            offers = item.get('offers', [])
            offers = offers if isinstance(offers, list) else [offers]
            assert offers and all(o.get('priceCurrency') == 'INR' for o in offers)
            for offer in offers:
                price = float(offer['price'])
                assert price > 0 and re.search(r'₹\s*' + re.escape(str(int(price))) + r'(?!\d)', visible)
                portion = offer.get('name')
                identity = (name, portion)
                assert identity not in seen, 'Duplicate dish/portion identity'
                seen.add(identity)
                diet = item.get('suitableForDiet')
                # OmnivorousDiet is ambiguous: never convert it to nonveg.
                veg = True if diet == 'https://schema.org/VegetarianDiet' else None
                conflict = name == 'Shevga Handi'
                rows.append(dict(
                    external_id='sd-menu-' + hashlib.sha256((KEY + ':' + name + ':' + str(portion)).encode()).hexdigest()[:20],
                    brand='Hotel Chul', name=name, portion=portion,
                    menu_category=category, price_inr=price, is_veg=veg,
                    veg_nonveg='veg' if veg else None,
                    veg_evidence='Official menu JSON-LD suitableForDiet=VegetarianDiet' if veg else None,
                    source_diet_marker=diet, source_url=URL, source_business_id=KEY,
                    price_scope='Explicit official outlet-menu price; GST applicable; current fulfilment unconfirmed',
                    tax_included=False, branch_availability='not_confirmed',
                    retrieved_on=DATE, recommendation_eligible=False, publish_ready=False,
                    verification_status='source_observed', data_conflict=conflict,
                    notes='Signature card says from ₹450; detailed menu lists ₹460/₹730. Retained as conflicting source observations.' if conflict else None))
        for child in section.get('hasMenuSection', []):
            walk(child, parents + (category,))
    walk(menus[0])
    return rows

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--html', required=True, type=Path)
    args = parser.parse_args()
    raw = args.html.read_bytes()
    rows = extract(raw.decode())
    root = Path(__file__).resolve().parents[1]
    set_id = 'chul-official-priced-menu-2026-10-13'
    distinct = len({r['name'] for r in rows})
    scope = dict(new_outlets=0, enriched_outlets=1, menu_entries=len(rows), distinct_dish_names=distinct,
                 published_prices=len(rows), explicitly_vegetarian_entries=sum(r['is_veg'] is True for r in rows),
                 unknown_dietary_entries=sum(r['is_veg'] is None for r in rows),
                 conflicts_found=1, conflict_entries=sum(r['data_conflict'] for r in rows),
                 source_checks=[dict(url=URL, checked_on=DATE, sha256=hashlib.sha256(raw).hexdigest(),
                                     access_method='anonymous_public_page', robots_url='https://chul.in/robots.txt',
                                     robots_status='User-Agent: *; Allow: /')],
                 complete_city_census=False, complete_state_census=False,
                 recommendation_eligible_items=0, neon_inserts=0,
                 excluded_beverages=3,
                 remaining_gaps=['Current availability and licences unconfirmed',
                                 'Shevga Handi signature/table price conflict requires owner confirmation',
                                 'OmnivorousDiet does not establish nonveg or egg classification',
                                 'Existing five homepage observations retained as dated historical records'])
    batch = dict(batch_id=BATCH, retrieved_on=DATE, businesses=[], menu_items=[],
                 menu_sets={set_id:dict(kind='outlet_page', brand='Hotel Chul', source_url=URL, items=rows)},
                 menu_associations=[dict(sourceKey=KEY, brand='Hotel Chul', outlet_menu_set_id=set_id)],
                 research_scope=scope)
    (root/'api/source-batches'/f'{BATCH}.json.gz').write_bytes(
        gzip.compress(json.dumps(batch, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps(scope, ensure_ascii=False))

if __name__ == '__main__':
    main()
