const fs=require('node:fs'),path=require('node:path'),zlib=require('node:zlib');
const snapshot=JSON.parse(zlib.gunzipSync(fs.readFileSync(path.join(__dirname,'../api/source-batches/mumbai-open-data-2026-10-09.json.gz'))));
const summary={batchId:snapshot.batch_id,profiles:snapshot.businesses.length,vocabularyItems:snapshot.vocabulary.length,inputRecords:snapshot.input_records,heldRecords:snapshot.held_records.length,duplicateCandidatesHeld:snapshot.duplicate_candidates.length,menuEntries:0,publishedPrices:0,completeCityCensus:false,scope:snapshot.scope,licence:snapshot.dataset_license,attribution:'© OpenStreetMap contributors; https://www.openstreetmap.org/copyright',downloadUrl:'/api/open-food-data/export'};
function register(app){
 app.get('/api/open-food-data/export',(req,res)=>{res.set('Cache-Control','no-store');res.set('Content-Disposition','attachment; filename="suggestdish-mumbai-open-data-2026-10-09.json"');res.json(snapshot);});
 app.get('/api/dish-vocabulary',(req,res)=>{
  res.set('Cache-Control','no-store');
  const q=String(req.query.q||'').trim().toLocaleLowerCase(),offset=Number(req.query.offset||0),limit=Number(req.query.limit||20);
  if(q.length>100||!Number.isSafeInteger(offset)||offset<0||offset>10000||!Number.isSafeInteger(limit)||limit<1||limit>50)return res.status(400).json({success:false,error:'Invalid vocabulary filters.'});
  const rows=snapshot.vocabulary.filter(r=>[r.dish_name,...r.aliases].some(x=>x.toLocaleLowerCase().includes(q)));
  res.json({success:true,source:'wikidata',license:'CC0-1.0',outletAvailabilityConfirmed:false,notice:'India-wide food/dish vocabulary, not restaurant menus. Ingredient candidates require recipe verification.',total:rows.length,offset,hasMore:offset+limit<rows.length,items:rows.slice(offset,offset+limit)});
 });
}
module.exports={businesses:snapshot.businesses,summary,register,snapshot};
