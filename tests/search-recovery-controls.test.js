const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const controls = require('../search-recovery-controls');

test('distance recovery exposes the API-supported 50 km ceiling', () => {
  assert.deepEqual(controls.DISTANCE_OPTIONS_KM, [1, 2, 5, 10, 25, 50]);
  assert.equal(controls.nextDistance(25), 50);
  assert.equal(controls.nextDistance(50), null);
});

test('closer refinement never repeats an unchanged minimum-distance request', () => {
  assert.equal(controls.previousDistance(50), 25);
  assert.equal(controls.previousDistance(2), 1);
  assert.equal(controls.previousDistance(1), null);
});

test('city-wide empty results hide the inapplicable distance action', () => {
  const state = controls.emptyRecoveryState(false, 5);
  assert.equal(state.hideDistanceAction, true);
  assert.match(state.message, /city-wide search/);
});

test('maximum-distance empty results expose a disabled terminal state', () => {
  const state = controls.emptyRecoveryState(true, 50);
  assert.equal(state.hideDistanceAction, false);
  assert.equal(state.disableDistanceAction, true);
  assert.equal(state.distanceActionLabel, 'Maximum distance selected');
  assert.match(state.message, /maximum 50 km/);
});

test('page loads recovery controls and offers the 50 km option', () => {
  const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
  assert.match(html, /src="\/search-recovery-controls\.js" defer/);
  assert.match(html, /<option value="50">Within 50 km<\/option>/);
  assert.match(html, /id="distanceRecoveryStatus" class="small mute" role="status" aria-live="polite"/);
});
