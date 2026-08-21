const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const api = p => fetch(p).then(r => { if(!r.ok) throw new Error(r.status+' '+r.statusText); return r.json(); });

let state = { date:'', job:'', item:'', scene:'', variant:'', filter:'all', tagFilter:'', sortBy:'id', dates:[], jobsByDate:{}, curJob:null, thumbSize:260, preset:'turbo', unet:'', lora1:'off', lora2:'off', lora3:'off', wt1:0.8, wt2:1, wt3:1, hdrSteps:'', hdrCfg:'', hdrSampler:'', hdrScheduler:'', hdrBatch:'' };
let selectedIds = new Set();
let monthCollapsed = new Set();
let dayCollapsed = new Set();
let sceneCollapsed = new Set();
let treeCollapsed = localStorage.getItem('anima.treeCollapsed')==='1';
let controlsCollapsed = localStorage.getItem('anima.controlsCollapsed')==='1';
let galleryFixedCollapsed = localStorage.getItem('anima.galleryFixedCollapsed')==='1';
let pollTimer = null;
// thumbnail keyboard focus: null=batch模式, 非null=单图模式 (+/- 针对单图)
let focusedThumbId = null;
let hdrMeta={unets:[],loras:[],samplers:[],schedulers:[]};
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

async function loadDates(){
  try{
    const dates=await api('/api/dates');
    state.dates=dates;
    // preload jobs for tree
    for(const d of dates){
      try{ state.jobsByDate[d.date]=await api('/api/jobs?date='+encodeURIComponent(d.date)); }catch{ state.jobsByDate[d.date]=[]; }
    }
    renderTree();
    $('#fileOff').classList.remove('show');
    setLive(true);
    updateKpi();
    if(state.date && state.job) loadJob(state.date, state.job);
    else if(state.date) setTimeout(()=>{ const first=(state.jobsByDate[state.date]||[])[0]; if(first&&!state.job){ state.job=first.job_id; pushHash(); loadJob(state.date, state.job); renderTree(); }},0);
  }catch(e){
    $('#fileOff').classList.add('show');
    setLive(false);
    console.error(e);
  }
}
function renderTree(){
  const wrap=$('#tree'); wrap.innerHTML='';
  if(!state.dates.length){ $('#treeEmpty').style.display=''; return; }
  $('#treeEmpty').style.display='none';
  // group by month
  const byMonth={};
  for(const d of state.dates){ const m=monthKey(d.date); (byMonth[m]||(byMonth[m]=[])).push(d); }
  const months=Object.keys(byMonth).sort().reverse();
  // auto expand month containing selected date
  const selMonth=state.date? monthKey(state.date): months[0];
  for(const m of months){
    const days=byMonth[m].sort((a,b)=> b.date.localeCompare(a.date));
    const collapsed=monthCollapsed.has(m) && m!==selMonth;
    const totalJobs=days.reduce((a,b)=>a+b.job_count,0);
    const totalImgs=days.reduce((a,b)=>a+b.image_count,0);
    const monthEl=document.createElement('div'); monthEl.className='tree-month'+(collapsed?' collapsed':'');
    monthEl.innerHTML=`<div class="tree-month-head" role="button" tabindex="0" aria-expanded="${!collapsed}"><span class="chev">▾</span><span>${m}</span><span style="margin-left:auto;color:var(--muted);font:500 11px/1 Fira Code,monospace">${totalJobs} jobs · ${totalImgs} imgs</span></div><div class="tree-month-body"></div>`;
    const body=monthEl.querySelector('.tree-month-body');
    for(const d of days){
      const dayKey=d.date;
      const dCollapsed=dayCollapsed.has(dayKey) && dayKey!==state.date;
      const jobs=state.jobsByDate[d.date]||[];
      const dayEl=document.createElement('div'); dayEl.className='tree-day'+(dCollapsed?' collapsed':'');
      dayEl.innerHTML=`<div class="tree-day-head" role="button" tabindex="0" aria-expanded="${!dCollapsed}"><span class="chev">▾</span><span>${d.date}</span><span style="margin-left:auto;color:var(--muted);font:500 11px/1 Fira Code,monospace">${d.job_count} · ${d.image_count} imgs</span></div><div class="tree-day-body"></div>`;
      const dayBody=dayEl.querySelector('.tree-day-body');
      if(!jobs.length){
        dayBody.innerHTML=`<div class="empty" style="padding:8px">无包</div>`;
      } else {
        for(const j of jobs){
          const active=state.date===d.date && state.job===j.job_id;
          const el=document.createElement('div'); el.className='tree-job'+(active?' active':'');
          const c=j.counts; el.title=`done:${c.done} failed:${c.failed} kept:${c.kept} rejected:${c.rejected} unreviewed:${c.unreviewed}`;
          el.innerHTML=`<span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(j.job_id)}</span><span style="display:flex;gap:4px;flex-shrink:0"><span class="badge ${c.failed?'failed':''}">${c.kept}✓</span><span class="badge">${c.done}/${j.item_count}</span></span>`;
          el.onclick=()=>{ state.date=d.date; state.job=j.job_id; state.scene=''; state.variant=''; pushHash(); renderTree(); renderScenes(); loadJob(d.date, j.job_id); };
          dayBody.appendChild(el);
        }
      }
      const head=dayEl.querySelector('.tree-day-head');
      head.onclick=()=>{ if(dayCollapsed.has(dayKey)) dayCollapsed.delete(dayKey); else dayCollapsed.add(dayKey); renderTree(); };
      head.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); head.onclick(); }};
      body.appendChild(dayEl);
    }
    const mHead=monthEl.querySelector('.tree-month-head');
    mHead.onclick=()=>{ if(monthCollapsed.has(m)) monthCollapsed.delete(m); else monthCollapsed.add(m); renderTree(); };
    mHead.onkeydown=e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); mHead.onclick(); }};
    wrap.appendChild(monthEl);
  }
}

function updateDelBtn(){
  const btn=document.getElementById('btnDelJob');
  if(!btn) return;
  const hasJob=!!(state.date && state.job);
  btn.disabled=!hasJob;
  btn.title=hasJob ? '删除当前包: '+state.date+'/'+state.job+'（含 jobs 定义与 output 图片，不可撤销）' : '先在左侧导航选中一个包';
}
function updateRerunBtn(){
  const btn=document.getElementById('btnRerunGroup');
  if(!btn) return;
  const hasGroup=!!(state.date && state.job && state.scene);
  if(!hasGroup){ btn.style.display='none'; btn.disabled=true; btn.title='在中栏 Scenes 选择一个分组后可用，将重跑该分组已跑过的图片'; return; }
  btn.style.display='';
  // check if any done/failed in that group to rerun
  const items=(state.curJob && state.curJob.items)||[];
  let count=0;
  for(const it of items){
    if(it.group!==undefined || it.scene!==undefined){
      const g=(it.group||it.scene||'__default__')||'__default__';
      if(g!==state.scene) continue;
      if(state.variant){
        const sg=(it.subgroup||it.variant||'')||'';
        // use subgroupKey logic: if variant set, match subgroupKey
        if(sg!==state.variant) continue;
      }
      count++;
    } else {
      if(items.length===1) count++;
    }
  }
  // fallback: if count computed 0, try via current filtered group match
  if(count===0 && state.scene){
    const scenes=(state.curJob && state.curJob._scenes)||[];
    const sc=scenes.find(s=>s.scene===state.scene);
    if(sc){
      if(state.variant && sc.variants[state.variant]) count=sc.variants[state.variant];
      else if(!state.variant) count=sc.count;
    }
  }
  btn.disabled = count===0;
  const label = state.variant ? `${state.scene}/${state.variant}` : state.scene;
  const disp = label==='__default__'?'未分组':label;
  btn.title=`重运行分组 [${disp}] 内 ${count} 张（覆盖已有图，需二次确认）`;
  // show count in text
  btn.textContent='↻ 重运行 '+disp;
}
async function loadJob(date,job){
  try{
    const j=await api('/api/job?date='+encodeURIComponent(date)+'&job='+encodeURIComponent(job));
    // build scene index client-side
    const scenes=buildScenes(j);
    j._scenes=scenes;
    state.curJob=j;
    reflectHdrFromJob(j);
    selectedIds.clear();
    updateDelBtn();
    // if selected scene no longer exists, clear it
    if(state.scene && !scenes.find(s=> s.scene===state.scene)) { state.scene=''; state.variant=''; }
    renderScenes(); renderGallery(); updateKpi(); renderTree();
    if(!state._suppressDrawer && state.item) openDrawer(state.item);
    await syncRunStatus();
    startPolling();
  }catch(e){ console.error(e); }
}
function groupKey(it){ const g=(it.group||'').trim(); if(g) return g; const s=(it.scene||'').trim(); return s || '__default__'; }
function subgroupKey(it, job){
  const sg=(it.subgroup||'').trim(); if(sg) return sg;
  const v=(it.variant||'').trim(); if(v) return v;
  // derive from tags/group_by if present
  if(it.tags && Array.isArray(it.group_by) && it.group_by.length>=2){
    const v2=(it.tags[it.group_by[1]]||'').trim();
    if(v2) return v2;
  }
  if(it.tags && it.tags.sampler && it.tags.scheduler) return it.tags.sampler + ' x ' + it.tags.scheduler;
  // single item no grouping
  if(!it.group && !it.scene) return '';
  // fallback ratio
  const w=it.width ?? job.defaults?.width ?? 1024;
  const h=it.height ?? job.defaults?.height ?? 768;
  const rw=w%8? ((w+7)/8)*8 : w; const rh=h%8? ((h+7)/8)*8 : h;
  const g=gcd(rw,rh)||1; return `${rw/g}:${rh/g}`;
}
function buildScenes(job){
  const by={}; const order=[];
  for(const it of job.items){
    const sc=groupKey(it);
    if(!by[sc]){ by[sc]=[]; order.push(sc); }
    by[sc].push(it);
  }
  order.sort(); if(order.includes('__default__') && order.length>1){ order.splice(order.indexOf('__default__'),1); order.push('__default__'); }
  return order.map(scene=>{
    const items=by[scene];
    const variants={};
    for(const it of items){
      const k=subgroupKey(it, job);
      const key=k || '__single__';
      variants[key]=(variants[key]||0)+1;
    }
    // if only __single__, hide second level
    const variantEntries= (Object.keys(variants).length===1 && variants['__single__']) ? {} : variants;
    return { scene, items, variants: variantEntries, count: items.length };
  });
}
function gcd(a,b){ for(;b;) { const t=b; b=a%b; a=t; } return a; }
function latestGroup(){
  if(!state.curJob||!state.curJob.items) return null;
  // newest done = last done in polling order; file scan shows actual newest is at higher indices after insertion
  // Use array order: latest newlyDone is last in items with status done that has just transitioned
  // To track across polls, remember last newlyDone ids
  if(state._latestGroupId){
    const it=state.curJob.items.find(x=> x.id===state._latestGroupId);
    if(it && it.status==='done' && it.output) return { group: groupKey(it), subgroup: subgroupKey(it, state.curJob) || '__single__', id: it.id };
  }
  // fallback: most recent done by array tail (output files appended sequentially, indices grow with generation)
  for(let i=state.curJob.items.length-1;i>=0;--i){ const it=state.curJob.items[i]; if(it.status==='done'&&it.output){ return { group: groupKey(it), subgroup: subgroupKey(it, state.curJob) || '__single__', id: it.id }; } }
  return null;
}
function renderScenes(){
  const ul=$('#sceneList'); ul.innerHTML='';
  const sub=$('#sceneSub');
  if(!state.curJob){ $('#sceneEmpty').style.display=''; $('#sceneEmpty').textContent='先选择左侧的批次包'; sub.textContent='选择批次后按分组聚合'; return; }
  $('#sceneEmpty').style.display='none';
  const scenes=state.curJob._scenes||[];
  sub.textContent=`${scenes.length} 分组 · ${state.curJob.items.length} 项`;
  // "全部"
  const allActive=!state.scene;
  const allLi=document.createElement('li'); allLi.className='scene-item'+(allActive?'':' collapsed');
  // we render "全部" as a selectable head row without variants
  const allEl=document.createElement('div'); allEl.className='scene-item';
  allEl.innerHTML=`<div class="scene-head" data-scene-all style="background: ${allActive?'rgba(34,197,94,.10)':'transparent'};border-radius:10px;">全部 (${state.curJob.items.length})<span style="margin-left:auto;color:var(--muted);font:500 11px/1 Fira Code,monospace">${filteredCountForScene('') } 项可见</span></div>`;
  allEl.querySelector('[data-scene-all]').onclick=()=>{ state.scene=''; state.variant=''; clearFocusedThumb(); pushHash(); renderScenes(); renderGallery(); };
  ul.appendChild(allEl);

  updateRerunBtn();
  for(const g of scenes){
    const active=state.scene===g.scene;
    const collapsed=sceneCollapsed.has(g.scene) && !active;
    const li=document.createElement('li'); li.className='scene-item'+(collapsed?' collapsed':'');
    const latest=latestGroup();
    const isLatestGroup = latest && latest.group===g.scene;
    const label=g.scene==='__default__' ? '未分组' : g.scene;
    li.innerHTML=`<div class="scene-head" role="button" tabindex="0" aria-expanded="${!collapsed}"><span class="chev">▾</span><span>${escapeHtml(label)}</span><span style="margin-left:auto;display:flex;gap:6px;align-items:center">${isLatestGroup?'<span class="badge" style="background:rgba(56,189,248,.18);border-color:rgba(56,189,248,.35);color:#7DD3FC" title="最新生成在此分组">● 新</span>':''}<span class="badge">${g.count}项</span><span class="badge" style="${active?'background:rgba(34,197,94,.14);border-color:rgba(34,197,94,.28)':''}">${active?'选中':''}</span></span></div><div class="scene-body"></div>`;
    const body=li.querySelector('.scene-body');
    // variants - lexical for alignment with execution order (counts shown in badge)
    const vs=Object.entries(g.variants).sort((a,b)=> a[0].localeCompare(b[0]));
    for(const [v,c] of vs){
      const vActive=active && state.variant===v;
      const isLatestSub = latest && latest.group===g.scene && latest.subgroup===v;
      const row=document.createElement('div'); row.className='scene-variant'+(vActive?' active':'');
      row.innerHTML=`<span>${escapeHtml(v)}${isLatestSub?' <span style="color:#7DD3FC">●</span>':''}</span><span class="badge">${c}</span>`;
      row.onclick=()=>{
        if(state.scene===g.scene && state.variant===v){ state.variant=''; } else { state.scene=g.scene; state.variant=v; }
        clearFocusedThumb();
        pushHash(); renderScenes(); renderGallery();
      };
      body.appendChild(row);
    }
    // selecting scene head selects whole scene
    const head=li.querySelector('.scene-head');
    head.onclick=e=>{
      if(e.target.closest('.badge')) return;
      if(state.scene===g.scene && !state.variant){
        if(sceneCollapsed.has(g.scene)) sceneCollapsed.delete(g.scene); else sceneCollapsed.add(g.scene);
        renderScenes();
        return;
      }
      state.scene=g.scene; state.variant=''; clearFocusedThumb(); pushHash();
      sceneCollapsed.delete(g.scene);
      renderScenes(); renderGallery();
      requestAnimationFrame(()=> head.scrollIntoView({block:'nearest', behavior:'smooth'}));
    };
    const chev=li.querySelector('.chev');
    chev.onclick=e=>{ e.stopPropagation(); if(sceneCollapsed.has(g.scene)) sceneCollapsed.delete(g.scene); else sceneCollapsed.add(g.scene); renderScenes(); };
    body.onclick=e=> e.stopPropagation();
    ul.appendChild(li);
  }
  // auto-scroll selected scene into view (Ctrl+Up/Down may change to far group)
  requestAnimationFrame(()=>{
    const activeHead = ul.querySelector('.scene-head[aria-expanded]') && ul.querySelector('.scene-item .scene-head');
    // find active by matching state.scene
    const scenes = state.curJob && state.curJob._scenes || [];
    const idx = scenes.findIndex(s=> s.scene===state.scene);
    if(idx>=0){
      const heads = ul.querySelectorAll('.scene-head');
      // heads[0] is "全部", so offset 1
      const target = heads[idx+1];
      if(target) target.scrollIntoView({block:'nearest', behavior:'smooth'});
    }
  });
}
function filteredCountForScene(key){ if(!state.curJob) return 0; if(!key) return filteredItems().length; return 0; }

function clearGallery(){
  $('#grid').innerHTML=''; $('#countInfo').textContent=''; $('#galleryEmpty').style.display='none'; $('#hint').style.display='none'; closeDrawer();
  updateKpi();
}
function matchesFilters(it){
  if(state.filter!=='all'){
    if(state.filter==='failed'){ if(it.status!=='failed') return false; }
    else { const v=(it.review&&it.review.verdict)||'unreviewed'; if(v!==state.filter) return false; }
  }
  if(state.tagFilter.trim()){
    const needles=state.tagFilter.split(',').map(s=>s.trim().toLowerCase()).filter(Boolean);
    const tags=(it.review&&it.review.tags)||[];
    const low=tags.map(t=>t.toLowerCase());
    if(!needles.some(n=> low.includes(n) || low.some(t=> t.includes(n)))) return false;
  }
  // scene / variant (generic group/subgroup)
  if(state.scene){
    const sc=groupKey(it);
    if(sc!==state.scene) return false;
    if(state.variant){
      let cur=subgroupKey(it, state.curJob);
      if(!cur) cur='__single__';
      if(cur!==state.variant) return false;
    }
  }
  return true;
}
function filteredDisplayItems(){
  // gallery/lb should show batch siblings as independent cards
  const base=filteredItems();
  return expandedDisplayItems(base);
}
function filteredItems(){
  if(!state.curJob) return [];
  let items=[...state.curJob.items].filter(matchesFilters);
  if(state.sortBy==='seed'){
    items.sort((a,b)=>{
      const sa=a.seed ?? a.output?.filename ?? a.id;
      const sb=b.seed ?? b.output?.filename ?? b.id;
      return String(sa).localeCompare(String(sb));
    });
  }else if(state.sortBy==='status'){
    const order={failed:0, pending:1, queued:2, done:3};
    items.sort((a,b)=> (order[a.status]??9)-(order[b.status]??9) || String(a.id).localeCompare(String(b.id)));
  }else{
    items.sort((a,b)=> String(a.id).localeCompare(String(b.id), undefined, {numeric:true}));
  }
  return items;
}
function expandedDisplayItems(baseItems){
  const out=[];
  for(const it of baseItems){
    if(it.status==='done' && it.output && it.output.filename){
      const urls=allImageUrls(it);
      if(urls.length<=1){
        out.push({...it, _displayId: it.id, _originalId: it.id, _displayUrl: urls[0]||imageUrl(it), _batchIndex:0, _batchTotal:1});
      } else {
        for(let i=0;i<urls.length;i++){
          const bo = i===0 ? it.output : (it.output.batch_outputs||[])[i-1];
          const fn = bo ? bo.filename : it.output.filename;
          const w = bo ? bo.w : it.output.w;
          const h = bo ? bo.h : it.output.h;
          const displayId = i===0 ? it.id : `${it.id}__b${i+1}`;
          out.push({...it, id: displayId, _originalId: it.id, _displayId: displayId, _displayUrl: urls[i], _batchIndex:i, _batchTotal:urls.length, _batchOutput: bo, output: {...it.output, filename: fn, w, h, bytes: bo?bo.bytes:it.output.bytes, sha16: bo?bo.sha16:it.output.sha16}});
        }
      }
    } else {
      out.push({...it, _displayId: it.id, _originalId: it.id, _displayUrl: imageUrl(it), _batchIndex:0, _batchTotal:1});
    }
  }
  return out;
}
function allImageUrls(item){
  if(!item.output||!item.output.filename) return [];
  const base='/output/'+encodeURIComponent(state.date)+'/'+encodeURIComponent(state.curJob.job_id)+'/';
  const urls=[base+encodeURIComponent(item.output.filename)];
  const sibs=item.output.batch_outputs||[];
  for(const bo of sibs){ if(bo.filename && !bo.deleted) urls.push(base+encodeURIComponent(bo.filename)); }
  return urls;
}
function imageUrl(item){
  if(!item.output||!item.output.filename) return '';
  return '/output/'+encodeURIComponent(state.date)+'/'+encodeURIComponent(state.curJob.job_id)+'/'+encodeURIComponent(item.output.filename);
}

function getThumbGridCols(){
  const grid = document.getElementById('grid');
  if(!grid || !grid.children.length) return 1;
  const rect0 = grid.children[0].getBoundingClientRect();
  let cols = 1;
  for(let i=1;i<grid.children.length;i++){
    const r = grid.children[i].getBoundingClientRect();
    if(Math.abs(r.top - rect0.top) < 8) cols++;
    else break;
  }
  if(cols<1) cols=1;
  return cols;
}
function setFocusedThumb(id){
  focusedThumbId = id;
  document.querySelectorAll('.card.thumb-focused').forEach(el=> el.classList.remove('thumb-focused'));
  const el = id ? document.querySelector('.card[data-id="'+CSS.escape(id)+'"]') : null;
  if(el){ el.classList.add('thumb-focused'); el.scrollIntoView({block:'nearest', inline:'nearest'}); }
  updateThumbFocusHint();
}
function clearFocusedThumb(){
  focusedThumbId = null;
  document.querySelectorAll('.card.thumb-focused').forEach(el=> el.classList.remove('thumb-focused'));
  updateThumbFocusHint();
}
function updateThumbFocusHint(){
  const pill = document.getElementById('thumbFocusHint');
  if(!pill) return;
  if(focusedThumbId){
    pill.textContent = '● 图 ' + focusedThumbId;
    pill.style.display = '';
  } else {
    if(state.scene){ pill.textContent = '○ 组 ' + (state.variant? state.scene+'/'+state.variant : state.scene); pill.style.display=''; }
    else pill.style.display='none';
  }
}
function moveFocusedThumb(dir){
  const ids = filteredDisplayItems().map(x=> x.id);
  if(!ids.length) return;
  if(focusedThumbId===null){
    setFocusedThumb(dir==='ArrowLeft' || dir==='ArrowUp' ? ids[ids.length-1] : ids[0]);
    return;
  }
  const curIdx = ids.indexOf(focusedThumbId);
  const cols = getThumbGridCols();
  let nextIdx;
  if(dir==='ArrowRight') nextIdx = Math.min(curIdx+1, ids.length-1);
  else if(dir==='ArrowLeft') nextIdx = Math.max(curIdx-1, 0);
  else if(dir==='ArrowDown') nextIdx = Math.min(curIdx+cols, ids.length-1);
  else if(dir==='ArrowUp') nextIdx = Math.max(curIdx-cols, 0);
  else return;
  setFocusedThumb(ids[nextIdx]);
}
function ensureFocusedThumbValid(){
  if(focusedThumbId===null) return;
  const ids = new Set(filteredDisplayItems().map(x=> x.id));
  if(!ids.has(focusedThumbId)) clearFocusedThumb();
  else updateThumbFocusHint();
}

function updateKpi(){
  const jobsEl=$('#kpiJobs'), imgEl=$('#kpiImages'), keptEl=$('#kpiKept'), revEl=$('#kpiReview');
  if(!jobsEl) return;
  const dateEntry=state.dates.find(d=>d.date===state.date);
  const totalJobs=dateEntry? dateEntry.job_count : state.dates.reduce((a,b)=>a+b.job_count,0);
  const totalImages=dateEntry? dateEntry.image_count : state.dates.reduce((a,b)=>a+b.image_count,0);
  jobsEl.textContent = state.dates.length? String(totalJobs) : '—';
  imgEl.textContent = state.dates.length? String(totalImages) : '—';
  if(state.curJob){
    const c=state.curJob.items.reduce((acc,it)=>{
      const v=(it.review&&it.review.verdict)||'unreviewed';
      acc[v]=(acc[v]||0)+1;
      acc[it.status]=(acc[it.status]||0)+1;
      return acc;
    },{});
    keptEl.textContent=String(c.kept||0);
    revEl.textContent=`${c.unreviewed||0} / ${c.rejected||0} / ${c.failed||0}`;
    revEl.title=`unreviewed / rejected / failed`;
  }else{
    keptEl.textContent='—';
    revEl.textContent='—';
  }
}
function createCard(it){
  const verdict=(it.review&&it.review.verdict)||'unreviewed';
  const status=it.status;
  const card=document.createElement('div');
  card.className='card '+(verdict==='rejected'?'rejected': verdict==='kept'?'kept':'');
  card.setAttribute('role','listitem');
  card.dataset.id=it.id;
  const ribbonText=status==='failed'?'失败': verdict==='kept'?'保留': verdict==='rejected'?'驳回':'未审核';
  const ribbonClass=status==='failed'?'failed': verdict;
  const url=it._displayUrl || imageUrl(it);
  const hasImg=!!url && status==='done' && !(it.output && it.output.missing) && !(it.output && it.output.deleted);
  const checked=selectedIds.has(it._originalId||it.id)?'checked':'';
  const dims=it.output? `${it.output.w}×${it.output.h}` : (it.width||it.height? `${it.width||'—'}×${it.height||'—'}` : '');
  const isBatchSibling = it._batchTotal>1;
  const batchLabel = isBatchSibling ? ` · ${it._batchIndex+1}/${it._batchTotal}` : '';
  card.innerHTML=`
      <div class="card-media">
        ${hasImg? `<img loading="lazy" src="${url}" alt="#${escapeHtml(it._displayId||it.id)}">` : `<div class="placeholder">${status==='failed'?'失败 · 查看错误': status==='pending'?'待生成 — 点运行批次': status==='queued'?'队列中': it.output&&it.output.missing?'图片缺失（output 已清理）': it.output&&it.output.deleted?'已删除': '无图 · 先运行批次'}</div>`}
        <span class="ribbon ${ribbonClass}">${ribbonText}</span>
        <label class="select-check" title="多选"><input type="checkbox" ${checked} data-check="${escapeHtml(it._originalId||it.id)}" aria-label="选择 ${escapeHtml(it._originalId||it.id)}"></label>
      </div>
      <div class="card-body">
        <div class="card-title"><span>#${escapeHtml(it._displayId||it.id)}</span><span style="color:var(--muted);font:500 11px/1 Fira Code,monospace">${dims}${batchLabel}</span></div>
      </div>
      <div class="card-actions">
        <button class="btn-ghost" data-act="kept" data-id="${escapeHtml(it._originalId||it.id)}" aria-label="保留 ${escapeHtml(it.id)}">✓ 保留</button>
        <button class="btn-ghost" data-act="rejected" data-id="${escapeHtml(it._originalId||it.id)}" aria-label="驳回 ${escapeHtml(it.id)}">✕ 驳回</button>
      </div>`;
  const img=card.querySelector('.card-media img');
  if(img){ img.addEventListener('click', ()=> openLightbox(it._displayId||it.id)); img.style.cursor='zoom-in'; }

  card.querySelectorAll('[data-act]').forEach(btn=>{
    btn.onclick=e=>{
      e.stopPropagation();
      const act=btn.dataset.act, id=btn.dataset.id;
      if(act==='kept'||act==='rejected') doReview(id, act);
    };
  });
  const cb=card.querySelector('input[type=checkbox]');
  cb.addEventListener('change', ()=>{ if(cb.checked) selectedIds.add(it.id); else selectedIds.delete(it.id); updateBatchBar(); });
  card.tabIndex=0;
  card.addEventListener('keydown', e=>{ if(e.key==='Enter') openLightbox(it._displayId||it.id); if(e.key===' '){ e.preventDefault(); cb.checked=!cb.checked; cb.dispatchEvent(new Event('change')); }});
  return card;
}
function renderGallery(){
  const grid=$('#grid');
  if(!state.curJob){ clearGallery(); return; }
  const items=filteredDisplayItems();
  $('#countInfo').textContent=`${items.length}/${state.curJob.items.length} · ${state.curJob.job_id} · ${state.date}${state.scene? ' · '+state.scene:''}`;
  const hint=$('#hint');
  if(state.curJob.items.length && items.length===0){
    hint.style.display=''; hint.textContent='无匹配项 — 试试切换筛选、场景或清空 tags';
  }else hint.style.display='none';
  if(!items.length){
    grid.innerHTML=''; $('#galleryEmpty').style.display='';
    if(!state.curJob.items.length) $('#galleryEmpty').textContent='空批次 — 去改 job JSON 或点「运行批次」';
    return;
  }
  $('#galleryEmpty').style.display='none';
  // diff: reuse existing nodes when possible (for polling)
  const existing=new Map([...grid.children].map(el=>[el.dataset.id, el]));
  const nextIds=new Set(items.map(it=> it.id));
  // remove cards not in filtered
  for(const [id,el] of existing){ if(!nextIds.has(id)) el.remove(); }
  // upsert in order
  let idx=0;
  for(const it of items){
    const was=grid.querySelector(`[data-id="${CSS.escape(it.id)}"]`);
    if(was){
      // update if status/review changed (re-render that card)
      const curVerdict=(it.review&&it.review.verdict)||'unreviewed';
      const curStatus=it.status;
      const needUpdate=was._verdict!==curVerdict || was._status!==curStatus || was._outFn!== (it.output&&it.output.filename);
      if(needUpdate){
        const wasFocused = was.classList.contains('thumb-focused');
        const fresh=createCard(it);
        fresh._verdict=curVerdict; fresh._status=curStatus; fresh._outFn=it.output&&it.output.filename;
        if(wasFocused) fresh.classList.add('thumb-focused');
        was.replaceWith(fresh);
      }
      // ensure order
      if(grid.children[idx]!== (was.parentNode? was : grid.querySelector(`[data-id="${CSS.escape(it.id)}"]`))){
        const node=grid.querySelector(`[data-id="${CSS.escape(it.id)}"]`);
        if(node && grid.children[idx]!==node) grid.insertBefore(node, grid.children[idx]||null);
      }
    } else {
      const card=createCard(it);
      card._verdict=(it.review&&it.review.verdict)||'unreviewed'; card._status=it.status; card._outFn=it.output&&it.output.filename;
      const before=grid.children[idx]||null;
      if(before) grid.insertBefore(card, before); else grid.appendChild(card);
    }
    idx++;
  }
  updateBatchBar(); updateKpi(); ensureFocusedThumbValid();
}
function applyIncrementalUpdate(prevJob, nextJob){
  if(!prevJob || !nextJob) { renderGallery(); return; }
  // if already rendered via full diff above, incremental is redundant — but for polling we call it before render
  let newlyDone=[];
  const prevMap=new Map(prevJob.items.map(x=> [x.id, x]));
  for(const it of nextJob.items){
    const p=prevMap.get(it.id);
    if(p && p.status!==it.status && it.status==='done' && it.output && it.output.filename) newlyDone.push(it);
  }
  if(newlyDone.length){
    const newest=newlyDone[newlyDone.length-1];
    state._latestGroupId=newest.id;
    renderGallery(); renderScenes();
    const first=newlyDone[0];
    requestAnimationFrame(()=>{
      for(const it of newlyDone){
        const el=document.querySelector(`[data-id="${CSS.escape(it.id)}"]`);
        if(el){ el.style.outline='2px solid rgba(34,197,94,.6)'; setTimeout(()=> el.style.outline='', 1200); }
        for(let k=2;k<=8;k++){ const sib=document.querySelector(`[data-id="${CSS.escape(it.id+'__b'+k)}"]`); if(sib){ sib.style.outline='2px solid rgba(34,197,94,.6)'; setTimeout(()=> sib.style.outline='', 1200); } }
      }
    });
    $('#status').textContent=`新增 ${newlyDone.length} 张 · ${first.id} …`;
    setTimeout(()=>{ if(!pollTimer) $('#status').textContent=''; }, 3000);
  } else {
    renderGallery();
  }
}
function startPolling(){
  if(pollTimer) { clearInterval(pollTimer); pollTimer=null; }
  if(!state.date||!state.job) return;
  const checkPending=()=> state.curJob && state.curJob.items.some(x=> x.status==='pending'||x.status==='queued');
  if(!checkPending()) { updateRunControls(); return; }
  pollTimer=setInterval(async()=>{
    try{
      const j=await api('/api/job?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job));
      j._scenes=buildScenes(j);
      const prev=state.curJob;
      state.curJob=j;
      applyIncrementalUpdate(prev, j);
      updateKpi(); renderTree();
      try{
        const s=await api('/api/run/status?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job));
        if(s.running){ runPaused=!!s.paused; updateRunControls(); if(s.paused) $('#status').textContent=`已暂停 · ${j.items.filter(x=> x.status==='pending'||x.status==='queued').length} 张待生成`; if(s.stopped) $('#status').textContent='已停止'; }
      }catch(e){}
      const stillPending=j.items.some(x=> x.status==='pending'||x.status==='queued');
      if(!stillPending){ clearInterval(pollTimer); pollTimer=null; $('#status').textContent='完成'; updateRerunBtn(); updateRunControls(); setTimeout(()=> $('#status').textContent='', 3000); }
    }catch(e){ console.error(e); }
  }, 1500);
}
function updateBatchBar(){
  const bar=$('#batchBar');
  if(selectedIds.size){ bar.style.display='flex'; $('#batchCount').textContent=`已选 ${selectedIds.size} 项`; }
  else bar.style.display='none';
}
async function doReview(id, verdict, reason, tags){
  // batch siblings (__bN) share backend record; map to original
  const _displayId = id;
  const backendId = (typeof id==='string' && id.includes('__b')) ? id.split('__b')[0] : id;
  id = backendId;
  if(!state.date||!state.curJob) return;
  const payload={ date:state.date, job:state.curJob.job_id, item_id:backendId, verdict, reason: reason||'', tags: tags||[] };
  const form=document.querySelector('#drawerBody [data-form-id="'+CSS.escape(id)+'"]');
  if(form && reason===undefined){
    payload.reason=form.querySelector('[name=reason]').value;
    const t=form.querySelector('[name=tags]').value;
    payload.tags=t.split(',').map(s=>s.trim()).filter(Boolean);
    const v=form.querySelector('input[name="verdict_'+CSS.escape(id)+'"]:checked');
    if(v) payload.verdict=v.value;
  }
  try{
    const res=await fetch('/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    if(!res.ok) throw new Error(await res.text());
    await res.json();
    try{ const _cards=document.querySelectorAll('.card[data-id="'+CSS.escape(backendId)+'"], .card[data-id^="'+CSS.escape(backendId)+'__b"]'); for(const c of _cards){ const r=c.querySelector('.ribbon'); if(r){ const wantVerdict=payload.verdict; r.className='ribbon '+(wantVerdict==='rejected'?'rejected':wantVerdict==='kept'?'kept':'unreviewed'); r.textContent=wantVerdict==='kept'?'保留':wantVerdict==='rejected'?'驳回':'未审核'; c.classList.remove('kept','rejected'); if(wantVerdict==='kept') c.classList.add('kept'); if(wantVerdict==='rejected') c.classList.add('rejected'); } } }catch(_){}
    await loadJob(state.date, state.curJob.job_id);
    if(!state._suppressDrawer && document.getElementById('lightbox').classList.contains('open') && (_displayId===state.item || backendId===state.item || _displayId.split('__b')[0]===state.item.split('__b')[0])) openLightbox(state.item);
  }catch(e){ alert('标注失败: '+e.message); }
}

// Drawer
function openDrawer(id){
  // support batch siblings (__b suffix) via expanded display items
  const it=findDisplayItem(id) || state.curJob.items.find(x=>x.id===id);
  if(!it) return;
  state.item=id; pushHash();
  const drawer=$('#drawer'); drawer.classList.add('open'); drawer.setAttribute('aria-hidden','false');
  $('#drawerTitle').textContent='#'+id+' · '+it.status;
  const jobDefaults=state.curJob.defaults||{};
  const w=it.width ?? jobDefaults.width ?? '—';
  const h=it.height ?? jobDefaults.height ?? '—';
  const steps=it.steps ?? jobDefaults.steps ?? '—';
  const seed=it.seed!=null? it.seed : (jobDefaults.seed!=null? jobDefaults.seed : 'auto');
  const neg=it.negative_prompt ?? jobDefaults.negative_prompt ?? '—';
  const sampler=it.sampler ?? jobDefaults.sampler ?? 'er_sde (回落)';
  const scheduler=it.scheduler ?? jobDefaults.scheduler ?? 'simple (回落)';
  const cfg=it.cfg!=null? it.cfg : (jobDefaults.cfg!=null? jobDefaults.cfg : '1.0 (回落)');
  const verdict=(it.review&&it.review.verdict)||'unreviewed';
  const tags=(it.review&&it.review.tags)||[];
  const reason=(it.review&&it.review.reason)||'';
  const out=it.output;
  const urls=allImageUrls(it);
  const url=it._displayUrl || imageUrl(it);
  const hasImg=!!url && it.status==='done' && !(it.output && it.output.missing) && !(it.output && it.output.deleted);
  const _drawerIsSibling = it._batchTotal>1;
  $('#drawerBody').innerHTML=`
    ${hasImg? `<div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#020617"><img src="${url}" alt="#${escapeHtml(it._displayId||id)}" style="width:100%;display:block">${_drawerIsSibling? `<span style="display:block;text-align:center;font:600 11px/1.4 Fira Code,monospace;color:var(--muted);padding:6px">batch ${it._batchIndex+1}/${it._batchTotal}</span>`:''}</div>` : `<div class="empty" style="margin:0">${it.status==='failed'?'失败': it.status==='pending'?'待生成':'无图'}</div>`}
    <div style="margin-top:12px" class="kv">
      <span>分组</span><span>${escapeHtml((it.group||it.scene)||'—')}</span>
      <span>子分组</span><span>${escapeHtml((it.subgroup||it.variant||subgroupKey(it, state.curJob))||'—')}</span>
      <span>尺寸</span><span>${w} × ${h}</span>
      <span>steps</span><span>${steps}</span>
      <span>seed</span><span>${escapeHtml(String(seed))}</span>
      <span>sampler</span><span>${escapeHtml(String(sampler))}</span>
      <span>scheduler</span><span>${escapeHtml(String(scheduler))}</span>
      <span>cfg</span><span>${escapeHtml(String(cfg))}</span>
      <span>positive</span><span style="word-break:break-word"><div style="display:grid;gap:2px">${segmentPrompt(it.positive_prompt)}</div></span>
      <span>negative</span><span style="word-break:break-word">${escapeHtml(String(neg))}</span>
      ${out? `<span>sha</span><span>${escapeHtml(out.sha16)} · ${out.w}×${out.h} · ${out.bytes}B</span><span>prompt_id</span><span style="word-break:break-all;font:500 11px/1.2 Fira Code,monospace">${escapeHtml(out.prompt_id||'')}</span><span>elapsed</span><span>${escapeHtml(String(out.elapsed_ms||''))} ms</span>`:''}
      ${it.error? `<span>error</span><span style="color:var(--danger);word-break:break-word">${escapeHtml(it.error)}</span>`:''}
      ${it.warnings&&it.warnings.length? `<span>warnings</span><span style="color:var(--warn)">${escapeHtml(it.warnings.join(' · '))}</span>`:''}
    </div>
    <div class="review-form" data-form-id="${escapeHtml(id)}">
      <div class="radio-row" role="radiogroup" aria-label="审核">
        <label><input type="radio" name="verdict_${escapeHtml(id)}" value="kept" ${verdict==='kept'?'checked':''}> 保留</label>
        <label><input type="radio" name="verdict_${escapeHtml(id)}" value="rejected" ${verdict==='rejected'?'checked':''}> 驳回</label>
        <label><input type="radio" name="verdict_${escapeHtml(id)}" value="unreviewed" ${verdict==='unreviewed'?'checked':''}> 未审核</label>
      </div>
      <label class="visually-hidden" for="reason-${escapeHtml(id)}">原因</label>
      <textarea id="reason-${escapeHtml(id)}" name="reason" rows="3" placeholder="原因（为什么不合适，例：手部畸形）">${escapeHtml(reason)}</textarea>
      <label class="visually-hidden" for="tags-${escapeHtml(id)}">标签</label>
      <input id="tags-${escapeHtml(id)}" name="tags" type="text" placeholder="tags 逗号分隔，如 hand, artifact" value="${escapeHtml(tags.join(', '))}">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-save="${escapeHtml(id)}">保存标注</button>
        <button class="btn-ghost" data-open-lightbox="${escapeHtml(id)}">灯箱</button>
        <button class="btn-ghost" data-close-drawer>关闭</button>
        <button class="btn-danger btn-sm" style="margin-left:auto" data-hard="${escapeHtml(id)}">物理删除…</button>
      </div>
    </div>
    <p class="notice" style="margin-top:10px">软标注不删文件（卡片灰化+角标），<code>export</code> 可见统计；物理删除需二次确认。</p>
  `;
  document.querySelector('#drawerBody [data-save]').onclick=()=>{
    const v=document.querySelector('#drawerBody input[name="verdict_'+CSS.escape(id)+'"]:checked');
    const verdict=v? v.value:'unreviewed';
    const reason=document.querySelector('#drawerBody [name=reason]').value;
    const tags=document.querySelector('#drawerBody [name=tags]').value.split(',').map(s=>s.trim()).filter(Boolean);
    doReview(id, verdict, reason, tags);
  };
  document.querySelector('#drawerBody [data-open-lightbox]').onclick=()=> openLightbox(id);
  document.querySelector('#drawerBody [data-close-drawer]').onclick=closeDrawer;
  const hard=document.querySelector('#drawerBody [data-hard]');
  hard.onclick=async()=>{
    if(!confirm('物理删除图片文件并保留记录？此操作次级，建议优先用驳回标注。')) return;
    if(!confirm('二次确认：删除 '+id+' 的图片文件？')) return;
    try{
      const res=await fetch('/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:state.date, job:state.curJob.job_id, item_id:id, hard:true})});
      if(!res.ok) throw new Error(await res.text());
      await loadJob(state.date, state.curJob.job_id);
      closeDrawer();
    }catch(e){ alert('删除失败: '+e.message); }
  };
}
function closeDrawer(){
  const d=$('#drawer'); d.classList.remove('open'); d.setAttribute('aria-hidden','true');
  state.item='';
  const ps=new URLSearchParams(location.hash.slice(1)); ps.delete('item'); const s=ps.toString(); history.replaceState(null,'', s? '#'+s : location.pathname);
}

// Lightbox - fullscreen with right drawer content, cross-scene navigation
function findDisplayItem(id){
  // id may be __b sibling; return expanded entry
  const all=filteredDisplayItems();
  return all.find(x=> x._displayId===id || x.id===id) || (state.curJob&&state.curJob.items.find(x=> x.id===id));
}
function visibleIds(){ return filteredDisplayItems().map(x=> x.id); }
function orderedScenes(){ return (state.curJob&&state.curJob._scenes)||[]; }
function lightboxStepWithin(dir){
  const ids=visibleIds(); if(!ids.length) return;
  const cur=state.item || ids[0];
  let idx=ids.indexOf(cur);
  if(idx<0) idx=0; else idx=(idx+dir+ids.length)%ids.length;
  openLightbox(ids[idx]);
}
function orderedVariants(){
  if(!state.curJob||!state.curJob.items) return [];
  const g=state.scene; const v=state.variant;
  // build list of all (scene,variant) pairs in display order
  const scenes=orderedScenes();
  const pairs=[];
  for(const sc of scenes){
    const vars=Object.keys(sc.variants||{});
    if(!vars.length){
      pairs.push([sc.scene,'']);
    }else{
      for(const vv of vars.sort((a,b)=>a.localeCompare(b))){
        pairs.push([sc.scene,vv]);
      }
    }
  }
  return pairs;
}
function lightboxStep(dir){
  const ids=visibleIds(); if(!ids.length) return;
  const cur=state.item || ids[0];
  let idx=ids.indexOf(cur);
  if(idx<0) idx=0;
  const atFirst=idx===0, atLast=idx===ids.length-1;
  if((dir===-1 && atFirst) || (dir===1 && atLast)){
    if(!state.scene){
      // no filter: just wrap within global
      lightboxStepWithin(dir); return;
    }
    const pairs=orderedVariants();
    const curKey = state.scene+''+(state.variant||'');
    let pi=pairs.findIndex(p=> p[0]==state.scene && (p[1]||'')===(state.variant||''));
    // if current is group-only (variant='') but pairs has subgroups, find first pair with that group
    if(pi<0){
      pi=pairs.findIndex(p=> p[0]==state.scene);
    }
    if(pi<0){ lightboxStepWithin(dir); return; }
    const nextPi=pi+dir;
    if(nextPi<0||nextPi>=pairs.length){ lightboxStepWithin(dir); return; }
    const [ns,nv]=pairs[nextPi];
    const savedScene=state.scene, savedVariant=state.variant;
    state.scene=ns; state.variant=nv;
    let nextIds=visibleIds();
    if(!nextIds.length){
      // subgroup empty? try group-only
      state.variant=''; nextIds=visibleIds();
    }
    if(!nextIds.length){
      state.scene=savedScene; state.variant=savedVariant; lightboxStepWithin(dir); return;
    }
    pushHash(); renderScenes(); renderGallery();
    const target=dir===1 ? nextIds[0] : nextIds[nextIds.length-1];
    openLightbox(target); return;
  }
  lightboxStepWithin(dir);
}
function lightboxStepScene(dir, openInLightbox){
  if(openInLightbox===undefined) openInLightbox=$('#lightbox').classList.contains('open');
  const scenes=orderedScenes(); if(!scenes.length) return;
  let curIdx=scenes.findIndex(s=> s.scene===state.scene);
  if(curIdx<0) curIdx=dir===1? -1 : 0;
  const nextIdx=curIdx+dir;
  if(nextIdx<0 || nextIdx>=scenes.length) return;
  state.scene=scenes[nextIdx].scene; state.variant=''; clearFocusedThumb(); pushHash(); renderScenes(); renderGallery();
  const ids=visibleIds();
  if(openInLightbox && ids.length) openLightbox(ids[0]);
}
function lightboxStepVariant(dir, openInLightbox){
  if(openInLightbox===undefined) openInLightbox=$('#lightbox').classList.contains('open');
  if(!state.curJob||!state.scene) return;
  const pairs=orderedVariants();
  const curKey = state.scene+''+(state.variant||'');
  let pi=pairs.findIndex(p=> p[0]==state.scene && (p[1]||'')===(state.variant||''));
  if(pi<0) pi=pairs.findIndex(p=> p[0]==state.scene);
  if(pi<0) return;
  const nextPi=pi+dir;
  if(nextPi<0||nextPi>=pairs.length) return;
  const [ns,nv]=pairs[nextPi];
  const beforeScene=state.scene, beforeVar=state.variant;
  state.scene=ns; state.variant=nv||''; clearFocusedThumb();
  let ids=visibleIds();
  // fallback to group-only if subgroup empty
  if(!ids.length){ state.variant=''; ids=visibleIds(); if(!ids.length){ state.scene=beforeScene; state.variant=beforeVar; return; } }
  pushHash(); renderScenes(); renderGallery();
  if(openInLightbox && ids.length) openLightbox(ids[0]);
}
function drawerInnerHtml(id){
  const it=findDisplayItem(id) || state.curJob.items.find(x=>x.id===id);
  if(!it) return '<div class="empty">无数据</div>';
  const jobDefaults=state.curJob.defaults||{};
  const w=it.width ?? jobDefaults.width ?? '—';
  const h=it.height ?? jobDefaults.height ?? '—';
  const steps=it.steps ?? jobDefaults.steps ?? '—';
  const seed=it.seed!=null? it.seed : (jobDefaults.seed!=null? jobDefaults.seed : 'auto');
  const neg=it.negative_prompt ?? jobDefaults.negative_prompt ?? '—';
  const sampler=it.sampler ?? jobDefaults.sampler ?? 'er_sde (回落)';
  const scheduler=it.scheduler ?? jobDefaults.scheduler ?? 'simple (回落)';
  const cfg=it.cfg!=null? it.cfg : (jobDefaults.cfg!=null? jobDefaults.cfg : '1.0 (回落)');
  const verdict=(it.review&&it.review.verdict)||'unreviewed';
  const tags=(it.review&&it.review.tags)||[];
  const reason=(it.review&&it.review.reason)||'';
  const out=it.output; const hasOut=!!out && !out.missing && !out.deleted;
  return `
    <div class="kv" style="margin-bottom:10px">
      <span>分组</span><span>${escapeHtml((it.group||it.scene)||'—')}</span>
      <span>子分组</span><span>${escapeHtml((it.subgroup||it.variant||subgroupKey(it, state.curJob))||'—')}</span>
      <span>尺寸</span><span>${w} × ${h}</span>
      <span>steps</span><span>${steps}</span>
      <span>seed</span><span>${escapeHtml(String(seed))}</span>
      <span>sampler</span><span>${escapeHtml(String(sampler))}</span>
      <span>scheduler</span><span>${escapeHtml(String(scheduler))}</span>
      <span>cfg</span><span>${escapeHtml(String(cfg))}</span>
      <span>positive</span><span style="word-break:break-word"><div style="display:grid;gap:2px">${segmentPrompt(it.positive_prompt)}</div></span>
      <span>negative</span><span style="word-break:break-word">${escapeHtml(String(neg))}</span>
      ${out&&hasOut? `<span>sha</span><span>${escapeHtml(out.sha16)} · ${out.w}×${out.h} · ${out.bytes}B</span><span>prompt_id</span><span style="word-break:break-all;font:500 11px/1.2 Fira Code,monospace">${escapeHtml(out.prompt_id||'')}</span><span>elapsed</span><span>${escapeHtml(String(out.elapsed_ms||''))} ms</span>`:''}
      ${it.error? `<span>error</span><span style="color:var(--danger);word-break:break-word">${escapeHtml(it.error)}</span>`:''}
      ${it.warnings&&it.warnings.length? `<span>warnings</span><span style="color:var(--warn)">${escapeHtml(it.warnings.join(' · '))}</span>`:''}
    </div>
    <div class="review-form" data-form-id="${escapeHtml(id)}">
      <div class="radio-row" role="radiogroup" aria-label="审核">
        <label><input type="radio" name="verdict_${escapeHtml(id)}" value="kept" ${verdict==='kept'?'checked':''}> 保留</label>
        <label><input type="radio" name="verdict_${escapeHtml(id)}" value="rejected" ${verdict==='rejected'?'checked':''}> 驳回</label>
        <label><input type="radio" name="verdict_${escapeHtml(id)}" value="unreviewed" ${verdict==='unreviewed'?'checked':''}> 未审核</label>
      </div>
      <label class="visually-hidden" for="reason-${escapeHtml(id)}">原因</label>
      <textarea id="reason-${escapeHtml(id)}" name="reason" rows="3" placeholder="原因（为什么不合适，例：手部畸形）">${escapeHtml(reason)}</textarea>
      <label class="visually-hidden" for="tags-${escapeHtml(id)}">标签</label>
      <input id="tags-${escapeHtml(id)}" name="tags" type="text" placeholder="tags 逗号分隔，如 hand, artifact" value="${escapeHtml(tags.join(', '))}">
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <button class="btn" data-save="${escapeHtml(id)}">保存标注</button>
        <button class="btn-ghost" data-close-lightbox>关闭全屏</button>
        <button class="btn-danger btn-sm" style="margin-left:auto" data-hard="${escapeHtml(id)}">物理删除…</button>
      </div>
    </div>
    <p class="notice" style="margin-top:10px">软标注不删文件（卡片灰化+角标），<code>export</code> 可见统计；物理删除需二次确认。</p>
  `;
}
function openLightbox(id){
  const it=findDisplayItem(id) || state.curJob.items.find(x=>x.id===id); if(!it) return;
  state.item=id; pushHash();
  const lb=$('#lightbox'); lb.classList.add('open');
  const url=it._displayUrl || imageUrl(it);
  const img=$('#lbImg');
  if(url && it.status==='done' && !it.output.missing && !it.output.deleted){ img.src=url; img.style.display=''; img.alt='#'+id; }
  else { img.removeAttribute('src'); img.style.display='none'; }
  // batch siblings are now independent cards; clear legacy container
  const _strip=document.getElementById('lbBatchStrip'); if(_strip) _strip.innerHTML='';
  const meta=$('#lbMeta');
  const verdict=(it.review&&it.review.verdict)||'unreviewed';
  const ids=visibleIds(); const pos=ids.indexOf(id)+1;
  const tags=(it.review&&it.review.tags)||[];
  meta.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <h3 style="margin:0">#${escapeHtml(id)} <span style="color:var(--muted);font:500 12px/1 Fira Code,monospace">${escapeHtml(it.status)} · ${escapeHtml(verdict)} · ${pos}/${ids.length}${it._batchTotal>1? ` · ${it._batchIndex+1}/${it._batchTotal}`:''}</span></h3>
      <span style="margin-left:auto;display:flex;gap:6px">
        <button class="btn-ghost btn-sm" id="lbScenePrev" title="上一场景">▲ 场景</button>
        <button class="btn-ghost btn-sm" id="lbSceneNext" title="下一场景">▼ 场景</button>
      </span>
    </div>
    ${ drawerInnerHtml(id) }
  `;
  // wire
  const save=meta.querySelector('[data-save]');
  if(save) save.onclick=()=>{
    const v=meta.querySelector('input[name="verdict_'+CSS.escape(id)+'"]:checked');
    const verdict2=v? v.value:'unreviewed';
    const reason=meta.querySelector('[name=reason]').value;
    const tags2=meta.querySelector('[name=tags]').value.split(',').map(s=>s.trim()).filter(Boolean);
    doReview(id, verdict2, reason, tags2);
  };
  const hard=meta.querySelector('[data-hard]');
  if(hard) hard.onclick=async()=>{
    if(!confirm('物理删除图片文件并保留记录？')) return;
    if(!confirm('二次确认：删除 '+id+' 的图片文件？')) return;
    try{ const bid=id.includes('__b')? id.split('__b')[0]:id; const res=await fetch('/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:state.date, job:state.curJob.job_id, item_id:bid, hard:true})}); if(!res.ok) throw new Error(await res.text()); await loadJob(state.date, state.curJob.job_id); const nids=visibleIds(); if(nids.length) openLightbox(nids[Math.min(pos-1, nids.length-1)]); else closeLightbox(); }catch(e){ alert('删除失败: '+e.message); }
  };
  const closeBtn=meta.querySelector('[data-close-lightbox]');
  if(closeBtn) closeBtn.onclick=closeLightbox;
  const sp=meta.querySelector('#lbScenePrev'); if(sp) sp.onclick=()=> lightboxStepScene(-1);
  const sn=meta.querySelector('#lbSceneNext'); if(sn) sn.onclick=()=> lightboxStepScene(1);
}
function closeLightbox(){ $('#lightbox').classList.remove('open'); }

// Tree toggle + Toolbar

// Batch thumb count
function batchThumbIds(){
  if(!state.curJob||!state.scene) return [];
  const all = state.curJob.items||[];
  if(state.variant){
    return all.filter(it=> groupKey(it)===state.scene && (subgroupKey(it, state.curJob)||'')===state.variant).map(it=> it.id);
  }
  return all.filter(it=> groupKey(it)===state.scene).map(it=> it.id);
}
function getVerdict(id){
  const it = state.curJob && state.curJob.items.find(x=> x.id===id);
  if(!it) return 'unreviewed';
  return (it.review&&it.review.verdict)||'unreviewed';
}
async function handlePlusMinusSingle(id, want){
  if(!id || !state.curJob) return;
  const cur = getVerdict(id);
  if(cur==='unreviewed'){
    state._suppressDrawer=true; await doReview(id, want, '', []); state._suppressDrawer=false;
    return;
  }
  if(cur===want){
    const it = state.curJob.items.find(x=> x.id===id);
    const prevReason = (it&&it.review&&it.review.reason)||'';
    const note = prompt(want==='kept' ? '该图已是【保留】，再次按 + 请补充备注：' : '该图已是【驳回】，再次按 - 请补充备注：', prevReason);
    if(note===null) return;
    state._suppressDrawer=true; await doReview(id, want, note, (it&&it.review&&it.review.tags)||[]); state._suppressDrawer=false;
  } else {
    state._suppressDrawer=true; await doReview(id, want, '', []); state._suppressDrawer=false;
  }
}
async function handlePlusMinusBatch(want){
  const ids = batchThumbIds();
  if(!ids.length) return;
  let allSame = ids.every(id=> getVerdict(id)===want);
  if(allSame){
    const note = prompt(want==='kept' ? `该二级分组已全部【保留】(${ids.length}张)，再次按 + 请补充备注：` : `该二级分组已全部【驳回】(${ids.length}张)，再次按 - 请补充备注：`, '');
    if(note===null) return;
    state._suppressDrawer=true;
    try{ document.getElementById('status').textContent=`批量备注 ${want==='kept'?'保留':'驳回'} ${ids.length} 项…`; for(const id of ids){ try{ await doReview(id, want, note, []); }catch{} } document.getElementById('status').textContent=`已备注 ${ids.length} 项`; } finally{ state._suppressDrawer=false; setTimeout(()=> document.getElementById('status').textContent='', 800); closeDrawer(); }
    return;
  }
  state._suppressDrawer=true;
  try{ document.getElementById('status').textContent=`批量${want==='kept'?'保留':'驳回'} ${ids.length} 项…`; for(const id of ids){ try{
    const cur=getVerdict(id);
    if(cur===want) continue;
    await doReview(id, want, '', []);
  }catch{} } document.getElementById('status').textContent=`已${want==='kept'?'保留':'驳回'} ${ids.length} 项`; } finally{ state._suppressDrawer=false; setTimeout(()=>{ closeDrawer(); const s=document.getElementById('status'); if(s && (s.textContent.includes('保留')||s.textContent.includes('驳回'))) s.textContent=''; }, 600); }
}

function applyTreeCollapsed(){
  const lay=$('#layout');
  if(treeCollapsed) lay.classList.add('tree-collapsed'); else lay.classList.remove('tree-collapsed');
}
// Toolbar
$$('.chip').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    $$('.chip').forEach(b=>{ b.classList.remove('active'); b.setAttribute('aria-pressed','false'); });
    btn.classList.add('active'); btn.setAttribute('aria-pressed','true');
    state.filter=btn.dataset.filter;
    renderGallery();
  });
});
$('#tagFilter').addEventListener('input', e=>{ state.tagFilter=e.target.value; renderGallery(); });
$('#sortBy').addEventListener('change', e=>{ state.sortBy=e.target.value; renderGallery(); });
$('#drawerClose').addEventListener('click', closeDrawer);
$('#lightbox').addEventListener('click', e=>{ if(e.target===e.currentTarget) closeLightbox(); });
$('#lightbox').addEventListener('wheel', e=>{ e.stopPropagation(); }, {passive:false});
$('#lbPrev').addEventListener('click', e=>{ e.stopPropagation(); lightboxStep(-1); });
$('#lbNext').addEventListener('click', e=>{ e.stopPropagation(); lightboxStep(1); });
document.addEventListener('keydown', e=>{
  const _isTyping = (()=>{ const tag=(e.target&&e.target.tagName)||''; return tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(e.target&&e.target.isContentEditable); })();
  if(!_isTyping && (e.key==='f' || e.key==='F') && !(e.ctrlKey || e.altKey || e.metaKey)){
    e.preventDefault();
    if($('#lightbox').classList.contains('open')) closeLightbox(); else if(state.item) openLightbox(state.item); else if(state.curJob && visibleIds().length) openLightbox(visibleIds()[0]);
    return;
  }
  const lbOpen=$('#lightbox').classList.contains('open');
  if(e.ctrlKey && (e.key==='ArrowUp' || e.key==='ArrowDown')){
    if(!_isTyping) { e.preventDefault(); e.stopPropagation(); clearFocusedThumb(); lightboxStepScene(e.key==='ArrowUp'? -1: 1, lbOpen); return; }
  }
  if(e.altKey && (e.key==='ArrowUp' || e.key==='ArrowDown')){
    if(!_isTyping) { e.preventDefault(); e.stopPropagation(); clearFocusedThumb(); lightboxStepVariant(e.key==='ArrowUp'? -1: 1, lbOpen); return; }
  }
  if(!e.ctrlKey && !e.altKey && !e.metaKey && (e.key==='ArrowLeft' || e.key==='ArrowRight' || e.key==='ArrowUp' || e.key==='ArrowDown')){
    if(_isTyping) { }
    else if(!lbOpen){
      const hasGroupFocus = !!state.scene;
      const canThumbNav = hasGroupFocus || focusedThumbId!==null;
      if(canThumbNav){
        e.preventDefault(); e.stopPropagation();
        moveFocusedThumb(e.key);
        return;
      }
      if(lbOpen){
        e.preventDefault(); lightboxStep(e.key==='ArrowLeft'? -1: 1); return;
      }
    } else {
      if(e.key==='ArrowLeft' || e.key==='ArrowRight'){ e.preventDefault(); lightboxStep(e.key==='ArrowLeft'? -1: 1); return; }
      if(e.key==='ArrowUp' || e.key==='ArrowDown'){ e.preventDefault(); lightboxStepScene(e.key==='ArrowUp'? -1: 1, true); return; }
    }
  }
  if(lbOpen){
    const isPlus = (e.key==='+' || e.key==='=' || e.code==='NumpadAdd' || e.key==='Add' || (e.key==='NumpadAdd'));
    const isMinus = (e.key==='-' || e.key==='_' || e.code==='NumpadSubtract' || e.key==='Subtract' || (e.key==='NumpadSubtract'));
    if(isPlus || isMinus){
      e.preventDefault();
      const want = isPlus ? 'kept' : 'rejected';
      handlePlusMinusSingle(state.item, want);
      return;
    }
    if(e.key==='1' || e.key==='2'){
      if(e.target && (e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA' || e.target.isContentEditable)) return;
      e.preventDefault();
      const verdict=e.key==='1' ? 'kept' : 'rejected';
      if(state.item) { state._suppressDrawer=true; doReview(state.item, verdict).finally(()=>{ state._suppressDrawer=false; setTimeout(()=> closeDrawer(), 0); }); }
      return;
    }
  }
  {
    const isPlus = (e.key==='+' || e.key==='=' || e.code==='NumpadAdd' || e.key==='Add');
    const isMinus = (e.key==='-' || e.key==='_' || e.code==='NumpadSubtract' || e.key==='Subtract');
    const plusDetected = isPlus;
    const minusDetected = isMinus;
    if((plusDetected || minusDetected) && !lbOpen){
      if(_isTyping) return;
      e.preventDefault(); e.stopPropagation();
      const want = plusDetected ? 'kept' : 'rejected';
      if(focusedThumbId){
        handlePlusMinusSingle(focusedThumbId, want);
      } else {
        if(!state.curJob || !state.scene) return;
        handlePlusMinusBatch(want);
      }
      return;
    }
  }
  if(e.key==='Escape'){ if(lbOpen) closeLightbox(); else if($('#drawer').classList.contains('open')) closeDrawer(); }
});
$('#thumbSlider').addEventListener('input', e=>{
  const v=parseInt(e.target.value,10);
  state.thumbSize=v;
  document.documentElement.style.setProperty('--thumb', v+'px');
  $('#thumbVal').textContent=v+'px';
  localStorage.setItem('anima.thumb', String(v));
});
(function initThumb(){
  const saved=parseInt(localStorage.getItem('anima.thumb')||'260',10);
  if(saved>=220&&saved<=500){ state.thumbSize=saved; const sl=$('#thumbSlider'); if(sl) sl.value=String(saved); document.documentElement.style.setProperty('--thumb', saved+'px'); const el=$('#thumbVal'); if(el) el.textContent=saved+'px'; }
  else { document.documentElement.style.setProperty('--thumb', '260px'); }
})();
document.getElementById('btnDelJob').addEventListener('click', async()=>{
  if(!state.date || !state.job){ alert('先在左侧导航选中一个包'); return; }
  const label=state.date+'/'+state.job;
  if(!confirm("删除当前包 '" + label + "' ？将移除 jobs/" + label + ".json 及其 output/" + label + "/ 下全部图片，此操作不可撤销。确定删除？")) return;
  const btn=document.getElementById('btnDelJob'); const prev=btn?btn.textContent:''; if(btn){ btn.disabled=true; btn.textContent='删除中…'; }
  try{
    const r=await fetch('/api/job/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:state.date,job:state.job})});
    if(r.status===409){ alert('该批次正在运行中，稍后再试'); return; }
    if(!r.ok){ const txt=await r.text(); throw new Error(txt||r.statusText); }
    state.job=''; state.scene=''; state.variant=''; state.curJob=null;
    selectedIds.clear(); clearGallery();
    await loadDates();
    pushHash(); renderTree(); renderScenes(); updateDelBtn();
  }catch(err){ alert('删除失败: '+(err&&err.message||err)); }
  finally{ if(btn){ btn.disabled=!state.date||!state.job; btn.textContent=prev||'🗑 删除包'; } }
});

$('#btnTreeToggle').addEventListener('click', ()=>{
  treeCollapsed=!treeCollapsed;
  localStorage.setItem('anima.treeCollapsed', treeCollapsed?'1':'0');
  applyTreeCollapsed();
});

// Batch
$('#batchKept').addEventListener('click', async()=>{ for(const id of [...selectedIds]) await doReview(id,'kept','',''); selectedIds.clear(); renderGallery(); });
$('#batchRejected').addEventListener('click', async()=>{ for(const id of [...selectedIds]) await doReview(id,'rejected','',''); selectedIds.clear(); renderGallery(); });
$('#batchClear').addEventListener('click', ()=>{ selectedIds.clear(); renderGallery(); });

// Run / Pause / Stop / Kill / Quit
let serverRunning=false;
let runPaused=false;
async function syncRunStatus(){
  if(!state.date||!state.job){ serverRunning=false; runPaused=false; updateRunControls(); return; }
  try{
    const j=await api('/api/run/status?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job));
    serverRunning=!!j.running; runPaused=!!j.paused;
  }catch(e){ serverRunning=false; }
  updateRunControls();
}
function updateRunControls(){
  const running = serverRunning;
  const btnRun=$('#btnRun'), btnPause=$('#btnPause'), btnStop=$('#btnStop');
  if(!btnRun||!btnPause||!btnStop) return;
  if(running){
    btnRun.style.display='none';
    btnPause.style.display='';
    btnStop.style.display='';
    btnPause.textContent = runPaused ? '▶ 继续' : '⏸ 暂停';
    btnPause.title = runPaused ? '继续批次' : '暂停（完成当前张后暂停）';
  } else {
    btnRun.style.display='';
    btnPause.style.display='none';
    btnStop.style.display='none';
    btnRun.disabled=false; btnRun.textContent='▶ 运行批次';
    runPaused=false;
  }
}
async function runApi(path){
  if(!state.date||!state.job) throw new Error('no job selected');
  const res=await fetch('/api/run/'+path+'?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job),{method:'POST'});
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
$('#btnRun').addEventListener('click', async()=>{
  if(!state.date||!state.job){ alert('先选择左侧树中的批次包'); return; }
  const btn=$('#btnRun'); btn.disabled=true; const prev=btn.textContent; btn.textContent='运行中…';
  $('#status').textContent='已触发，后台串行生成中…';
  try{
    const hdr=buildHdrPayload();
    const res=await fetch('/api/run?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job),{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(hdr)});
    if(res.status===409){ alert('该批次已在运行中'); return; }
    if(!res.ok) throw new Error(await res.text());
    serverRunning=true; runPaused=false;
    updateRunControls();
    startPolling();
    let tries=0;
    const timer=setInterval(async()=>{
      tries++;
      try{
        const s=await api('/api/run/status?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job));
        serverRunning=!!s.running; runPaused=!!s.paused;
        updateRunControls();
        if(s.stopped || !s.running){ clearInterval(timer); if(s.stopped) $('#status').textContent='已停止'; updateRunControls(); }
      }catch(e){}
      const pending=state.curJob? state.curJob.items.filter(x=> x.status==='pending'||x.status==='queued').length : 0;
      if(!runPaused) $('#status').textContent= pending? `生成中… 剩余 ${pending}` : '完成';
      else $('#status').textContent= `已暂停 · 剩余 ${pending} · 点 继续 恢复`;
      if(pending===0 || tries>240){ clearInterval(timer); serverRunning=false; btn.disabled=false; btn.textContent=prev; updateRunControls(); setTimeout(()=> $('#status').textContent='', 3000); }
    }, 1500);
  }catch(e){ alert('触发失败: '+e.message); }
  finally{ if(btn.disabled) setTimeout(()=>{ btn.disabled=false; btn.textContent=prev; updateRunControls(); }, 800); }
});
$('#btnPause').addEventListener('click', async()=>{
  if(!state.date||!state.job) return;
  const btn=$('#btnPause'); const wasPaused=runPaused;
  btn.disabled=true;
  try{
    if(!wasPaused){
      await runApi('pause');
      runPaused=true;
      $('#status').textContent='暂停中（完成当前张后暂停）…';
    } else {
      await runApi('resume');
      runPaused=false;
      $('#status').textContent='已继续…';
    }
    updateRunControls();
  }catch(e){ alert((wasPaused?'继续':'暂停')+'失败: '+e.message); }
  finally{ btn.disabled=false; updateRunControls(); }
});
$('#btnStop').addEventListener('click', async()=>{
  if(!state.date||!state.job) return;
  if(!confirm('停止当前批次？正在生成的图片会尝试中断，剩余 pending 保留。')) return;
  const btn=$('#btnStop'); btn.disabled=true;
  try{
    await runApi('stop');
    serverRunning=false; runPaused=false;
    $('#status').textContent='已停止';
    updateRunControls();
    // re-sync after stop to ensure server cleared running flag; poll will also confirm
    setTimeout(()=> syncRunStatus(), 400);
    setTimeout(()=> syncRunStatus(), 1200);
  }catch(e){ alert('停止失败: '+e.message); }
  finally{ btn.disabled=false; updateRunControls(); }
});
$('#btnKill').addEventListener('click', async()=>{
  if(!confirm('释放端口并清理 anima 幽灵进程？（kill :8765 + anima.exe）')) return;
  alert('请在终端执行: anima kill  或  anima kill --port 8765');
});
$('#btnRerunGroup').addEventListener('click', async()=>{
  if(!state.date||!state.job){ alert('先选择左侧树中的批次包'); return; }
  if(!state.scene){ alert('在中栏 Scenes 选择一个分组后可用'); return; }
  const label = state.variant ? `${state.scene}/${state.variant}` : state.scene;
  if(!confirm(`重运行分组 [${label}] 将覆盖该分组已有图片并重新生成，是否继续？`)) return;
  const btn=$('#btnRerunGroup'); btn.disabled=true; const prev=btn.textContent; btn.textContent='重运行中…';
  $('#status').textContent='重运行已触发，替换生成中…';
  try{
    const hdr=buildHdrPayload();
    // merge group filter into payload
    hdr.group=state.scene; if(state.variant) hdr.subgroup=state.variant;
    hdr.force=true;
    const res=await fetch('/api/run?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job),{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(hdr)});
    if(res.status===409){ alert('该批次已在运行中（全批或该分组）'); return; }
    if(!res.ok) throw new Error(await res.text());
    serverRunning=true; runPaused=false; updateRunControls(); startPolling();
    let tries=0;
    const timer=setInterval(async()=>{
      tries++;
      try{
        const s=await api('/api/run/status?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job));
        runPaused=!!s.paused; updateRunControls();
        if(s.stopped){ clearInterval(timer); $('#status').textContent='已停止'; updateRunControls(); }
      }catch(e){}
      const pending=state.curJob? state.curJob.items.filter(x=> x.status==='pending'||x.status==='queued').length : 0;
      if(!runPaused) $('#status').textContent= pending? `重运行中… 剩余 ${pending}` : '重运行完成';
      else $('#status').textContent=`已暂停 · 剩余 ${pending}`;
      if(pending===0 || tries>240){ clearInterval(timer); serverRunning=false; btn.disabled=false; btn.textContent=prev; updateRerunBtn(); updateRunControls(); setTimeout(()=> $('#status').textContent='', 3000); }
    }, 1500);
  }catch(e){ alert('重运行失败: '+e.message); btn.disabled=false; btn.textContent=prev; updateRerunBtn(); }
});
$('#btnQuit').addEventListener('click', async()=>{
  if(!confirm('Quit 将关闭网页并停止后端服务，确定？')) return;
  try{ await fetch('/api/quit',{method:'POST'}); }catch(e){}
  setLive(false);
  $('#status').textContent='服务已停止';
  setTimeout(()=>{ window.close(); setTimeout(()=>{ document.body.innerHTML='<div style="display:grid;place-items:center;height:100vh;background:#0F172A;color:#94A3B8;font:14px Inter;text-align:center"><div><h2>Anima 已退出</h2><p>后端服务已停止，可关闭此标签页。</p></div></div>'; }, 300); }, 400);
});

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
