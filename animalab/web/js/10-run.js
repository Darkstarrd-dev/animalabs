// Run / Pause / Stop / Kill / Quit
let serverRunning=false;
let runPaused=false;
async function syncRunStatus(){
  if(!state.date||!state.job){ serverRunning=false; runPaused=false; updateRunControls(); return; }
  try{
    const j=await api('/api/run/status?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job));
    serverRunning=!!j.running; runPaused=!!j.paused;
  }catch(e){ serverRunning=false; }
  updateRunControls();
}
function updateRunControls(){
  const running = serverRunning;
  const btnRun=$('#btnRun'), btnPause=$('#btnPause'), btnStop=$('#btnStop');
  if(!btnRun||!btnPause||!btnStop) return;
  if(running){
    btnRun.style.display='none';
    btnPause.style.display='';
    btnStop.style.display='';
    btnPause.textContent = runPaused ? '▶ 继续' : '⏸ 暂停';
    btnPause.title = runPaused ? '继续批次' : '暂停（完成当前张后暂停）';
  } else {
    btnRun.style.display='';
    btnPause.style.display='none';
    btnStop.style.display='none';
    btnRun.disabled=false; btnRun.textContent='▶ 运行批次';
    runPaused=false;
  }
}
async function runApi(path){
  if(!state.date||!state.job) throw new Error('no job selected');
  const res=await fetch('/api/run/'+path+'?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job),{method:'POST'});
  if(!res.ok) throw new Error(await res.text());
  return res.json();
}
$('#btnRun').addEventListener('click', async()=>{
  if(!state.date||!state.job){ alert('先选择左侧树中的批次包'); return; }
  const btn=$('#btnRun'); btn.disabled=true; const prev=btn.textContent; btn.textContent='运行中…';
  $('#status').textContent='已触发，后台串行生成中…';
  try{
    const hdr=buildHdrPayload();
    const res=await fetch('/api/run?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job),{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(hdr)});
    if(res.status===409){ alert('该批次已在运行中'); return; }
    if(!res.ok) throw new Error(await res.text());
    serverRunning=true; runPaused=false;
    updateRunControls();
    startPolling();
    let tries=0;
    const timer=setInterval(async()=>{
      tries++;
      try{
        const s=await api('/api/run/status?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job));
        serverRunning=!!s.running; runPaused=!!s.paused;
        updateRunControls();
        if(s.stopped || !s.running){ clearInterval(timer); if(s.stopped) $('#status').textContent='已停止'; updateRunControls(); }
      }catch(e){}
      const pending=state.curJob? state.curJob.items.filter(x=> x.status==='pending'||x.status==='queued').length : 0;
      if(!runPaused) $('#status').textContent= pending? `生成中… 剩余 ${pending}` : '完成';
      else $('#status').textContent= `已暂停 · 剩余 ${pending} · 点 继续 恢复`;
      if(pending===0 || tries>240){ clearInterval(timer); serverRunning=false; btn.disabled=false; btn.textContent=prev; updateRunControls(); setTimeout(()=> $('#status').textContent='', 3000); }
    }, 1500);
  }catch(e){ alert('触发失败: '+e.message); }
  finally{ if(btn.disabled) setTimeout(()=>{ btn.disabled=false; btn.textContent=prev; updateRunControls(); }, 800); }
});
$('#btnPause').addEventListener('click', async()=>{
  if(!state.date||!state.job) return;
  const btn=$('#btnPause'); const wasPaused=runPaused;
  btn.disabled=true;
  try{
    if(!wasPaused){
      await runApi('pause');
      runPaused=true;
      $('#status').textContent='暂停中（完成当前张后暂停）…';
    } else {
      await runApi('resume');
      runPaused=false;
      $('#status').textContent='已继续…';
    }
    updateRunControls();
  }catch(e){ alert((wasPaused?'继续':'暂停')+'失败: '+e.message); }
  finally{ btn.disabled=false; updateRunControls(); }
});
$('#btnStop').addEventListener('click', async()=>{
  if(!state.date||!state.job) return;
  if(!confirm('停止当前批次？正在生成的图片会尝试中断，剩余 pending 保留。')) return;
  const btn=$('#btnStop'); btn.disabled=true;
  try{
    await runApi('stop');
    serverRunning=false; runPaused=false;
    $('#status').textContent='已停止';
    updateRunControls();
    // re-sync after stop to ensure server cleared running flag; poll will also confirm
    setTimeout(()=> syncRunStatus(), 400);
    setTimeout(()=> syncRunStatus(), 1200);
  }catch(e){ alert('停止失败: '+e.message); }
  finally{ btn.disabled=false; updateRunControls(); }
});
$('#btnKill').addEventListener('click', async()=>{
  if(!confirm('释放端口并清理 anima 幽灵进程？（kill :8765 + anima.exe）')) return;
  alert('请在终端执行: anima kill  或  anima kill --port 8765');
});
$('#btnRerunGroup').addEventListener('click', async()=>{
  if(!state.date||!state.job){ alert('先选择左侧树中的批次包'); return; }
  if(!state.scene){ alert('在中栏 Scenes 选择一个分组后可用'); return; }
  const label = state.variant ? `${state.scene}/${state.variant}` : state.scene;
  if(!confirm(`重运行分组 [${label}] 将覆盖该分组已有图片并重新生成，是否继续？`)) return;
  const btn=$('#btnRerunGroup'); btn.disabled=true; const prev=btn.textContent; btn.textContent='重运行中…';
  $('#status').textContent='重运行已触发，替换生成中…';
  try{
    const hdr=buildHdrPayload();
    // merge group filter into payload
    hdr.group=state.scene; if(state.variant) hdr.subgroup=state.variant;
    hdr.force=true;
    const res=await fetch('/api/run?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job),{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(hdr)});
    if(res.status===409){ alert('该批次已在运行中（全批或该分组）'); return; }
    if(!res.ok) throw new Error(await res.text());
    serverRunning=true; runPaused=false; updateRunControls(); startPolling();
    let tries=0;
    const timer=setInterval(async()=>{
      tries++;
      try{
        const s=await api('/api/run/status?date='+encodeURIComponent(state.date)+'&job='+encodeURIComponent(state.job));
        runPaused=!!s.paused; updateRunControls();
        if(s.stopped){ clearInterval(timer); $('#status').textContent='已停止'; updateRunControls(); }
      }catch(e){}
      const pending=state.curJob? state.curJob.items.filter(x=> x.status==='pending'||x.status==='queued').length : 0;
      if(!runPaused) $('#status').textContent= pending? `重运行中… 剩余 ${pending}` : '重运行完成';
      else $('#status').textContent=`已暂停 · 剩余 ${pending}`;
      if(pending===0 || tries>240){ clearInterval(timer); serverRunning=false; btn.disabled=false; btn.textContent=prev; updateRerunBtn(); updateRunControls(); setTimeout(()=> $('#status').textContent='', 3000); }
    }, 1500);
  }catch(e){ alert('重运行失败: '+e.message); btn.disabled=false; btn.textContent=prev; updateRerunBtn(); }
});
$('#btnQuit').addEventListener('click', async()=>{
  if(!confirm('Quit 将关闭网页并停止后端服务，确定？')) return;
  try{ await fetch('/api/quit',{method:'POST'}); }catch(e){}
  setLive(false);
  $('#status').textContent='服务已停止';
  setTimeout(()=>{ window.close(); setTimeout(()=>{ document.body.innerHTML='<div style="display:grid;place-items:center;height:100vh;background:#0F172A;color:#94A3B8;font:14px Inter;text-align:center"><div><h2>Anima 已退出</h2><p>后端服务已停止，可关闭此标签页。</p></div></div>'; }, 300); }, 400);
});

