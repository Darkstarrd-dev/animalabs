function applyControlsCollapsed(){
  const top=document.querySelector('.topbar');
  if(top) top.classList.toggle('controls-collapsed', !!controlsCollapsed);
  const btn=document.getElementById('btnToggleControls');
  if(btn){
    const collapsed=!!controlsCollapsed;
    btn.setAttribute('aria-pressed', collapsed?'true':'false');
    btn.setAttribute('aria-label', collapsed?'展开采样参数':'收起采样参数');
    btn.title=collapsed?'展开采样参数（第二排）':'收起采样参数（第二排）';
    btn.textContent=(collapsed?'▸ 参数':'▾ 参数');
  }
  syncDrawerInset();
}
function applyGalleryFixedCollapsed(){
  const lay=document.getElementById('layout');
  if(lay) lay.classList.toggle('gallery-fixed-collapsed', !!galleryFixedCollapsed);
  const btn=document.getElementById('btnToggleGalleryFixed');
  if(btn){
    const collapsed=!!galleryFixedCollapsed;
    btn.setAttribute('aria-pressed', collapsed?'true':'false');
    btn.setAttribute('aria-label', collapsed?'展开概览与筛选':'收起概览与筛选');
    btn.title=collapsed?'展开概览与筛选（KPI+工具栏）':'收起概览与筛选（KPI+工具栏）';
    btn.textContent=(collapsed?'▸ 概览':'▾ 概览');
  }
}
function syncDrawerInset(){
  const d=document.getElementById('drawer');
  if(!d) return;
  // CSS handles inset via .topbar.controls-collapsed ~ .drawer, but sync for file:// fallback
  const topCollapsed=!!controlsCollapsed;
  d.style.top=topCollapsed?'48px':'96px';
}
// Header presets bindings
let _hdrReflectedJobKey='';
(function bindHdr(){
  const bind=(id, key, isNum)=>{
    const el=document.getElementById(id); if(!el) return;
    const ev=(el.tagName==='SELECT'?'change':'input');
    el.addEventListener(ev, ()=>{
      state[key]= isNum ? parseFloat(el.value) : el.value;
      hdrUserEdited=true;
      if(id.indexOf('selLora')===0) syncLoraWtDisabled();
      saveHdr();
    });
  };
  bind('selPreset','preset',false);
  bind('selUnet','unet',false);
  bind('selLora1','lora1',false);
  bind('selLora2','lora2',false);
  bind('selLora3','lora3',false);
  bind('wtLora1','wt1',true);
  bind('wtLora2','wt2',true);
  bind('wtLora3','wt3',true);
  bind('inpSteps','hdrSteps',false);
  bind('inpCfg','hdrCfg',false);
  bind('selSampler','hdrSampler',false);
  bind('selScheduler','hdrScheduler',false);
  bind('inpBatch','hdrBatch',false);
  const b1=document.getElementById('btnToggleControls');
  if(b1) b1.addEventListener('click', ()=>{
    controlsCollapsed=!controlsCollapsed;
    try{ localStorage.setItem('anima.controlsCollapsed', controlsCollapsed?'1':'0'); }catch(e){}
    applyControlsCollapsed();
  });
  const b2=document.getElementById('btnToggleGalleryFixed');
  if(b2) b2.addEventListener('click', ()=>{
    galleryFixedCollapsed=!galleryFixedCollapsed;
    try{ localStorage.setItem('anima.galleryFixedCollapsed', galleryFixedCollapsed?'1':'0'); }catch(e){}
    applyGalleryFixedCollapsed();
  });
})();

// Init
loadHdr();
parseHash();
applyTreeCollapsed();
applyControlsCollapsed();
applyGalleryFixedCollapsed();
updateDelBtn();
window.addEventListener('hashchange', ()=>{ parseHash(); renderTree(); renderScenes(); renderGallery(); updateDelBtn(); if(state.date&&state.job) loadJob(state.date, state.job); if(state.item) openDrawer(state.item); });
loadDates();
fetchHdrMeta().then(function(){ applyHdrToDOM(); });
applyHdrToDOM();
