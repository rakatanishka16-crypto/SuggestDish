const test=require('node:test'),assert=require('node:assert/strict');
const init=require('../mobile-navigation');
function harness(){
 const classes=new Set(),listeners={},headerEvents={},toggleEvents={},linkEvents={};
 const header={offsetHeight:76,classList:{add:x=>classes.add(x),remove:x=>classes.delete(x),toggle(x,on){if(on)classes.add(x);else classes.delete(x);}},contains:x=>x?.inside===true,addEventListener:(k,f)=>headerEvents[k]=f};
 const toggle={setAttribute(k,v){this[k]=v;},addEventListener:(k,f)=>toggleEvents[k]=f,focus(){this.focused=true;}};
 const links={addEventListener:(k,f)=>linkEvents[k]=f};
 const media={matches:true,addEventListener(k,f){this.change=f;}};
 const document={activeElement:null,querySelector:s=>s==='.navbar'?header:toggle,getElementById:()=>links};
 const window={scrollY:0,matchMedia:()=>media,addEventListener:(k,f)=>listeners[k]=f,requestAnimationFrame:f=>f()};
 init(document,window);
 return {classes,toggle,media,document,headerEvents,toggleEvents,linkEvents,scroll(y){window.scrollY=y;listeners.scroll();}};
}
test('mobile header hides on downward scroll, returns upward and stays visible at the top',()=>{
 const h=harness();h.scroll(130);assert.ok(h.classes.has('mobile-header-hidden'));h.scroll(110);assert.ok(!h.classes.has('mobile-header-hidden'));h.scroll(200);h.scroll(0);assert.ok(!h.classes.has('mobile-header-hidden'));
});
test('small scroll jitter does not toggle the mobile header',()=>{
 const h=harness();h.scroll(150);h.scroll(147);assert.ok(h.classes.has('mobile-header-hidden'));h.scroll(139);assert.ok(!h.classes.has('mobile-header-hidden'));
});
test('expanded menu stays visible, exposes its state, and closes on a link or Escape',()=>{
 const h=harness();h.toggleEvents.click();assert.equal(h.toggle['aria-expanded'],'true');h.scroll(200);assert.ok(!h.classes.has('mobile-header-hidden'));h.linkEvents.click({target:{closest:()=>({})}});assert.equal(h.toggle['aria-expanded'],'false');h.toggleEvents.click();h.headerEvents.keydown({key:'Escape'});assert.equal(h.toggle['aria-expanded'],'false');assert.equal(h.toggle.focused,true);
});
test('desktop and keyboard navigation keep the header visible',()=>{
 const h=harness();h.media.matches=false;h.scroll(200);assert.ok(!h.classes.has('mobile-header-hidden'));h.media.matches=true;h.document.activeElement={inside:true,matches:()=>true};h.scroll(300);assert.ok(!h.classes.has('mobile-header-hidden'));h.media.change();assert.equal(h.toggle['aria-expanded'],'false');
});
test('touch focus does not leave the navigation permanently pinned',()=>{
 const h=harness();h.document.activeElement={inside:true,matches:()=>false};h.scroll(200);assert.ok(h.classes.has('mobile-header-hidden'));
});
