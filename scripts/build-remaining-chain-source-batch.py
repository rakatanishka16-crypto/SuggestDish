"""Build reproducible official-source snapshots from exported public locator cards.

Input JSON exports preserve source fields; no missing geography or prices are inferred.
"""
import argparse, collections, gzip, hashlib, json, re
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument('--input-dir', type=Path, required=True)
p.add_argument('--output', type=Path, required=True)
args = p.parse_args()
rows, menus, excluded = [], {}, []
seen = set()
def clean(s): return re.sub(r'\s+', ' ', str(s or '')).strip()
def norm(s): return re.sub(r'[^a-z0-9]', '', clean(s).lower())
def digest(s): return hashlib.sha256(s.encode()).hexdigest()[:20]
def load(prefix): return json.loads((args.input_dir / (prefix+'-outlets-20261005.json')).read_text())
def add(brand, b, city, state, url, locality=None, partial=False, lat=None, lon=None, note=None):
    address = clean(b.get('address'))
    if not city or not address or norm(city)=='testcity':
        excluded.append({'brand':brand,'reason':'Missing factual city/address or test record','source':b}); return
    city = {'New mumbai':'Navi Mumbai','Sambhaji Nagar':'Aurangabad','Chhatrapati Sambhaji':'Aurangabad','Bangalore':'Bengaluru','Gurgaon':'Gurugram'}.get(city,city)
    key = brand+':'+norm(city)+':'+norm(address)
    if key in seen: return
    seen.add(key)
    external = 'sd-food-'+digest(key)
    name = clean(b.get('name')) or clean(locality) or address[:90]
    if 'Jumboking' in name: name = address[:90]
    if not name.lower().startswith(brand.lower()): name = brand+' - '+name
    try: lat,lon=float(lat),float(lon)
    except (TypeError,ValueError): lat,lon=None,None
    if lat is not None and not (6<=lat<=38 and 68<=lon<=98): lat,lon=None,None
    row = dict(external_id=external,sourceKey='official:'+external,name=name,brand=brand,locality=clean(locality) or None,city=city,source_city=b.get('source_city',city),state=state,business_type='restaurant',category='amenity:restaurant',address=address,address_scope='locality_only' if partial else 'published_address',phone=clean(b.get('phone')).removeprefix('tel:') or None,email=None,opening_hours=clean(b.get('hours')) or None,latitude=lat,longitude=lon,coordinate_evidence='Official locator card coordinates' if lat is not None else None,restaurant_rating=None,review_count=None,fssai_license_number=None,license_status='not_checked',source_urls=[url],source_types=['business_website'],retrieved_on='2026-10-05',verification_status='source_observed',review_status='source_observed',directory_publish_ready=True,recommendation_eligible=False,publish_ready=False,image_url=None,source_store_id=b.get('id'),source_detail_type='official_locator_card',menu_status='not_transcribed',service_note=note or 'Official outlet listing observed. Current operation, menu, prices and availability require confirmation.')
    if partial: row['service_note']='The official locator supplies locality and city only, not a full street address. Menu and outlet prices have not been confirmed.'
    if b.get('source_status'): row['source_operational_tag']=b['source_status']
    if b.get('menu'):
        setid='mcd-checked-'+digest(url)
        row.update(outlet_menu_set_id=setid,menu_status='outlet_page_observed',service_note='Selected items and displayed prices from this official outlet page; customisations, taxes and current availability require confirmation.')
        menus[setid]={'kind':'outlet_page','brand':brand,'items':[dict(external_id='sd-menu-'+digest(setid+name),brand=brand,name=name,menu_category=None,portion=None,price_inr=price,is_veg=None,veg_evidence='Not transcribed',price_scope='Displayed price on selected official outlet page',branch_availability='published_on_outlet_page',tax_included=None,retrieved_on='2026-10-05',recommendation_eligible=False,publish_ready=False) for name,price in b['menu']]}
    rows.append(row)

for b in load('lapinoz'):
    d=b['data']; add("La Pino'z Pizza",b,d['city'],None,b['url'],d.get('localityDisplay'),True,d.get('lat'),d.get('lng'))
for b in load('mcd'): add("McDonald's",b,clean(b['city']),None,'https://mcdindia.com/',note='North/East India official locator card. Source status tags do not establish permanent closure or live opening status; menu and prices are unconfirmed.')
for b in json.loads((args.input_dir/'mcd-west-checked-20261005.json').read_text()): add("McDonald's",b,b['city'],b['state'],b['url'])
for b in load('haldiram'):
    city,state=b['cityState'].split(',',1); add("Haldiram's",b,city.strip().title(),state.strip(),'https://www.haldirams.com/store-locator',note='Official locator listing; includes retail shops and base kitchens where named. Dine-in service and dish-level prices are unconfirmed.')
for b in load('wow'):
    b=dict(b); b['address']=b['address'].replace(b['city']+' -',', '+b['city']+' -'); add('Wow! Momo',b,b['city'],b['state'],b['url'],b['name'])
for b in load('waffle'):
    parts=[x.strip() for x in b['address'].split(',')]; city,state=parts[-4:-2]
    conflict = (city=='Bardhaman' and state=='Punjab') or (city=='Delhi NCR' and state=='Haryana' and 'New Delhi' in b['address'])
    add('The Belgian Waffle Co.',b,city,None if conflict else state,'https://thebelgianwaffle.co/store-locator',b['name'],note='Official locator address preserved. Source state metadata conflicts with address text; state is left unconfirmed.' if conflict else None)
for b in load('jumbo'):
    raw=b['city']; city={'Central Mumbai':'Mumbai','Western Mumbai':'Mumbai'}.get(raw,raw); state=None
    if raw=='Punjab':
        city='Zirakpur' if 'Zirakpur' in b['address'] else 'Chandigarh' if 'CHANDIGARH' in b['address'] else None
        state='Punjab' if city=='Zirakpur' else None
    if raw=='Telangana': city=None
    b=dict(b,source_city=raw); add('Jumboking',b,city,state,b['url'])
csb=load('csb')
csb.append(dict(name='Chai Sutta Bar Indirapuram',address='G24, D Mall, Krishna Apra, Plot 1, Shakti Khand 2, Indirapuram, Ghaziabad, Uttar Pradesh 201014',phone='+91 93119 35663'))
for b in csb:
    parts=[x.strip() for x in b['address'].split(',')]; state=re.sub(r'\s+\d{6}$','',parts[-1]); city=parts[-2]
    if 'Vijaypur' in b['name']: city='Vijaypur'
    add('Chai Sutta Bar',b,city,state,'https://www.chaisuttabarindia.com/locations/',b['name'])
for b in load('chaayos'): add('Chaayos',b,b['city'],b['state'],b['url'],b['name'])
scope={'brand_counts':dict(collections.Counter(b['brand'] for b in rows)),'cities':len({b['city'] for b in rows}),'outlet_menu_assignments':sum('outlet_menu_set_id' in b for b in rows),'excluded_records':excluded,'pending_brands':['Mojo Pizza'],'coverage_limits':['Partial brand coverage; not a complete India census','McDonald’s North/East locator plus one checked West/South outlet','Belgian Waffle, Chai Sutta Bar and Chaayos are partial observed sets','La Pino’z cards provide locality-level addresses only','Menus absent unless directly observed on the selected branch page']}
out={'batch_id':'remaining-chain-outlets-2026-10-05','retrieved_on':'2026-10-05','businesses':rows,'menu_items':[],'menu_sets':menus,'research_scope':scope}
args.output.parent.mkdir(parents=True,exist_ok=True)
args.output.write_bytes(gzip.compress(json.dumps(out,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
print(json.dumps({'count':len(rows),**scope},ensure_ascii=False))
