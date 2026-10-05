import json,re,hashlib,time,urllib.request,concurrent.futures,collections,subprocess,sys
from pathlib import Path
from bs4 import BeautifulSoup
ROOT=Path(sys.argv[1]);ROOT.mkdir(parents=True,exist_ok=True)
def fetch(url):
 p=ROOT/('fetch-'+hashlib.sha256(url.encode()).hexdigest()[:20]+'.html')
 if p.exists():return p.read_text()
 result=subprocess.run(['curl','--fail','--silent','--show-error','--location','--max-time','35','--connect-timeout','12',url],capture_output=True)
 if result.returncode:raise ValueError('Source request failed or timed out')
 raw=result.stdout.decode('utf-8');p.write_text(raw)
 time.sleep(.4)
 return raw
def soup(raw):return BeautifulSoup(raw,'lxml')
def clean(v):return re.sub(r'\s+',' ',str(v or '')).strip()
def store_data(raw):
 s=soup(raw);tag=s.find('brand-store-list');return json.loads(tag['data-results']) if tag and tag.get('data-results') not in ['null',None] else []
for filename,url in {'dominos-locator.html':'https://www.dominos.co.in/store-location/','dominos-menu.html':'https://www.dominos.co.in/menu','kfc-maharashtra.html':'https://restaurants.kfc.co.in/location/maharashtra','bk-maharashtra.html':'https://stores.burgerking.in/location/maharashtra'}.items():
 if not (ROOT/filename).exists():(ROOT/filename).write_text(fetch(url))
menu_tag=soup((ROOT/'dominos-menu.html').read_text()).find('brand-menu-data')
if not menu_tag:raise ValueError('Official menu payload missing; do not publish an empty replacement')
(ROOT/'dominos-menu-data.json').write_text(json.dumps(json.loads(menu_tag['data-results'])))
legacy=soup((ROOT/'dominos-locator.html').read_text());cities={a['href'].strip('/').split('/')[-1]:re.sub(r' \(\d+\)$','',a.get_text(' ',strip=True)) for a in legacy.select('a.citylink')}
outlets={}
for card in legacy.select('.custom-panel'):
 title=card.select_one('.city-main-sub-title');address=card.select_one('.media-body .grey-text');link=title.find_parent('a') if title else None
 if not link or not address:continue
 href=link['href'];parts=href.strip('/').split('/')
 if len(parts)!=3:continue
 phone=card.select_one('.modal-body .zred');hours=card.select_one('.res-timing')
 outlets[href]={'brand':"Domino's Pizza",'name':clean(title.text),'address':clean(address.text),'city':cities.get(parts[1],parts[1].replace('-',' ').title()),'state':None,'phone':clean(phone.text) if phone else None,'opening_hours':hours.get('title') if hours else None,'latitude':None,'longitude':None,'source_url':'https://www.dominos.co.in'+href,'directory_source_url':'https://www.dominos.co.in/store-location/','source_type':'official_locator_card','store_id':None}
(ROOT/'dominos-legacy-outlets.json').write_text(json.dumps(list(outlets.values()),ensure_ascii=False));print('Dominos official locator unique URL records',len(outlets),flush=True)
priority=['jalna','aurangabad','mumbai','thane','navi-mumbai','pune','nagpur','nashik','akola','amravati','ahmadnagar','ahmednagar','jalgoan','jalgaon','kolhapur','solapur','sangli','satara','latur','nanded','beed','baramati','wardha','gondia','chandrapur','yavatmal','karad','ratnagiri','washim','parbhani','dhule','nandurbar','buldana','buldhana','chiplun','alibag','panvel','new-delhi','delhi','bangalore','bengaluru','hyderabad','chennai','kolkata','noida','gurgaon','gurugram','ahmedabad','jaipur','lucknow','indore','bhopal','surat','vadodara','chandigarh']
priority=[c for c in priority if c in cities]
def city_fetch(c):
 url='https://www.dominos.co.in/store-location/'+c
 try:return c,store_data(fetch(url)),None
 except Exception as e:return c,[],str(e)
fresh=[];audit=[]
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for city,groups,error in pool.map(city_fetch,priority):
  n=0
  for g in groups:
   for detail in g.get('storeStationDetails',[]):
    st=detail.get('store',{});station=st.get('stations',[{}])[0] if st.get('stations') else {};n+=1
    fresh.append({'brand':"Domino's Pizza",'name':clean(st.get('name')),'address':clean(st.get('address')),'city':clean(st.get('city')).title(),'state':clean(st.get('region')).title(),'phone':clean(st.get('phone')),'opening_hours':clean(station.get('startTime'))+' - '+clean(station.get('endTime')) if station.get('startTime') else None,'latitude':st.get('latitude'),'longitude':st.get('longitude'),'source_url':'https://www.dominos.co.in/store-location/'+city,'directory_source_url':'https://www.dominos.co.in/store-location/','source_type':'official_city_store_data','store_id':st.get('id'),'source_operational_tag':st.get('storeOperationalTag')})
  audit.append({'url':'https://www.dominos.co.in/store-location/'+city,'count':n,'error':error});(ROOT/'dominos-current-outlets.json').write_text(json.dumps(fresh,ensure_ascii=False));(ROOT/'dominos-current-audit.json').write_text(json.dumps(audit));print('Dominos city',city,n,error or '',flush=True)

def paginated_brand(brand,host,startfile):
 first=soup((ROOT/startfile).read_text());last=next((int(re.search(r'page=(\d+)',a['href']).group(1)) for a in first.select('a[href]') if a.get_text(strip=True)=='Last'),1)
 records={};errors=[]
 def page(n):
  url=host+'/location/maharashtra'+('?page='+str(n) if n>1 else '')
  try:return url,soup(fetch(url)) if n>1 else first,None
  except Exception as e:return url,None,str(e)
 with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
  for url,s,error in pool.map(page,range(1,last+1)):
   if error:errors.append({'url':url,'error':error});continue
   for box in s.select('.store-info-box'):
    a=box.select_one('.outlet-name a[href]');address=box.select_one('.outlet-address .info-text');phone=box.select_one('.outlet-phone a');lat=box.select_one('.outlet-latitude');lon=box.select_one('.outlet-longitude')
    if not a or not address:continue
    href=a['href'];text=address.get_text(' ',strip=True);city_tag=address.select_one('.merge-in-next');city=clean(city_tag.find('span').text) if city_tag and city_tag.find('span') else None
    if not city:errors.append({'url':href,'error':'City missing from source'});continue
    children=address.find_all('span',recursive=False);locality=clean(children[-2].text) if len(children)>1 else ''
    records[href]={'brand':brand,'name':brand+' - '+locality+', '+city,'address':text+', Maharashtra','city':city,'state':'Maharashtra','locality':locality,'phone':clean(phone.text) if phone else None,'opening_hours':None,'latitude':float(lat['value']) if lat and lat.get('value') else None,'longitude':float(lon['value']) if lon and lon.get('value') else None,'source_url':href,'directory_source_url':url,'source_type':'official_locator_card'}
   print(brand,'directory',url,'total',len(records),flush=True)
 (ROOT/(brand.lower().replace(' ','-')+'-outlets.json')).write_text(json.dumps(list(records.values()),ensure_ascii=False))
 return records,errors
kfc,errors=paginated_brand('KFC','https://restaurants.kfc.co.in','kfc-maharashtra.html')
bk,bkerrors=paginated_brand('Burger King','https://stores.burgerking.in','bk-maharashtra.html');errors+=bkerrors
menus={};checked=[]
def branch_fetch(item):
 url,b=item
 try:
  raw=fetch(url);s=soup(raw);ld=[]
  for script in s.find_all('script',type='application/ld+json'):
   try:v=json.loads(script.string);ld.extend(v if isinstance(v,list) else [v])
   except:pass
  lb=next((x for x in ld if x.get('@type')=='LocalBusiness'),None)
  if lb:
   address=lb.get('address');address=address[0] if isinstance(address,list) else address or {};b['address']=', '.join(clean(address.get(k)) for k in ['streetAddress','addressLocality','addressRegion','postalCode'] if address.get(k))+', Maharashtra';b['city']=clean(address.get('addressRegion'));b['locality']=clean(address.get('addressLocality'));b['name']=b['brand']+' - '+b['locality']+', '+b['city'];b['opening_hours']='; '.join(x['dayOfWeek']+': '+x.get('opens','')+' - '+x.get('closes','') for x in lb.get('openingHoursSpecification',[]));b['geo']=lb.get('geo');b['source_type']='official_outlet_page'
  items=[]
  for card in s.select('.card'):
   title=card.select_one('.card-title');price=card.select_one('.price-sec')
   if not title or not price:continue
   name=clean(title.text);m=re.search(r'([\d,]+(?:\.\d+)?)',price.text)
   if not m:continue
   # Only the exact source marker establishes dietary type, never brand assumptions.
   mark=card.select_one('.imd-icon');classes=' '.join(mark.get('class',[])) if mark else '';veg=True if re.search(r'\bveg-icon\b',classes) else False if re.search(r'\bnonveg-icon\b',classes) else None
   cat=card.find_parent(class_='tab-pane');catname=clean(cat.find(['h2','h3']).text) if cat and cat.find(['h2','h3']) else None
   items.append({'name':name,'price_inr':float(m.group(1).replace(',','')),'is_veg':veg,'menu_category':catname,'portion':None,'tax_included':False if 'prices are excluding GST' in raw else None})
  return url,b,items,None
 except Exception as e:return url,b,[],str(e)
with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
 for url,b,items,error in pool.map(branch_fetch,list(kfc.items())+list(bk.items())):
  if error:errors.append({'url':url,'error':error})
  else:checked.append(b);menus[url]=items
  (ROOT/'checked-chain-outlets.json').write_text(json.dumps(checked,ensure_ascii=False));(ROOT/'outlet-menus.json').write_text(json.dumps(menus,ensure_ascii=False));(ROOT/'crawl-errors.json').write_text(json.dumps(errors));print('Outlet',len(checked),b['brand'],b['city'],'menu',len(items),error or '',flush=True)
print('FINISHED',len(fresh),len(kfc),len(bk),'menus',sum(bool(x) for x in menus.values()),'errors',len(errors),flush=True)
