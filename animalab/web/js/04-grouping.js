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
  allEl.querySelector('[data-scene-all]').onclick=()=>{ state.scene=''; state.variant=''; pushHash(); renderScenes(); renderGallery(); };
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
      state.scene=g.scene; state.variant=''; pushHash();
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
