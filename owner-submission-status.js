(function(root){
 'use strict';
 function init(document,fetch){
  const form=document.getElementById('statusForm'),status=document.getElementById('status'),reference=document.getElementById('reference'),access=document.getElementById('access'),button=form.querySelector('button');
  const credentials=()=>({submissionId:reference.value.trim(),accessCode:access.value.trim()});
  let generation=0;
  const current=(version,c)=>{const now=credentials();return version===generation && c.submissionId===now.submissionId && c.accessCode===now.accessCode;};
  const changed=()=>{generation++;status.textContent='Business access changed. Check this submission again.';};
  reference.addEventListener('input',changed);access.addEventListener('input',changed);
  form.onsubmit=async event=>{
   event.preventDefault();if(button.disabled)return;
   const version=++generation,c=credentials();button.disabled=true;status.textContent='Checking submission…';
   try{
    const r=await fetch('/api/business-listings/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c),signal:AbortSignal.timeout(15000)}),d=await r.json();
    if(!current(version,c))return;
    if(!r.ok || !d.success)throw Error(d.error || 'Status unavailable.');
    const stages={pending:'Received → Profile, ownership and menu review pending',needs_information:'Received → More information requested → Resubmit for review',approved:'Received → Review complete → Approved for eligible recommendations',rejected:'Received → Review complete → Not approved'};
    status.textContent=d.businessName+'\n'+(stages[d.status] || 'Review status unavailable')+'\n'+d.message;
   }catch(e){if(current(version,c))status.textContent=e.message;}
   finally{button.disabled=false;}
  };
 }
 if(typeof module==='object' && module.exports)module.exports={init};
 else init(root.document,root.fetch.bind(root));
})(typeof window==='object'?window:globalThis);
