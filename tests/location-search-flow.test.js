const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const html=fs.readFileSync(require.resolve('../index.html'),'utf8');
const resolver=html.slice(html.indexOf('  async function resolveEnteredLocation()'),html.indexOf('  if (enterLocation) enterLocation.addEventListener("click", resolveEnteredLocation);'));
const guard=html.slice(html.indexOf('        const typedLocation ='),html.indexOf('        console.log(\n          "AI Recommend button clicked."'));
async function simulate(ok=true){
 const input={value:'Mumbai',focus(){}},coverage={textContent:''};const calls=[];
 const ctx={document:{getElementById:id=>id==='locationQuery'?input:coverage},window:{location:{hostname:'www.suggestdish.com'}},Number,URLSearchParams,AbortSignal,toast(){},updateLocationLabel(){},enterLocation:{disabled:false},locationPending:false,gpsPending:false,locationSelectionVersion:0,selectedCity:'Jalna',userLatitude:19.8,userLongitude:75.8,appliedLocationQuery:'jalna',excludedDishIds:[12],excludedRestaurantIds:[8],fetch:async url=>{calls.push(url);return {ok,json:async()=>url.includes('location-search')?{success:ok,city:'Mumbai',label:'Mumbai',latitude:null,longitude:null}:{success:true,counts:{candidate_restaurants:27,candidate_records:1270,mapped_restaurants:9,mapped_candidates:90}}}}};
 vm.createContext(ctx);vm.runInContext(resolver+'\nasync function beginSearch(){'+guard+'return {city:selectedCity,lat:userLatitude,lon:userLongitude};}',ctx);
 const result=await ctx.beginSearch();return {ctx,result,calls,coverage};
}
test('typing Mumbai then Recommend resolves it and clears previous GPS/locality coordinates',async()=>{
 const {ctx,result,calls,coverage}=await simulate();assert.equal(result.city,'Mumbai');assert.equal(result.lat,null);assert.equal(result.lon,null);
 assert.equal(ctx.excludedDishIds.length,0);assert.equal(calls[0],'/api/location-search?q=Mumbai');
 assert.match(calls[1],/^\/api\/recommendation-coverage/);assert.match(coverage.textContent,/27 restaurants with 1270 searchable/);assert.match(coverage.textContent,/Only 9 of these restaurants have coordinates/);assert.equal(ctx.excludedRestaurantIds.length,0);
});
test('failed typed-location lookup aborts search instead of sending the previous city/coordinates',async()=>{
 const {ctx,result,calls}=await simulate(false);assert.equal(result,undefined);assert.equal(calls.length,1);assert.equal(ctx.enterLocation.disabled,false);
});
test('all inline scripts still compile',()=>{
 for(const m of html.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi))if(!m[0].includes('application/ld+json'))new vm.Script(m[1]);
});
