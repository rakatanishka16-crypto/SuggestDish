'use strict';
// Explicit response whitelist: never serialize the underlying database row.
exports.validId=value=>typeof value==='string' && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(value);
exports.contact=row=>({contactName:row.contactName ?? null,email:row.email ?? null,phone:row.phone ?? null});
