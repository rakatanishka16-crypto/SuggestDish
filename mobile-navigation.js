(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory;
  else factory(root.document,root);
})(typeof window!=='undefined'?window:this,function initMobileNavigation(document,window){
  const header=document.querySelector('.navbar');
  const toggle=document.querySelector('.mobile-nav-toggle');
  const links=document.getElementById('primaryNavigation');
  if(!header||!toggle||!links||!window.matchMedia)return;
  const mobile=window.matchMedia('(max-width:900px)');
  let lastY=Math.max(0,window.scrollY||0),scheduled=false,open=false;
  const show=()=>header.classList.remove('mobile-header-hidden');
  function setOpen(value){
    open=value;
    header.classList.toggle('mobile-menu-open',open);
    toggle.setAttribute('aria-expanded',String(open));
    if(open)show();
  }
  function update(){
    scheduled=false;
    const y=Math.max(0,window.scrollY||0);
    const focused=document.activeElement;
    const keyboardFocus=header.contains(focused)&&focused?.matches?.(':focus-visible');
    if(!mobile.matches||open||keyboardFocus||y<=24){show();lastY=y;return;}
    const delta=y-lastY;
    if(Math.abs(delta)<8)return;
    header.classList.toggle('mobile-header-hidden',delta>0&&y>header.offsetHeight+24);
    lastY=y;
  }
  header.classList.add('mobile-nav-ready');
  toggle.addEventListener('click',()=>setOpen(!open));
  links.addEventListener('click',event=>{if(event.target.closest('a'))setOpen(false);});
  header.addEventListener('focusin',show);
  header.addEventListener('keydown',event=>{if(event.key==='Escape'&&open){setOpen(false);toggle.focus();}});
  window.addEventListener('scroll',()=>{if(!scheduled){scheduled=true;window.requestAnimationFrame(update);}},{passive:true});
  mobile.addEventListener?.('change',()=>{setOpen(false);show();lastY=Math.max(0,window.scrollY||0);});
});
