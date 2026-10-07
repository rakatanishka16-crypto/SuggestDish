const test=require('node:test'),assert=require('node:assert/strict'),safeRows=require('../lib/recommendation-shape');
test('malformed Gemini envelopes fail closed to an empty list for database fallback',()=>{
 for(const value of [null,undefined,'oops',[],{}, {recommendations:null}, {recommendations:'not an array'}])assert.deepEqual(safeRows(value),[]);
});
test('only recommendation objects continue to candidate validation',()=>{
 const good={id:7,dishName:'Poha',restaurant:'Cafe'};
 assert.deepEqual(safeRows({recommendations:[null,7,'dish',[],good,{id:8}]}),[good,{id:8}]);
});
test('Gemini empty or mixed malformed rows leave valid object rows available',()=>{
 assert.deepEqual(safeRows({recommendations:[null,false]}),[]);
 assert.deepEqual(safeRows({recommendations:[null,{id:'unknown'}]}),[{id:'unknown'}]);
});
