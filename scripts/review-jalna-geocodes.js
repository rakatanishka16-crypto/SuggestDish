// Locally review missing Jalna coordinates. This script NEVER updates Neon.
// Run: node scripts/review-jalna-geocodes.js
require("dotenv").config();
const fs = require("node:fs");
const { neon } = require("@neondatabase/serverless");

const key = process.env.GEOAPIFY_KEY || process.env.GEOAPIFY_API_KEY;
const center = { lat: 19.8347, lon: 75.8816 };
const quote = (x) => `"${String(x ?? "").replace(/"/g, '""')}"`;
const distance = (lat, lon) => {
  const r = Math.PI / 180;
  const a = Math.sin((lat - center.lat) * r / 2) ** 2 +
    Math.cos(lat * r) * Math.cos(center.lat * r) *
    Math.sin((lon - center.lon) * r / 2) ** 2;
  return 12742 * Math.asin(Math.sqrt(a));
};

async function geocode(row) {
  if (!row.address) return { row, status: "needs_address" };
  const url = new URL("https://api.geoapify.com/v1/geocode/search");
  url.searchParams.set("text", `${row.name}, ${row.address}, Maharashtra, India`);
  url.searchParams.set("filter", "countrycode:in");
  url.searchParams.set("bias", `proximity:${center.lon},${center.lat}`);
  url.searchParams.set("limit", "3");
  const response = await fetch(url, {
    headers: { "x-api-key": key }, signal: AbortSignal.timeout(15000)
  });
  if (!response.ok) return { row, status: `http_${response.status}` };
  const data = await response.json();
  const options = (data.features || []).map((f) => {
    const p = f.properties || {};
    return { p, km: distance(Number(p.lat), Number(p.lon)) };
  }).filter(({ p, km }) => Number.isFinite(km) && km <= 20);
  const best = options[0];
  if (!best) return { row, status: "no_local_match" };
  const { p, km } = best;
  // Even high-confidence geocoding can identify the street, not the business.
  const precise = ["amenity", "building"].includes(p.result_type);
  const confidence = Number(p.rank?.confidence) || 0;
  return {
    row, status: precise && confidence >= 0.8 ? "review_precise" : "review_approximate",
    lat: p.lat, lon: p.lon, km: km.toFixed(2), confidence: confidence.toFixed(2),
    resultType: p.result_type, formatted: p.formatted
  };
}

async function main() {
  if (!process.env.DATABASE_URL || !key) throw new Error("DATABASE_URL and GEOAPIFY_KEY must be in local .env");
  const sql = neon(process.env.DATABASE_URL);
  const rows = await sql`SELECT "id", "name", "address", "city"
    FROM "Restaurant" WHERE "city" ILIKE '%Jalna%'
    AND ("latitude" IS NULL OR "longitude" IS NULL) ORDER BY "id"`;
  const results = [];
  for (const row of rows) {
    try { results.push(await geocode(row)); }
    catch (error) { results.push({ row, status: "request_failed" }); console.error(`ID ${row.id}: ${error.message}`); }
  }
  const headers = ["id","name","address","status","latitude","longitude","km_from_jalna","confidence","result_type","matched_address"];
  const lines = [headers.join(","), ...results.map(({ row, status, lat, lon, km, confidence, resultType, formatted }) =>
    [row.id,row.name,row.address,status,lat,lon,km,confidence,resultType,formatted].map(quote).join(","))];
  fs.writeFileSync("jalna-geocode-review.csv", lines.join("\n") + "\n");
  const counts = Object.fromEntries([...new Set(results.map(r => r.status))].map(s => [s, results.filter(r => r.status === s).length]));
  console.log(`Reviewed ${rows.length} missing-coordinate Jalna rows. Status counts:`, counts);
  console.log("Saved jalna-geocode-review.csv. No database rows were changed.");
}

main().catch(error => { console.error(error.message); process.exitCode = 1; });
