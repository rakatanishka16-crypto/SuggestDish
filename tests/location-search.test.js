const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

function serverHarness({ rows = [], cityRows = [{ city: 'Mumbai' }], fetchImpl, env = {}, aiReply } = {}) {
  const routes = new Map();
  const queries = [];
  const app = { use() {}, post() {}, get(route, handler) { routes.set(route, handler); }, listen() {} };
  const express = () => app;
  express.json = () => () => {};
  express.raw = () => () => {};
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    queries.push({ query, values });
    return query.includes('SELECT DISTINCT city') ? cityRows : rows;
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'api/server.js'), 'utf8'), {
    require(name) {
      // Middleware has its own HTTP integration tests; this harness exercises route data flow.
      if (name === '../lib/menu-preference-evidence') return require('../lib/menu-preference-evidence');
      if (name === '../lib/launch-security') return () => {};
      if (name === '../lib/operational-errors') return require('../lib/operational-errors');
      if (name === '../lib/razorpay-payments') return require('../lib/razorpay-payments');
      if (name === '../lib/dish-events') return require('../lib/dish-events');
      if (name === '../lib/business-media') return require('../lib/business-media');
      if (name === '../lib/customer-feedback') return require('../lib/customer-feedback');
      if (name === '../lib/dish-photos') return require('../lib/dish-photos');
      if (name === '../lib/star-evidence') return require('../lib/star-evidence');
      if (name === '../lib/business-stars') return require('../lib/business-stars');
      if (name === '../lib/business-directory') return require('../lib/business-directory');
      if (name === '../lib/recommendation-coverage') return require('../lib/recommendation-coverage');
      if (name === '../lib/featured-dishes') return require('../lib/featured-dishes');
      if (name === '../lib/catalogue-import') return require('../lib/catalogue-import');
      if (name === '../lib/source-catalog') return require('../lib/source-catalog');
      if (name === '../lib/business-review') return require('../lib/business-review');
      if (name === '../lib/business-listings') return require('../lib/business-listings');
      if (name === 'dotenv') return { config() {} };
      if (name === 'express') return express;
      if (name === 'cors') return () => () => {};
      if (name === '@neondatabase/serverless') return { neon: () => sql };
      if (name === '@google/genai') return { GoogleGenAI: class { constructor() { if (aiReply) this.models = { generateContent: async params => ({ text: JSON.stringify(await aiReply(params)) }) }; } } };
      throw new Error(name);
    },
    module: { exports: {} }, process: { env: { VERCEL: '1', ...env } }, console,
    URLSearchParams, AbortSignal, fetch: fetchImpl
  });
  return { queries, async request(route, query) {
    let body;
    let status = 200;
    const res = { status(code) { status = code; return res; }, json(value) { body = value; return res; } };
    await routes.get(route)({ query }, res);
    return { body, status };
  } };
}

test('typed city resolves from production records without an external geocoder', async () => {
  const h = serverHarness();
  const { body, status } = await h.request('/api/location-search', { q: ' Mumbai ' });
  assert.equal(status, 200);
  assert.equal(body.city, 'Mumbai');
  assert.equal(body.latitude, null);
  assert.equal(h.queries[0].values[0], 'Mumbai');
});

test('city filter and budget are bound to SQL rather than interpolated into text', async () => {
  const h = serverHarness();
  const { body } = await h.request('/api/ai-recommend', { city: 'Mumbai', budget: '200', vegetarian: 'true' });
  assert.deepEqual(h.queries[0].values, [200, 'Mumbai', 'Mumbai']);
  assert.match(h.queries[0].query, /LOWER\(TRIM\(r.city\)\)/);
  assert.equal(body.recommendations.length, 0);
  assert.match(body.summary, /Mumbai/);
});

test('Mumbai database fallback preserves real price and vegetarian flag', async () => {
  const h = serverHarness({ rows: [{ id: 1, name: 'BBQ Paneer Pizza', price: 448, isVeg: true, restaurantName: "Pop Tate's - Time Square", restaurantCity: 'Mumbai', restaurantAddress: 'Marol', latitude: 19.108, longitude: 72.8837 }] });
  const { body } = await h.request('/api/ai-recommend', { city: 'Mumbai', budget: '500', vegetarian: 'true' });
  assert.equal(body.source, 'database');
  assert.equal(body.recommendations[0].city, 'Mumbai');
  assert.equal(body.recommendations[0].price, 448);
  assert.equal(body.recommendations[0].vegetarian, true);
});

test('unresolved area produces a useful error and does not pretend to be a location', async () => {
  const h = serverHarness({ cityRows: [], env: { GEOAPIFY_KEY: 'test' }, fetchImpl: async () => ({ ok: true, json: async () => ({ features: [] }) }) });
  const { status, body } = await h.request('/api/location-search', { q: 'unknown area' });
  assert.equal(status, 404);
  assert.equal(body.success, false);
});

test('area search uses Indian geocoding and returns real coordinates', async () => {
  let url;
  const h = serverHarness({ cityRows: [], env: { GEOAPIFY_KEY: 'test' }, fetchImpl: async value => {
    url = new URL(value);
    return { ok: true, json: async () => ({ features: [{ properties: { lat: 19.06, lon: 72.83, formatted: 'Bandra West, Mumbai' } }] }) };
  } });
  const { body } = await h.request('/api/location-search', { q: 'Bandra West, Mumbai' });
  assert.equal(url.searchParams.get('filter'), 'countrycode:in');
  assert.equal(body.latitude, 19.06);
  assert.equal(body.longitude, 72.83);
  assert.equal(body.city, null);
});

function frontendHarness(fetchOverride) {
  const elements = new Map();
  const calls = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { style: {}, children: [], replaceChildren() { this.children = []; }, append(child) { this.children.push(child); }, value: 'any', checked: true, addEventListener(event, fn) { this[event] = fn; } });
    return elements.get(id);
  };
  element('aiBudget').value = '500';
  element('locationQuery').value = '';
  let locationChoice = 'Mumbai';
  let geolocationSuccess;
  const document = {
    addEventListener(event, fn) { fn(); }, getElementById(id) { return id==='menuCoverage' ? null : element(id); }, querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return { style: {}, dataset: {}, children: [], replaceChildren() { this.children = []; }, append(child) { this.children.push(child); }, setAttribute() {}, remove() {} }; }, body: { appendChild() {} }
  };
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, {
    document, window: { location: { hostname: 'www.suggestdish.com' } }, console: { log() {}, error() {} },
    prompt: () => locationChoice, URL, URLSearchParams, AbortSignal, setTimeout() {}, navigator: { geolocation: { getCurrentPosition(fn) { geolocationSuccess = fn; } } },
    fetch: async (url,options) => {
      calls.push(url);
      if(fetchOverride)return fetchOverride(url,options);
      return { ok: true, json: async () => url.includes('location-search')
        ? { success: true, city: 'Mumbai', label: 'Mumbai', latitude: null, longitude: null }
        : { success: true, recommendations: [{ dishName: 'BBQ Paneer Pizza', restaurant: "Pop Tate's - Time Square" }, { dishName: '<script>dish</script>', restaurant: 'Second restaurant', price: 200, vegetarian: true }, { dishName: 'Third dish', restaurant: 'Third restaurant' }], source: 'database' } };
    }
  });
  return { element, calls, setLocation(value) { locationChoice = value; element("locationQuery").value = value; }, enableGPS() { geolocationSuccess({ coords: { latitude: 19.07, longitude: 72.88 } }); } };
}

test('Enter Location Mumbai reaches recommendation request and displays its result', async () => {
  const h = frontendHarness();
  h.setLocation("Mumbai");
  await h.element('enterLocation').click();
  await h.element('aiRecommendBtn').click();
  const params = new URL(h.calls[1], 'https://www.suggestdish.com').searchParams;
  assert.equal(params.get('city'), 'Mumbai');
  assert.equal(params.has('lat'), false);
  assert.equal(h.element('aiDishName').textContent, 'BBQ Paneer Pizza');
  assert.equal(h.element('aiResult').style.display, 'block');
});

test('GPS selection replaces a previous typed city', async () => {
  const h = frontendHarness();
  h.setLocation("Mumbai");
  await h.element('enterLocation').click();
  h.element('enableLocation').click();
  h.enableGPS();
  await h.element('aiRecommendBtn').click();
  const params = new URL(h.calls[1], 'https://www.suggestdish.com').searchParams;
  assert.equal(params.has('city'), false);
  assert.equal(params.get('lat'), '19.07');
  assert.equal(params.get('lon'), '72.88');
});


test('all three returned recommendations render as text without interpreting markup', async () => {
  const h = frontendHarness(); await h.element('aiRecommendBtn').click();
  const extra=h.element('aiMoreRecommendations');
  assert.equal(extra.style.display,'block'); assert.equal(extra.children.length,2);
  assert.equal(extra.children[0].children[0].textContent,'<script>dish</script>');
});

test('South Indian fallback ranks source-backed paniyaram above unrelated cheaper food', async () => {
  const base={isVeg:true,restaurantCity:'Mumbai',restaurantAddress:'Mumbai',latitude:null,longitude:null};
  const h=serverHarness({rows:[{...base,id:1,name:'Modak with Ghee',price:49,restaurantId:1,restaurantName:'Maharashtra kitchen'},{...base,id:2,name:'Masala Paniyaram',price:130,restaurantId:2,restaurantName:'A Petal and Paniyaram',starConfirmed:true,starOrigin:'published_menu',popularityBasis:'signature',starSourceUrl:'https://www.petalandpaniyaram.in/menu/'}]});
  const {body}=await h.request('/api/ai-recommend',{city:'Mumbai',cuisine:'South Indian',budget:'180',vegetarian:'true'});
  assert.equal(body.recommendations[0].dishName,'Masala Paniyaram');
  assert.equal(body.recommendations[0].starOrigin,'published_menu');
  assert.equal(body.recommendations.length,1);
  assert.match(body.recommendations[0].reason,/Restaurant-listed signature/);
});

test('South Indian search does not label vada pav as South Indian or pad empty results',async()=>{
  const h=serverHarness({rows:[{id:1,name:'Vada Pav - Single Piece',price:65,isVeg:true,restaurantId:1,restaurantName:'Thepla House',restaurantCity:'Mumbai',restaurantAddress:'Mumbai',latitude:null,longitude:null}]});
  const {body}=await h.request('/api/ai-recommend',{city:'Mumbai',cuisine:'South Indian',budget:'200',vegetarian:'true'});
  assert.equal(body.recommendations.length,0);assert.match(body.summary,/No available dishes match that cuisine/);
});

test('breakfast and custom dish preferences affect fallback ranking', async()=>{
 const base={isVeg:true,restaurantCity:'Mumbai',restaurantAddress:'Mumbai'};
 const h=serverHarness({rows:[{...base,id:1,name:'Dal Curry',price:50,restaurantId:1,restaurantName:'One'},{...base,id:2,name:'Poha',price:80,restaurantId:2,restaurantName:'Two'}]});
 const {body}=await h.request('/api/ai-recommend',{city:'Mumbai',mood:'breakfast',customPreferences:'poha please',budget:'200',vegetarian:'true'});
 assert.equal(body.recommendations[0].dishName,'Poha');
 assert.equal(body.preferences.customPreferences,'poha please');
 assert.equal((await h.request('/api/ai-recommend',{customPreferences:'x'.repeat(501)})).status,400);
});
test('custom text and breakfast travel from the form to the API',async()=>{
 const h=frontendHarness();h.element('aiMood').value='breakfast';h.element('aiCustomPreferences').value='poha & chutney';
 await h.element('aiRecommendBtn').click();
 const params=new URL(h.calls[0],'https://www.suggestdish.com').searchParams;
 assert.equal(params.get('mood'),'breakfast');assert.equal(params.get('customPreferences'),'poha & chutney');
});

 test('nonvegetarian filter never substitutes vegetarian dishes',async()=>{const h=serverHarness({rows:[{id:1,name:'Veg Sandwich',price:100,isVeg:true,restaurantName:'Veg Place',restaurantCity:'Mumbai'},{id:2,name:'Chicken Sandwich',price:150,isVeg:false,restaurantName:'Chicken Place',restaurantCity:'Mumbai'}]});const {body}=await h.request('/api/ai-recommend',{diet:'nonvegetarian',budget:'200'});assert.equal(body.recommendations.length,1);assert.equal(body.recommendations[0].vegetarian,false);});
 test('distance filter validates radius and excludes far restaurants',async()=>{const h=serverHarness({rows:[{id:1,name:'Sandwich',price:100,isVeg:true,restaurantName:'Far Place',latitude:20,longitude:73}]});assert.equal((await h.request('/api/ai-recommend',{radiusKm:'bad'})).status,400);const {body}=await h.request('/api/ai-recommend',{lat:'19',lon:'72',radiusKm:'2',budget:'200'});assert.equal(body.recommendations.length,0);});
test('paid or owner star slots cannot bypass diet, budget or distance constraints',async()=>{const shared={starConfirmed:true,starOrigin:'owner_claim',restaurantCity:'Mumbai'};for(const scenario of [{row:{...shared,id:1,name:'Chicken Burger',price:150,isVeg:false,restaurantName:'Non Veg'},query:{diet:'vegetarian',budget:'200'}},{row:{...shared,id:2,name:'Paneer Burger',price:500,isVeg:true,restaurantName:'Over Budget'},query:{diet:'vegetarian',budget:'200'}},{row:{...shared,id:3,name:'Paneer Burger',price:150,isVeg:true,restaurantName:'Far Away',latitude:20,longitude:73},query:{diet:'vegetarian',budget:'200',lat:'19',lon:'72',radiusKm:'2'}}]){const {body}=await serverHarness({rows:[scenario.row]}).request('/api/ai-recommend',scenario.query);assert.equal(body.recommendations.length,0);}});
test('star evidence is not presented as sponsored placement',async()=>{const row={id:1,name:'Paneer Burger',price:150,isVeg:true,restaurantName:'A',restaurantCity:'Mumbai',starConfirmed:true,starOrigin:'owner_claim'};const {body}=await serverHarness({rows:[row]}).request('/api/ai-recommend',{diet:'vegetarian',budget:'200'});assert.equal(body.recommendations[0].starConfirmed,true);assert.equal(body.recommendations[0].sponsored,undefined);});

test('specific sandwich request never substitutes biryani',async()=>{const h=serverHarness({rows:[{id:1,name:'Chicken Biryani',price:150,isVeg:false,restaurantName:'Restaurant',restaurantCity:'Mumbai'}]});const {body}=await h.request('/api/ai-recommend',{diet:'nonvegetarian',budget:'200',customPreferences:'chicken sandwich'});assert.equal(body.recommendations.length,0);assert.match(body.summary,/specific request/);});

test('dish refinements exclude only specified dishes and preserve diet',async()=>{const h=serverHarness({rows:[{id:1,name:'Veg Sandwich',price:100,isVeg:true,restaurantName:'A'},{id:2,name:'Veg Sandwich',price:120,isVeg:true,restaurantName:'B'}]});const {body}=await h.request('/api/ai-recommend',{diet:'vegetarian',budget:'200',excludeDishIds:'1'});assert.equal(body.recommendations.length,1);assert.equal(body.recommendations[0].dishId,2);assert.equal((await h.request('/api/ai-recommend',{excludeDishIds:'1,evil'})).status,400);});
test('golgappa alias keeps a pani puri request specific',async()=>{const h=serverHarness({rows:[{id:1,name:'Pani Puri',price:80,isVeg:true,restaurantName:'A'},{id:2,name:'Veg Sandwich',price:90,isVeg:true,restaurantName:'B'}]});const {body}=await h.request('/api/ai-recommend',{diet:'vegetarian',budget:'200',customPreferences:'golgappa'});assert.equal(body.recommendations.length,1);assert.equal(body.recommendations[0].dishName,'Pani Puri');});

test('natural budget and veg request constrain any-diet results',async()=>{const h=serverHarness({rows:[{id:1,name:'Veg Sandwich',price:100,isVeg:true,restaurantName:'A'},{id:2,name:'Chicken Sandwich',price:100,isVeg:false,restaurantName:'B'},{id:3,name:'Veg Sandwich',price:180,isVeg:true,restaurantName:'C'}]});const {body}=await h.request('/api/ai-recommend',{diet:'any',budget:'300',customPreferences:'veg sandwich under 150'});assert.equal(body.recommendations.length,1);assert.equal(body.recommendations[0].dishId,1);});

test('Jain and vegan requests never infer preparation from vegetarian status',async()=>{const h=serverHarness({rows:[{id:1,name:'Pav Bhaji',price:100,isVeg:true,restaurantName:'A'}]});for(const query of [{diet:'jain'},{diet:'vegan'},{diet:'vegetarian',customPreferences:'jain pav bhaji'}]){const {body}=await h.request('/api/ai-recommend',query);assert.equal(body.recommendations.length,0);assert.match(body.summary,/Verified ingredient/);}});

test('health endpoint confirms server reachability without exposing configuration',async()=>{const h=serverHarness();const {status,body}=await h.request('/api/health',{});assert.equal(status,200);assert.equal(body.success,true);assert.equal(body.status,'ok');assert.equal(Object.keys(body).length,2);});
test('blank, repeated and incomplete coordinate inputs never turn into a zero location',async()=>{for(const query of [{lat:' ',lon:'72'},{lat:['19'],lon:'72'},{lat:'19',lon:['72']},{lat:'19'},{lat:'',lon:''}]){const h=serverHarness();const r=await h.request('/api/ai-recommend',query);assert.equal(r.status,400);assert.equal(h.queries.length,0);}});
test('fallback recommends one eligible dish and refinement advances to the next',async()=>{const h=serverHarness({rows:[{id:1,name:'Poha',price:60,isVeg:true,restaurantName:'A',restaurantCity:'Jalna'},{id:2,name:'Poha',price:80,isVeg:true,restaurantName:'B',restaurantCity:'Jalna'}]});const first=await h.request('/api/ai-recommend',{city:'Jalna',diet:'vegetarian',budget:'100'});assert.equal(first.body.recommendations.length,1);assert.equal(first.body.recommendations[0].dishId,1);assert.doesNotMatch(first.body.summary,/available dishes/);const next=await h.request('/api/ai-recommend',{city:'Jalna',diet:'vegetarian',budget:'100',excludeDishIds:'1'});assert.equal(next.body.recommendations.length,1);assert.equal(next.body.recommendations[0].dishId,2);});


test('timed-out recommendation releases loading and allows retry without changing preferences', async () => {
 const h=frontendHarness(async(url,options)=>{assert.ok(options.signal);throw Object.assign(new Error('timed out'),{name:'TimeoutError'});});
 const before=h.element('aiDiet').value;
 await h.element('aiRecommendBtn').click();
 assert.equal(h.element('aiRecommendBtn').disabled,false);
 assert.equal(h.element('aiLoading').style.display,'none');
 assert.match(h.element('aiErrorText').textContent,/Please try again; your preferences are unchanged/);
 assert.equal(h.element('aiDiet').value,before);
 await h.element('aiRecommendBtn').click();assert.equal(h.calls.length,2);
});
test('timed-out location search releases the location button and can be retried', async () => {
 const h=frontendHarness(async(url,options)=>{assert.ok(options.signal);throw Object.assign(new Error('timed out'),{name:'TimeoutError'});});
 h.setLocation('Mumbai');
 await h.element('enterLocation').click();assert.equal(h.element('enterLocation').disabled,false);
 await h.element('enterLocation').click();assert.equal(h.calls.length,2);
});

test('Jalna breakfast without a specific craving uses existing idli data',async()=>{
 const base={isVeg:true,restaurantCity:'Jalna'};
 const h=serverHarness({rows:[{...base,id:1,name:'Paneer Curry',price:100,restaurantName:'A'},{...base,id:2,name:'2 Idli With Sambar',price:90,restaurantName:'B'}]});
 const {body}=await h.request('/api/ai-recommend',{city:'Jalna',mood:'breakfast',budget:'200',diet:'vegetarian',customPreferences:''});
 assert.equal(body.recommendations[0].dishName,'2 Idli With Sambar');
});
test('specific misal and upma requests do not substitute idli',async()=>{
 for(const dish of ['misal','upma']){
  const h=serverHarness({rows:[{id:1,name:'2 Idli With Sambar',price:90,isVeg:true,restaurantName:'A',restaurantCity:'Jalna'}]});
  const {body}=await h.request('/api/ai-recommend',{city:'Jalna',mood:'breakfast',customPreferences:dish,budget:'200',diet:'vegetarian'});
  assert.equal(body.recommendations.length,0);
 }
});
test('breakfast vocabulary ranks a priced upma over unrelated curry',async()=>{
 const base={isVeg:true,restaurantCity:'Jalna'};
 const h=serverHarness({rows:[{...base,id:1,name:'Paneer Curry',price:40,restaurantName:'A'},{...base,id:2,name:'Upma',price:70,restaurantName:'B'}]});
 const {body}=await h.request('/api/ai-recommend',{city:'Jalna',mood:'breakfast',budget:'200',diet:'vegetarian'});
 assert.equal(body.recommendations[0].dishName,'Upma');
});
test('breakfast cannot substitute an unrelated main course when coverage is empty',async()=>{
 const h=serverHarness({rows:[{id:1,name:'Paneer Curry',price:90,isVeg:true,restaurantName:'A',restaurantCity:'Jalna'}]});
 const {body}=await h.request('/api/ai-recommend',{city:'Jalna',mood:'breakfast',budget:'200',diet:'vegetarian'});
 assert.equal(body.recommendations.length,0);assert.match(body.summary,/breakfast menu coverage/i);
});

test('sweet search excludes savoury rice bowls even at a nearby dessert-named outlet', async () => {
  const base={isVeg:true,restaurantCity:'Mumbai',latitude:19.2,longitude:72.85};
  const h=serverHarness({rows:[
    {...base,id:1,name:'Rajma Rice Bowl',price:80,restaurantName:'Chocolate Dessert Kitchen',restaurantAddress:'Sweet Mango Road'},
    {...base,id:2,name:'Mango Rice Bowl',price:90,restaurantName:'B'},
    {...base,id:3,name:'Gulab Jamun',price:120,restaurantName:'C'}
  ]});
  const {body}=await h.request('/api/ai-recommend',{city:'Mumbai',taste:'sweet',budget:'200',diet:'vegetarian',lat:'19.2',lon:'72.85',radiusKm:'5'});
  assert.equal(body.recommendations[0].dishName,'Gulab Jamun');
});

test('sweet search returns empty rather than savoury or ambiguous replacements', async () => {
  for(const name of ['Rajma Rice Bowl','Sweet Corn Soup','Sweet Potato Fries','Mango Salad','Rice Bowl + Gulab Jamun Combo','Chocolate Pizza','Paneer Waffle']){
    const h=serverHarness({rows:[{id:1,name,price:80,isVeg:true,restaurantName:'Chocolate Dessert Kitchen'}]});
    const {body}=await h.request('/api/ai-recommend',{taste:'sweet',budget:'200'});
    assert.equal(body.recommendations.length,0,name);
    assert.match(body.summary,/No named sweet dishes/);
  }
});

test('sweet filter preserves budget, diet and dish refinement exclusions', async () => {
  const h=serverHarness({rows:[
    {id:1,name:'Brownie',price:300,isVeg:true,restaurantName:'A'},
    {id:2,name:'Cake',price:80,isVeg:false,restaurantName:'B'},
    {id:3,name:'Kulfi',price:80,isVeg:true,restaurantName:'C'},
    {id:4,name:'Rice Bowl',price:80,isVeg:true,restaurantName:'D'}
  ]});
  const {body}=await h.request('/api/ai-recommend',{taste:'sweet',budget:'200',diet:'vegetarian',excludeDishIds:'3'});
  assert.equal(body.recommendations.length,0);
});

test('natural-language sweet request uses the same constraint and permits explicitly sweet rice', async () => {
  const h=serverHarness({rows:[
    {id:1,name:'Rice Bowl',price:80,isVeg:true,restaurantName:'A'},
    {id:2,name:'Sweet Rice',price:90,isVeg:true,restaurantName:'B'}
  ]});
  const {body}=await h.request('/api/ai-recommend',{customPreferences:'something sweet',budget:'200'});
  assert.equal(body.recommendations[0].dishName,'Sweet Rice');
});


test('sweet plus an explicit savoury rice bowl request returns no substitution', async () => {
  const h=serverHarness({rows:[
    {id:1,name:'Rajma Rice Bowl',price:150,isVeg:true,restaurantName:'A'},
    {id:2,name:'Brownie',price:150,isVeg:true,restaurantName:'B'}
  ]});
  const {body}=await h.request('/api/ai-recommend',{taste:'sweet',customPreferences:'rajma rice bowl',budget:'500'});
  assert.equal(body.recommendations.length,0);
});


const tasteCases = [
  ['spicy', 'Spicy Schezwan Noodles', ['Rice Bowl', 'Masala Idli', 'Hot Chocolate', 'Mild Chilli Paneer']],
  ['sweet', 'Gulab Jamun', ['Rice Bowl', 'Sweet Corn Soup', 'Mango Salad']],
  ['rich', 'Paneer Butter Masala', ['Plain Rice', 'Buttermilk', 'Fat Free Cream Soup']],
  ['light', 'Steamed Idli', ['Fried Idli', 'Creamy Salad', 'Cheese Sandwich', 'Rice Bowl']],
  ['tangy', 'Tangy Lemon Rice', ['Plain Rice', 'Mango Rice Bowl', 'No Lemon Soup']],
  ['crispy', 'Crispy Veg', ['Steamed Momos', 'Crispy Veg Gravy', 'Soft Crispy Roll']]
];
for (const [taste, matching, rejected] of tasteCases) {
  test(`${taste} eligibility uses dish names and rejects unrelated or contradictory dishes`, async () => {
    const base={isVeg:true,restaurantCity:'Mumbai',latitude:19.2,longitude:72.85};
    const h=serverHarness({rows:[
      ...rejected.map((name,i)=>({...base,id:i+1,name,price:40,restaurantName:`${taste} ${matching} Kitchen`,restaurantAddress:`${matching} Road`,starConfirmed:true})),
      {...base,id:100,name:matching,price:120,restaurantName:'Matching Outlet'}
    ]});
    const {body}=await h.request('/api/ai-recommend',{taste,budget:'200',diet:'vegetarian',lat:'19.2',lon:'72.85',radiusKm:'5'});
    assert.equal(body.recommendations[0].dishName,matching);
  });
  test(`${taste} returns no match when its candidates fail budget, diet, radius or refinement`, async () => {
    const base={name:matching,isVeg:true,restaurantCity:'Mumbai',latitude:19.2,longitude:72.85};
    const h=serverHarness({rows:[
      {...base,id:1,price:300,restaurantName:'Over Budget'},
      {...base,id:2,price:80,isVeg:false,restaurantName:'Wrong Diet'},
      {...base,id:3,price:80,latitude:18.9,restaurantName:'Too Far'},
      {...base,id:4,price:80,restaurantName:'Already Shown'},
      {...base,id:5,name:'Plain Rice',price:80,restaurantName:'Unrelated'}
    ]});
    const {body}=await h.request('/api/ai-recommend',{taste,budget:'200',diet:'vegetarian',lat:'19.2',lon:'72.85',radiusKm:'5',excludeDishIds:'4'});
    assert.equal(body.recommendations.length,0);
  });
}

test('taste filters constrain Gemini inputs and reject its unrelated output', async () => {
  let prompt;
  const h=serverHarness({env:{GEMINI_API_KEY:'test'},aiReply: async params=>{
    prompt=params.contents;
    return {recommendations:[{id:1,dishName:'Rice Bowl',restaurant:'A'}]};
  },rows:[
    {id:1,name:'Rice Bowl',price:80,isVeg:true,restaurantName:'A'},
    {id:2,name:'Crispy Veg',price:100,isVeg:true,restaurantName:'B'}
  ]});
  const {body}=await h.request('/api/ai-recommend',{taste:'crispy',budget:'200'});
  assert.equal(prompt.includes('Rice Bowl'),false);
  assert.ok(prompt.includes('Crispy Veg'));
  assert.equal(body.recommendations[0].dishName,'Crispy Veg');
});

test('multiple requested tastes are combined rather than silently relaxed',async()=>{
 const rows=[{id:1,name:'Spicy Noodles',price:90,isVeg:true,restaurantName:'A'},{id:2,name:'Crispy Veg',price:90,isVeg:true,restaurantName:'B'}];
 let h=serverHarness({rows});
 let {body}=await h.request('/api/ai-recommend',{taste:'spicy',customPreferences:'something crispy',budget:'200'});
 assert.equal(body.recommendations.length,0);
 h=serverHarness({rows:[...rows,{id:3,name:'Spicy Crispy Veg',price:120,isVeg:true,restaurantName:'C'}]});
 ({body}=await h.request('/api/ai-recommend',{taste:'spicy',customPreferences:'something crispy',budget:'200'}));
 assert.equal(body.recommendations[0].dishName,'Spicy Crispy Veg');
});

test('unknown taste is rejected before querying and Anything retains unrestricted discovery',async()=>{
 const h=serverHarness({rows:[{id:1,name:'Rice Bowl',price:80,isVeg:true,restaurantName:'A'}]});
 assert.equal((await h.request('/api/ai-recommend',{taste:'unknown'})).status,400);
 assert.equal(h.queries.length,0);
 const {body}=await h.request('/api/ai-recommend',{taste:'any',budget:'200'});
 assert.equal(body.recommendations[0].dishName,'Rice Bowl');
});

const moodCases = [
  ['breakfast', 'Idli Sambar', 'Paneer Butter Masala'],
  ['brunch', 'Poha', 'Dal Tadka'],
  ['lunch', 'Dal Tadka', 'Chocolate Brownie'],
  ['dinner', 'Paneer Butter Masala', 'Paneer Puff'],
  ['quick meal', 'Veg Wrap', 'Veg Biryani'],
  ['comfort food', 'Dal Khichdi', 'Mineral Water'],
  ['date night', 'Alfredo Pasta', 'Plain Rice'],
  ['family meal', 'Veg Thali', 'Paneer Puff'],
  ['friends outing', 'Veg Momos', 'Plain Roti'],
  ['snack', 'Samosa', 'Dal Tadka'],
  ['celebration', 'Chocolate Cake', 'Extra Cheese']
];
for (const [mood, matching, unrelated] of moodCases) {
  test(`${mood} filters by dish type rather than outlet name, price or proximity`, async () => {
    const base={isVeg:true,restaurantCity:'Mumbai',latitude:19.2,longitude:72.85};
    const h=serverHarness({rows:[
      {...base,id:1,name:unrelated,price:20,starConfirmed:true,restaurantName:`${mood} ${matching} Kitchen`,restaurantAddress:`${matching} Road`},
      {...base,id:2,name:matching,price:150,restaurantName:'Matching Outlet'}
    ]});
    const {body}=await h.request('/api/ai-recommend',{mood,budget:'200',diet:'vegetarian',lat:'19.2',lon:'72.85',radiusKm:'5'});
    assert.equal(body.recommendations[0].dishName,matching);
    assert.match(body.recommendations[0].reason,/Occasion match uses the menu dish type/);
  });
  test(`${mood} preserves budget, diet, distance and refinement instead of padding results`, async () => {
    const base={name:matching,isVeg:true,restaurantCity:'Mumbai',latitude:19.2,longitude:72.85};
    const h=serverHarness({rows:[
      {...base,id:1,price:300,restaurantName:'Over Budget'},
      {...base,id:2,price:80,isVeg:false,restaurantName:'Wrong Diet'},
      {...base,id:3,price:80,latitude:18.9,restaurantName:'Too Far'},
      {...base,id:4,price:80,restaurantName:'Already Shown'},
      {...base,id:5,name:'Mineral Water',price:10,restaurantName:'Unrelated'}
    ]});
    const {body}=await h.request('/api/ai-recommend',{mood,budget:'200',diet:'vegetarian',lat:'19.2',lon:'72.85',radiusKm:'5',excludeDishIds:'4'});
    assert.equal(body.recommendations.length,0);
  });
}

test('every displayed mood has a tested rule; Any occasion stays unrestricted', async () => {
  const block=fs.readFileSync(path.join(root, "index.html"), "utf8").match(/<select id="aiMood"[\s\S]*?<\/select>/)[0];
  const values=[...block.matchAll(/value="([^"]+)"/g)].map(m=>m[1]).filter(v=>v!=='any');
  assert.deepEqual(values,moodCases.map(c=>c[0]));
  const h=serverHarness({rows:[{id:1,name:'Plain Rice',price:80,isVeg:true,restaurantName:'A'}]});
  const {body}=await h.request('/api/ai-recommend',{mood:'any',budget:'200'});
  assert.equal(body.recommendations[0].dishName,'Plain Rice');
});

test('mood and taste plus an explicit dish request are intersected', async () => {
  const rows=[
    {id:1,name:'Idli Sambar',price:90,isVeg:true,restaurantName:'A'},
    {id:2,name:'Gulab Jamun',price:90,isVeg:true,restaurantName:'B'},
    {id:3,name:'Sheera',price:90,isVeg:true,restaurantName:'C'}
  ];
  const h=serverHarness({rows});
  let result=await h.request('/api/ai-recommend',{mood:'breakfast',taste:'sweet',budget:'200'});
  assert.equal(result.body.recommendations[0].dishName,'Sheera');
  result=await h.request('/api/ai-recommend',{mood:'breakfast',taste:'sweet',customPreferences:'idli',budget:'200'});
  assert.equal(result.body.recommendations.length,0);
});

test('Gemini cannot restore a dish rejected by the mood filter', async () => {
  let prompt;
  const h=serverHarness({env:{GEMINI_API_KEY:'test'},aiReply: async params=>{
    prompt=params.contents;
    return {recommendations:[{id:1,dishName:'Plain Rice',restaurant:'A'}]};
  },rows:[
    {id:1,name:'Plain Rice',price:80,isVeg:true,restaurantName:'A'},
    {id:2,name:'Chocolate Brownie',price:120,isVeg:true,restaurantName:'B'}
  ]});
  const {body}=await h.request('/api/ai-recommend',{mood:'date night',budget:'200'});
  assert.equal(prompt.includes('Plain Rice'),false);
  assert.equal(body.recommendations[0].dishName,'Chocolate Brownie');
});

test('unknown mood fails before querying, while case and the legacy comfort alias work',async()=>{
 const h=serverHarness({rows:[{id:1,name:'Dal Khichdi',price:80,isVeg:true,restaurantName:'A'}]});
 assert.equal((await h.request('/api/ai-recommend',{mood:'unknown'})).status,400);
 assert.equal(h.queries.length,0);
 for(const mood of ['Comfort Food','comfort']){
   const {body}=await h.request('/api/ai-recommend',{mood,budget:'200'});
   assert.equal(body.recommendations[0].dishName,'Dal Khichdi');
 }
});

const cuisineCases = [
  ['Indian', 'Dal Tadka', ['Classic Cheese Pizza','Plain Rice Bowl']],
  ['North Indian', 'Paneer Butter Masala', ['Paneer Pizza','Paneer Puff']],
  ['South Indian', 'Masala Idli', ['Vada Pav','Schezwan Dosa']],
  ['Maharashtrian', 'Ukadiche Modak', ['Hakka Noodles','Misal Pizza']],
  ['Chinese', 'Hakka Noodles', ['Crispy Potato','Schezwan Dosa']],
  ['Italian', 'Margherita Pizza', ['Paneer Pizza','Schezwan Pasta']],
  ['Continental', 'Grilled Vegetables', ['Plain Rice','Paneer Sandwich']]
];
for(const [cuisine,matching,rejected] of cuisineCases){
 test(`${cuisine} uses dish families, rejects clear fusion and ignores outlet/address cues`,async()=>{
  const base={isVeg:true,restaurantCity:'Mumbai'};
  const h=serverHarness({rows:[
   ...rejected.map((name,i)=>({...base,id:i+1,name,price:40,starConfirmed:true,restaurantName:`${cuisine} ${matching} Restaurant`,restaurantAddress:`${matching} Road`})),
   {...base,id:100,name:matching,price:150,restaurantName:'Matching Outlet'}
  ]});
  const {body}=await h.request('/api/ai-recommend',{cuisine,budget:'200',diet:'vegetarian'});
  assert.equal(body.recommendations[0].dishName,matching);
  assert.match(body.recommendations[0].reason,/Cuisine match uses the menu dish name or published section/);
 });
 test(`${cuisine} cannot override budget, diet, radius or refinement constraints`,async()=>{
  const base={name:matching,isVeg:true,restaurantCity:'Mumbai',latitude:19.2,longitude:72.85};
  const h=serverHarness({rows:[
   {...base,id:1,price:300,restaurantName:'Over Budget'},
   {...base,id:2,price:80,isVeg:false,restaurantName:'Wrong Diet'},
   {...base,id:3,price:80,latitude:18.9,restaurantName:'Too Far'},
   {...base,id:4,price:80,restaurantName:'Already Shown'},
   {...base,id:5,name:'Mineral Water',price:10,restaurantName:cuisine}
  ]});
  const {body}=await h.request('/api/ai-recommend',{cuisine,budget:'200',diet:'vegetarian',lat:'19.2',lon:'72.85',radiusKm:'5',excludeDishIds:'4'});
  assert.equal(body.recommendations.length,0);
 });
}

test('every displayed cuisine has a tested rule; Any cuisine remains unrestricted',async()=>{
 const block=fs.readFileSync(path.join(root,'index.html'),'utf8').match(/<select id="aiCuisine"[\s\S]*?<\/select>/)[0];
 const values=[...block.matchAll(/value="([^"]+)"/g)].map(m=>m[1]).filter(v=>v!=='any');
 assert.deepEqual(values,cuisineCases.map(c=>c[0]));
 const h=serverHarness({rows:[{id:1,name:'Mystery Rice Bowl',price:80,isVeg:true,restaurantName:'A'}]});
 const {body}=await h.request('/api/ai-recommend',{cuisine:'any',budget:'200'});
 assert.equal(body.recommendations[0].dishName,'Mystery Rice Bowl');
});

test('cuisine, taste and occasion must all match the same dish',async()=>{
 const h=serverHarness({rows:[
  {id:1,name:'Margherita Pizza',price:80,isVeg:true,restaurantName:'A'},
  {id:2,name:'Brownie',price:90,isVeg:true,restaurantName:'B'},
  {id:3,name:'Tiramisu',price:120,isVeg:true,restaurantName:'C'}
 ]});
 const {body}=await h.request('/api/ai-recommend',{cuisine:'Italian',taste:'sweet',mood:'date night',budget:'200'});
 assert.equal(body.recommendations[0].dishName,'Tiramisu');
 const other=await h.request('/api/ai-recommend',{cuisine:'Chinese',customPreferences:'idli',budget:'200'});
 assert.equal(other.body.recommendations.length,0);
});

test('Gemini receives only cuisine-eligible dishes and cannot restore a rejected one',async()=>{
 let prompt;
 const h=serverHarness({env:{GEMINI_API_KEY:'test'},aiReply:async params=>{
  prompt=params.contents;
  return {recommendations:[{id:1,dishName:'Paneer Pizza',restaurant:'A'}]};
 },rows:[
  {id:1,name:'Paneer Pizza',price:80,isVeg:true,restaurantName:'A'},
  {id:2,name:'Paneer Butter Masala',price:120,isVeg:true,restaurantName:'B'}
 ]});
 const {body}=await h.request('/api/ai-recommend',{cuisine:'North Indian',budget:'200'});
 assert.equal(prompt.includes('Paneer Pizza'),false);
 assert.equal(body.recommendations[0].dishName,'Paneer Butter Masala');
});

test('unknown cuisine fails before querying and the legacy south alias works',async()=>{
 const h=serverHarness({rows:[{id:1,name:'Idli Sambar',price:80,isVeg:true,restaurantName:'A'}]});
 assert.equal((await h.request('/api/ai-recommend',{cuisine:'unknown'})).status,400);
 assert.equal(h.queries.length,0);
 const {body}=await h.request('/api/ai-recommend',{cuisine:'south',budget:'200'});
 assert.equal(body.recommendations[0].dishName,'Idli Sambar');
});


test('different restaurant excludes all its dishes and named branches before AI selection', async () => {
 const base={isVeg:true,price:100,restaurantCity:'Jalna',latitude:null,longitude:null};
 const rows=[{...base,id:1,name:'Poha',restaurantId:11,restaurantName:'Cafe A - East'}, {...base,id:2,name:'Idli',restaurantId:11,restaurantName:'Cafe A - East'}, {...base,id:3,name:'Poha',restaurantId:12,restaurantName:'Cafe A - West'}, {...base,id:4,name:'Idli',restaurantId:13,restaurantName:'Cafe B'}, {...base,id:5,name:'Idli',price:400,restaurantId:14,restaurantName:'Cafe C'}];
 for(const aiReply of [undefined, async () => ({recommendations:[{id:2}]})]){
  const h=serverHarness({rows,aiReply,env:aiReply?{GEMINI_API_KEY:'test'}:{}});
  const {body}=await h.request('/api/ai-recommend',{city:'Jalna',diet:'vegetarian',budget:'200',mood:'breakfast',excludeRestaurantIds:'11'});
  assert.equal(body.recommendations.length,1);assert.equal(body.recommendations[0].restaurantId,13);assert.equal(body.recommendations[0].dishId,4);
 }
});
test('different restaurant returns no match rather than returning an excluded outlet',async()=>{
 const h=serverHarness({rows:[{id:1,name:'Poha',price:80,isVeg:true,restaurantId:11,restaurantName:'Cafe A'}]});
 const r=await h.request('/api/ai-recommend',{excludeRestaurantIds:'11'});
 assert.equal(r.body.recommendations.length,0);assert.match(r.body.summary,/Clear refinements/);
});
test('invalid restaurant exclusions are rejected before querying',async()=>{
 for(const value of ['', '0', '-1', '1,evil', ['1'], '9007199254740993', Array.from({length:21},(_,i)=>i+1).join(',')]){
  const h=serverHarness();const r=await h.request('/api/ai-recommend',{excludeRestaurantIds:value});assert.equal(r.status,400);assert.equal(h.queries.length,0);
 }
});
test('restaurant refinement reaches request and both reset controls clear it',async()=>{
 const h=frontendHarness(async url=>({ok:true,json:async()=>({success:true,recommendations:[{dishId:1,restaurantId:11,dishName:'Poha',restaurant:'Cafe A'}],source:'database'})}));
 await h.element('aiRecommendBtn').click();
 h.element('refineDifferent').click();await new Promise(resolve=>setImmediate(resolve));
 assert.equal(new URL(h.calls.filter(url=>url.includes('/api/ai-recommend')).at(-1),'https://www.suggestdish.com').searchParams.get('excludeRestaurantIds'),'11');
 for(const id of ['refineReset','clearEmptyRefinements']){
  h.element(id).click();await new Promise(resolve=>setImmediate(resolve));
  assert.equal(new URL(h.calls.filter(url=>url.includes('/api/ai-recommend')).at(-1),'https://www.suggestdish.com').searchParams.has('excludeRestaurantIds'),false);
 }
});
