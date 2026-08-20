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
