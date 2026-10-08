const test=require('node:test'),assert=require('node:assert/strict'),evidenceUrl=require('../lib/ownership-evidence');
test('ownership evidence accepts business website and social profiles without asserting verification',()=>{
 for(const url of ['https://www.instagram.com/examplecafe/','https://www.facebook.com/examplecafe','https://example.com/','https://maps.app.goo.gl/example','https://share.google/example','https://www.zomato.com/mumbai/example'])assert.equal(evidenceUrl(url),url);
 assert.equal(evidenceUrl('  https://example.com/  '),'https://example.com/');
});
test('ownership evidence rejects malformed, private-address, credential and oversized links',()=>{
 for(const url of [null,{},[],true,'','javascript:alert(1)','http://example.com','https://owner:secret@example.com/','https://localhost/','https://127.0.0.1/','https://[::1]/','https://10.0.0.1/','https://cafe.local/','https://cafe.test/','https://example.com:8080/','https://example.com./','https://example.com/'+ 'a'.repeat(2000)])assert.equal(evidenceUrl(url),null,String(url));
});
