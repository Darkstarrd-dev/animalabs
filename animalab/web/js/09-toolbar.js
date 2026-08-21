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
    // same verdict already -> prompt for reason note
    const it = state.curJob.items.find(x=> x.id===id);
    const prevReason = (it&&it.review&&it.review.reason)||'';
    const note = prompt(want==='kept' ? '该图已是【保留】，再次按 + 请补充备注：' : '该图已是【驳回】，再次按 - 请补充备注：', prevReason);
    if(note===null) return;
    state._suppressDrawer=true; await doReview(id, want, note, (it&&it.review&&it.review.tags)||[]); state._suppressDrawer=false;
  } else {
    // flip: kept->rejected or rejected->kept, no prompt, direct switch
    state._suppressDrawer=true; await doReview(id, want, '', []); state._suppressDrawer=false;
  }
}
async function handlePlusMinusBatch(want){
  const ids = batchThumbIds();
  if(!ids.length) return;
  // Determine batch state: check if all share same verdict?
  // We'll apply per-item logic: if item already at want -> prompt per batch? spec says batch level, but repeat should prompt.
  // For batch, we treat as: if any item differs, batch flip to want without prompt; if all already at want, prompt once for batch note.
  let allSame = ids.every(id=> getVerdict(id)===want);
  if(allSame){
    const note = prompt(want==='kept' ? `该二级分组已全部【保留】(${ids.length}张)，再次按 + 请补充备注：` : `该二级分组已全部【驳回】(${ids.length}张)，再次按 - 请补充备注：`, '');
    if(note===null) return;
    // apply note to each
    state._suppressDrawer=true;
    try{ document.getElementById('status').textContent=`批量备注 ${want==='kept'?'保留':'驳回'} ${ids.length} 项…`; for(const id of ids){ try{ await doReview(id, want, note, []); }catch{} } document.getElementById('status').textContent=`已备注 ${ids.length} 项`; } finally{ state._suppressDrawer=false; setTimeout(()=> document.getElementById('status').textContent='', 800); closeDrawer(); }
    return;
  }
  // not all same: flip each to want
  state._suppressDrawer=true;
  try{ document.getElementById('status').textContent=`批量${want==='kept'?'保留':'驳回'} ${ids.length} 项…`; for(const id of ids){ try{
    const cur=getVerdict(id);
    if(cur===want) continue; // keep same-reason items skip unless they were unreviewed? actually unreviewed->want
    // For items opposite, switch without prompt
    // For unreviewed, just set
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
  // F: toggle lightbox
  if(!_isTyping && (e.key==='f' || e.key==='F') && !(e.ctrlKey || e.altKey || e.metaKey)){
    e.preventDefault();
    if($('#lightbox').classList.contains('open')) closeLightbox(); else if(state.item) openLightbox(state.item); else if(state.curJob && visibleIds().length) openLightbox(visibleIds()[0]);
    return;
  }
  const lbOpen=$('#lightbox').classList.contains('open');
  // Ctrl+Up/Down (top-level group) — also clears thumb focus
  if(e.ctrlKey && (e.key==='ArrowUp' || e.key==='ArrowDown')){
    if(!_isTyping) { e.preventDefault(); e.stopPropagation(); clearFocusedThumb(); lightboxStepScene(e.key==='ArrowUp'? -1: 1, lbOpen); return; }
  }
  if(e.altKey && (e.key==='ArrowUp' || e.key==='ArrowDown')){
    if(!_isTyping) { e.preventDefault(); e.stopPropagation(); clearFocusedThumb(); lightboxStepVariant(e.key==='ArrowUp'? -1: 1, lbOpen); return; }
  }

  // Thumbnail arrow focus navigation — only when a group is active OR when plain arrows pressed with focus context
  // Spec: 在一级或者二级项目有focus的情况下，上下左右在thumbnail中进行focus切换
  if(!e.ctrlKey && !e.altKey && !e.metaKey && (e.key==='ArrowLeft' || e.key==='ArrowRight' || e.key==='ArrowUp' || e.key==='ArrowDown')){
    if(_isTyping) { /* allow typing cursor */ }
    else if(lbOpen){
      if(e.key==='ArrowLeft' || e.key==='ArrowRight'){ e.preventDefault(); lightboxStep(e.key==='ArrowLeft'? -1: 1); return; }
      if(e.key==='ArrowUp' || e.key==='ArrowDown'){ e.preventDefault(); lightboxStepScene(e.key==='ArrowUp'? -1: 1, true); return; }
    } else {
      const hasGroupFocus = !!state.scene;
      const canThumbNav = hasGroupFocus || focusedThumbId!==null;
      if(canThumbNav){
        e.preventDefault(); e.stopPropagation();
        moveFocusedThumb(e.key);
        return;
      }
    }
  }

  if(lbOpen){
    // lightbox +/- and 1/2
    const isPlus = (e.key==='+' || e.key==='=' || e.code==='NumpadAdd' || e.key==='Add' || (e.key==='NumpadAdd'));
    const isMinus = (e.key==='-' || e.key==='_' || e.code==='NumpadSubtract' || e.key==='Subtract' || (e.key==='NumpadSubtract'));
    if(isPlus || isMinus){
      e.preventDefault();
      const want = isPlus ? 'kept' : 'rejected';
      // lb +/- always single-item via state.item
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
  // Main +/- (non-lightbox): dual mode
  // - if focusedThumbId !== null: single-item +/- (image level)
  // - else: batch +/- for current group (level-2)
  {
    const isPlus = (e.key==='+' || e.key==='=' || e.code==='NumpadAdd' || e.key==='Add');
    const isMinus = (e.key==='-' || e.key==='_' || e.code==='NumpadSubtract' || e.key==='Subtract');
    // also Numpad +/- without Shift: e.key may be 'Add'/'Subtract' only
    // Do additional detection for '=' without shift? '=' is same key as '+'
    // We also check e.key.length===1
    const plusDetected = isPlus;
    const minusDetected = isMinus;
    if((plusDetected || minusDetected) && !lbOpen){
      if(_isTyping) return;
      e.preventDefault(); e.stopPropagation();
      const want = plusDetected ? 'kept' : 'rejected';
      if(focusedThumbId){
        // image-level
        handlePlusMinusSingle(focusedThumbId, want);
      } else {
        // batch-level (subgroup)
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

