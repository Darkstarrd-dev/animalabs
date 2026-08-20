
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
