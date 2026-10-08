(function(root){
 'use strict';
 function fillDish(form,dish){
  for(const name of ['dishName','dishPrice','diet','menuUrl','popularityBasis','popularityEvidence'])form.elements[name].value=dish?.[name] ?? '';
  form.elements.consent.checked=false;
 }
 function fill(form,details){
  const d=details || {},dish=d.dish || {};
  for(const name of ['city','address','profileUrl','ownershipEvidence'])form.elements[name].value=d[name] ?? '';
  fillDish(form,dish);
 }
 const api={fill,fillDish};
 if(typeof module==='object' && module.exports)module.exports=api;
 else root.SuggestDishClaimDetails=api;
})(typeof window==='object'?window:globalThis);
