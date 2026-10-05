"""Build an outlet snapshot from cached official locators; never infer branch prices."""
import argparse,collections,hashlib,json,re,html
from pathlib import Path
from bs4 import BeautifulSoup
parser=argparse.ArgumentParser();parser.add_argument('--cache',type=Path,required=True);parser.add_argument('--output',type=Path,required=True);args=parser.parse_args();root=args.cache
CHECKED='2026-10-05'
def norm(v):return re.sub('[^a-z0-9]','',str(v or '').lower())
def citykey(v):
 key=norm(v);return {'bangalore':'bengaluru','gurgaon':'gurugram','jallandhar':'jalandhar','jalgoan':'jalgaon','ahmadnagar':'ahmednagar','nasik':'nashik','newdelhi':'delhi'}.get(key,key)
def identifier(v):return hashlib.sha256(v.encode()).hexdigest()[:20]
def read(name,default):
 p=root/name;return json.loads(p.read_text()) if p.exists() else default
legacy=read('dominos-legacy-outlets.json',[]);fresh=read('dominos-current-outlets.json',[])
# The current city response replaces older locator cards for that city, avoiding stale duplicates.
freshcities={citykey(b['city']) for b in fresh};records=[b for b in legacy if citykey(b['city']) not in freshcities]+fresh
# Use the original branch URL when its name or unique phone agrees with the current city record.
byname={(citykey(b['city']),norm(b['name'])):b['source_url'] for b in legacy}
phones=collections.defaultdict(list)
for b in legacy:
 if b.get('phone'):phones[(citykey(b['city']),norm(b['phone']))].append(b['source_url'])
for b in records:
 if b['source_type']=='official_city_store_data':
  matches=phones.get((citykey(b['city']),norm(b.get('phone'))),[])
  branch=byname.get((citykey(b['city']),norm(b['name']))) or (matches[0] if len(matches)==1 else None)
  if branch:b['branch_url']=branch
checked={b['source_url']:b for b in read('checked-chain-outlets.json',[])}
for filename in ['kfc-outlets.json','burger-king-outlets.json']:
 for original in read(filename,[]):
  b=dict(checked.get(original['source_url'],original))
  if not b.get('city'):
   b['city']=original['city'];b['address']=original['address'];b['name']=b['brand']+' - '+(b.get('locality') or original.get('locality',''))+', '+b['city']
  records.append(b)
menu_sets={};dominos=[]
data=read('dominos-menu-data.json',{})
for p in data.get('productDefinitions',[]):
 label=p.get('metadataMap',{}).get('foodLabel',{}).get('values',[None])[0];veg=True if label=='VEG' else False if label=='NONVEG' else None
 for v in p.get('variants',[]):
  price=v.get('price',{}).get('currentPrice');attrs=v.get('attributes',[]);portion=' / '.join(str(a['value']) for a in attrs if a.get('value') and a.get('name') in ['Size','Crust']) or None
  dominos.append({'external_id':'sd-menu-'+identifier('dominos:'+v['productUID']),'brand':"Domino's Pizza",'name':p['displayName'],'menu_category':', '.join(c['categoryName'] for c in p.get('categoryInfo',[])) or p.get('family',{}).get('name'),'portion':portion,'price_inr':price if isinstance(price,(int,float)) and price>0 else None,'is_veg':veg,'veg_evidence':'Official product foodLabel: '+str(label),'source_url':'https://www.dominos.co.in/menu','price_scope':'National website catalog; outlet price not confirmed','source_availability':'catalog_disabled' if v.get('isCartDisabled') or v.get('isMasterDisabled') else 'catalog_listed','branch_availability':'not_confirmed','tax_included':None,'retrieved_on':CHECKED,'recommendation_eligible':False,'publish_ready':False})
for p in data.get('comboDefinitions',[]):
 label=p.get('metadataMap',{}).get('foodLabel',{}).get('values',[None])[0];price=p.get('price',{}).get('currentPrice')
 dominos.append({'external_id':'sd-menu-'+identifier('dominos:'+p['comboUID']),'brand':"Domino's Pizza",'name':p['displayName'],'menu_category':'Meals & combos','portion':None,'price_inr':price if isinstance(price,(int,float)) and price>0 else None,'is_veg':True if label=='VEG' else False if label=='NONVEG' else None,'veg_evidence':'Official product foodLabel: '+str(label),'source_url':'https://www.dominos.co.in/menu','price_scope':'National website catalog; outlet price not confirmed','source_availability':'catalog_disabled' if p.get('isCartDisabled') else 'catalog_listed','branch_availability':'not_confirmed','tax_included':None,'retrieved_on':CHECKED,'recommendation_eligible':False,'publish_ready':False})
menu_sets['dominos-national-reference']={'kind':'brand_reference','brand':"Domino's Pizza",'items':dominos}

def outlet_menu(url,brand):
 path=root/('fetch-'+hashlib.sha256(url.encode()).hexdigest()[:20]+'.html')
 if not path.exists():return []
 raw=path.read_text();s=BeautifulSoup(raw,'lxml');description={}
 for tag in s.find_all('script',type='application/ld+json'):
  try:ld=json.loads(tag.string)
  except:continue
  for obj in ld if isinstance(ld,list) else [ld]:
   for entry in obj.get('itemListElement',[]):
    item=entry.get('item',{});name=item.get('name')
    if name:description[BeautifulSoup(name,'lxml').get_text()]=BeautifulSoup(item.get('description',''),'lxml').get_text()
 items=[]
 for card in s.select('.card'):
  title=card.select_one('h4.card-title');price=card.select_one('.price-sec')
  if not title or not price:continue
  name=title.get_text(' ',strip=True);match=re.search(r'(\d[\d,]*(?:\.\d+)?)',price.text)
  if not match:continue
  pane=card.find_parent(class_='tab-pane');category=s.find('a',href='#'+pane['id']) if pane and pane.get('id') else None
  veg=False if re.search(r'\b(chicken|mutton|fish|prawn|beef)\b',name,re.I) else True if re.search(r'\bveg\b',name,re.I) else None
  desc=description.get(name,'');portion_match=re.search(r'Serves:\s*[^|)]+(?:\|\s*[\d.]+\s*g)?',desc)
  items.append({'name':name,'menu_category':category.get_text(' ',strip=True) if category else None,'price_inr':float(match.group(1).replace(',','')),'is_veg':veg,'veg_evidence':'Explicit veg or animal-ingredient label in official product name' if veg is not None else 'Source does not establish dietary type','portion':portion_match.group(0) if portion_match else None,'tax_included':False if 'prices are excluding GST' in desc else None})
 return items
businesses=[];seen=set()
city_aliases={'bangalore':'Bengaluru','gurgaon':'Gurugram','jallandhar':'Jalandhar','jalgoan':'Jalgaon','nasik':'Nashik','ahmadnagar':'Ahmednagar'}
for b in records:
 b={k:html.unescape(v) if isinstance(v,str) else v for k,v in b.items()}
 key=b['brand']+':'+(str(b['store_id']) if b.get('store_id') else b['source_url']);external='sd-food-'+identifier(key)
 if external in seen:continue
 seen.add(external);source_urls=[b['source_url']]
 for url in [b.get('branch_url'),b.get('directory_source_url')]:
  if url and url not in source_urls:source_urls.append(url)
 lat,lon=b.get('latitude'),b.get('longitude');geo=b.get('geo')
 if geo:
  try:lat,lon=float(geo['latitude']),float(geo['longitude'])
  except (KeyError,TypeError,ValueError):lat,lon=None,None
 if lat is not None and (not isinstance(lat,(int,float)) or not -90<=lat<=90):lat,lon=None,None
 if lon is not None and (not isinstance(lon,(int,float)) or not -180<=lon<=180):lat,lon=None,None
 if lat==0 and lon==0:lat,lon=None,None
 business={'external_id':external,'sourceKey':'official:'+external,'name':b['brand']+' - '+b['name'] if b['brand']=="Domino's Pizza" else b['name'],'brand':b['brand'],'locality':b.get('locality') or b['name'],'city':city_aliases.get(norm(b['city']),b['city'].title()),'source_city':b['city'],'state':b.get('state'),'business_type':'restaurant','category':'amenity:restaurant','address':b['address'] or None,'phone':b.get('phone'),'email':None,'opening_hours':b.get('opening_hours') or None,'latitude':lat,'longitude':lon,'coordinate_evidence':'Official locator or city-store data' if lat is not None else None,'restaurant_rating':None,'review_count':None,'fssai_license_number':None,'license_status':'not_checked','source_urls':source_urls,'source_types':['business_website'],'retrieved_on':CHECKED,'verification_status':'source_observed','review_status':'source_observed','directory_publish_ready':True,'recommendation_eligible':False,'publish_ready':False,'image_url':None,'source_store_id':b.get('store_id'),'source_detail_type':b['source_type']}
 if b['brand']=="Domino's Pizza":
  business['reference_menu_set_id']='dominos-national-reference';business['menu_status']='national_reference_only';business['service_note']='The national menu is reference information. Outlet stock, prices, service and current opening hours require confirmation.'
 else:
  items=outlet_menu(b['source_url'],b['brand']);business['menu_status']='outlet_page_observed' if items else 'not_transcribed';business['service_note']='Menu and price observations come from this official outlet page. Confirm current availability and the final bill with the outlet.' if items else 'An official outlet listing is available. A dish-level menu has not been transcribed.'
  if items:
   setid=b['brand'].lower().replace(' ','-')+'-'+identifier(json.dumps(items,sort_keys=True,ensure_ascii=False));business['outlet_menu_set_id']=setid
   if setid not in menu_sets:
    enriched=[]
    for item in items:
     enriched.append({'external_id':'sd-menu-'+identifier(setid+json.dumps(item,sort_keys=True)),**item,'brand':b['brand'],'price_scope':'Published on the selected official outlet page','branch_availability':'published_on_outlet_page','retrieved_on':CHECKED,'recommendation_eligible':False,'publish_ready':False})
    menu_sets[setid]={'kind':'outlet_page','brand':b['brand'],'items':enriched}
 businesses.append(business)
output={'batch_id':'india-chain-outlets-2026-10-05','retrieved_on':CHECKED,'coverage':'Actual official outlet observations. Domino’s national menu is a reference; KFC outlet-page menus are linked only to pages checked. Not a complete census or owner verification.','businesses':businesses,'menu_items':[],'menu_sets':menu_sets,'research_scope':{'brand_counts':dict(collections.Counter(b['brand'] for b in businesses)),'cities':len(set(b['city'] for b in businesses)),'outlet_menu_assignments':sum('outlet_menu_set_id' in b for b in businesses),'reference_menu_assignments':sum('reference_menu_set_id' in b for b in businesses),'source_pages_checked':len(checked),'crawl_errors':read('crawl-errors.json',[])}}
args.output.parent.mkdir(parents=True,exist_ok=True);args.output.write_text(json.dumps(output,ensure_ascii=False,separators=(',',':')))
print(json.dumps({'businesses':len(businesses),'menu_sets':len(menu_sets),'menu_variants':sum(len(s['items']) for s in menu_sets.values()),'scope':output['research_scope'],'bytes':args.output.stat().st_size}))
