'use strict';
// Explicitly requested exceptions to priced-menu browsing. These links do not
// import platform menu content or establish current operation or dish prices.
const {createHash}=require('node:crypto');
const scope=require('../api/source-batches/jalna-menu-request-scope-2026-10-27.json');
const priced=require('./jalna-priced-menus');
const pending=new Set(priced.batch.request_outcomes.filter(r=>r.status!=='published_menu').map(r=>r.name));
const canonical=value=>{try{const u=new URL(value);return u.origin+u.pathname.replace(/\/(order|menu|info)\/?$/,'').replace(/\/$/,'');}catch{return null;}};
const businesses=scope.listings.filter(([name])=>pending.has(name)).map(([name,path])=>{
 const url='https://www.zomato.com/jalna/'+path;
 return {sourceKey:'directory:jalna-menu-link-'+createHash('sha256').update(url).digest('hex').slice(0,16),name,brand:name,category:'Food outlet',city:'Jalna',state:'Maharashtra',district:'Jalna',address:null,latitude:null,longitude:null,source_urls:[url],menu_source_urls:[url],source_types:['requested_menu_link'],retrieved_on:scope.requested_on,menu_link_only:true,directory_publish_ready:true,recommendation_eligible:false,publish_ready:false,attribution:'Requested external menu link only; prices, ownership, licence status and current operation have not been confirmed.'};
});
function apply(existing){
 const result=existing.map(b=>({...b}));
 for(const b of businesses){
  // Reuse only an exact source URL and city; a shared name is insufficient.
  const match=result.find(x=>x.sourceKey===b.sourceKey||(x.city==='Jalna'&&[...(x.source_urls||[]),...(x.menu_source_urls||[])].some(u=>canonical(u)===canonical(b.menu_source_urls[0]))));
  if(match){match.menu_link_only=true;match.menu_source_urls=[...new Set([b.menu_source_urls[0],...(match.menu_source_urls||[])])];}
  else result.push({...b});
 }
 return result;
}
function menuFor(b){return b.menu_link_only?{menuScope:'external_link',menuItems:[],menuNotice:'Prices unavailable — this listing links to an external menu only. Confirm the current menu and prices with the outlet.'}:null;}
module.exports={businesses,apply,menuFor};
