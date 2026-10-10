'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const operational=require('../lib/operational-errors');

test('operational logs retain bounded codes without serialising errors or secrets',()=>{
 const calls=[];
 const error=Object.assign(new Error('DATABASE_URL=postgres://secret'),{code:'ECONNRESET',request:{authorization:'Bearer private'}});
 operational.log('Database unavailable',error,(...args)=>calls.push(args));
 assert.deepEqual(calls,[['Database unavailable',{code:'ECONNRESET'}]]);
 assert.doesNotMatch(JSON.stringify(calls),/secret|Bearer|authorization/);
});

test('unsafe provider values collapse to a generic code',()=>{
 assert.equal(operational.code({code:'bad code with token=private'}),'unexpected_error');
 assert.equal(operational.code({status:503}),'503');
 assert.equal(operational.code(null),'unexpected_error');
});
