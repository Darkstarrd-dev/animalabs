// Tree toggle + Toolbar
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
  // F: toggle lightbox for selected item (non-typing contexts)
  const _tag=(e.target&&e.target.tagName)||''; const _typing=_tag==='INPUT'||_tag==='TEXTAREA'||_tag==='SELECT'||(e.target&&e.target.isContentEditable);
  if(!_typing && (e.key==='f' || e.key==='F') && !(e.ctrlKey || e.altKey || e.metaKey)){
    e.preventDefault();
    if($('#lightbox').classList.contains('open')) closeLightbox(); else if(state.item) openLightbox(state.item); else if(state.curJob && visibleIds().length) openLightbox(visibleIds()[0]);
    return;
  }
  const lbOpen=$('#lightbox').classList.contains('open');
  // Ctrl+Up/Down (top-level group) and Alt+Up/Down (subgroup) work both inside and outside lightbox
  if(e.ctrlKey && (e.key==='ArrowUp' || e.key==='ArrowDown')){
    const tag=(e.target&&e.target.tagName)||''; const isTyping=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(e.target&&e.target.isContentEditable);
    if(!isTyping) { e.preventDefault(); e.stopPropagation(); lightboxStepScene(e.key==='ArrowUp'? -1: 1, lbOpen); return; }
  }
  if(e.altKey && (e.key==='ArrowUp' || e.key==='ArrowDown')){
    const tag=(e.target&&e.target.tagName)||''; const isTyping=tag==='INPUT'||tag==='TEXTAREA'||tag==='SELECT'||(e.target&&e.target.isContentEditable);
    if(!isTyping) { e.preventDefault(); e.stopPropagation(); lightboxStepVariant(e.key==='ArrowUp'? -1: 1, lbOpen); return; }
  }
  if(lbOpen){
    if(e.key==='ArrowLeft' || e.key==='ArrowRight'){ e.preventDefault(); lightboxStep(e.key==='ArrowLeft'? -1: 1); return; }
    if(e.key==='ArrowUp' || e.key==='ArrowDown'){ e.preventDefault(); lightboxStepScene(e.key==='ArrowUp'? -1: 1, true); return; }
    if(e.key==='NumpadAdd' || e.code==='NumpadAdd' || e.key==='Add'){ e.preventDefault(); state._suppressDrawer=true; doReview(state.item,'kept').finally(()=>{ state._suppressDrawer=false; setTimeout(()=> closeDrawer(), 0); }); return; }
    if(e.key==='NumpadSubtract' || e.code==='NumpadSubtract' || e.key==='Subtract'){ e.preventDefault(); state._suppressDrawer=true; doReview(state.item,'rejected').finally(()=>{ state._suppressDrawer=false; setTimeout(()=> closeDrawer(), 0); }); return; }
    if(e.key==='1' || e.key==='2'){
      if(e.target && (e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA' || e.target.isContentEditable)) return;
      e.preventDefault();
      const verdict=e.key==='1' ? 'kept' : 'rejected';
      if(state.item) { state._suppressDrawer=true; doReview(state.item, verdict).finally(()=>{ state._suppressDrawer=false; setTimeout(()=> closeDrawer(), 0); }); }
      return;
    }
  }
  // Numpad +/- batch keep/reject for current top-level group (only when not in lightbox) - never open drawer
  if(!lbOpen && (e.code==='NumpadAdd' || e.code==='NumpadSubtract' || e.key==='Add' || e.key==='Subtract')){
    const tag2=(e.target&&e.target.tagName)||''; const isTyping2=tag2==='INPUT'||tag2==='TEXTAREA'||tag2==='SELECT'||(e.target&&e.target.isContentEditable);
    if(!isTyping2 && state.curJob && state.scene){
      const isAdd=(e.code==='NumpadAdd' || e.key==='Add');
      const verdict=isAdd?'kept':'rejected';
      const ids=(state.curJob.items||[]).filter(it=> groupKey(it)===state.scene).map(it=> it.id);
      if(ids.length){ e.preventDefault(); e.stopPropagation(); state._suppressDrawer=true; (async()=>{ try{ $('#status').textContent=`批量${verdict==='kept'?'保留':'驳回'} ${ids.length} 项…`; for(const id of ids){ try{ await doReview(id, verdict, '', [], true); }catch{} } $('#status').textContent=`已${verdict==='kept'?'保留':'驳回'} ${ids.length} 项`; }finally{ state._suppressDrawer=false; setTimeout(()=> { closeDrawer(); $('#status').textContent=''; }, 600); } })(); return; }
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

