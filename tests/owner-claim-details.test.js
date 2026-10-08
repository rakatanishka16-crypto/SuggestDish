const test=require('node:test'),assert=require('node:assert/strict'),{fill}=require('../owner-claim-details');
test('saved claim restore fills exact dish and resets consent without touching credentials or contact',()=>{
 const elements=Object.fromEntries(['city','address','profileUrl','ownershipEvidence','dishName','dishPrice','diet','menuUrl','popularityBasis','popularityEvidence','contactName','email','phone','claimId','accessCode'].map(k=>[k,{value:'unsaved'}]));elements.consent={checked:true};
 fill({elements},{city:'Mumbai',address:'Exact branch',profileUrl:'https://www.instagram.com/example/',ownershipEvidence:'Verify official contact',dish:{dishName:'Poha',dishPrice:65.5,diet:'vegetarian',menuUrl:'https://example.com/menu',popularityBasis:'signature',popularityEvidence:'Known for this dish'}});
 assert.equal(elements.city.value,'Mumbai');assert.equal(elements.dishPrice.value,65.5);assert.equal(elements.diet.value,'vegetarian');assert.equal(elements.consent.checked,false);for(const n of ['contactName','email','phone','claimId','accessCode'])assert.equal(elements[n].value,'unsaved');
});
test('missing saved dish clears stale form values instead of guessing diet or price',()=>{
 const elements=Object.fromEntries(['city','address','profileUrl','ownershipEvidence','dishName','dishPrice','diet','menuUrl','popularityBasis','popularityEvidence'].map(k=>[k,{value:'stale'}]));elements.consent={checked:true};fill({elements},{dish:null});for(const v of Object.values(elements))if('value' in v)assert.equal(v.value,'');assert.equal(elements.consent.checked,false);
});
