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
})();

// Init
loadHdr();
parseHash();
applyTreeCollapsed();
updateDelBtn();
window.addEventListener('hashchange', ()=>{ parseHash(); renderTree(); renderScenes(); renderGallery(); updateDelBtn(); if(state.date&&state.job) loadJob(state.date, state.job); if(state.item) openDrawer(state.item); });
loadDates();
fetchHdrMeta().then(function(){ applyHdrToDOM(); });
applyHdrToDOM();

