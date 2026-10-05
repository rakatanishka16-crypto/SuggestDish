function coordinates(lat, lon) {
  return typeof lat === 'number' && typeof lon === 'number' && Number.isFinite(lat) && Number.isFinite(lon) && Math.abs(lat) <= 90 && Math.abs(lon) <= 180;
}
function distanceKm(origin, outlet) {
  if (!origin || !coordinates(outlet.latitude, outlet.longitude)) return null;
  const radians = n => n * Math.PI / 180;
  const a = Math.sin(radians(outlet.latitude-origin.latitude)/2)**2 + Math.cos(radians(origin.latitude))*Math.cos(radians(outlet.latitude))*Math.sin(radians(outlet.longitude-origin.longitude)/2)**2;
  return Math.round(6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(Math.max(0,1-a))) * 100) / 100;
}
function queryOrigin(query) {
  if (query.lat === undefined && query.lon === undefined) return null;
  if (!['string','number'].includes(typeof query.lat) || !['string','number'].includes(typeof query.lon) || String(query.lat).trim() === '' || String(query.lon).trim() === '') throw new Error('Provide a valid latitude and longitude together.');
  const origin = {latitude:Number(query.lat),longitude:Number(query.lon)};
  if (!coordinates(origin.latitude,origin.longitude)) throw new Error('Provide a valid latitude and longitude together.');
  return origin;
}
module.exports = {coordinates,distanceKm,queryOrigin};
