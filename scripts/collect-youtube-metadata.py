#!/usr/bin/env python3
"""Bounded original YouTube metadata only; no dish extraction or scores."""
import argparse,csv,datetime as dt,hashlib,json,os,time
from pathlib import Path
from urllib import request,parse,error
FIELDS=['video_id','title','channel_id','channel','published_at','view_count','description','source_url','source','retrieved_at','expires_at']
QUERIES=['best dishes in Mumbai','must try food Mumbai','Mumbai street food']
def now():return dt.datetime.now(dt.timezone.utc)
def fresh(stamp,current=None,days=1):
 try:return dt.timedelta(0)<=(current or now())-dt.datetime.fromisoformat(stamp)<dt.timedelta(days=days)
 except (ValueError,TypeError):return False
class Client:
 def __init__(self,root,key,interval=3):self.root=Path(root);self.root.mkdir(parents=True,exist_ok=True);self.key=key;self.last=0;self.interval=interval;self.calls=0
 def get(self,method,params):
  cache=self.root/(hashlib.sha256(json.dumps([method,params],sort_keys=True).encode()).hexdigest()+'.json')
  if cache.exists():
   saved=json.loads(cache.read_text())
   if fresh(saved['retrieved_at']):return saved['response'],saved['retrieved_at']
   cache.unlink()
  time.sleep(max(0,self.interval-(time.monotonic()-self.last)));self.last=time.monotonic()
  url='https://www.googleapis.com/youtube/v3/'+method+'?'+parse.urlencode({**params,'key':self.key})
  try:
   with request.urlopen(request.Request(url,headers={'User-Agent':'SuggestDish metadata collector'}),timeout=30) as r:response=json.load(r)
  except error.HTTPError as e:raise RuntimeError('YouTube HTTP '+str(e.code)+'; check API enablement, key restrictions or quota') from None
  except (error.URLError,TimeoutError):raise RuntimeError('YouTube network request failed; retry later') from None
  stamp=now().isoformat();cache.write_text(json.dumps({'retrieved_at':stamp,'expires_at':(now()+dt.timedelta(days=30)).isoformat(),'response':response},ensure_ascii=False));self.calls+=1
  return response,stamp
def purge(root):
 root=Path(root);removed=0
 for p in (root/'raw').glob('*.json'):
  try:valid=fresh(json.loads(p.read_text())['retrieved_at'],days=30)
  except (ValueError,KeyError):valid=False
  if not valid:p.unlink();removed+=1
 output=root/'youtube_videos.csv'
 if output.exists() and not fresh(dt.datetime.fromtimestamp(output.stat().st_mtime,dt.timezone.utc).isoformat(),days=30):output.unlink();removed+=1
 return removed
def collect(client,max_results=10,geotagged=False):
 ids=[]
 for q in QUERIES:
  params={'part':'snippet','type':'video','q':q,'regionCode':'IN','maxResults':max_results,'safeSearch':'moderate'}
  if geotagged:params.update(location='19.0760,72.8777',locationRadius='35km')
  response,_=client.get('search',params)
  ids.extend(i['id']['videoId'] for i in response.get('items',[]) if i.get('id',{}).get('videoId'))
 ids=list(dict.fromkeys(ids));rows=[]
 if ids:
  response,stamp=client.get('videos',{'part':'snippet,statistics','id':','.join(ids)})
  for v in response.get('items',[]):
   s=v.get('snippet',{});rows.append(dict(zip(FIELDS,[v['id'],s.get('title'),s.get('channelId'),s.get('channelTitle'),s.get('publishedAt'),v.get('statistics',{}).get('viewCount'),s.get('description'),'https://www.youtube.com/watch?v='+v['id'],'youtube',stamp,(dt.datetime.fromisoformat(stamp)+dt.timedelta(days=30)).isoformat()])))
 return rows
def main():
 p=argparse.ArgumentParser();p.add_argument('--output',default='youtube-temporary');p.add_argument('--max-results',type=int,choices=range(1,11),default=10);p.add_argument('--geotagged-only',action='store_true');p.add_argument('--purge-only',action='store_true');a=p.parse_args();root=Path(a.output);root.mkdir(parents=True,exist_ok=True);purge(root)
 if a.purge_only:return
 key=os.environ.get('YOUTUBE_API_KEY');record_count=0;failure=None
 try:
  if not key:raise RuntimeError('YOUTUBE_API_KEY is missing in this runtime; Vercel variables are not automatically available to local Python')
  rows=collect(Client(root/'raw',key),a.max_results,a.geotagged_only)
  with (root/'youtube_videos.csv').open('w',newline='',encoding='utf-8') as f:w=csv.DictWriter(f,fieldnames=FIELDS);w.writeheader();w.writerows(rows)
  record_count=len(rows);print(json.dumps({'videos':record_count,'new_outlets':0,'new_dishes':0,'new_prices':0,'mention_extraction':False}))
 except RuntimeError as e:failure=str(e);print(failure)
 finally:
  with (root/'runs.jsonl').open('a') as f:f.write(json.dumps({'timestamp':now().isoformat(),'source':'youtube','record_count':record_count,'errors':[failure] if failure else []})+'\n')
 return 1 if failure else 0
if __name__=='__main__':raise SystemExit(main())
