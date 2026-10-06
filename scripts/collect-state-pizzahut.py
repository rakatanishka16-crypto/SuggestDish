"""Collect published Pizza Hut locator facts, one state at a time.

Requires beautifulsoup4. Retains source identities, check dates and page hashes.
Menus are attached only to individually fetched branch Menu pages. Prices and
ratings are never inferred from promotions, reviews, descriptions or brand names.
Example: python scripts/collect-state-pizzahut.py --state Maharashtra \
  --cache-dir /tmp/sd-state-research --output api/source-batches/maharashtra-2026-10-06.json.gz
"""
import argparse, collections, datetime, gzip, hashlib, json, re, subprocess, time
from pathlib import Path
from urllib.parse import urlsplit, urlunsplit
from bs4 import BeautifulSoup

HOST = 'https://restaurants.pizzahut.co.in'

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()[:20]

def clean(value):
    return re.sub(r'\s+', ' ', str(value or '')).strip()

def parse_places(raw, state):
    places = []
    for script in BeautifulSoup(raw, 'html.parser').select('script[type="application/ld+json"]'):
        data = json.loads(script.string or script.get_text())
        for group in data if isinstance(data, list) else [data]:
            for entry in group.get('itemListElement', []):
                place = entry.get('item', {})
                if not isinstance(place, dict):
                    continue
                address = place.get('address', {})
                if address.get('addressRegion') != state:
                    raise ValueError('Locator returned another state; refusing this page')
                parts = urlsplit(place.get('url', ''))
                if parts.scheme != 'https' or parts.netloc not in ['restaurants.pizzahut.co.in', 'www.pizzahut.co.in']:
                    raise ValueError('Unexpected outlet source host')
                if not clean(address.get('streetAddress')) or not clean(address.get('addressLocality')):
                    raise ValueError('Missing outlet city or street address')
                place['url'] = urlunsplit((parts.scheme, parts.netloc, parts.path, '', ''))
                places.append(place)
    if not places:
        raise ValueError('No locator records: refusing an empty replacement')
    return places

def parse_menu(raw, url, checked):
    soup = BeautifulSoup(raw, 'html.parser')
    items = {}
    # Exact product title styling, independent of descriptions or timeline posts.
    for title in soup.select('div.line-clamp-2'):
        if 'font-semibold' not in title.get('class', []):
            continue
        container = title.parent.parent
        if not container.find('img', alt='Order Now'):
            continue
        name = clean(title.get_text(' ', strip=True))
        if not name:
            continue
        icons = {img.get('alt') for img in container.find_all('img')}
        veg = True if 'Veg' in icons else False if 'Non-Veg' in icons else None
        key = 'sd-menu-' + digest(url + ':' + name)
        items[key] = dict(external_id=key, brand='Pizza Hut', name=name,
                         menu_category=None, portion=None, price_inr=None,
                         is_veg=veg, veg_evidence='Explicit product icon on branch Menu page' if veg is not None else 'Not established by source',
                         source_url=url, price_scope='Price not published on observed menu page',
                         branch_availability='published_on_outlet_page', tax_included=None,
                         retrieved_on=checked, recommendation_eligible=False, publish_ready=False)
    return list(items.values())

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--state', required=True, choices=['Maharashtra', 'Karnataka', 'Goa', 'Gujarat', 'Delhi', 'Haryana', 'Tamil Nadu'])
    parser.add_argument('--cache-dir', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    parser.add_argument('--menu-pages', type=int, default=1)
    args = parser.parse_args()
    if not 0 <= args.menu_pages <= 20:
        raise ValueError('Choose 0–20 branch menu pages per run')
    checked = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    audit, failures = [], []

    def fetch(url, cache_name):
        cache = args.cache_dir / (cache_name + '.html')
        if not cache.exists() or datetime.datetime.fromtimestamp(cache.stat().st_mtime, datetime.timezone.utc).date().isoformat() != checked:
            result = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location', '--max-time', '35', url], capture_output=True)
            if result.returncode:
                raise ValueError('Source fetch failed')
            cache.write_bytes(result.stdout)
            time.sleep(.5)
        raw = cache.read_text()
        audit.append(dict(url=url, sha256=hashlib.sha256(raw.encode()).hexdigest(), checked_on=checked))
        return raw

    slug = args.state.lower().replace(' ', '-')
    first = fetch(HOST + '/' + args.state.replace(' ', '%20'), 'pizzahut-' + slug)
    # totalStores is a locator response field, not a claim of state census coverage.
    counts = re.findall(r'\\?"totalStores\\?"\s*:\s*(\d+)', first)
    if not counts or len(set(counts)) != 1:
        raise ValueError('Missing or conflicting locator total')
    reported = int(counts[0])
    if not 0 < reported < 2000:
        raise ValueError('Unexpected locator count')
    first_places = parse_places(first, args.state)
    def place_key(p):
        return p['url'] if p['url'].endswith('/Home') else 'address:' + clean(p['address']['streetAddress']) + ':' + clean(p['address']['addressLocality'])
    places = {place_key(p): p for p in first_places}
    for place in places.values():
        place['directory_source_url'] = HOST + '/' + args.state.replace(' ', '%20')
    # Some locator pages display 20 cards but advance by only 10. Follow the
    # published storeStart offsets, reconcile unique identities, and stop at total.
    page = 2
    while len(places) < reported and page <= reported + 1:
        raw = fetch(HOST + '/' + args.state.replace(' ', '%20') + '?page=' + str(page), 'pizzahut-' + slug + '-page-' + str(page))
        before = len(places)
        for place in parse_places(raw, args.state):
            place['directory_source_url'] = HOST + '/' + args.state.replace(' ', '%20') + '?page=' + str(page)
            places[place_key(place)] = place
        if len(places) == before:
            raise ValueError('Pagination repeated a page without adding source identities')
        page += 1
    if len(places) != reported:
        raise ValueError(f'Pagination did not reconcile: {len(places)} unique outlets, locator reports {reported}')
    businesses, menu_sets = [], {}
    for index, (identity, place) in enumerate(places.items()):
        url = place['url']
        address = place['address']; geo = place.get('geo', {})
        lat, lon = geo.get('latitude'), geo.get('longitude')
        if not isinstance(lat, (int, float)) or not isinstance(lon, (int, float)) or not (6 <= lat <= 38 and 68 <= lon <= 98):
            lat, lon = None, None
        store_id = re.search(r'-(\d+)/Home$', url)
        external = 'sd-food-' + digest('Pizza Hut:' + (store_id.group(1) if store_id else identity))
        source_city = clean(address['addressLocality'])
        city = {'Chhatrapati Sambhaji Nagar': 'Aurangabad', 'Chhatrapati Sambhajinagar': 'Aurangabad', 'Bangalore': 'Bengaluru', 'Gurgaon': 'Gurugram'}.get(source_city, source_city)
        b = dict(external_id=external, sourceKey='official:' + external, name=clean(place['name']).replace(' | ', ' - '),
                 brand='Pizza Hut', city=city, source_city=source_city, state=args.state,
                 locality=None, address=', '.join(clean(address.get(k)) for k in ['streetAddress', 'addressLocality', 'addressRegion', 'postalCode'] if address.get(k)),
                 address_scope='published_address', phone=clean(place.get('telephone')) or None, email=None, opening_hours=None,
                 latitude=lat, longitude=lon, coordinate_evidence='Official locator coordinates' if lat is not None else None,
                 business_type='restaurant', category='amenity:restaurant', restaurant_rating=None, review_count=None,
                 fssai_license_number=None, license_status='not_checked', source_urls=[url, place['directory_source_url']] if store_id else [place['directory_source_url'], url], source_types=['business_website'],
                 retrieved_on=checked, verification_status='source_observed', review_status='source_observed', directory_publish_ready=True,
                 recommendation_eligible=False, publish_ready=False, image_url=None, source_store_id=store_id.group(1) if store_id else None,
                 source_detail_type='official_locator_structured_data', menu_status='not_transcribed',
                 service_note='Official outlet listing observed. Current operation, food quality, menu stock and final prices require confirmation.')
        if index < args.menu_pages and store_id:
            menu_url = url.removesuffix('/Home') + '/Menu'
            try:
                items = parse_menu(fetch(menu_url, 'pizzahut-menu-' + digest(menu_url)), menu_url, checked)
                if not items:
                    raise ValueError('No structured menu cards observed')
                set_id = 'pizzahut-outlet-' + digest(menu_url)
                menu_sets[set_id] = dict(kind='outlet_page', brand='Pizza Hut', source_url=menu_url, items=items)
                b.update(outlet_menu_set_id=set_id, menu_status='outlet_page_observed')
            except ValueError as error:
                failures.append(dict(url=menu_url, reason=str(error)))
        businesses.append(b)
    batch = dict(batch_id=slug + '-' + checked, retrieved_on=checked, businesses=businesses, menu_items=[], menu_sets=menu_sets,
                 research_scope=dict(brand_counts={'Pizza Hut': len(businesses)}, state=args.state,
                                     city_counts=dict(collections.Counter(b['city'] for b in businesses)),
                                     source_pages=audit, source_failures=failures, locator_reported_outlets=reported,
                                     locator_pagination_reconciled=True, complete_state_census=False,
                                     coverage_limits=['One brand locator only; street vendors, independent restaurants, cafes and hotels remain incomplete', f'{len(menu_sets)} selected branch menu pages checked; other branch menus are unconfirmed', 'Menu prices not published on the checked source; no promotional prices inferred']))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_bytes(gzip.compress(json.dumps(batch, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps(dict(outlets=len(businesses), cities=batch['research_scope']['city_counts'], menu_entries=sum(len(s['items']) for s in menu_sets.values()), failures=failures)))

if __name__ == '__main__':
    main()
