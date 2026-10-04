const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = path.join(__dirname, '..');

function serverHarness({ rows = [], cityRows = [{ city: 'Mumbai' }], fetchImpl, env = {} } = {}) {
  const routes = new Map();
  const queries = [];
  const app = { use() {}, post() {}, get(route, handler) { routes.set(route, handler); }, listen() {} };
  const express = () => app;
  express.json = () => () => {};
  const sql = async (strings, ...values) => {
    const query = strings.join('?');
    queries.push({ query, values });
    return query.includes('SELECT DISTINCT city') ? cityRows : rows;
  };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'api/server.js'), 'utf8'), {
    require(name) {
      if (name === '../lib/razorpay-payments') return require('../lib/razorpay-payments');
      if (name === '../lib/customer-feedback') return require('../lib/customer-feedback');
      if (name === '../lib/dish-photos') return require('../lib/dish-photos');
      if (name === '../lib/star-evidence') return require('../lib/star-evidence');
      if (name === '../lib/business-stars') return require('../lib/business-stars');
      if (name === '../lib/business-directory') return require('../lib/business-directory');
      if (name === '../lib/business-review') return require('../lib/business-review');
      if (name === '../lib/business-listings') return require('../lib/business-listings');
      if (name === 'dotenv') return { config() {} };
      if (name === 'express') return express;
      if (name === 'cors') return () => () => {};
      if (name === '@neondatabase/serverless') return { neon: () => sql };
      if (name === '@google/genai') return { GoogleGenAI: class {} };
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

function frontendHarness() {
  const elements = new Map();
  const calls = [];
  const element = id => {
    if (!elements.has(id)) elements.set(id, { style: {}, children: [], replaceChildren() { this.children = []; }, append(child) { this.children.push(child); }, value: 'any', checked: true, addEventListener(event, fn) { this[event] = fn; } });
    return elements.get(id);
  };
  element('aiBudget').value = '500';
  element('locationQuery').value = 'Mumbai';
  let locationChoice = 'Mumbai';
  let geolocationSuccess;
  const document = {
    addEventListener(event, fn) { fn(); }, getElementById(id) { return id==='menuCoverage' ? null : element(id); }, querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return { style: {}, children: [], replaceChildren() { this.children = []; }, append(child) { this.children.push(child); }, setAttribute() {}, remove() {} }; }, body: { appendChild() {} }
  };
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, {
    document, window: { location: { hostname: 'www.suggestdish.com' } }, console: { log() {}, error() {} },
    prompt: () => locationChoice, URL, URLSearchParams, setTimeout() {}, navigator: { geolocation: { getCurrentPosition(fn) { geolocationSuccess = fn; } } },
    fetch: async url => {
      calls.push(url);
      return { ok: true, json: async () => url.includes('location-search')
        ? { success: true, city: 'Mumbai', label: 'Mumbai', latitude: null, longitude: null }
        : { success: true, recommendations: [{ dishName: 'BBQ Paneer Pizza', restaurant: "Pop Tate's - Time Square" }, { dishName: '<script>dish</script>', restaurant: 'Second restaurant', price: 200, vegetarian: true }, { dishName: 'Third dish', restaurant: 'Third restaurant' }], source: 'database' } };
    }
  });
  return { element, calls, setLocation(value) { locationChoice = value; element("locationQuery").value = value; }, enableGPS() { geolocationSuccess({ coords: { latitude: 19.07, longitude: 72.88 } }); } };
}

test('Enter Location Mumbai reaches recommendation request and displays its result', async () => {
  const h = frontendHarness();
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

test('specific sandwich request never substitutes biryani',async()=>{const h=serverHarness({rows:[{id:1,name:'Chicken Biryani',price:150,isVeg:false,restaurantName:'Restaurant',restaurantCity:'Mumbai'}]});const {body}=await h.request('/api/ai-recommend',{diet:'nonvegetarian',budget:'200',customPreferences:'chicken sandwich'});assert.equal(body.recommendations.length,0);assert.match(body.summary,/specific request/);});

test('dish refinements exclude only specified dishes and preserve diet',async()=>{const h=serverHarness({rows:[{id:1,name:'Veg Sandwich',price:100,isVeg:true,restaurantName:'A'},{id:2,name:'Veg Sandwich',price:120,isVeg:true,restaurantName:'B'}]});const {body}=await h.request('/api/ai-recommend',{diet:'vegetarian',budget:'200',excludeDishIds:'1'});assert.equal(body.recommendations.length,1);assert.equal(body.recommendations[0].dishId,2);assert.equal((await h.request('/api/ai-recommend',{excludeDishIds:'1,evil'})).status,400);});
test('golgappa alias keeps a pani puri request specific',async()=>{const h=serverHarness({rows:[{id:1,name:'Pani Puri',price:80,isVeg:true,restaurantName:'A'},{id:2,name:'Veg Sandwich',price:90,isVeg:true,restaurantName:'B'}]});const {body}=await h.request('/api/ai-recommend',{diet:'vegetarian',budget:'200',customPreferences:'golgappa'});assert.equal(body.recommendations.length,1);assert.equal(body.recommendations[0].dishName,'Pani Puri');});

test('natural budget and veg request constrain any-diet results',async()=>{const h=serverHarness({rows:[{id:1,name:'Veg Sandwich',price:100,isVeg:true,restaurantName:'A'},{id:2,name:'Chicken Sandwich',price:100,isVeg:false,restaurantName:'B'},{id:3,name:'Veg Sandwich',price:180,isVeg:true,restaurantName:'C'}]});const {body}=await h.request('/api/ai-recommend',{diet:'any',budget:'300',customPreferences:'veg sandwich under 150'});assert.equal(body.recommendations.length,1);assert.equal(body.recommendations[0].dishId,1);});

test('Jain and vegan requests never infer preparation from vegetarian status',async()=>{const h=serverHarness({rows:[{id:1,name:'Pav Bhaji',price:100,isVeg:true,restaurantName:'A'}]});for(const query of [{diet:'jain'},{diet:'vegan'},{diet:'vegetarian',customPreferences:'jain pav bhaji'}]){const {body}=await h.request('/api/ai-recommend',query);assert.equal(body.recommendations.length,0);assert.match(body.summary,/Verified ingredient/);}});
