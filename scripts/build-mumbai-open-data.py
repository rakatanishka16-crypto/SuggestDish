"""Build a licensed, directory-only snapshot from the phase-1 collector CSVs."""
import csv,json,gzip,sys,math,difflib,unicodedata
from pathlib import Path
restaurants,dishes,existing_path=sys.argv[1:]
existing=json.loads(Path(existing_path).read_text())
normalize=lambda x:''.join(c for c in unicodedata.normalize('NFKC',x or '').casefold() if c.isalnum())
def meters(r,e):
 if e.get('latitude') is None or e.get('longitude') is None:return math.inf
 a,b,c,d=map(math.radians,[float(r['lat']),float(r['lon']),e['latitude'],e['longitude']]);h=math.sin((c-a)/2)**2+math.cos(a)*math.cos(c)*math.sin((d-b)/2)**2
 return 6371000*2*math.asin(math.sqrt(min(1,h)))
businesses=[];held=[];duplicates=[]
for r in csv.DictReader(open(restaurants,encoding='utf-8')):
 if not r['name'].strip() or r['amenity'] not in ('restaurant','cafe','fast_food','food_court','ice_cream'):
  held.append({'source_id':r['source_id'],'reason':'unnamed_or_cuisine_only_non_target_object'});continue
 matches=[]
 for e in existing:
  d=meters(r,e)
  if d<=100:
   score=max(difflib.SequenceMatcher(None,normalize(r['name']),normalize(e.get(k)),autojunk=False).ratio() for k in ('name','brand'))
   if score>=.92:matches.append((e,d,score))
 if matches:
  duplicates.append({'source_id':r['source_id'],'candidate_profile_ids':[m[0]['id'] for m in matches],'distance_m':[round(m[1],2) for m in matches],'similarity':[round(m[2],3) for m in matches],'action':'held_existing_profile_match_for_review','automatic_merge':False});continue
 sid='open:osm_'+r['source_id'].replace('/','_')
 businesses.append({'sourceKey':sid,'external_id':sid,'existingBusinessId':'osm:'+r['source_id'],'name':r['name'],'name_en':r['name_en'] or None,'brand':None,'city':'Mumbai','state':'Maharashtra','locality':r['area'] or None,'category':'amenity:'+r['amenity'],'address':r['full_address'] or None,'address_fields':json.loads(r['address_fields']),'latitude':float(r['lat']),'longitude':float(r['lon']),'coordinate_type':r['coordinate_type'],'cuisine':r['cuisine'] or None,'website':r['website'] or None,'phone':r['phone'] or None,'opening_hours':r['opening_hours'] or None,'source_urls':[r['source_url']],'source_types':['openstreetmap'],'source_id':r['source_id'],'retrieved_on':r['last_updated'],'source_license':'ODbL-1.0','attribution':r['attribution'],'license_status':'not_checked','verification_status':'source_observed','operating_status':None,'restaurant_rating':None,'review_count':None,'recommendation_eligible':False,'directory_publish_ready':True,'publish_ready':False,'outlet_menu_set_id':None,'reference_menu_set_id':None,'service_note':'OpenStreetMap observation only. Operation, menu, dietary preparation and quality unconfirmed. Way coordinates are bounding-box centers, not verified entrances.'})
vocabulary=[]
for r in csv.DictReader(open(dishes,encoding='utf-8')):
 vocabulary.append({**r,**{k:json.loads(r[k]) for k in ('aliases','region','main_ingredients','dish_type')},'ingredient_evidence_property':'P527 (has part); ingredient candidates require recipe verification','outlet_id':None,'price':None,'availability_confirmed':False})
data={'batch_id':'mumbai-open-data-2026-10-09','retrieved_on':'2026-10-09','businesses':businesses,'vocabulary':vocabulary,'menu_items':[],'held_records':held,'duplicate_candidates':duplicates,'input_records':1908,'complete_city_census':False,'scope':'Mumbai City + Mumbai Suburban OSM administrative district union; excludes Navi Mumbai','dataset_license':'ODbL-1.0 for OSM profiles and match metadata; CC0-1.0 for Wikidata vocabulary'}
Path('api/source-batches/mumbai-open-data-2026-10-09.json.gz').write_bytes(gzip.compress(json.dumps(data,ensure_ascii=False).encode(),mtime=0))
print(json.dumps({'published_directory_profiles':len(businesses),'held':len(held),'existing_profile_candidates_held':len(duplicates),'vocabulary_items':len(vocabulary)},indent=2))
