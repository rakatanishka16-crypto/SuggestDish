"""Build factual outlet records from official locator and menu observations.

Google links are published by the business, not independently verified reviews.
"""
import argparse, collections, gzip, hashlib, json, re
from pathlib import Path
p=argparse.ArgumentParser();p.add_argument('--world-source',type=Path,required=True);p.add_argument('--output',type=Path,required=True);args=p.parse_args()
CHECKED='2026-10-05'
def ident(s):return hashlib.sha256(s.encode()).hexdigest()[:20]
businesses=[];menus={}
def add(brand,locality,city,state,address,phone,url,google=None,menu=None,kind='brand_reference',note=None):
 key='sd-food-'+ident(brand+':'+city+':'+address)
 b=dict(external_id=key,sourceKey='official:'+key,name=brand+' - '+locality,brand=brand,locality=locality,city=city,state=state,address=address,phone=phone,email=None,opening_hours=None,business_type='cafe',category='amenity:cafe',latitude=None,longitude=None,coordinate_evidence=None,restaurant_rating=None,review_count=None,fssai_license_number=None,license_status='not_checked',source_urls=[url],source_types=['business_website'],retrieved_on=CHECKED,verification_status='source_observed',review_status='source_observed',directory_publish_ready=True,recommendation_eligible=False,publish_ready=False,image_url=None,source_detail_type='official_locator',menu_status='not_transcribed',service_note=note or 'Official outlet listing. Current stock, operation and final prices require confirmation.',google_maps_url=google,google_listing_status='business_link_published' if google else 'not_checked')
 if menu:
  setid=brand.lower().replace(' ','-')+'-'+ident(json.dumps(menu,ensure_ascii=False))
  b['outlet_menu_set_id' if kind=='outlet_page' else 'reference_menu_set_id']=setid
  b['menu_status']='outlet_page_observed' if kind=='outlet_page' else 'brand_reference_only'
  items=[]
  for name,price,source in menu:
   items.append(dict(external_id='sd-menu-'+ident(setid+name),brand=brand,name=name,menu_category=None,portion=None,price_inr=price,is_veg=None,veg_evidence='Dietary preparation and ingredients not established by this observation',source_url=source,price_scope='Published on selected outlet menu page' if kind=='outlet_page' else 'Official brand catalog; outlet price unconfirmed',branch_availability='published_on_outlet_page' if kind=='outlet_page' else 'not_confirmed',tax_included=None,retrieved_on=CHECKED,recommendation_eligible=False,publish_ready=False))
  menus[setid]=dict(brand=brand,kind=kind,items=items)
 businesses.append(b)

worldmenu=[(n,None,'https://www.kunafaworld.com/index.php') for n in ['Classic Caramel Kunafa','Classic Cream Kunafa','Classic Nutella Kunafa','Classic Nutty Kunafa','Crunchy Caramel Kunafa','Crunchy Chefs Feast Kunafa','Crunchy Cheese Kunafa','Nutella Cone Kunafa']]
text=args.world_source.read_text();lines=[re.sub(r'^L\d+: ?','',s) for s in text.splitlines() if re.match(r'^L\d+:',s)]
cards=[]
for i,s in enumerate(lines):
 if s.startswith('#### '):
  label=re.sub(r'【\d+†([^†】]+)(?:†[^】]+)?】',r'\1',s[5:]);phone=re.search(r'(?:\+91\s*)?\d[\d\s/]+$',label)
  phone=phone.group().strip() if phone else None
  name=label[:label.rfind(phone)].strip() if phone else label.strip()
  end=next((j for j in range(i+1,len(lines)) if lines[j].startswith('#### ') or lines[j].startswith('### Contact')),len(lines))
  address=' '.join(x.strip() for x in lines[i+1:end] if x.strip()).replace('16^{th}','16th')
  cards.append((name,phone,address))
worldgoogle={'Jakkur, Bengaluru':'https://goo.gl/maps/g1BuAhQgP5r7xaKU9','Hilltop Arena Food Court, Kasaragod':'https://g.page/kunafa-world-kasaragod?share=','Kandivali West, Mumbai':'https://goo.gl/maps/CVutHj433yGsTRd68','Oshiwara,Mumbai':'https://maps.app.goo.gl/n22MHRAgLUh8e4k1A'}
for name,phone,address in cards:
 city=name.split(',')[-1].strip() if ',' in name else name
 city={'Calicut':'Kozhikode','Mysuru':'Mysuru'}.get(city,city)
 state=next((s for s in ['Karnataka','Kerala','Maharashtra','Chhattisgarh','Telangana'] if s in address),None)
 if not state and city in ['Mumbai','Pune']:state='Maharashtra'
 add('Kunafa World',name,city,state,address,phone,'https://www.kunafaworld.com/store_locator.php',worldgoogle.get(name),worldmenu,note='Official locator outlet and brand-level kunafa reference. Branch menu, prices and availability remain unconfirmed. Published address retained; source postal-code errors are not corrected by guessing.')

# Addresses and Google links published on the official Kunafa Bytes locator.
bytesrows=[
 ('Kothrud','Pune','Maharashtra','Shop no 12, Kunafa Bytes, Karishma Society, near Kasat Sadi shop, Kothrud Industrial Area, Kothrud, Pune, Maharashtra 411038','+91 98909 46848','https://share.google/ZPUo4CyRhPl6HBF1W'),
 ('Viman Nagar','Pune','Maharashtra','shop no 9, Konark Arcade, Viman Nagar Rd, near dutta mandir chowk, Sakore Nagar, Viman Nagar, Pune, Maharashtra 411014','+91 88560 47691','https://share.google/d5u42Kv5NrDVDrcED'),
 ('Salunke Vihar','Pune','Maharashtra','Shop no 3, Mohit Nanak Highlands society, Kondhwa, Pune, Maharashtra 411048','+91 91584 40752','https://maps.app.goo.gl/AaZSHZMTqm7BbcyDA'),
 ('Vijay Nagar','Indore','Madhya Pradesh','2A, Scheme No 78 – III, near The Hub, Scheme Number 78, Vijay Nagar, Part II, Scheme 78, Vijay Nagar, Indore, Madhya Pradesh 452010','+91 96854 49228','https://share.google/c5C2jfYuchT79fbX8'),
 ('Tower Square','Indore','Madhya Pradesh','968, near fly Collection, Tower Chouraha, Khatiwala Tank, Indore, Madhya Pradesh 452001','+91 81034 52391','https://share.google/OTSvwCCxZ0mmZ6bCA'),
 ('New Fatehpura','Udaipur','Rajasthan','Shop no. G-2, Phoenix Lifestyle, New Fatehpura, Panchwati, Udaipur, Rajasthan 313004','+91 74249 99007','https://share.google/l6xb2w0M74FIczXh0'),
 ('Vesu','Surat','Gujarat','Shop A/10 and B/10, Aagam Vivianna, opp. Phoenix Tower, Vesu, Surat, Gujarat 395007','+91 78599 11553','https://share.google/Lqw7M7g6boE3yxsH7'),
 ('College Road','Nashik','Maharashtra','College Rd, Lasalgaon, D’souza Colony, Nashik, Maharashtra 422005','+91 80901 30591','https://share.google/sHMhHGT4TAWWj9uaU'),
 ('Mazgaon','Mumbai','Maharashtra','shop no.11, Shreepati Cornet, Tarwadi, Tadwadi, Mazgaon, Mumbai, Maharashtra 400010','+91 91674 01868','https://share.google/kMX9zBLDnTOV2R3nR'),
 ('Chabb Talav','Dahod','Gujarat','Shop-12, Chabb Talav Food Court, opp. Saifee Hospital, Wanzawad, Govindnagar, Dahod, Gujarat 389151','+91 96953 52750','https://share.google/TLNne07NtfkjCnbtI'),
 ('Alkapuri','Vadodara','Gujarat','29-B, opp. M.K high School, Complex, Nutan Bharat Society, Alkapuri, Vadodara, Gujarat 390007','+91 95743 62494','https://share.google/rXVbYvrxMgvua9KhX'),
 ('Nehru Nagar','Belagavi','Karnataka','Seabird Tourists Office, Nehru Nagar, Belagavi, Karnataka 590016','+91 99029 98501','https://share.google/fnN2UCq1EcwD6FYL4'),
 ('Stone Chariot','Hosapete','Karnataka','Shop No1, Stone Chariot, near Trends, Hosapete, Karnataka 583201','+91 99025 05165','https://share.google/gvCKiAVS9WF1lC9fi'),
 ('Jayanagar','Bengaluru','Karnataka','40/1 (176)38th cross, 9th Main Rd, 5th Block, Jayanagar, Bengaluru, Karnataka 560041','+91 62827 24797','https://share.google/hsZvpj4VnpqTAVPDZ'),
 ('Cannought Garden, Cidco','Aurangabad','Maharashtra','Kunafa Bytes, opp. Starbucks, Cannought Garden, Place, Cidco, Chhatrapati Sambhajinagar, Maharashtra 431003','+91 95799 66233','https://share.google/0Yx9onbTAnI2k3G0M'),
 ('South Bopal','Ahmedabad','Gujarat','Gala Gymkhana Rd, Chittavan, South Bopal, Bopal, Ahmedabad, Gujarat 380058','+91 63524 09251','https://share.google/sGngE1OYETgDX2pqe'),
 ('Thaltej','Ahmedabad','Gujarat','Shop No 16, Ground Floor, Maple Trade, Sal Hospital Rd, near Surdhara Circle, Thaltej, Ahmedabad, Gujarat 380059','+91 63676 15879','https://share.google/a1sCzLzwyFhcTmsUt')]
for locality,city,state,address,phone,google in bytesrows:
 add('Kunafa Bytes',locality,city,state,address,phone,'https://kunafabytes.com/store-locator/',google,[('Kunafa Chocolate',None,'https://kunafabytes.com/store-locator/')],note='Official outlet address with a Google listing link published by the business. Kunafa Chocolate is a brand catalog reference; branch stock and prices remain unconfirmed.')

cafemenu=[('French Fries — Peri Peri',200),('Lazy Bazy Nachos',320),('Garlic Bread',220),('Kimchi Noodle',270),('Exotic Garlic Bread',320),('Super Spicy Noodle',270),('Butter Croissant',180),('Shin Ramyun Noodle Soup',270),('Chocolate Croissant',260),('Nutella Croissant',290),('Avocado Toast',350),('Cream Cheese Avocado',320),('Cottage Cream Cheese Croissant',290),('Creamy Veggie Croissant Sandwich',350),('Very Berries Bowl',320),('Cocoa Nutty Bowl',320),('Walnut Brownie',240),('Mango Bliss Bowl',320),('New York Cheesecake',290),('Power Bowl',360),('Biscoff Cheesecake',310),('Nutella Cheesecake',310),('Fudge Brownie',320),('Focaccia Club',350),('The Green Fiesta',360),('Sourdough Grilled',290)]
add('Cafe 9 Story','Mota Varachha','Surat','Gujarat','C101, Pragati IT Park, Opp. Mota Varachha, Mota Varachha, Surat, Gujarat 394105','096240 00969','https://cafe9story.com/en/menu','https://maps.app.goo.gl/3gvEkp5thbaZhgoLA',[(n,price,'https://cafe9story.com/en/menu') for n,price in cafemenu],kind='outlet_page',note='Single-location official menu with published food prices. Confirm stock, taxes and dietary preparation with the cafe.')
businesses[-1]['opening_hours']='Open daily · 10:00 AM – 11:55 PM'
scope={'brand_counts':dict(collections.Counter(b['brand'] for b in businesses)),'google_links_published':sum(bool(b['google_maps_url']) for b in businesses),'google_reviews_imported':False,'complete_top_100_dish_mapping':False,'excluded_records':[{'brand':'Kunafa Bytes','locality':'Adajan','reason':'Address repeats South Bopal Ahmedabad and conflicts with branch label; withheld'},{'brand':'KBites','reason':'Only head-office address established; not a food outlet'}],'coverage_limits':['Official-source outlet additions for three brands; remaining top-100 dish associations pending','Google links are business-published, not independently checked listing data','Only Cafe 9 Story has a checked branch menu; chain menus are brand references','No ratings, live inventory, prices or coordinates inferred']}
out={'batch_id':'viral-food-outlets-2026-10-05','retrieved_on':CHECKED,'businesses':businesses,'menu_items':[],'menu_sets':menus,'research_scope':scope}
args.output.write_bytes(gzip.compress(json.dumps(out,ensure_ascii=False,separators=(',',':')).encode(),mtime=0))
print(json.dumps({'businesses':len(businesses),'menu_entries':sum(len(m['items']) for m in menus.values()),**scope}))
