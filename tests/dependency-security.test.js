const test=require('node:test'),assert=require('node:assert/strict');
const {deepmerge,deepmergeInto}=require('deepmerge-ts');
test('recursive object merges do not exhaust the stack in the patched dependency',()=>{
 const a={},b={};a.self=a;b.self=b;
 assert.doesNotThrow(()=>deepmerge(a,b));
 const target={},source={};target.self=target;source.self=source;
 assert.doesNotThrow(()=>deepmergeInto(target,source));
 assert.deepEqual(deepmerge({a:{one:1}},{a:{two:2}}),{a:{one:1,two:2}});
});
