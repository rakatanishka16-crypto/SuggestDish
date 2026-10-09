import sys,json,gzip,time,datetime,hashlib,urllib.request,urllib.parse,math,difflib,unicodedata
from pathlib import Path
import argparse
parser=argparse.ArgumentParser(description='Bounded Mumbai OSM bakery/sweets/catering pass; no menus or prices inferred')
parser.add_argument('--root',default='.')
parser.add_argument('--cache',required=True)
parser.add_argument('--existing-profiles',required=True)
args=parser.parse_args()
root=Path(args.root);cache=Path(args.cache);cache.mkdir(parents=True,exist_ok=True)
existing=json.load(open(args.existing_profiles));target=root/'api/source-batches/mumbai-open-data-2026-10-09.json.gz';data=json.load(gzip.open(target));known={b['source_id'] for b in data['businesses']}|{r['source_id'] for r in data['held_records']}|{r['source_id'] for r in data['duplicate_candidates']}
normalize=lambda s:''.join(c for c in unicodedata.normalize('NFKC',s or '').casefold() if c.isalnum())
def distance(lat,lon,b):
 if b.get('latitude') is None or b.get('longitude') is None:return math.inf
 a,x,c,y=map(math.radians,[lat,lon,b['latitude'],b['longitude']]);h=math.sin((c-a)/2)**2+math.cos(a)*math.cos(c)*math.sin((y-x)/2)**2;return 12742000*math.asin(math.sqrt(min(1,h)))
summary={'added':0,'already_observed':0,'held':0,'duplicate_candidates':0,'districts':[],'failures':[]};seen=set()
for relation in [7964376,7964375]:
 q=f'[out:json][timeout:30][maxsize:134217728];relation({relation});map_to_area->.m;(nwr(area.m)[shop~"^(bakery|pastry|confectionery)$"];nwr(area.m)[craft~"^(caterer|confectionery)$"];);out center tags;'
 p=cache/(str(relation)+'-'+hashlib.sha256(q.encode()).hexdigest()+'.json')
 try:
  if p.exists():envelope=json.load(open(p))
  else:
   time.sleep(3);req=urllib.request.Request('https://overpass-api.de/api/interpreter',data=urllib.parse.urlencode({'data':q}).encode(),headers={'User-Agent':'SuggestDish open-data collection (suggestdish.com)','Content-Type':'application/x-www-form-urlencoded'})
   with urllib.request.urlopen(req,timeout=55) as r:response=json.load(r)
   if response.get('remark'):raise RuntimeError(response['remark'])
   envelope={'retrieved_on':datetime.datetime.now(datetime.timezone.utc).isoformat(),'query':q,'response':response};p.write_text(json.dumps(envelope,ensure_ascii=False))
  snapshot=envelope['response'].get('osm3s',{}).get('timestamp_osm_base')
  if not snapshot or (datetime.datetime.fromisoformat(envelope['retrieved_on'])-datetime.datetime.fromisoformat(snapshot.replace('Z','+00:00'))).days>7:raise RuntimeError('Missing or stale OSM snapshot')
  summary['districts'].append(relation)
  for e in envelope['response']['elements']:
   sid=f"{e['type']}/{e['id']}"
   if sid in seen:continue
   seen.add(sid)
   if sid in known:summary['already_observed']+=1;continue
   t=e.get('tags',{});name=t.get('name') or t.get('name:en');loc=e if e['type']=='node' else e.get('center',{});lat=loc.get('lat');lon=loc.get('lon')
   if not name or lat is None or lon is None:summary['held']+=1;data['held_records'].append({'source_id':sid,'reason':'food_shop_missing_name_or_coordinates'});continue
   matches=[]
   for b in existing:
    d=distance(lat,lon,b)
    if d<=100:
     score=max(difflib.SequenceMatcher(None,normalize(name),normalize(b.get(k)),autojunk=False).ratio() for k in ['name','brand'])
     if score>=.92:matches.append((b['id'],round(d,2),round(score,3)))
   if matches:summary['duplicate_candidates']+=1;data['duplicate_candidates'].append({'source_id':sid,'candidate_profile_ids':[m[0] for m in matches],'distance_m':[m[1] for m in matches],'similarity':[m[2] for m in matches],'automatic_merge':False,'action':'held_existing_profile_match_for_review'});continue
   category=('shop:'+t['shop']) if t.get('shop') in ['bakery','pastry','confectionery'] else 'craft:'+t['craft'];address=t.get('addr:full') or ', '.join(t[k] for k in ['addr:housenumber','addr:street','addr:suburb','addr:city','addr:postcode'] if t.get(k)) or None
   b={'sourceKey':'open:osm_'+sid.replace('/','_'),'external_id':'open:osm_'+sid.replace('/','_'),'existingBusinessId':'osm:'+sid,'source_id':sid,'name':name,'name_en':t.get('name:en'),'brand':None,'city':'Mumbai','state':'Maharashtra','locality':t.get('addr:suburb') or t.get('addr:neighbourhood'),'category':category,'address':address,'address_fields':{k:v for k,v in t.items() if k.startswith('addr:')},'latitude':lat,'longitude':lon,'coordinate_type':'node' if e['type']=='node' else 'way_bbox_center' if e['type']=='way' else 'relation_bbox_center','cuisine':t.get('cuisine'),'website':t.get('website') or t.get('contact:website'),'phone':t.get('phone') or t.get('contact:phone'),'opening_hours':t.get('opening_hours'),'source_urls':['https://www.openstreetmap.org/'+sid],'source_types':['openstreetmap'],'retrieved_on':envelope['retrieved_on'],'source_license':'ODbL-1.0','attribution':'© OpenStreetMap contributors; https://www.openstreetmap.org/copyright','license_status':'not_checked','verification_status':'source_observed','operating_status':None,'restaurant_rating':None,'review_count':None,'recommendation_eligible':False,'directory_publish_ready':True,'publish_ready':False,'outlet_menu_set_id':None,'reference_menu_set_id':None,'service_note':'OSM food-shop/craft observation. Operation, menu, dietary preparation and quality unconfirmed. Way/relation centers are not verified entrances.'}
   data['businesses'].append(b);existing.append({'id':b['sourceKey'],'name':name,'latitude':lat,'longitude':lon});summary['added']+=1
 except Exception as exc:summary['failures'].append({'relation':relation,'error':str(exc)});print(summary['failures'][-1],flush=True)
summary['new_unique_objects']=len(seen-known);data['input_records']+=summary['new_unique_objects'];data['food_shop_collection_pass']=summary
target.write_bytes(gzip.compress(json.dumps(data,ensure_ascii=False).encode(),mtime=0));(cache/'summary.json').write_text(json.dumps(summary,indent=2));
with (cache/'runs.jsonl').open('a') as log:log.write(json.dumps({'timestamp':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'OpenStreetMap Overpass','record_count':summary['added'],'errors':summary['failures'],'summary':summary})+'\n')
print(json.dumps(summary),flush=True)
