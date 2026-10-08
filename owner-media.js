(function(root){
 'use strict';
 function init(document,fetch){
 const form=document.getElementById('mediaUploadForm'),status=document.getElementById('mediaStatus'),dish=document.getElementById('mediaDish');
 const claim=document.getElementById('mediaClaim'),access=document.getElementById('mediaAccess'),load=document.getElementById('loadMediaDishes');
 const metrics=document.getElementById('ownerMetrics'),list=document.getElementById('mediaUploads');
 const credentials=()=>({claimId:claim.value.trim(),accessCode:access.value.trim()});
 let generation=0,loaded=null;
 const same=(a,b)=>a.claimId===b.claimId && a.accessCode===b.accessCode;
 const current=(version,c)=>version===generation && same(c,credentials());
 function clear(){dish.replaceChildren();metrics.replaceChildren();list.replaceChildren();loaded=null;document.getElementById('mediaPermission').checked=false;}
 function changed(){generation++;clear();status.textContent='Business access changed. Load the approved dishes for this claim again.';}
 claim.addEventListener('input',changed);access.addEventListener('input',changed);
 load.onclick=async()=>{const version=++generation,c=credentials();clear();load.disabled=true;status.textContent='Loading your approved dishes…';try{
 const r=await fetch('/api/business-media/dishes',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(c),signal:AbortSignal.timeout(15000)});const d=await r.json();if(!current(version,c))return;if(!r.ok || !d.success)throw Error(d.error || 'Unable to load dishes.');
 for(const item of d.dishes){const option=document.createElement('option');option.value=item.id;option.textContent=item.name+' · '+(item.isVeg?'Vegetarian':'Non-vegetarian');dish.append(option);}
 if(d.metrics===null){metrics.textContent='Metrics are not available yet.';}else if(!d.metrics.length){metrics.textContent='No recorded dish events yet.';}else for(const m of d.metrics){const line=document.createElement('p');const labels={recommendation_shown:'recommendations displayed',maps_click:'Maps clicks',menu_click:'menu clicks',share_click:'share clicks'};line.textContent=m.name+': '+(m.event?m.total+' '+(labels[m.event] || m.event):'no events recorded');metrics.append(line);}
 for(const m of d.media){const line=document.createElement('p');line.textContent=m.kind+' — '+m.status;list.append(line);if(m.status==='approved'){const a=document.createElement('a');a.href='/api/business-media/'+m.id;a.target='_blank';a.rel='noopener noreferrer';a.textContent='View approved image';list.append(a);}}
 loaded=c;status.textContent=d.dishes.length?'Select the exact dish before uploading its photo.':'No approved star dishes yet. Submit a dish revision for review; menu images can still be uploaded.';
 }catch(e){if(current(version,c)){clear();status.textContent=e.message;}}finally{load.disabled=false;}};
 form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button[type="submit"]'),version=generation,c=credentials();button.disabled=true;status.textContent='Uploading for review…';try{
 const file=document.getElementById('mediaFile').files[0],kind=document.getElementById('mediaKind').value;
 if(!file || !['image/jpeg','image/png'].includes(file.type) || file.size>2*1024*1024)throw Error('Choose a JPEG or PNG image no larger than 2 MB.');
 if(kind==='dish'&&(!loaded || !same(loaded,c) || !dish.value))throw Error('Load and select your approved dish first.');
 const r=await fetch('/api/business-media/upload',{method:'POST',headers:{'Content-Type':file.type,Authorization:'Bearer '+c.accessCode,'x-claim-id':c.claimId,'x-media-kind':kind,'x-dish-id':kind==='dish'?dish.value:'','x-media-permission':document.getElementById('mediaPermission').checked?'confirmed':'','x-ingredient-evidence':encodeURIComponent(document.getElementById('mediaEvidence').value)},body:file,signal:AbortSignal.timeout(30000)});const d=await r.json();if(!current(version,c))return;if(!r.ok || !d.success)throw Error(d.error || 'Unable to upload.');status.textContent=d.message;document.getElementById('mediaFile').value='';document.getElementById('mediaPermission').checked=false;
 }catch(e){if(current(version,c))status.textContent=e.message;}finally{button.disabled=false;}};
 }
 if(typeof module==='object' && module.exports)module.exports={init};
 else init(root.document,root.fetch.bind(root));
})(typeof window==='object'?window:globalThis);
