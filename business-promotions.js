'use strict';
(() => {
 const init=()=>{
  const panel=document.getElementById('paidDishPromotions'),checkout=document.getElementById('businessPaymentForm');
  if(!panel||!checkout)return;
  const note=document.getElementById('promotionStatus'),slots=document.getElementById('promotionSlots'),load=document.getElementById('loadPromotedDishes');
  let loading=false;
  const credentials=()=>({submissionId:checkout.elements.submissionId.value.trim(),accessCode:checkout.elements.accessCode.value.trim()});
  async function api(path,body){const r=await fetch(path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),signal:AbortSignal.timeout(20000)});const d=await r.json();if(!r.ok||!d.success)throw Error(d.error||'Please try again later.');return d;}
  async function preparePhoto(file){
   if(file.size>20*1024*1024)throw Error('Choose a photo smaller than 20 MB.');
   const url=URL.createObjectURL(file),img=new Image();
   try{await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=()=>reject(Error('This photo format could not be opened. Choose a JPEG, PNG or WebP photo.'));img.src=url;});
    const scale=Math.min(1,1600/img.width,1200/img.height),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(img.width*scale));canvas.height=Math.max(1,Math.round(img.height*scale));const ctx=canvas.getContext('2d');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(img,0,0,canvas.width,canvas.height);
    for(const quality of [.85,.7,.55,.4,.25]){const encoded=canvas.toDataURL('image/jpeg',quality).split(',')[1];if(encoded&&encoded.length<=327680)return encoded;}
    throw Error('This photo is too detailed to upload. Please choose a smaller image.');
   }finally{URL.revokeObjectURL(url);}
  }
  async function refresh(){
   if(loading)return;loading=true;load.disabled=true;slots.replaceChildren();
   const owner=credentials();
   if(!owner.submissionId||!owner.accessCode){note.textContent='Enter your business reference and private access code above, then load your promoted dishes.';loading=false;load.disabled=false;return;}
   note.textContent='Checking your paid dish slots…';
   try{
    const data=await api('/api/business-promotions/status',owner);
    if(!data.active){note.textContent=data.message;return;}
    note.textContent=data.businessName+' · 2 promoted dish slots available until '+new Date(data.endsAt).toLocaleDateString('en-IN')+'. '+(data.canReplace?'Your annual plan includes dish replacements.':'Choose your two dishes. You can correct their price, dietary type and menu link; dish replacements are an annual-plan benefit.');
    for(let slot=1;slot<=2;slot++){
     const saved=data.dishes.find(d=>d.slot===slot);
     const form=document.createElement('form');form.className='card panel';form.style.marginTop='16px';
     form.innerHTML='<h3>Promoted dish '+slot+'</h3><label>Dish photo *<input name="photo" type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif"></label><p class="small mute">Upload your own photo of this exact dish. Photos are resized for the homepage slideshow. Keep the dish near the centre for mobile cropping.</p><img class="promotion-preview" alt="Selected dish photo preview" hidden style="width:100%;max-height:240px;object-fit:cover;border-radius:12px"><div class="business-fields"><label>Price (₹) *<input name="dishPrice" type="number" min="0.01" max="100000" step="0.01" required></label><label>Dish name *<input name="dishName" required maxlength="160"></label><label>Dietary type *<select name="diet" required><option value="">Choose dietary type</option><option value="vegetarian">Vegetarian</option><option value="non-vegetarian">Non-vegetarian</option></select></label><label>Food business name *<input name="businessName" required maxlength="160"></label><label>Business details / public location *<input name="businessInfo" required maxlength="500" placeholder="Area, city and relevant business details"></label><label>Public menu link *<input name="menuUrl" type="url" required maxlength="2000" placeholder="https://…"></label></div><label style="display:block;margin:16px 0"><input name="consent" type="checkbox" required> I am authorised to promote this dish, these menu details are accurate, I have permission to publish this photo, and I agree to show the photo and details as Sponsored and owner-submitted.</label><button type="submit" class="btn btn-primary">Publish promoted dish</button><p role="status" aria-live="polite"></p>';
     form.elements.businessName.value=saved?.businessName||data.defaultBusinessName;form.elements.businessInfo.value=saved?.businessInfo||data.defaultBusinessInfo;const preview=form.querySelector('img');if(saved?.photoUrl){preview.src=saved.photoUrl;preview.hidden=false;}else form.elements.photo.required=true;
     let selectedPhoto;
     form.elements.photo.addEventListener('change',async()=>{selectedPhoto=null;const file=form.elements.photo.files[0];if(!file)return;const message=form.querySelector('[role=status]');try{selectedPhoto=await preparePhoto(file);preview.src='data:image/jpeg;base64,'+selectedPhoto;preview.hidden=false;message.textContent='Photo ready to publish.';}catch(error){message.textContent=error.message;form.elements.photo.value='';}});
     if(saved){form.elements.dishName.value=saved.name;form.elements.dishPrice.value=saved.price;form.elements.diet.value=saved.isVeg?'vegetarian':'non-vegetarian';form.elements.menuUrl.value=saved.menuUrl;form.querySelector('button').textContent='Save dish details';if(!data.canReplace)form.elements.dishName.readOnly=true;}
     form.addEventListener('submit',async event=>{event.preventDefault();const button=form.querySelector('button'),status=form.querySelector('[role=status]');button.disabled=true;status.textContent='Publishing…';try{if(form.elements.photo.files.length && !selectedPhoto)throw Error('Please wait for the photo to finish processing.');const result=await api('/api/business-promotions/save',{...owner,slot,businessName:form.elements.businessName.value,businessInfo:form.elements.businessInfo.value,...(selectedPhoto?{photo:selectedPhoto,photoMime:'image/jpeg'}:{}),dishName:form.elements.dishName.value,dishPrice:form.elements.dishPrice.value,diet:form.elements.diet.value,menuUrl:form.elements.menuUrl.value,consent:form.elements.consent.checked});status.textContent=result.message;window.dispatchEvent(new Event('suggestdish:promotions-updated'));form.elements.photo.required=false;button.textContent='Save dish details';if(!data.canReplace)form.elements.dishName.readOnly=true;}catch(error){status.textContent=error.message;}finally{button.disabled=false;}});
     slots.append(form);
    }
   }catch(error){note.textContent=error.message;}finally{loading=false;load.disabled=false;}
  }
  load.addEventListener('click',refresh);
  if(credentials().submissionId && credentials().accessCode)refresh();
  window.addEventListener('suggestdish:payment-confirmed',()=>{panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'start'});refresh();});
 };
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
