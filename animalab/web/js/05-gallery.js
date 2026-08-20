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
        const fresh=createCard(it);
        fresh._verdict=curVerdict; fresh._status=curStatus; fresh._outFn=it.output&&it.output.filename;
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
  updateBatchBar(); updateKpi();
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
