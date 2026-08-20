const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const api = p => fetch(p).then(r => { if(!r.ok) throw new Error(r.status+' '+r.statusText); return r.json(); });

let state = { date:'', job:'', item:'', scene:'', variant:'', filter:'all', tagFilter:'', sortBy:'id', dates:[], jobsByDate:{}, curJob:null, thumbSize:260 };
let selectedIds = new Set();
let monthCollapsed = new Set();
let dayCollapsed = new Set();
let sceneCollapsed = new Set();
let pollTimer = null;
let treeCollapsed = localStorage.getItem('anima.treeCollapsed')==='1';
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
async function loadJob(date,job){
  try{
    const j=await api('/api/job?date='+encodeURIComponent(date)+'&job='+encodeURIComponent(job));
    // build scene index client-side
    const scenes=buildScenes(j);
    j._scenes=scenes;
    state.curJob=j;
    selectedIds.clear();
    updateDelBtn();
    // if selected scene no longer exists, clear it
    if(state.scene && !scenes.find(s=> s.scene===state.scene)) { state.scene=''; state.variant=''; }
    renderScenes(); renderGallery(); updateKpi(); renderTree();
    if(state.item) openDrawer(state.item);
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
  // find latest done by max output.elapsed? fallback to last done in display order
  let best=null, bestScore=-1;
  for(const it of state.curJob.items){
    if(it.status!=='done'||!it.output) continue;
    // use elapsed_ms if available, else use seed as tiebreaker? Use prompt_id numeric fallback
    const score = it.output.elapsed_ms || 0;
    // prefer larger elapsed? not chronological. Better use max index with higher file suffix? Use filename numeric?
    // Use max done position in ordered display: higher index in OrderedIndices order is later executed? So later in file after sort?
    // Approximate with max filename number
    if(score>bestScore || (score===bestScore && (best==null || it.id>best.id))){
      best=it; bestScore=score;
    }
  }
  // if no elapsed_ms distinctive, pick last done by array position (closest to latest execution tail)
  if(!bestScore){
    for(let i=state.curJob.items.length-1;i>=0;--i){ const it=state.curJob.items[i]; if(it.status==='done'&&it.output){ best=it; break; } }
  }
  if(!best) return null;
  return { group: groupKey(best), subgroup: subgroupKey(best, state.curJob) || '__single__', id: best.id };
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
      // toggle collapse if clicking chev area? we distinguish: if active and no variant, collapse toggle
      if(state.scene===g.scene && !state.variant){
        if(sceneCollapsed.has(g.scene)) sceneCollapsed.delete(g.scene); else sceneCollapsed.add(g.scene);
        renderScenes();
        return;
      }
      state.scene=g.scene; state.variant=''; pushHash(); // clear collapsed for selected
      sceneCollapsed.delete(g.scene);
      renderScenes(); renderGallery();
    };
    // also allow collapsing via chev click is same; provide separate collapse on chev double behavior handled above
    const chev=li.querySelector('.chev');
    chev.onclick=e=>{ e.stopPropagation(); if(sceneCollapsed.has(g.scene)) sceneCollapsed.delete(g.scene); else sceneCollapsed.add(g.scene); renderScenes(); };
    body.onclick=e=> e.stopPropagation();
    ul.appendChild(li);
  }
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
  const url=imageUrl(it);
  const hasImg=!!url && status==='done' && !it.output.missing && !it.output.deleted;
  const checked=selectedIds.has(it.id)?'checked':'';
  const dims=it.output? `${it.output.w}×${it.output.h}` : (it.width||it.height? `${it.width||'—'}×${it.height||'—'}` : '');
  card.innerHTML=`
      <div class="card-media">
        ${hasImg? `<img loading="lazy" src="${url}" alt="#${escapeHtml(it.id)}">` : `<div class="placeholder">${status==='failed'?'失败 · 查看错误': status==='pending'?'待生成 — 点运行批次': status==='queued'?'队列中': it.output&&it.output.missing?'图片缺失（output 已清理）': it.output&&it.output.deleted?'已删除': '无图 · 先运行批次'}</div>`}
        <span class="ribbon ${ribbonClass}">${ribbonText}</span>
        <label class="select-check" title="多选"><input type="checkbox" ${checked} data-check="${escapeHtml(it.id)}" aria-label="选择 ${escapeHtml(it.id)}"></label>
      </div>
      <div class="card-body">
        <div class="card-title"><span>#${escapeHtml(it.id)}</span><span style="color:var(--muted);font:500 11px/1 Fira Code,monospace">${dims}</span></div>
      </div>
      <div class="card-actions">
        <button class="btn-ghost" data-act="kept" data-id="${escapeHtml(it.id)}" aria-label="保留 ${escapeHtml(it.id)}">✓ 保留</button>
        <button class="btn-ghost" data-act="rejected" data-id="${escapeHtml(it.id)}" aria-label="驳回 ${escapeHtml(it.id)}">✕ 驳回</button>
      </div>`;
  const img=card.querySelector('img');
  if(img){ img.addEventListener('click', ()=> openLightbox(it.id)); img.style.cursor='zoom-in'; }
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
  card.addEventListener('keydown', e=>{ if(e.key==='Enter') openLightbox(it.id); if(e.key===' '){ e.preventDefault(); cb.checked=!cb.checked; cb.dispatchEvent(new Event('change')); }});
  return card;
}
function renderGallery(){
  const grid=$('#grid');
  if(!state.curJob){ clearGallery(); return; }
  const items=filteredItems();
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
    // just re-render with diff (no full clear)
    renderGallery();
    const first=newlyDone[0];
    // subtle flash for new cards
    requestAnimationFrame(()=>{
      for(const it of newlyDone){
        const el=document.querySelector(`[data-id="${CSS.escape(it.id)}"]`);
        if(el){ el.style.outline='2px solid rgba(34,197,94,.6)'; setTimeout(()=> el.style.outline='', 1200); }
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
  if(!checkPending()) return;
  let prevSnapshot = JSON.parse(JSON.stringify(state.curJob));
  pollTimer=setInterval(async()=>{
    try{
      const j=await api('/api/job?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job));
      j._scenes=buildScenes(j);
      const prev=state.curJob;
      state.curJob=j;
      applyIncrementalUpdate(prev, j);
      updateKpi(); renderTree();
      const stillPending=j.items.some(x=> x.status==='pending'||x.status==='queued');
      if(!stillPending){ clearInterval(pollTimer); pollTimer=null; $('#status').textContent='完成'; setTimeout(()=> $('#status').textContent='', 3000); }
    }catch(e){ console.error(e); }
  }, 1500);
}
function updateBatchBar(){
  const bar=$('#batchBar');
  if(selectedIds.size){ bar.style.display='flex'; $('#batchCount').textContent=`已选 ${selectedIds.size} 项`; }
  else bar.style.display='none';
}
async function doReview(id, verdict, reason, tags){
  if(!state.date||!state.curJob) return;
  const payload={ date:state.date, job:state.curJob.job_id, item_id:id, verdict, reason: reason||'', tags: tags||[] };
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
    await loadJob(state.date, state.curJob.job_id);
    if(document.getElementById('lightbox').classList.contains('open') && state.item===id) openLightbox(id);
  }catch(e){ alert('标注失败: '+e.message); }
}

// Drawer
function openDrawer(id){
  const it=state.curJob.items.find(x=>x.id===id);
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
  const url=imageUrl(it);
  const hasImg=!!url && it.status==='done' && !it.output.missing && !it.output.deleted;
  $('#drawerBody').innerHTML=`
    ${hasImg? `<div style="border:1px solid var(--border);border-radius:12px;overflow:hidden;background:#020617"><img src="${url}" alt="#${escapeHtml(id)}" style="width:100%;display:block"></div>` : `<div class="empty" style="margin:0">${it.status==='failed'?'失败': it.status==='pending'?'待生成':'无图'}</div>`}
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
function visibleIds(){ return filteredItems().map(x=> x.id); }
function orderedScenes(){ return (state.curJob&&state.curJob._scenes)||[]; }
function lightboxStepWithin(dir){
  const ids=visibleIds(); if(!ids.length) return;
  const cur=state.item || ids[0];
  let idx=ids.indexOf(cur);
  if(idx<0) idx=0; else idx=(idx+dir+ids.length)%ids.length;
  openLightbox(ids[idx]);
}
function lightboxStep(dir){
  const ids=visibleIds(); if(!ids.length) return;
  const cur=state.item || ids[0];
  let idx=ids.indexOf(cur);
  if(idx<0) idx=0;
  const atFirst=idx===0, atLast=idx===ids.length-1;
  // cross-scene: if at boundary, jump to next/prev scene's first/last visible
  if((dir===-1 && atFirst) || (dir===1 && atLast)){
    const scenes=orderedScenes();
    if(scenes.length && state.scene){
      let si=scenes.findIndex(s=> s.scene===state.scene);
      if(si>=0){
        const nextSi=si+dir;
        if(nextSi>=0 && nextSi<scenes.length){
          const nextScene=scenes[nextSi].scene;
          // find first visible id in next scene
          const savedScene=state.scene, savedVariant=state.variant;
          state.scene=nextScene; state.variant='';
          const nextIds=visibleIds();
          state.scene=savedScene; state.variant=savedVariant;
          if(nextIds.length){
            state.scene=nextScene; state.variant=''; pushHash(); renderScenes(); renderGallery();
            const target=dir===1 ? nextIds[0] : nextIds[nextIds.length-1];
            openLightbox(target); return;
          }
        }
      }
    }
  }
  lightboxStepWithin(dir);
}
function lightboxStepScene(dir){
  const scenes=orderedScenes(); if(!scenes.length) return;
  let curIdx=scenes.findIndex(s=> s.scene===state.scene);
  if(curIdx<0) curIdx=dir===1? -1 : 0;
  const nextIdx=curIdx+dir;
  if(nextIdx<0 || nextIdx>=scenes.length) return;
  state.scene=scenes[nextIdx].scene; state.variant=''; pushHash(); renderScenes(); renderGallery();
  const ids=visibleIds();
  if(ids.length) openLightbox(ids[0]);
}
function drawerInnerHtml(id){
  const it=state.curJob.items.find(x=>x.id===id);
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
  const it=state.curJob.items.find(x=>x.id===id); if(!it) return;
  state.item=id; pushHash();
  const lb=$('#lightbox'); lb.classList.add('open');
  const url=imageUrl(it);
  const img=$('#lbImg');
  if(url && it.status==='done' && !it.output.missing && !it.output.deleted){ img.src=url; img.style.display=''; img.alt='#'+id; }
  else { img.removeAttribute('src'); img.style.display='none'; }
  const meta=$('#lbMeta');
  const verdict=(it.review&&it.review.verdict)||'unreviewed';
  const ids=visibleIds(); const pos=ids.indexOf(id)+1;
  const tags=(it.review&&it.review.tags)||[];
  meta.innerHTML=`
    <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
      <h3 style="margin:0">#${escapeHtml(id)} <span style="color:var(--muted);font:500 12px/1 Fira Code,monospace">${escapeHtml(it.status)} · ${escapeHtml(verdict)} · ${pos}/${ids.length}</span></h3>
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
    try{ const res=await fetch('/api/delete',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({date:state.date, job:state.curJob.job_id, item_id:id, hard:true})}); if(!res.ok) throw new Error(await res.text()); await loadJob(state.date, state.curJob.job_id); const nids=visibleIds(); if(nids.length) openLightbox(nids[Math.min(pos-1, nids.length-1)]); else closeLightbox(); }catch(e){ alert('删除失败: '+e.message); }
  };
  const closeBtn=meta.querySelector('[data-close-lightbox]');
  if(closeBtn) closeBtn.onclick=closeLightbox;
  const sp=meta.querySelector('#lbScenePrev'); if(sp) sp.onclick=()=> lightboxStepScene(-1);
  const sn=meta.querySelector('#lbSceneNext'); if(sn) sn.onclick=()=> lightboxStepScene(1);
}
function closeLightbox(){ $('#lightbox').classList.remove('open'); }

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
  const lbOpen=$('#lightbox').classList.contains('open');
  if(lbOpen){
    if(e.key==='ArrowLeft' || e.key==='ArrowRight'){ e.preventDefault(); lightboxStep(e.key==='ArrowLeft'? -1: 1); return; }
    if(e.key==='ArrowUp' || e.key==='ArrowDown'){ e.preventDefault(); lightboxStepScene(e.key==='ArrowUp'? -1: 1); return; }
    if(e.key==='1' || e.key==='2'){
      if(e.target && (e.target.tagName==='INPUT' || e.target.tagName==='TEXTAREA' || e.target.isContentEditable)) return;
      e.preventDefault();
      const verdict=e.key==='1' ? 'kept' : 'rejected';
      if(state.item) doReview(state.item, verdict);
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

// Run / Kill / Quit
$('#btnRun').addEventListener('click', async()=>{
  if(!state.date||!state.job){ alert('先选择左侧树中的批次包'); return; }
  const btn=$('#btnRun'); btn.disabled=true; const prev=btn.textContent; btn.textContent='运行中…';
  $('#status').textContent='已触发，后台串行生成中…';
  try{
    const res=await fetch('/api/run?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job),{method:'POST'});
    if(res.status===409){ alert('该批次已在运行中'); return; }
    if(!res.ok) throw new Error(await res.text());
    startPolling();
    let tries=0;
    const timer=setInterval(async()=>{
      tries++;
      const pending=state.curJob? state.curJob.items.filter(x=> x.status==='pending'||x.status==='queued').length : 0;
      $('#status').textContent= pending? `生成中… 剩余 ${pending}` : '完成';
      if(pending===0 || tries>120){ clearInterval(timer); btn.disabled=false; btn.textContent=prev; setTimeout(()=> $('#status').textContent='', 3000); }
    }, 2000);
  }catch(e){ alert('触发失败: '+e.message); }
  finally{ if(btn.disabled) setTimeout(()=>{ btn.disabled=false; btn.textContent=prev; }, 800); }
});
$('#btnKill').addEventListener('click', async()=>{
  if(!confirm('释放端口并清理 anima 幽灵进程？（kill :8765 + anima.exe）')) return;
  alert('请在终端执行: anima kill  或  anima kill --port 8765');
});
$('#btnQuit').addEventListener('click', async()=>{
  if(!confirm('Quit 将关闭网页并停止后端服务，确定？')) return;
  try{ await fetch('/api/quit',{method:'POST'}); }catch(e){}
  setLive(false);
  $('#status').textContent='服务已停止';
  setTimeout(()=>{ window.close(); setTimeout(()=>{ document.body.innerHTML='<div style="display:grid;place-items:center;height:100vh;background:#0F172A;color:#94A3B8;font:14px Inter;text-align:center"><div><h2>Anima 已退出</h2><p>后端服务已停止，可关闭此标签页。</p></div></div>'; }, 300); }, 400);
});

// Init
parseHash();
applyTreeCollapsed();
updateDelBtn();
window.addEventListener('hashchange', ()=>{ parseHash(); renderTree(); renderScenes(); renderGallery(); updateDelBtn(); if(state.date&&state.job) loadJob(state.date, state.job); if(state.item) openDrawer(state.item); });
loadDates();
