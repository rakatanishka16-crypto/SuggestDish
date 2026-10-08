const { test } = require('node:test');
const assert = require('node:assert/strict');
const { check, REQUIRED } = require('../scripts/check-payment-readiness');
function client({ omit, functions = true } = {}) {
  return { async query(sql, params) {
    assert.ok(sql.startsWith('SELECT '), 'metadata checks must remain read-only');
    if (sql.includes('information_schema')) return { rows: Object.entries(REQUIRED).flatMap(([table_name, cols]) => cols.map(column_name => ({ table_name, column_name }))).filter(row => `${row.table_name}.${row.column_name}` !== omit) };
    return { rows: [{ signature: functions ? params[0] : null }] };
  }};
}
test('payment schema check reports complete metadata without claiming checkout acceptance', async () => {
  const result = await check(client());
  assert.equal(result.schemaReady, true);
  assert.deepEqual(result.missing, []);
  assert.match(result.scope, /still require sandbox/);
});
test('payment schema check identifies missing checkout owner token column', async () => {
  const result = await check(client({ omit: 'BusinessSubmission.checkoutTokenHash' }));
  assert.equal(result.schemaReady, false);
  assert.deepEqual(result.missing, ['BusinessSubmission.checkoutTokenHash']);
});
test('payment schema check fails closed when atomic confirmation and reservation functions are missing', async () => {
  const result = await check(client({ functions: false }));
  assert.equal(result.schemaReady, false);
  assert.equal(result.missing.length, 2);
});
