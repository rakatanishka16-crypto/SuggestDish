"""Enrich known mall outlet identities from their published business pages.

Requires beautifulsoup4. No new outlet rows are created. No review text, images,
promotional timeline prices or dietary guesses are imported. Every observed
menu stays scoped to the individual fetched source page.
"""
import argparse, concurrent.futures, datetime, gzip, hashlib, importlib.util, json, re, subprocess, time
from pathlib import Path
from urllib.parse import urlsplit
from urllib.robotparser import RobotFileParser
from bs4 import BeautifulSoup

def clean(value):
    return re.sub(r'\s+', ' ', str(value or '')).strip()

def digest(value):
    return hashlib.sha256(value.encode()).hexdigest()[:20]

def parse_cards(raw, brand, url, checked):
    soup = BeautifulSoup(raw, 'html.parser')
    descriptions = {}
    for script in soup.select('script[type="application/ld+json"]'):
        try:
            data = json.loads(script.string or script.get_text())
        except (ValueError, TypeError):
            continue
        for entry in data if isinstance(data, list) else [data]:
            if isinstance(entry, dict) and entry.get('@type') == 'ItemList':
                for row in entry.get('itemListElement', []):
                    product = row.get('item', {})
                    if product.get('@type') in ('IndividualProduct', 'Product'):
                        descriptions[clean(product.get('name'))] = clean(product.get('description'))
    items = {}
    for title in soup.select('.card-title'):
        card = title.find_parent(class_='pr-card') or title.find_parent(class_='card')
        if not card or not card.select_one('a[data-track-event-product], a[data-product], .card-img-top'):
            continue
        name = clean(title.get('title') or title.get_text(' ', strip=True))
        if not name:
            continue
        price_tag = card.select_one('.price-sec')
        price = None
        if price_tag and not price_tag.find_parent(['del', 's']):
            match = re.fullmatch(r'(?:₹|Rs\.?|INR)?\s*([\d,]+(?:\.\d{1,2})?)', clean(price_tag.get_text(' ', strip=True)))
            if match:
                price = float(match.group(1).replace(',', ''))
                if price <= 0:
                    price = None
        marker = card.select_one('.imd-icon')
        classes = marker.get('class', []) if marker else []
        veg = False if 'nonveg-icon' in classes else True if 'veg-icon' in classes else None
        key = 'sd-menu-' + digest(url + ':' + name)
        description = descriptions.get(name, '')
        portion = re.search(r'Serves:\s*[^|)]+(?:\|\s*[\d.]+\s*g)?', description)
        items[key] = dict(external_id=key, brand=brand, name=name, menu_category=None,
                         portion=portion.group(0) if portion else None, price_inr=price, is_veg=veg,
                         veg_evidence='Explicit menu icon' if veg is not None else 'Dietary type not established by an explicit source marker',
                         source_url=url, price_scope='Displayed price on this outlet page' if price is not None else 'Price not published for this item',
                         branch_availability='published_on_outlet_page', tax_included=False if 'prices are excluding GST' in description else None,
                         retrieved_on=checked, recommendation_eligible=False, publish_ready=False)
    return list(items.values())

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--targets', required=True, type=Path)
    parser.add_argument('--cache-dir', required=True, type=Path)
    parser.add_argument('--output', required=True, type=Path)
    args = parser.parse_args()
    checked = datetime.datetime.now(datetime.timezone.utc).date().isoformat()
    targets = json.loads(args.targets.read_text())['targets']
    if len({t['sourceKey'] for t in targets}) != len(targets):
        raise ValueError('Duplicate target identities')
    args.cache_dir.mkdir(parents=True, exist_ok=True)
    spec = importlib.util.spec_from_file_location('state_pizzahut', Path(__file__).with_name('collect-state-pizzahut.py'))
    ph = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(ph)
    allowed_hosts = {'restaurants.pizzahut.co.in', 'restaurants.kfc.co.in', 'stores.burgerking.in',
                     'restaurants.wowmomo.com', 'www.dominos.co.in', 'www.haldirams.com',
                     'thebelgianwaffle.co', 'www.jumboking.co.in'}
    responses = {}

    def fetch(url):
        parts = urlsplit(url)
        if parts.scheme != 'https' or parts.netloc not in allowed_hosts:
            raise ValueError('Source not an approved official host')
        cache = args.cache_dir / ('source-' + digest(url) + '.html')
        if not cache.exists() or datetime.datetime.fromtimestamp(cache.stat().st_mtime, datetime.timezone.utc).date().isoformat() != checked:
            result = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location', '--max-time', '35', url], capture_output=True)
            if result.returncode:
                raise ValueError('Official source fetch failed')
            cache.write_bytes(result.stdout)
            time.sleep(.4)
        raw = cache.read_text()
        if len(raw) < 500 or '<html' not in raw.lower():
            raise ValueError('Source did not return a business page')
        return raw

    # Check public crawler rules first; a failed source is held pending.
    robots = {}
    def load_robots(host):
        url = 'https://' + host + '/robots.txt'
        result = subprocess.run(['curl', '--fail', '--silent', '--show-error', '--location', '--max-time', '20', url], capture_output=True)
        robot = RobotFileParser(url)
        if result.returncode:
            return host, None
        robot.parse(result.stdout.decode('utf-8').splitlines())
        return host, robot
    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
        robots.update(pool.map(load_robots, sorted({urlsplit(t['source_url']).netloc for t in targets})))

    def source_url(target):
        url = target['source_url']
        return url.removesuffix('/Home') + '/Menu' if target['brand'] == 'Pizza Hut' and url.endswith('/Home') else url

    urls = list(dict.fromkeys(source_url(t) for t in targets))
    def load(url):
        robot = robots.get(urlsplit(url).netloc)
        if robot is None:
            return url, None, 'Crawler rules unavailable; held pending'
        if not robot.can_fetch('*', url):
            return url, None, 'Public crawler rules disallow this source'
        try:
            return url, fetch(url), None
        except ValueError as error:
            return url, None, str(error)
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for url, raw, error in pool.map(load, urls):
            responses[url] = (raw, error)
            print('source', 'pending' if error else 'checked', url, flush=True)

    associations, menu_sets, audit = [], {}, []
    for target in targets:
        url = source_url(target)
        raw, error = responses[url]
        record = dict(sourceKey=target['sourceKey'], brand=target['brand'], mall=target['mall_name'], city=target['mall_city'],
                      source_url=url, checked_on=checked, menu_items=0, published_prices=0,
                      status='pending' if error else 'source_checked', reason=error)
        if raw:
            record['sha256'] = hashlib.sha256(raw.encode()).hexdigest()
            # Generic city/brand locator pages never become a branch menu.
            branch_page = bool(re.search(r'-\d+/(?:Home|Menu)$', url))
            items = ph.parse_menu(raw, url, checked) if target['brand']=='Pizza Hut' and branch_page else parse_cards(raw, target['brand'], url, checked) if branch_page else []
            if items:
                set_id = 'mall-outlet-' + digest(target['sourceKey'] + ':' + url)
                menu_sets[set_id] = dict(kind='outlet_page', brand=target['brand'], source_url=url, items=items)
                associations.append(dict(sourceKey=target['sourceKey'], brand=target['brand'], outlet_menu_set_id=set_id))
                record.update(status='outlet_menu_observed', menu_items=len(items), published_prices=sum(m['price_inr'] is not None for m in items), reason=None)
            else:
                record['reason'] = 'No individual branch menu extracted; existing brand references are not branch availability'
        audit.append(record)
    scope = dict(malls=len({t['mall_name'] for t in targets}), target_records=len(targets),
                 checked_records=sum(r['status']!='pending' for r in audit), outlet_menus_observed=len(associations),
                 new_outlet_rows=0, menu_entries=sum(len(s['items']) for s in menu_sets.values()),
                 published_prices=sum(m['price_inr'] is not None for s in menu_sets.values() for m in s['items']),
                 source_checks=audit, complete_mall_tenant_census=False,
                 coverage_limits=['Enrichment of existing source identities, not new outlet claims', 'Only explicitly published product prices are transcribed', 'Branch-page catalogs do not confirm current stock, final prices, food quality or dietary preparation', 'Missing branch menus stay pending; no national menu is copied to branches'])
    batch = dict(batch_id='maharashtra-mall-menus-' + checked, retrieved_on=checked,
                 businesses=[], menu_items=[], menu_sets=menu_sets, menu_associations=associations, research_scope=scope)
    args.output.write_bytes(gzip.compress(json.dumps(batch, ensure_ascii=False, separators=(',', ':')).encode(), mtime=0))
    print(json.dumps({k:v for k,v in scope.items() if k!='source_checks'}), flush=True)

if __name__ == '__main__':
    main()
