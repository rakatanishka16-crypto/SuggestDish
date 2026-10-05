"""Collect public brand facts at low concurrency; no reviews, images or marketing copy."""
import argparse, concurrent.futures, hashlib, json, pathlib, re, time, urllib.parse, urllib.request
from bs4 import BeautifulSoup
ROOT=pathlib.Path(__file__).resolve().parents[1]
BASE='https://naturalicecreams.in/'
DAY='2026-10-05'
def get(url):
    req=urllib.request.Request(url,headers={'User-Agent':'SuggestDish-source-research/1.0'})
    return urllib.request.urlopen(req,timeout=30).read().decode()
def ident(prefix,value): return prefix+hashlib.sha256(value.encode()).hexdigest()[:20]
def collect(cache):
    cache.mkdir(parents=True,exist_ok=True)
    stores=json.loads((cache/'stores.json').read_text()) if (cache/'stores.json').exists() else json.loads(get(BASE+'find-stores.php'))
    businesses=[]
    aliases={'MUMBAI':'Mumbai','Bangalore':'Bengaluru','Bangaluru':'Bengaluru','Nasik':'Nashik','Mangalore':'Mangaluru','Belgaum':'Belagavi','Cochin':'Kochi','Calicut':'Kozhikode','Trivandrum':'Thiruvananthapuram','Panjim':'Panaji','Vasco':'Vasco da Gama','Vishakhapatnam':'Visakhapatnam'}
    for s in stores:
        city=aliases.get(s['city'].strip(),s['city'].strip())
        locality=s['firm_name'].strip()
        if not city or not locality: continue
        eid=ident('sd-food-',BASE+'find-stores.php#'+s['id'])
        businesses.append({'external_id':eid,'sourceKey':'official:'+eid,'name':'Naturals Ice Cream - '+locality,'brand':'Naturals Ice Cream','locality':locality,'city':city,'source_city_label':s['city'],'source_outlet_id':s['id'],'business_type':'ice_cream','category':'amenity:ice_cream','address':None,'phone':None,'email':None,'opening_hours':None,'latitude':None,'longitude':None,'restaurant_rating':None,'review_count':None,'license_status':'not_checked','service_note':'Public store-finder observation. Full street address, phone, hours, pin accuracy and current operation remain unconfirmed.','source_urls':[BASE+'store-locator/',BASE+'find-stores.php'],'source_types':['business_website'],'retrieved_on':DAY,'verification_status':'source_observed','review_status':'source_observed','directory_publish_ready':True,'recommendation_eligible':False,'publish_ready':False,'image_url':None,'data_quality_note':'Store finder returns postal-code-like values under opening_hours and phone-like values under closing_hours; these fields, ambiguous address fields and uncorroborated map pins are not imported.'})
    shop=(cache/'shop.html').read_text() if (cache/'shop.html').exists() else get(BASE+'shop/')
    soup=BeautifulSoup(shop,'html.parser')
    urls={urllib.parse.urljoin(BASE,a['href'].strip()) for a in soup.select('a[href]') if '/product/' in a['href']}
    urls.add(BASE+'product/tender-coconut-ice-cream/')
    menus=[];failures=[]
    def product(url):
        dest=cache/(urllib.parse.urlparse(url).path.strip('/').replace('/','-')+'.html')
        try:
            if dest.exists(): html=dest.read_text()
            else:
                time.sleep(0.5)
                html=get(url);dest.write_text(html)
            soup=BeautifulSoup(html,'html.parser');summary=soup.select_one('.summary')
            if not summary or not summary.select_one('h1'): raise ValueError('Missing product summary')
            name=summary.select_one('h1').get_text(' ',strip=True)
            text=summary.get_text(' ',strip=True)
            tags=summary.select('.tagged_as a')
            veg=True if any(a.get_text(' ',strip=True)=='100% Vegetarian' for a in tags) else None
            price=summary.select_one('p.price');amount=None
            if price:
                vals=re.findall(r'\d[\d,]*(?:\.\d+)?',price.get_text(' ',strip=True))
                if len(vals)==1: amount=float(vals[0].replace(',',''))
            stock=summary.select_one('.stock')
            availability='OutOfStock' if stock and 'out of stock' in stock.get_text().lower() else 'InStock' if stock and 'in stock' in stock.get_text().lower() else None
            categories=', '.join(a.get_text(' ',strip=True) for a in summary.select('.posted_in a')) or 'Ice cream'
            return {'external_id':ident('sd-menu-',url),'brand':'Naturals Ice Cream','name':name,'menu_category':categories,'price_inr':None,'observed_price_inr':amount,'portion':None,'is_veg':veg,'veg_evidence':'Official product tag: 100% Vegetarian' if veg else None,'source_url':url,'source_urls':[url],'product_url':url,'price_scope':'Brand product page; serving size and branch price unconfirmed','price_status':'needs_portion_confirmation' if amount is not None else 'not_published','price_effective_date':None,'tax_included':None,'branch_availability':'not_confirmed','source_availability':availability,'order_note':(('Website displays ₹'+format(amount,'g')+' but does not identify a scoop or pack size. ' if amount is not None else 'No clear product price found. ')+'Confirm portion, current branch price and seasonal availability before ordering.'),'retrieved_on':DAY,'image_url':None,'publish_ready':False,'recommendation_eligible':False}
        except Exception as e: return {'failure':url,'reason':str(e)}
    with concurrent.futures.ThreadPoolExecutor(max_workers=2) as pool:
        for m in pool.map(product,sorted(urls)):
            if 'failure' in m: failures.append(m)
            else: menus.append(m)
            print('products checked',len(menus)+len(failures),'of',len(urls),flush=True)
    batch={'batch_id':'naturals-public-sources-2026-10-05','retrieved_on':DAY,'coverage':'Partial public-brand observations. Street addresses, contact fields, hours and coordinates are unknown because store-finder fields are unreliable. Product prices do not establish serving size or branch price.','businesses':businesses,'menu_items':menus,'excluded_sources':[],'collection_failures':failures,'research_scope':{'store_finder_records':len(stores),'product_urls_checked':len(urls),'concurrency':2,'copy_scope':'Outlet identity/locality/city and product name/category/price/dietary tag only; no photographs, marketing descriptions or reviews copied.'}}
    output=ROOT/'api/source-batches/naturals-2026-10-05.json';output.write_text(json.dumps(batch,ensure_ascii=False,separators=(',',':'))+'\n')
    print('DONE',len(businesses),len(menus),'prices',sum(m['price_inr'] is not None for m in menus),'failures',failures,flush=True)
if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('--cache',type=pathlib.Path,required=True);collect(p.parse_args().cache)
