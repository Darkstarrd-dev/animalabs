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

