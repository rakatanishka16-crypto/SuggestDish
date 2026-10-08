'use strict';
function price(value){
 if(typeof value!=='number'&&typeof value!=='string')throw Error('Enter a valid dish price in rupees.');
 if(typeof value==='string'&&!/^(?:\d+(?:\.\d{1,2})?|\.\d{1,2})$/.test(value.trim()))throw Error('Enter a valid dish price in rupees.');
 const amount=Number(typeof value==='string'?value.trim():value);
 if(!Number.isFinite(amount)||amount<=0||amount>100000||Math.abs(amount*100-Math.round(amount*100))>1e-6)throw Error('Enter a positive dish price with up to two decimal places.');
 return amount;
}
function slot(value){
 if(value===undefined)return 1;
 if(typeof value!=='number'&&typeof value!=='string')throw Error('Choose a valid dish slot.');
 if(typeof value==='string'&&!/^[1-3]$/.test(value.trim()))throw Error('Choose a valid dish slot.');
 const n=Number(value);if(!Number.isInteger(n)||n<1||n>3)throw Error('Choose a valid dish slot.');return n;
}
module.exports={price,slot};
