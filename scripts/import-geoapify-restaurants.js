// Run locally: node scripts/import-geoapify-restaurants.js [--write]
// Requires GEOAPIFY_KEY and, for --write, DATABASE_URL in .env.
// Geoapify Places contains locations, not verified menus, prices or ratings.
require("dotenv").config();
const { neon } = require("@neondatabase/serverless");

const center = { lat: 19.8347, lon: 75.8816 }; // Jalna pilot
const radiusMeters = 15000;
const pageSize = 100;
const maxPages = 20;
const write = process.argv.includes("--write");
const key = process.env.GEOAPIFY_KEY || process.env.GEOAPIFY_API_KEY;

const normalized = (name) => String(name || "").toLowerCase()
  .normalize("NFKD").replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

function distanceMeters(a, b) {
  const lat = (a.latitude + b.latitude) * Math.PI / 360;
  const dx = (a.longitude - b.longitude) * Math.cos(lat) * 111320;
  const dy = (a.latitude - b.latitude) * 111320;
  return Math.hypot(dx, dy);
}

async function main() {
  if (!key) throw new Error("Set GEOAPIFY_KEY in your local .env file.");
  if (write && !process.env.DATABASE_URL) throw new Error("Set DATABASE_URL for --write.");
  const places = new Map();
  for (let page = 0; page < maxPages; page++) {
    const url = new URL("https://api.geoapify.com/v2/places");
    url.searchParams.set("categories", "catering.restaurant,catering.cafe,catering.fast_food");
    url.searchParams.set("filter", `circle:${center.lon},${center.lat},${radiusMeters}`);
    url.searchParams.set("limit", String(pageSize));
    url.searchParams.set("offset", String(page * pageSize));
    const response = await fetch(url, {
      headers: { "x-api-key": key },
      signal: AbortSignal.timeout(15000)
    });
    if (!response.ok) throw new Error(`Geoapify returned HTTP ${response.status}.`);
    const data = await response.json();
    const features = Array.isArray(data.features) ? data.features : [];
    for (const feature of features) {
      const p = feature.properties || {};
      const longitude = Number(feature.geometry?.coordinates?.[0]);
      const latitude = Number(feature.geometry?.coordinates?.[1]);
      if (!p.name || !Number.isFinite(longitude) || !Number.isFinite(latitude)) continue;
      const id = p.place_id || `${normalized(p.name)}:${latitude.toFixed(5)}:${longitude.toFixed(5)}`;
      places.set(id, {
        name: p.name.trim().slice(0, 250),
        address: (p.formatted || p.address_line2 || "").slice(0, 500),
        city: p.city || "Jalna",
        latitude, longitude
      });
    }
    if (features.length < pageSize) break;
    if (page === maxPages - 1) console.warn("Page cap reached; this run may be incomplete.");
  }

  const candidates = [...places.values()];
  console.log(`Found ${candidates.length} named food places within 15 km of Jalna centre.`);
  if (!write) {
    console.log("Preview:", candidates.slice(0, 5));
    console.log("No database changes. Run again with --write to import restaurants.");
    return;
  }

  const sql = neon(process.env.DATABASE_URL);
  const existing = await sql`SELECT "name", "latitude", "longitude" FROM "Restaurant"`;
  const columns = await sql`SELECT column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'Restaurant' AND column_name = 'updatedAt'`;
  let added = 0, skipped = 0;
  for (const place of candidates) {
    const duplicate = existing.some((row) => normalized(row.name) === normalized(place.name)
      && ((row.latitude != null && row.longitude != null
        && distanceMeters({latitude:Number(row.latitude), longitude:Number(row.longitude)}, place) < 150)
        || (normalized(row.address) && normalized(row.address) === normalized(place.address))));
    if (duplicate) { skipped++; continue; }
    if (columns.length) {
      await sql`INSERT INTO "Restaurant" ("name", "address", "city", "latitude", "longitude", "updatedAt")
        VALUES (${place.name}, ${place.address}, ${place.city}, ${place.latitude}, ${place.longitude}, NOW())`;
    } else {
      await sql`INSERT INTO "Restaurant" ("name", "address", "city", "latitude", "longitude")
        VALUES (${place.name}, ${place.address}, ${place.city}, ${place.latitude}, ${place.longitude})`;
    }
    existing.push(place);
    added++;
  }
  console.log(`Imported ${added} restaurants; skipped ${skipped} nearby name matches. No dishes were created.`);
}

main().catch((error) => { console.error(error.message); process.exitCode = 1; });
