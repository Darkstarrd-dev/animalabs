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
    // optimistic ribbon patch before reload (so thumb feedback instant even if loadJob transiently fails)
    try{ const _cards=document.querySelectorAll('.card[data-id="'+CSS.escape(backendId)+'"], .card[data-id^="'+CSS.escape(backendId)+'__b"]'); for(const c of _cards){ const r=c.querySelector('.ribbon'); if(r){ const wantVerdict=payload.verdict; r.className='ribbon '+(wantVerdict==='rejected'?'rejected':wantVerdict==='kept'?'kept':'unreviewed'); r.textContent=wantVerdict==='kept'?'保留':wantVerdict==='rejected'?'驳回':'未审核'; c.classList.remove('kept','rejected'); if(wantVerdict==='kept') c.classList.add('kept'); if(wantVerdict==='rejected') c.classList.add('rejected'); } } }catch(_){}
    await loadJob(state.date, state.curJob.job_id);
    if(!state._suppressDrawer && document.getElementById('lightbox').classList.contains('open') && (_displayId===state.item || backendId===state.item || _displayId.split('__b')[0]===state.item.split('__b')[0])) openLightbox(state.item);
  }catch(e){ alert('标注失败: '+e.message); }
}

