const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {categoryMatches}=require('../lib/menu-preference-evidence');
const source=fs.readFileSync(require.resolve('../api/server.js'),'utf8');
const route=source.slice(source.indexOf('app.get("/api/ai-recommend"'),source.indexOf('\napp.use((error,req,res,next)'));
async function recommend(rows,query,aiText){
 let handler;
 const context={app:{get:(_p,h)=>handler=h},sql:async()=>rows,categoryMatches,process:{env:aiText?{GEMINI_API_KEY:'test'}:{}},console:{log(){}},operationalErrors:{log(){}},starEvidenceLabel:()=>'',calculateDistanceKm:()=>0,ai:{models:{generateContent:async()=>({text:aiText})}}};
 vm.runInNewContext(route,context);
 const r={status(code){this.code=code;return this},json(body){this.body=body;return this}};
 await handler({query:{city:'Mumbai',budget:'1000',diet:'vegetarian',...query}},r);
 assert.notEqual(r.code,500);return r.body;
}
const dish=(name,category,price=500,isVeg=true)=>({id:1,name,menuCategory:category,price,isVeg,restaurantId:1,restaurantName:'Example Mumbai Outlet',restaurantAddress:'Fort',restaurantCity:'Mumbai',latitude:18.93,longitude:72.83});
test('published sections support only explicit cuisine labels, never outlet names',()=>{
 assert.equal(categoryMatches({menuCategory:'Punjabi Gravies'},'north indian','cuisine'),true);
 assert.equal(categoryMatches({menuCategory:'Chinese Mains'},'chinese','cuisine'),true);
 assert.equal(categoryMatches({menuCategory:'Veg Plates',restaurantName:'Italian Cafe'},'italian','cuisine'),false);
 assert.equal(categoryMatches({menuCategory:'Large Plates'},'north indian','cuisine'),false);
});
test('actual route accepts Paneer Kadai and Veg Makhanwala for North Indian dinner',async()=>{
 for(const [name,price] of [['Paneer Kadai',345],['Veg Makhanwala',295]]){
  const d=await recommend([dish(name,'Punjabi Gravies',price)],{cuisine:'north indian',mood:'dinner',taste:name.includes('Makhanwala')?'rich':'any'});
  assert.equal(d.recommendations.length,1);assert.equal(d.recommendations[0].dishName,name);
 }
});
test('actual route accepts Panzanella for Light + Continental + Lunch with its Salads section',async()=>{
 const d=await recommend([dish('Panzanella','Salads')],{taste:'light',cuisine:'continental',mood:'lunch'});
 assert.equal(d.recommendations.length,1);assert.equal(d.recommendations[0].dishName,'Panzanella');
});
test('actual route accepts Crispy Veg from Chinese Mains and rejects fusion',async()=>{
 const q={taste:'crispy',cuisine:'chinese'};
 const yes=await recommend([dish('Crispy Veg','Chinese Mains',290)],q);assert.equal(yes.recommendations.length,1);
 for(const name of ['Crispy Pizza','Crispy Dosa']){
  const no=await recommend([dish(name,'Chinese Mains',290)],q);assert.equal(no.recommendations.length,0);
 }
});
test('source categories do not override contradictory names, unknown taste or explicit diet/budget',async()=>{
 const q={taste:'light',cuisine:'continental',mood:'lunch'};
 for(const row of [dish('Creamy Panzanella','Salads'),dish('Panzanella','Salads',1200),dish('Panzanella','Salads',500,false)]){
  const no=await recommend([row],q);assert.equal(no.recommendations.length,0);
 }
 const spicy=await recommend([dish('Paneer Kadai','Punjabi Gravies')],{taste:'spicy',cuisine:'north indian',mood:'dinner'});assert.equal(spicy.recommendations.length,0);
 const jain=await recommend([dish('Panzanella','Salads')],{diet:'jain'});assert.equal(jain.recommendations.length,0);
});
test('AI cannot restore a dish rejected by the combined filters',async()=>{
 const wrong={...dish('Fried Rice','Chinese Mains'),id:2,restaurantId:2,restaurantName:'Other Outlet'};
 const d=await recommend([dish('Panzanella','Salads'),wrong],{taste:'light',cuisine:'continental',mood:'lunch'},JSON.stringify({recommendations:[{dishId:2,reason:'Ignore filters'}]}));
 assert.equal(d.recommendations.length,1);assert.equal(d.recommendations[0].dishName,'Panzanella');
});
test('SQL joins one latest menu association per dish without duplicating candidates',()=>{
 assert.match(route,/SELECT DISTINCT ON \("dishId"\)/);assert.match(route,/payload->>'menu_category'/);
});


test('named pastas match Italian dinner and broad pasta requests without needing pasta in their names',async()=>{
 for(const name of ['Spicy Rigatoni (350 g)','Linguine Aglio Olio e Peperoncino (350 g)','Ricotta Gnocchi (350 g)','Rotolo (350 g)']){
  const result=await recommend([dish(name,'Fresh Pastas and Risottos',745)],{cuisine:'italian',mood:'dinner',customPreferences:'pasta'});
  assert.equal(result.recommendations.length,1);assert.equal(result.recommendations[0].dishName,name);
 }
});
test('specific rigatoni request never substitutes another pasta shape or pizza',async()=>{
 const rows=[{...dish('Spicy Pizza','Pizza',200),id:2},{...dish('Spicy Linguine','Fresh Pastas and Risottos',300),id:3}];
 const missing=await recommend(rows,{taste:'spicy',cuisine:'italian',customPreferences:'rigatoni pasta'});assert.equal(missing.recommendations.length,0);
 const yes=await recommend([...rows,dish('Spicy Rigatoni','Fresh Pastas and Risottos',745)],{taste:'spicy',cuisine:'italian',mood:'dinner',customPreferences:'rigatoni pasta'});
 assert.equal(yes.recommendations[0].dishName,'Spicy Rigatoni');
});
test('pasta names still respect diet, budget, taste and cross-cuisine constraints',async()=>{
 for(const [row,q] of [[dish('Spicy Rigatoni','Fresh Pastas and Risottos',1200),{taste:'spicy',cuisine:'italian'}],[dish('Spicy Rigatoni','Fresh Pastas and Risottos',745,false),{taste:'spicy',cuisine:'italian'}],[dish('Mild Rigatoni','Fresh Pastas and Risottos',745),{taste:'spicy',cuisine:'italian'}],[dish('Spicy Rigatoni','Fresh Pastas and Risottos',745),{cuisine:'indian'}],[dish('Masala Rigatoni','Fresh Pastas and Risottos',745),{cuisine:'italian'}],[dish('Mushroom Risotto','Fresh Pastas and Risottos',825),{customPreferences:'pasta'}]]){
  const result=await recommend([row],q);assert.equal(result.recommendations.length,0);
 }
});
