'use strict';
const {isIP}=require('node:net');
// A submitted URL is evidence to review, never proof of ownership. No URL is fetched.
module.exports=function ownershipEvidenceUrl(value){
 if(typeof value!=='string' || !value.trim() || value.length>2000)return null;
 try{
  const u=new URL(value.trim()),host=u.hostname.toLowerCase();
  if(u.protocol!=='https:' || u.username || u.password || u.port || host.endsWith('.') || isIP(host) || host.startsWith('['))return null;
  const labels=host.split('.');
  if(labels.length<2 || labels.some(s=>!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(s)) || /^(?:local|localhost|internal|test|invalid|example)$/.test(labels.at(-1)) || /^\d+$/.test(labels.at(-1)))return null;
  return u.href;
 }catch{return null;}
};
