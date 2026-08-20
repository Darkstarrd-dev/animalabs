function hdrKey(k){ return 'anima.hdr.'+k; }
function saveHdr(){ try{ localStorage.setItem(hdrKey('preset'), state.preset||'turbo'); localStorage.setItem(hdrKey('unet'), state.unet||''); localStorage.setItem(hdrKey('lora1'), state.lora1||'off'); localStorage.setItem(hdrKey('lora2'), state.lora2||'off'); localStorage.setItem(hdrKey('lora3'), state.lora3||'off'); localStorage.setItem(hdrKey('wt1'), String(state.wt1)); localStorage.setItem(hdrKey('wt2'), String(state.wt2)); localStorage.setItem(hdrKey('wt3'), String(state.wt3)); localStorage.setItem(hdrKey('hdrSteps'), String(state.hdrSteps||'')); localStorage.setItem(hdrKey('hdrCfg'), String(state.hdrCfg||'')); localStorage.setItem(hdrKey('hdrSampler'), state.hdrSampler||''); localStorage.setItem(hdrKey('hdrScheduler'), state.hdrScheduler||''); localStorage.setItem(hdrKey('hdrBatch'), String(state.hdrBatch||'')); }catch(e){} }
function loadHdr(){ try{ const p=localStorage.getItem(hdrKey('preset')); if(p) state.preset=p; state.unet=localStorage.getItem(hdrKey('unet'))||''; state.lora1=localStorage.getItem(hdrKey('lora1'))||'off'; state.lora2=localStorage.getItem(hdrKey('lora2'))||'off'; state.lora3=localStorage.getItem(hdrKey('lora3'))||'off'; const w1=localStorage.getItem(hdrKey('wt1')); const w2=localStorage.getItem(hdrKey('wt2')); const w3=localStorage.getItem(hdrKey('wt3')); if(w1!=null) state.wt1=parseFloat(w1)||0.8; if(w2!=null) state.wt2=parseFloat(w2)||1; if(w3!=null) state.wt3=parseFloat(w3)||1; const hs=localStorage.getItem(hdrKey('hdrSteps')); const hc=localStorage.getItem(hdrKey('hdrCfg')); const hsa=localStorage.getItem(hdrKey('hdrSampler')); const hsc=localStorage.getItem(hdrKey('hdrScheduler')); if(hs!=null) state.hdrSteps=hs||''; if(hc!=null) state.hdrCfg=hc||''; if(hsa!=null) state.hdrSampler=hsa||''; if(hsc!=null) state.hdrScheduler=hsc||''; }catch(e){} }
function applyHdrToDOM(){ const s=(id,v)=>{ const el=document.getElementById(id); if(el) el.value=v; }; s('selPreset', state.preset||'turbo'); s('selUnet', state.unet||''); s('selLora1', state.lora1||'off'); s('selLora2', state.lora2||'off'); s('selLora3', state.lora3||'off'); s('wtLora1', state.wt1); s('wtLora2', state.wt2); s('wtLora3', state.wt3); s('inpSteps', state.hdrSteps||''); s('inpCfg', state.hdrCfg||''); s('selSampler', state.hdrSampler||''); s('selScheduler', state.hdrScheduler||''); s('inpBatch', state.hdrBatch||''); syncLoraWtDisabled(); }
function syncLoraWtDisabled(){ [['selLora1','wtLora1'],['selLora2','wtLora2'],['selLora3','wtLora3']].forEach(function(pair){ const a=pair[0],b=pair[1]; const s=document.getElementById(a), w=document.getElementById(b); if(s&&w){ const off=!s.value||s.value==='off'; w.disabled=off; w.style.opacity=off?'.45':'1'; } }); }
function buildHdrPayload(){ const loras=[]; [['lora1','wt1'],['lora2','wt2'],['lora3','wt3']].forEach(function(pair){ const k=pair[0],wk=pair[1]; const name=state[k]; if(name && name!=='off'){ let wt=parseFloat(state[wk]); if(!isFinite(wt)) wt=1; loras.push({name:name, weight:wt}); }}); const payload={preset:state.preset||'turbo', unet_name: state.unet||'', loras:loras}; const s=parseInt(state.hdrSteps,10); if(isFinite(s) && String(state.hdrSteps).trim()!=='') payload.steps=s; const c=parseFloat(state.hdrCfg); if(isFinite(c) && String(state.hdrCfg).trim()!=='') payload.cfg=c; if(state.hdrSampler && state.hdrSampler!=='') payload.sampler=state.hdrSampler; if(state.hdrScheduler && state.hdrScheduler!=='') payload.scheduler=state.hdrScheduler; const b=parseInt(state.hdrBatch,10); if(isFinite(b) && String(state.hdrBatch).trim()!=='' && b>=1){ payload.batch=Math.max(1, Math.min(8, b)); } return payload; }
async function fetchHdrMeta(){ try{ const r=await fetch('/api/meta'); if(!r.ok) return; const j=await r.json(); hdrMeta.unets=j.unets||[]; hdrMeta.loras=j.loras||[]; hdrMeta.samplers=j.samplers||['euler','euler_ancestral','heun','dpmpp_2m','dpmpp_sde','dpmpp_2m_sde','euler_cfg_pp','er_sde']; hdrMeta.schedulers=j.schedulers||['normal','karras','exponential','simple','sgm_uniform','beta','linear_quadratic']; populateHdrSelects(); }catch(e){} }
function reflectHdrFromJob(j){
  if(!j || hdrUserEdited) return;
  const key=(j.job_id||'')+'|'+(j.date||'');
  if(key===_hdrReflectedJobKey) return;
  _hdrReflectedJobKey=key;
  const d=j.defaults||{};
  let touched=false;
  if(d.preset && d.preset!==state.preset){ state.preset=d.preset; touched=true; }
  if(d.unet_name!==undefined && d.unet_name!==state.unet){ state.unet=d.unet_name||''; touched=true; }
  if(Array.isArray(d.loras) && d.loras.length){
    (d.loras||[]).slice(0,3).forEach(function(lr, idx){
      const k=['lora1','lora2','lora3'][idx], wk=['wt1','wt2','wt3'][idx];
      if(lr && lr.name && lr.name!==state[k]){ state[k]=lr.name; touched=true; }
      if(lr && isFinite(lr.weight) && lr.weight!==state[wk]){ state[wk]=lr.weight; touched=true; }
    });
  }
  if(d.steps!=null && String(d.steps)!==String(state.hdrSteps)) { state.hdrSteps=String(d.steps); touched=true; }
  if(d.cfg!=null && String(d.cfg)!==String(state.hdrCfg)) { state.hdrCfg=String(d.cfg); touched=true; }
  if(d.sampler && d.sampler!==state.hdrSampler){ state.hdrSampler=d.sampler; touched=true; }
  if(d.scheduler && d.scheduler!==state.hdrScheduler){ state.hdrScheduler=d.scheduler; touched=true; }
  if(d.batch!=null && String(d.batch)!==String(state.hdrBatch)) { state.hdrBatch=String(d.batch); touched=true; }
  if(touched){ applyHdrToDOM(); saveHdr(); }
}

function populateHdrSelects(){ const selU=document.getElementById('selUnet'); if(selU){ const cur=state.unet||''; selU.innerHTML='<option value="">(follow preset)</option>'+hdrMeta.unets.map(function(n){ return '<option value="'+escapeHtml(n)+'">'+escapeHtml(n)+'</option>'; }).join(''); selU.value=cur; if(selU.value!==cur && cur) { const o=document.createElement('option'); o.value=cur; o.textContent=cur+' (missing)'; selU.appendChild(o); selU.value=cur; } } ['selLora1','selLora2','selLora3'].forEach(function(id){ const el=document.getElementById(id); if(!el) return; const curKey=id==='selLora1'?'lora1':id==='selLora2'?'lora2':'lora3'; const cur=state[curKey]||'off'; el.innerHTML='<option value="off">off</option>'+hdrMeta.loras.map(function(n){ return '<option value="'+escapeHtml(n)+'">'+escapeHtml(n)+'</option>'; }).join(''); el.value=cur; if(el.value!==cur){ const o=document.createElement('option'); o.value=cur; o.textContent=cur+' (missing)'; el.appendChild(o); el.value=cur; }}); const selS=document.getElementById('selSampler'); if(selS){ const cur=state.hdrSampler||''; selS.innerHTML='<option value="">—</option>'+hdrMeta.samplers.map(function(n){ return '<option value="'+escapeHtml(n)+'">'+escapeHtml(n)+'</option>'; }).join(''); selS.value=cur; if(selS.value!==cur && cur){ const o=document.createElement('option'); o.value=cur; o.textContent=cur; selS.appendChild(o); selS.value=cur; }} const selSc=document.getElementById('selScheduler'); if(selSc){ const cur=state.hdrScheduler||''; selSc.innerHTML='<option value="">—</option>'+hdrMeta.schedulers.map(function(n){ return '<option value="'+escapeHtml(n)+'">'+escapeHtml(n)+'</option>'; }).join(''); selSc.value=cur; if(selSc.value!==cur && cur){ const o=document.createElement('option'); o.value=cur; o.textContent=cur; selSc.appendChild(o); selSc.value=cur; }} syncLoraWtDisabled(); }
function parseHash(){ const ps=new URLSearchParams(location.hash.slice(1)); state.date=ps.get('date')||''; state.job=ps.get('job')||''; state.item=ps.get('item')||''; state.scene=ps.get('scene')||''; state.variant=ps.get('variant')||''; }
function pushHash(){ const ps=new URLSearchParams(); if(state.date) ps.set('date',state.date); if(state.job) ps.set('job',state.job); if(state.item) ps.set('item',state.item); if(state.scene) ps.set('scene',state.scene); if(state.variant) ps.set('variant',state.variant); const s=ps.toString(); history.replaceState(null,'', s?'#'+s:location.pathname); }
function setLive(ok){ const el=$('#livePill'); if(!el) return; el.textContent= ok?'● LIVE':'○ OFFLINE'; el.className='pill '+(ok?'live':'warn'); }
function segmentPrompt(s){
  const parts=String(s).split(/\.\s+/).map(p=>p.trim()).filter(Boolean);
  if(parts.length<=1) return escapeHtml(s);
  return parts.map(p=>'<p style="margin:4px 0">'+escapeHtml(p.endsWith('.')?p:p+'.')+'</p>').join('');
}
function escapeHtml(s){ return String(s).replace(/[&<>"']/g, c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }
function monthKey(date){ return date.slice(0,7); }

