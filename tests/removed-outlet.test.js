const test = require('node:test');
const assert = require('node:assert/strict');
const catalog = require('../lib/source-catalog');

test('removed kitchen and Thepla House branches cannot enter public discovery or future imports', () => {
  const original = require('../api/source-batches/mumbai-2026-10-04.json').businesses;
  const removed = original.filter(b => /tejal/i.test(b.name));
  assert.ok(removed.length > 1, 'fixture includes multiple branches');
  for (const outlet of removed) {
    assert.equal(catalog.listingRows.some(b => b.id === outlet.sourceKey), false);
    assert.equal(catalog.importData.businesses.some(b => b.sourceKey === outlet.sourceKey), false);
  }
});

test('other Mumbai outlets remain available after the removal', () => {
  for (const name of ['Celebration 365', 'Epilicious', 'Hopleaf']) {
    assert.ok(catalog.listingRows.some(b => b.name.includes(name)), name);
  }
});
