const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');

// Exercise the actual recommendation route, with SQL and provider calls mocked.
// Unrelated route registration is stubbed; no database or gateway is contacted.
function harness(rows, aiReply) {
  const routes = new Map();
  let prompt = null;
  const app = {use() {}, get(p, fn) {routes.set(p, fn);}, listen() {}};
  const express = () => app;
  express.json = express.raw = () => () => {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../api/server.js'), 'utf8'), {
    require(name) {
      if (name === 'dotenv') return {config() {}};
      if (name === 'express') return express;
      if (name === '@neondatabase/serverless') return {neon: () => async () => rows};
      if (name === '@google/genai') return {GoogleGenAI: class {
        models = {generateContent: async p => {prompt = p.contents; return {text: JSON.stringify(aiReply)};}};
      }};
      if (name === '../lib/catalogue-import') return {register() {}};
      if (name === '../lib/star-evidence') return {label: () => ''};
      if (name === '../lib/operational-errors') return {log() {}};
      if (name.startsWith('../lib/')) return () => {};
      throw Error('Unexpected dependency: ' + name);
    },
    module: {exports: {}}, process: {env: aiReply ? {GEMINI_API_KEY: 'mock'} : {}},
    console, URLSearchParams, AbortSignal
  });
  return {get prompt() {return prompt;}, async request(query = {}) {
    let body, status = 200;
    const res = {status(code) {status = code; return this;}, json(value) {body = value; return this;}};
    await routes.get('/api/ai-recommend')({query: {budget: '200', diet: 'vegetarian', ...query}}, res);
    return {body, status};
  }};
}
const dish = (price, id = 1) => ({id, name: 'Idli Sambar', price, isVeg: true, restaurantName: 'Outlet ' + id, restaurantCity: 'Mumbai'});

for (const price of [-1, '-5', '', '  ', null, undefined, NaN, Infinity, 'Infinity', 'NaN', true, false, [], [10], {}]) {
  test('rejects invalid menu price ' + String(price) + ' (' + typeof price + ')', async () => {
    const {body, status} = await harness([dish(price)]).request();
    assert.equal(status, 200);
    assert.equal(body.success, true);
    assert.equal(body.recommendations.length, 0);
  });
}
for (const price of [0, '0', 80, '80.50', ' 90 ']) {
  test('retains explicit nonnegative price ' + JSON.stringify(price), async () => {
    const {body} = await harness([dish(price)]).request();
    assert.equal(body.recommendations[0].price, Number(price));
  });
}
test('AI input excludes invalid prices and rejected AI choice falls back to a valid menu record', async () => {
  const h = harness([dish(-10, 1), dish('', 2), dish(90, 3)], {recommendations: [{id: 1}]});
  const {body} = await h.request();
  assert.equal(body.recommendations[0].dishId, 3);
  assert.equal(body.recommendations[0].price, 90);
  assert.equal(h.prompt.includes('Outlet 1'), false);
  assert.equal(h.prompt.includes('Outlet 2'), false);
  assert.equal(h.prompt.includes('Outlet 3'), true);
});
test('valid prices still obey budget and diet', async () => {
  const {body} = await harness([dish(201), {...dish(90, 2), isVeg: false}]).request();
  assert.equal(body.recommendations.length, 0);
});
