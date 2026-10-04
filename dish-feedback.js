'use strict';
(() => {
 const dialog=document.getElementById('dishFeedbackDialog'),form=document.getElementById('dishFeedbackForm'),status=document.getElementById('feedbackStatus');
 const choices={dislike:[['too_far','Too far away'],['too_expensive','Too expensive'],['not_my_craving','Does not match my craving'],['not_my_diet','Does not match my diet'],['want_variety','I want more variety']],correction:[['wrong_photo','Wrong photo'],['wrong_price','Wrong price'],['wrong_diet','Incorrect dietary information'],['closed_outlet','Outlet closed'],['wrong_address','Wrong address'],['missing_information','Missing information']],review:[['tried_it','I tried this dish']]};
 document.addEventListener('click',event=>{
  const button=event.target.closest('[data-feedback-kind]');if(!button)return;const kind=button.dataset.feedbackKind;if(!choices[kind])return;
  form.reset();form.elements.dishId.value=button.dataset.dishId;form.elements.kind.value=kind;status.textContent='';document.getElementById('feedbackTitle').textContent=button.dataset.dishName+' — '+(kind==='review'?'Your experience':kind==='correction'?'Correction report':'Your preference');
  const select=document.getElementById('feedbackReason');select.replaceChildren();for(const [value,label] of choices[kind]){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
  document.getElementById('reviewRatings').hidden=kind!=='review';form.elements.tried.required=kind==='review';dialog.showModal();
 });
 document.getElementById('closeFeedback').onclick=()=>dialog.close();
 form.onsubmit=async event=>{event.preventDefault();const button=form.querySelector('button[type="submit"]');button.disabled=true;status.textContent='Saving feedback…';try{const payload={dishId:Number(form.elements.dishId.value),kind:form.elements.kind.value,reason:form.elements.reason.value,note:form.elements.note.value,consent:form.elements.consent.checked,tried:form.elements.tried.checked};for(const name of ['taste','portion','value'])payload[name]=payload.kind==='review' && form.elements[name].value?Number(form.elements[name].value):null;const response=await fetch('/api/customer-feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload),signal:AbortSignal.timeout(15000)});const data=await response.json();if(!response.ok || !data.success)throw Error(data.error || 'Unable to save feedback.');status.textContent=data.message;}catch(error){status.textContent=error.message || 'Unable to save feedback.';}finally{button.disabled=false;}};
})();
