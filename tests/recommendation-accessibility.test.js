const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('recommendation async states expose accessible announcements and focus targets', () => {
  assert.match(html, /id="aiLoading"[\s\S]*?role="status"[\s\S]*?aria-live="polite"[\s\S]*?aria-atomic="true"/);
  assert.match(html, /id="aiResult"[\s\S]*?role="region"[\s\S]*?aria-labelledby="aiDishName"[\s\S]*?tabindex="-1"/);
  assert.match(html, /id="aiError"[\s\S]*?role="alert"[\s\S]*?aria-atomic="true"[\s\S]*?tabindex="-1"/);
  assert.match(html, /aiResult\.style\.display\s*=\s*\n\s*"block";\s*\n\s*aiResult\.focus\?\.\(\);/);
  assert.match(html, /aiError\.style\.display\s*=\s*\n\s*"block";\s*\n\s*aiError\.focus\?\.\(\);/);
});
