"""Build a bounded official-site batch from inspected anonymous pages.
Source HTML lives in /tmp/sd-public-oct08; never copies reviews or templates.
"""
import json,gzip,hashlib,re
from urllib.parse import urlencode
from pathlib import Path
from bs4 import BeautifulSoup
root=Path(__file__).resolve().parents[1];date='2026-10-08';bid='maharashtra-local-official-2026-10-08'
audit=json.loads(Path('/tmp/sd-public-oct08/fetch-audit.json').read_text())
existing=json.loads(Path('/tmp/sd-current-oct08-listings.json').read_text())
def norm(x):return re.sub('[^a-z0-9]','',x.lower())
def hid(x):return hashlib.sha256(x.encode()).hexdigest()[:20]
def soup(u):
 a=audit[u];assert a['status']==200 and not a.get('error');return BeautifulSoup(Path(a['path']).read_text(),'html.parser')
rows=[('Copper Chilli','N1, Cidco, Town centre, near MGM Hospital, Chhatrapati Sambhaji Nagar, Maharashtra - 431001','https://copperchilli.com/','restaurant','+91 9921604422'),('Hotel Chul','Gut No. 385, Jalna Road, Near Cambridge School, Chhatrapati Sambhajinagar, Maharashtra','https://chul.in/','restaurant','+91 7038 87 67 67'),('EssPressOh Café','Ground Floor, Prozone Mall, Chhatrapati Sambhajinagar, 431006','https://esspressoh.com/menu/','cafe','+91-8055333333'),('The Basil Kitchen','N1 Road, Cidco, Chhatrapati Sambhaji Nagar, Maharashtra 431001','https://thebasilkitchen.com/','restaurant','+91 9921114422'),('Grand Madhuram Restaurant','Pandariba Road, Beside HDFC Bank, Kiranachawadi, Chhatrapati Sambhajinagar (Aurangabad) 431001','https://hotelgrandmadhuram.com/the-restaurant/','hotel_restaurant','+91 7972183484')]
businesses=[];sets={};sources=[]
for name,address,url,typ,phone in rows:
 s=soup(url);text=s.get_text(' ',strip=True)
 # Facts must be visible; whitespace/punctuation are presentation-only.
 assert norm(address) in norm(text)
 if any(norm(x.get('name',''))==norm(name) and norm(x.get('address') or '')==norm(address) for x in existing):continue
 key='official:sd-food-'+hid(url+':'+address)
 b=dict(external_id=key[9:],sourceKey=key,name=name,brand=name,city='Chhatrapati Sambhajinagar',state='Maharashtra',district='Chhatrapati Sambhajinagar',address=address,address_scope='published_address',latitude=None,longitude=None,phone=phone,business_type=typ,category='amenity:cafe' if typ=='cafe' else 'amenity:restaurant',source_urls=[url],source_types=['business_website'],retrieved_on=date,restaurant_rating=None,review_count=None,license_status='not_checked',fssai_license_number=None,currently_operating=None,operating_status=None,verification_status='source_observed',review_status='source_observed',directory_publish_ready=True,publish_ready=False,recommendation_eligible=False,menu_status='not_observed',google_maps_url=None,service_note='Official website identity/address observation; operation, licences, dietary preparation and stock unconfirmed.')
 b['directions_url']='https://www.google.com/maps/search/?'+urlencode({'api':'1','query':name+', '+address})
 b['directions_basis']='Generated address search; not a verified Google place ID'
 for a in s.select('a[href]'):
  if any(host in a['href'] for host in ['maps.app.goo.gl/','google.com/maps','maps.google.com/']):b['google_maps_url']=a['href'];break
 items=[]
 def add(n,price=None,portion=None):
  assert norm(n) in norm(text)
  items.append(dict(external_id='sd-menu-'+hid(key+':'+n+':'+str(portion)),brand=name,name=n,portion=portion,price_inr=price,is_veg=None,veg_evidence=None,source_url=url,price_scope='Explicit published website price; taxes and fulfilment unconfirmed' if price is not None else 'Price not published',branch_availability='not_confirmed',tax_included=None,retrieved_on=date,recommendation_eligible=False,publish_ready=False,menu_category=None,source_business_id=key))
 if name=='Copper Chilli':
  for n in ['Paneer Makhanwala','Subz Milloni Handi','Punjabi Kofta Masala','Veg Manchurian','Paneer Pahadi Tikka','Honey Chilli Potato','Chicken Chilli','Chicken Crispy','Mutton Seekh Kabab','Prawns Tikka','Promfet Tandoori','Egg Masala']:add(n)
 if name=='Hotel Chul':
  assert re.search(r'Half\s*₹\s*900\s*·\s*Full\s*₹\s*1800',text)
  assert re.search(r'Half\s*₹\s*750\s*·\s*Full\s*₹\s*1100',text)
  for n,p,part in [('Champaran Mutton',900,'Half'),('Champaran Mutton',1800,'Full'),('Gavran Chicken',750,'Half'),('Gavran Chicken',1100,'Full'),('Shevga Handi',730,None)]:add(n,p,part)
 if name=='The Basil Kitchen':
  for n in ['Hot Basil Rice','Paneer Lababdar','Spring Roll']:add(n)
 if name=='Grand Madhuram Restaurant':
  b.update(data_conflict=True,menu_status='held_template_content_conflict',menu_notice='Pure vegetarian restaurant description conflicts with template USD meat/alcohol menu; all dish/price entries withheld.')
 if items:
  mid='official-local-menu-'+hid(key);sets[mid]=dict(kind='outlet_page',brand=name,source_url=url,items=items);b['outlet_menu_set_id']=mid;b['menu_status']='outlet_page_observed'
 businesses.append(b);sources.append(dict(url=url,sha256=audit[url]['sha256'],checked_on=date,access_method='anonymous_public_page',robots_respected=True))
failed=[dict(url=u,status='held',reason=r) for u,r in [('https://saawariyarasoi.com/','JavaScript shell; no visible verified branch address'),('https://senoritacafe.com/','Unmodified template menu, USD prices and placeholder contact; branch identity held')]]
batch=dict(batch_id=bid,retrieved_on=date,businesses=businesses,menu_sets=sets,research_scope=dict(state='Maharashtra',city_counts={'Chhatrapati Sambhajinagar':len(businesses)},new_outlets=len(businesses),menu_entries=sum(len(s['items']) for s in sets.values()),published_prices=sum(x['price_inr'] is not None for s in sets.values() for x in s['items']),source_pages=sources,failed_or_held_sources=failed,complete_city_census=False,complete_state_census=False,brand_counts={b['brand']:1 for b in businesses},gaps=['Branch menus for EssPressOh and Grand Madhuram','Jalna independent restaurant addresses need accessible corroboration','Street vendors/carts and remaining district towns not yet broadly covered']))
(root/'api/source-batches'/f'{bid}.json.gz').write_bytes(gzip.compress(json.dumps(batch,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
p=root/'api/source-batches/state-import-progress.json';progress=json.loads(p.read_text());progress['updated_on']=date;mh=next(s for s in progress['states'] if s['state']=='Maharashtra');mh['batch_ids'].append(bid);mh['latest_bounded_batch']=batch['research_scope'];progress['source_attempts'] += [dict(source=b['name'],url=b['source_urls'][0],status='source_observed',checked_on=date) for b in businesses]+failed;progress['broad_source_pass_complete']=False;p.write_text(json.dumps(progress,ensure_ascii=False,indent=2)+'\n')
print(json.dumps(batch['research_scope']))
