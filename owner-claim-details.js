(function(root){
 'use strict';
 function fill(form,details){
  const d=details || {},dish=d.dish || {};
  for(const name of ['city','address','profileUrl','ownershipEvidence'])form.elements[name].value=d[name] ?? '';
  for(const name of ['dishName','dishPrice','diet','menuUrl','popularityBasis','popularityEvidence'])form.elements[name].value=dish[name] ?? '';
  form.elements.consent.checked=false;
 }
 const api={fill};
 if(typeof module==='object' && module.exports)module.exports=api;
 else root.SuggestDishClaimDetails=api;
})(typeof window==='object'?window:globalThis);
