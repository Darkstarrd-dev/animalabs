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
  state.scene=scenes[nextIdx].scene; state.variant=''; pushHash(); renderScenes(); renderGallery();
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
  state.scene=ns; state.variant=nv||'';
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

