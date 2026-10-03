"""Extract named directory candidates from a local Geofabrik India OSM PBF.
No menu, food-service, ratings or ownership verification is inferred.
"""
import osmium, json, sys, collections, datetime
from pathlib import Path
AMENITIES={'restaurant','cafe','fast_food','food_court','ice_cream','bar','pub'}
SHOPS={'bakery','confectionery','deli','pastry','catering'}
HOTELS={'hotel','motel','guest_house','resort'}
class Extract(osmium.SimpleHandler):
 def __init__(self):
  super().__init__(); self.rows={};self.closed=0
 def record(self,o,kind):
  if not (o.tags.get("name") or o.tags.get("name:en")):return
  t=dict(o.tags)
  name=t.get('name') or t.get('name:en')
  category=None
  if t.get('amenity') in AMENITIES:category='amenity:'+t['amenity']
  elif t.get('shop') in SHOPS:category='shop:'+t['shop']
  elif t.get('craft')=='caterer':category='craft:caterer'
  elif t.get('tourism') in HOTELS:category='tourism:'+t['tourism']
  if not name or not category:return
  if t.get('disused')=='yes' or t.get('abandoned')=='yes' or t.get('operational_status')=='closed':self.closed+=1;return
  address=', '.join(t[k] for k in ['addr:housenumber','addr:street','addr:suburb','addr:city','addr:state','addr:postcode'] if t.get(k))
  lat=lon=None
  if kind=='node' and o.location.valid():lat=o.location.lat;lon=o.location.lon
  key=f'osm:{kind}/{o.id}'
  self.rows[key]={'sourceKey':key,'name':name.strip()[:250],'category':category,'address':address[:1000], 'city':t.get('addr:city','')[:150],'latitude':lat,'longitude':lon,'sourceUrl':f'https://www.openstreetmap.org/{kind}/{o.id}','sourceLicense':'ODbL-1.0','reviewStatus':'unverified'}
 def node(self,o):self.record(o,'node')
 def way(self,o):self.record(o,'way')
 def relation(self,o):self.record(o,'relation')
if __name__=='__main__':
 out=Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
 h=Extract();filters=[osmium.filter.TagFilter(*([('amenity',v) for v in AMENITIES]+[('shop',v) for v in SHOPS]+[('tourism',v) for v in HOTELS]+[('craft','caterer')])),osmium.filter.KeyFilter('name','name:en')];h.apply_file(sys.argv[1],filters=filters);rows=sorted(h.rows.values(),key=lambda r:r['sourceKey'])
 (out/'osm-horeca-candidates.json').write_text(json.dumps(rows,ensure_ascii=False,separators=(',',':')))
 stats={'collectedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'source':'Geofabrik India OpenStreetMap extract','sourceUrl':'https://download.geofabrik.de/asia/india.html','totalSourceObjects':len(rows),'withCityTag':sum(bool(r['city']) for r in rows),'withAddress':sum(bool(r['address']) for r in rows),'withNodeCoordinates':sum(r['latitude'] is not None for r in rows),'categories':dict(collections.Counter(r['category'] for r in rows)),'excludedClosedTaggedObjects':h.closed,'completeBusinessCensus':False,'hotelFoodServiceVerified':False}
 (out/'coverage.json').write_text(json.dumps(stats,ensure_ascii=False,indent=2));print(json.dumps(stats,ensure_ascii=False))
