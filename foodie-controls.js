'use strict';
(() => {
 const key='suggestdish.preferences.v1';
 const fields=['aiTaste','aiCuisine','aiMood','aiBudget','aiCustomBudget','aiRadius','aiDiet','aiCustomPreferences','aiDiningMode'];
 const remember=document.getElementById('rememberPreferences');
 const status=document.getElementById('preferencesStatus');
 const notify=text=>{status.textContent=text;};
 const read=()=>Object.fromEntries(fields.map(id=>[id,document.getElementById(id).value]));
 function restore(data) {
  if(!data || typeof data!=='object') return;
  for(const id of fields){const field=document.getElementById(id),value=data[id];if(typeof value!=='string') continue;
   if(field.tagName==='SELECT' && !Array.from(field.options).some(option=>option.value===value))continue;
   if(id==='aiCustomPreferences' && value.length>500)continue;
   if(id==='aiCustomBudget' && (!Number.isFinite(Number(value)) || Number(value)<1 || Number(value)>100000))continue;
   field.value=value;
  }
 }
 try {const saved=JSON.parse(localStorage.getItem(key)||'null');if(saved){restore(saved);remember.checked=true;notify('Your saved preferences have been restored. Location is not saved.');}}catch{notify('Preference storage is unavailable on this device.');}
 function save(){if(!remember.checked)return;try{localStorage.setItem(key,JSON.stringify(read()));notify('Preferences saved on this device. Location is not saved.');}catch{notify('Unable to save preferences on this device.');}}
 fields.forEach(id=>document.getElementById(id).addEventListener('change',save));
 document.getElementById('aiRecommendBtn').addEventListener('click',save);
 remember.addEventListener('change',()=>{if(remember.checked)save();else{try{localStorage.removeItem(key);notify('Saved preferences removed.');}catch{notify('Unable to remove saved preferences.');}}});
 document.getElementById('forgetPreferences').addEventListener('click',()=>{try{localStorage.removeItem(key);remember.checked=false;notify('Saved preferences removed. Your current search is unchanged.');}catch{notify('Unable to remove saved preferences.');}});
 document.querySelectorAll('[data-craving]').forEach(button=>button.addEventListener('click',()=>{
  document.getElementById('aiCustomPreferences').value=button.dataset.craving;
  document.getElementById('aiMood').value=button.dataset.occasion || 'any';
  document.getElementById('aiTaste').value=button.dataset.taste || 'any';
  document.getElementById('aiCuisine').value='any';
  save();document.getElementById('aiCustomPreferences').focus();
 }));
})();
