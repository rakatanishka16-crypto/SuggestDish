// Read-only metadata check. Does not create orders, charge cards or apply migrations.
const REQUIRED = {
  BusinessSubmission: ['id', 'checkoutTokenHash'],
  Restaurant: ['id'],
  BusinessPlanPayment: ['id', 'submissionId', 'restaurantId', 'plan', 'amount', 'currency', 'keyId', 'orderId', 'paymentId', 'status', 'startsAt', 'endsAt', 'createdAt'],
};
async function check(client) {
  const { rows } = await client.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND table_name = ANY($1::text[])`, [Object.keys(REQUIRED)]);
  const missing = [];
  for (const [table, columns] of Object.entries(REQUIRED)) {
    for (const column of columns) if (!rows.some(row => row.table_name === table && row.column_name === column)) missing.push(`${table}.${column}`);
  }
  const functions = ['public.confirm_business_payment(uuid,text,boolean)', 'public.reserve_business_payment(uuid,uuid,integer,text,integer,text)'];
  for (const name of functions) {
    const result = await client.query('SELECT to_regprocedure($1)::text AS signature', [name]);
    if (!result.rows[0]?.signature) missing.push(name);
  }
  return { schemaReady: missing.length === 0, missing, scope: 'Schema metadata only; checkout, constraints, permissions and webhook behaviour still require sandbox acceptance tests.' };
}
async function main() {
  require('dotenv').config({ quiet: true });
  if (!process.env.DATABASE_URL) { console.error('DATABASE_URL is missing. Configure it privately in the intended environment.'); process.exitCode = 1; return; }
  const { Client } = require('pg');
  const client = new Client({ connectionString: process.env.DATABASE_URL, connectionTimeoutMillis: 10000, statement_timeout: 10000 });
  try {
    await client.connect();
    await client.query('BEGIN READ ONLY');
    const result = await check(client);
    await client.query('ROLLBACK');
    console.log(JSON.stringify(result, null, 2));
    if (!result.schemaReady) process.exitCode = 1;
  } catch {
    // Do not print driver errors: they can include credentials or connection details.
    console.error('Payment readiness check failed. Check database connectivity and read permissions; no migration was applied.');
    process.exitCode = 1;
  } finally { await client.end().catch(() => {}); }
}
if (require.main === module) main();
module.exports = { check, REQUIRED };
