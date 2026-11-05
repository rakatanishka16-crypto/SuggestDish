#!/usr/bin/env node
'use strict';

/**
 * Read-only coverage audit for the IndiaRestros public API.
 *
 * This intentionally does NOT persist restaurant, contact, menu or price rows.
 * It reports only aggregate response counts so SuggestDish can evaluate source
 * coverage before requesting permission for any bulk dataset transfer.
 *
 * Run: node scripts/audit-indiarestros-source.js
 */

const BASE = 'https://indiarestros.com/api/v1';
const CITIES = [
  ['mumbai', 'Mumbai'],
  ['pune', 'Pune'],
  ['delhi', 'Delhi'],
  ['lucknow', 'Lucknow'],
  ['chennai', 'Chennai'],
  ['bengaluru', 'Bengaluru'],
  ['kolkata', 'Kolkata'],
  ['hyderabad', 'Hyderabad'],
  ['ahmedabad', 'Ahmedabad'],
  ['jaipur', 'Jaipur'],
  ['nagpur', 'Nagpur'],
  ['nashik', 'Nashik'],
];

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function rowsFrom(payload) {
  if (Array.isArray(payload?.results)) return payload.results;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

async function getJson(path, attempt = 0) {
  const response = await fetch(new URL(path, BASE), {
    headers: {
      accept: 'application/json',
      'user-agent': 'SuggestDish-SourceAudit/1.0 (+https://www.suggestdish.com)',
    },
    signal: AbortSignal.timeout(20000),
  });

  if (response.status === 429 && attempt < 2) {
    const retryAfter = Number(response.headers.get('retry-after'));
    await sleep(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : 5000);
    return getJson(path, attempt + 1);
  }

  if (!response.ok) {
    throw new Error('HTTP ' + response.status + ' for ' + path);
  }

  return response.json();
}

async function auditCity(slug, label) {
  const result = {
    city: label,
    restaurants: { status: 'not_checked', returned: 0, apiReportedCount: null },
    dishes: { status: 'not_checked', returned: 0, apiReportedCount: null, pricedRows: 0 },
  };

  try {
    const payload = await getJson('/restaurants?city=' + encodeURIComponent(slug) + '&limit=1');
    const rows = rowsFrom(payload);
    result.restaurants = {
      status: 'ok',
      returned: rows.length,
      apiReportedCount: Number.isFinite(payload?.count) ? payload.count : null,
      hasNextPage: payload?.next_offset != null,
    };
  } catch (error) {
    result.restaurants = { status: 'error', error: error.message };
  }

  await sleep(800);

  try {
    const payload = await getJson('/dishes?city=' + encodeURIComponent(slug) + '&limit=5');
    const rows = rowsFrom(payload);
    result.dishes = {
      status: 'ok',
      returned: rows.length,
      apiReportedCount: Number.isFinite(payload?.count) ? payload.count : null,
      pricedRows: rows.filter((row) => Number.isFinite(Number(row?.price)) && Number(row.price) > 0).length,
      hasNextPage: payload?.next_offset != null,
    };
  } catch (error) {
    result.dishes = { status: 'error', error: error.message };
  }

  return result;
}

async function main() {
  const startedAt = new Date().toISOString();
  let dataset = { status: 'not_checked' };

  try {
    const stats = await getJson('/stats');
    dataset = {
      status: 'ok',
      // Aggregate counts only; no source records or contact details are written.
      totals: stats?.totals || stats?.counts || stats,
    };
  } catch (error) {
    dataset = { status: 'error', error: error.message };
  }

  const cities = [];
  for (const [slug, label] of CITIES) {
    cities.push(await auditCity(slug, label));
    await sleep(800);
  }

  const report = {
    reportType: 'read_only_source_coverage_audit',
    provider: 'IndiaRestros',
    checkedAt: startedAt,
    completedAt: new Date().toISOString(),
    dataPersisted: false,
    contactDetailsCollected: false,
    menuRowsPersisted: false,
    dataset,
    cities,
    note: 'This is a small coverage sample, not a full-corpus count or permission to bulk-copy data. Review the provider terms and obtain written approval for a bulk transfer before any database import.',
  };

  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
}

main().catch((error) => {
  process.stderr.write('Source audit failed: ' + error.message + '\n');
  process.exitCode = 1;
});
