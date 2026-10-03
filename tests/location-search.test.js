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
    if (!elements.has(id)) elements.set(id, { style: {}, value: 'any', checked: true, addEventListener(event, fn) { this[event] = fn; } });
    return elements.get(id);
  };
  element('aiBudget').value = '500';
  let locationChoice = 'Mumbai';
  let geolocationSuccess;
  const document = {
    addEventListener(event, fn) { fn(); }, getElementById: element, querySelector() { return null; }, querySelectorAll() { return []; },
    createElement() { return { style: {}, setAttribute() {}, remove() {} }; }, body: { appendChild() {} }
  };
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  vm.runInNewContext(script, {
    document, window: { location: { hostname: 'www.suggestdish.com' } }, console: { log() {}, error() {} },
    prompt: () => locationChoice, URLSearchParams, setTimeout() {}, navigator: { geolocation: { getCurrentPosition(fn) { geolocationSuccess = fn; } } },
    fetch: async url => {
      calls.push(url);
      return { ok: true, json: async () => url.includes('location-search')
        ? { success: true, city: 'Mumbai', label: 'Mumbai', latitude: null, longitude: null }
        : { success: true, recommendations: [{ dishName: 'BBQ Paneer Pizza', restaurant: "Pop Tate's - Time Square" }], source: 'database' } };
    }
  });
  return { element, calls, setLocation(value) { locationChoice = value; }, enableGPS() { geolocationSuccess({ coords: { latitude: 19.07, longitude: 72.88 } }); } };
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
