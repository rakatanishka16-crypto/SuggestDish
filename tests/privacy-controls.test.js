'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
function fixture({saved,blocked=false,dnt,gpc}={}){
 const store=new Map(saved ? [['suggestdish.privacy.v1',saved]]:[]),events=new Map(),requests=[];
 const buttons=['false','true'].map(value=>({dataset:{privacy:value},addEventListener(event,handler){this.click=handler;}}));
 const settings={addEventListener(event,handler){this.click=handler;}};
 const panel={hidden:false,querySelectorAll:()=>buttons,querySelector:()=>({focus(){}}),setAttribute(){}};
 const status={textContent:''};
 const document={addEventListener:(event,handler)=>events.set(event,handler),createElement:()=>panel,body:{append(){}},querySelectorAll:()=>[settings],getElementById:()=>status};
 const window={}; const localStorage={getItem:k=>{if(blocked)throw Error();return store.get(k)||null;},setItem:(k,v)=>{if(blocked)throw Error();store.set(k,v);}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../privacy-controls.js'),'utf8'),{window,document,localStorage,navigator:{doNotTrack:dnt,globalPrivacyControl:gpc},fetch:(...args)=>{requests.push(args);return Promise.resolve({});},Date});
 events.get('DOMContentLoaded')(); return {api:window.SuggestDishPrivacy,buttons,panel,store,requests,settings,status};
}
test('no event is sent without consent, rejection persists and can be changed',()=>{
 const h=fixture();h.api.record('maps_click',[1]);assert.equal(h.requests.length,0);assert.equal(h.panel.hidden,false);
 h.buttons[0].click();assert.equal(h.panel.hidden,true);assert.equal(JSON.parse(h.store.get('suggestdish.privacy.v1')).analytics,false);
 h.settings.click();assert.equal(h.panel.hidden,false);h.buttons[1].click();h.api.record('maps_click',[1]);assert.equal(h.requests.length,1);
 assert.deepEqual(JSON.parse(h.requests[0][1].body),{event:'maps_click',dishIds:[1]});
 h.buttons[0].click();h.api.record('menu_click',[1]);assert.equal(h.requests.length,1);
});
test('browser privacy signals suppress analytics even after opting in',()=>{
 for(const options of [{dnt:'1'},{gpc:true}]){const h=fixture({...options,saved:JSON.stringify({analytics:true})});h.api.record('recommendation_shown',[1]);assert.equal(h.requests.length,0);}
});
test('blocked device storage fails closed and preserves session rejection',()=>{
 const h=fixture({blocked:true});h.api.record('maps_click',[1]);assert.equal(h.requests.length,0);h.buttons[0].click();assert.match(h.status.textContent,/this visit/);assert.equal(h.api.analyticsAllowed(),false);
});
