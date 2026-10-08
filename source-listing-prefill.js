(function(root){
 'use strict';
 function apply(form,business){
  const values={businessName:business?.name,city:business?.city,address:business?.address},limits={businessName:160,city:100,address:500};
  for(const [name,value] of Object.entries(values))if(value!=null && (typeof value!=='string' || value.length>limits[name]))throw Error('Source details exceed the form limits. Check the source and enter the exact branch details manually.');
  for(const [name,value] of Object.entries(values))form.elements[name].value=value ?? '';
  // Changing branch invalidates any earlier dish/profile entries and consent.
  for(const name of ['category','profileUrl','menuUrl','dishName','dishPrice','diet'])form.elements[name].value='';
  form.elements.consent.checked=false;
 }
 async function init(document,location,fetch){
  const id=new URLSearchParams(location.search).get('sourceBusinessId');
  if(!id)return;
  const form=document.getElementById('businessListingForm'),status=document.getElementById('businessListingStatus');
  if(!form || !status)return;
  if(!/^official:[A-Za-z0-9:_-]{1,111}$/.test(id)){status.textContent='Invalid selected outlet. Choose it again from the directory.';return;}
  try{
   const response=await fetch('/api/business-source?'+new URLSearchParams({businessId:id}),{signal:AbortSignal.timeout(15000)});
   const data=await response.json();
   if(!response.ok || !data.success || data.business?.sourceKey!==id)throw Error('Selected source outlet could not be loaded. Choose it again from the directory.');
   const button=document.createElement('button');button.type='button';button.className='btn btn-light';button.textContent='Use selected outlet details';
   status.textContent='Selected outlet: '+data.business.name+'. Use its source details to replace branch fields and clear any previous dish details. Ownership and current menu still require review.';
   status.before(button);
   button.addEventListener('click',()=>{try{apply(form,data.business);status.textContent='Branch details loaded from the source. Check the address, choose a category, and add your profile proof and current signature dish. Nothing has been submitted.';button.remove();}catch(error){status.textContent=error.message;}});
  }catch(error){status.textContent=error.name==='TimeoutError'?'Source request timed out. Choose the outlet again or enter its details manually.':error.message;}
 }
 const api={apply,init};
 if(typeof module==='object' && module.exports)module.exports=api;
 else {root.SuggestDishSourceListing=api;init(root.document,root.location,root.fetch.bind(root));}
})(typeof window==='object'?window:globalThis);
