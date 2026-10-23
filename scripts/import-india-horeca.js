// Import GeoJSON Sequence exported from the Geofabrik India OSM extract.
// Dry run: node scripts/import-india-horeca.js --input india-food.geojsonseq
// Staging write: STAGING_DATABASE_URL=... node scripts/import-india-horeca.js --input india-food.geojsonseq --write
// This script never creates Restaurant or Dish rows.
const fs = require("node:fs");
const readline = require("node:readline");

const args = process.argv.slice(2);
const input = args[args.indexOf("--input") + 1];
const write = args.includes("--write");
if (!input || input.startsWith("--") || !fs.existsSync(input)) {
  console.error("Usage: node scripts/import-india-horeca.js --input FILE.geojsonseq [--write]");
  process.exit(1);
}
if (write && !process.env.STAGING_DATABASE_URL) {
  console.error("--write requires STAGING_DATABASE_URL. Production DATABASE_URL is intentionally ignored.");
  process.exit(1);
}

const amenityTypes = new Set(["restaurant", "cafe", "fast_food", "food_court", "bar", "pub", "biergarten", "ice_cream"]);
const tourismTypes = new Set(["hotel", "motel", "guest_house", "hostel"]);
const shopTypes = new Set(["bakery", "pastry", "confectionery", "deli", "caterer"]);

function classify(tags) {
  if (amenityTypes.has(tags.amenity)) return `amenity:${tags.amenity}`;
  if (tourismTypes.has(tags.tourism)) return `tourism:${tags.tourism}`;
  if (shopTypes.has(tags.shop)) return `shop:${tags.shop}`;
  if (tags.craft === "caterer") return "craft:caterer";
  return null;
}

function coordinates(geometry) {
  if (geometry?.type === "Point") return geometry.coordinates;
  // Polygon coordinates are not necessarily the business entrance. Leave them
  // empty until a reviewer or geocoder locates the actual outlet.
  return null;
}

function candidate(feature) {
  const tags = feature.properties || {};
  const category = classify(tags);
  const sourceType = String(tags["@type"] || "");
  const sourceNumber = String(tags["@id"] || "");
  const sourceId = `${sourceType}/${sourceNumber}`;
  const name = String(tags.name || "").trim();
  if (!category || !name || !/^(node|way|relation)\/[0-9]+$/.test(sourceId)) return null;
  const point = coordinates(feature.geometry);
  const lon = point?.[0], lat = point?.[1];
  if (point && (!Number.isFinite(lon) || !Number.isFinite(lat))) return null;
  return {
    source_key: `osm:${sourceId}`,
    name: name.slice(0, 250),
    category,
    address: [
      tags["addr:housenumber"], tags["addr:street"], tags["addr:suburb"],
      tags["addr:city"], tags["addr:state"], tags["addr:postcode"]
    ].filter(Boolean).join(", ").slice(0, 500) || null,
    city: String(tags["addr:city"] || "").slice(0, 150) || null,
    latitude: point ? lat : null,
    longitude: point ? lon : null,
    source_url: `https://www.openstreetmap.org/${sourceId}`
  };
}

async function main() {
  let sql;
  if (write) {
    const { neon } = require("@neondatabase/serverless");
    sql = neon(process.env.STAGING_DATABASE_URL);
    await sql`
      CREATE TABLE IF NOT EXISTS "HorecaCandidate" (
        "sourceKey" text PRIMARY KEY,
        "name" text NOT NULL,
        "category" text NOT NULL,
        "address" text,
        "city" text,
        "latitude" double precision,
        "longitude" double precision,
        "sourceUrl" text NOT NULL,
        "sourceLicense" text NOT NULL DEFAULT 'ODbL-1.0',
        "reviewStatus" text NOT NULL DEFAULT 'unverified',
        "createdAt" timestamptz NOT NULL DEFAULT now(),
        "updatedAt" timestamptz NOT NULL DEFAULT now()
      )
    `;
  }
  let read = 0, valid = 0, invalid = 0;
  let batch = [];
  const seen = new Set();
  const categories = {};
  async function flush() {
    if (!write || batch.length === 0) { batch = []; return; }
    const payload = JSON.stringify(batch);
    await sql`
      INSERT INTO "HorecaCandidate"
        ("sourceKey", "name", "category", "address", "city",
         "latitude", "longitude", "sourceUrl")
      SELECT x.source_key, x.name, x.category, x.address, x.city,
             x.latitude, x.longitude, x.source_url
      FROM jsonb_to_recordset(${payload}::jsonb)
        AS x(source_key text, name text, category text, address text,
             city text, latitude double precision, longitude double precision,
             source_url text)
      ON CONFLICT ("sourceKey") DO UPDATE SET
        "name" = EXCLUDED."name",
        "category" = EXCLUDED."category",
        "address" = EXCLUDED."address",
        "city" = EXCLUDED."city",
        "latitude" = EXCLUDED."latitude",
        "longitude" = EXCLUDED."longitude",
        "sourceUrl" = EXCLUDED."sourceUrl",
        "updatedAt" = now()
    `;
    batch = [];
  }
  for await (const line of readline.createInterface({ input: fs.createReadStream(input) })) {
    if (!line.trim()) continue;
    read++;
    let item;
    try { item = candidate(JSON.parse(line.replace(/^\x1e/, ""))); }
    catch { invalid++; continue; }
    if (!item || seen.has(item.source_key)) { invalid++; continue; }
    seen.add(item.source_key);
    valid++;
    categories[item.category] = (categories[item.category] || 0) + 1;
    batch.push(item);
    if (batch.length >= 500) await flush();
  }
  await flush();
  console.log(JSON.stringify({read, candidates: valid, skipped: invalid, categories, mode: write ? "staging_write" : "preview"}, null, 2));
  console.log("No public restaurants or dishes were created. All candidates require verification.");
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
