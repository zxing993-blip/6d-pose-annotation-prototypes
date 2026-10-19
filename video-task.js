(() => {
  // 表单内容逐项取自项目内「视频标注-摆放物品.png」的可见结果区。
  const actionOptions = ['抓取','寻找','持握运输','按按钮','把...放到...里','整理','手收回','放到'];
  const right = [
    {time:'00:00:00:00-00:00:00:42',frames:'1-43',action:'抓取',target:'手持纸盒'},
    {time:'00:00:00:42-00:00:17:54',frames:'43-1075',action:'寻找',target:'扁平纸盒'},
    {time:'00:00:17:54-00:00:21:18',frames:'1075-1279',action:'持握运输',target:'折叠完成的纸盒'},
    {time:'00:00:21:18-00:00:24:54',frames:'1279-1495',action:'按按钮',target:'电脑鼠标'}
  ];
  const left = [
    {time:'00:00:00:00-00:00:00:42',frames:'1-43',action:'把...放到...里',target:'手持纸盒'},
    {time:'00:00:00:42-00:00:02:12',frames:'43-133',action:'整理',target:'左侧堆叠的扁平纸盒',english:'Left-stacked flat cardboard boxes'},
    {time:'00:00:02:12-00:00:17:54',frames:'133-1075',action:'寻找',target:'扁平纸盒'},
    {time:'00:00:17:54-00:00:21:18',frames:'1075-1279',action:'手收回',target:'折叠完成的纸盒'},
    {time:'00:00:22:00-00:00:24:00',frames:'1321-1441',action:'把...放到...里',target:'',success:'否'}
  ];
  const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
  const renderOptions = selected => actionOptions.map(value => `<option ${value===selected?'selected':''}>${esc(value)}</option>`).join('');
  function renderAction(item,side,index){
    const id=`${side}-${index}`;
    const success=item.success||'是';
    return `<section class="action-item">
      <div class="time-row"><span class="text">时间范围：${esc(item.time)}　（${esc(item.frames)}）</span><span class="row-tools"><button class="mini-play" type="button" aria-label="播放此片段">▶</button><button class="trash" type="button" aria-label="删除此片段">♜</button></span></div>
      <label class="select-row"><span>Action:</span><select aria-label="${side==='right'?'右手':'左手'}第${index+1}段 Action">${renderOptions(item.action)}</select></label>
      <label class="target-label" for="target-${id}">目标名称</label><input class="target-input" id="target-${id}" type="text" value="${esc(item.target)}">
      ${item.english!==undefined?`<label class="english-label" for="english-${id}">目标名称（英）</label><input class="english-input" id="english-${id}" type="text" value="${esc(item.english)}">`:''}
      <fieldset class="choice-field"><legend>是否成功</legend>${['是','否','中断'].map(value=>`<label><input type="radio" name="success-${id}" value="${value}" ${success===value?'checked':''}> ${value}</label>`).join('')}</fieldset>
    </section>`;
  }
  document.getElementById('rightHandActions').innerHTML=right.map((item,index)=>renderAction(item,'right',index)).join('');
  document.getElementById('leftHandActions').innerHTML=left.map((item,index)=>renderAction(item,'left',index)).join('');
  const timeline=document.querySelector('.timeline');
  const scrub=document.getElementById('timelineScrub');
  const readout=document.getElementById('timeReadout');
  const playButton=document.getElementById('playButton');
  const withinTask=document.getElementById('poseWithinTask');
  const outsideTask=document.getElementById('poseOutsideTask');
  const boxLayer=document.getElementById('videoObjectBoxes');
  const taskContent=document.getElementById('taskContent');
  const taskToggle=document.getElementById('taskToggle');
  const dialog=document.getElementById('unsavedDialog');
  const toastNode=document.getElementById('videoToast');
  const objects=[
    {id:'box-01',name:'手持纸盒',from:0,to:370,box:{x:20,y:62,w:36,h:18},thumb:{x:-206,y:-202},color:'#ffd327'},
    {id:'box-02',name:'折叠纸盒',from:80,to:1400,box:{x:55,y:45,w:21,h:30},thumb:{x:-284,y:-165},color:'#27c7f1'},
    {id:'mouse-01',name:'电脑鼠标',from:120,to:1490,box:{x:85,y:68,w:6,h:9},thumb:{x:-351,y:-205},color:'#e756db'}
  ];  const taskStartFrame=0,taskEndFrame=1494,videoEndFrame=1495;
  const fields=[['tx','位置 X',3],['ty','位置 Y',3],['tz','位置 Z',3],['rx','旋转 X',1],['ry','旋转 Y',1],['rz','旋转 Z',1]];
  const state={frame:132,selectedId:'box-01',poseOpen:true,taskExpanded:true,saved:new Map(),drafts:new Map(),pendingFrame:null,pendingKeepScroll:false};
  let toastTimer;

  function timecode(frame){
    const seconds=Math.floor(frame/60);
    return `00:${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}:${String(frame%60).padStart(2,'0')}`;
  }
  function taskAt(frame){return frame>=taskStartFrame && frame<=taskEndFrame;}
  function presentObjects(frame){return objects.filter(item=>frame>=item.from && frame<=item.to);}
  function poseValid(item,frame){return !(item.id==='box-02'&&frame>=400&&frame<=430) && !(item.id==='mouse-01'&&frame>=900&&frame<=920);}
  function poseKey(id,frame){return `${id}@${frame}`;}
  function basePose(id,frame){
    const seed=objects.findIndex(item=>item.id===id)+1;
    return {tx:(seed*.11+frame*.0004).toFixed(3),ty:(seed*.06+frame*.0002).toFixed(3),tz:(.65+seed*.08).toFixed(3),rx:'0.0',ry:(seed*1.2).toFixed(1),rz:(frame*.06).toFixed(1)};
  }
  function currentPose(id){const key=poseKey(id,state.frame);return state.drafts.get(key)||state.saved.get(key)||basePose(id,state.frame);}
  function isDirty(){return state.drafts.size>0;}
  function showToast(message){
    toastNode.textContent=message;toastNode.hidden=false;
    clearTimeout(toastTimer);toastTimer=setTimeout(()=>{toastNode.hidden=true;},2300);
  }
  function pause(){playButton.textContent='▶';playButton.setAttribute('aria-label','播放');}
  function renderPoseEditor(item){
    if(!poseValid(item,state.frame))return `<div class="pose-unavailable">当前画面已识别该物品，但 6D 位姿不可用。请登记异常，等待管理员重跑。</div><button type="button" class="pose-link" data-issue="${item.id}">登记异常</button>`;
    const key=poseKey(item.id,state.frame),pose=currentPose(item.id);
    return `<div class="pose-editor ${state.drafts.has(key)?'pose-editor-dirty':''}"><div class="pose-editor-head"><strong>6D Pose 坐标</strong></div>
      <div class="pose-grid">${fields.map(([field,label,digits])=>`<label class="pose-field"><span>${label}（${field}）</span><span class="pose-input"><button type="button" data-step="${field}" data-delta="-1" aria-label="减小${label}">−</button><input type="number" inputmode="decimal" data-field="${field}" value="${esc(pose[field])}" step="${digits===3?'0.001':'0.1'}" aria-label="${label}"><button type="button" data-step="${field}" data-delta="1" aria-label="增大${label}">＋</button></span></label>`).join('')}</div>
      <div class="pose-editor-actions"><button type="button" class="pose-link" id="restorePose">恢复默认值</button><details class="pose-more"><summary aria-label="更多位姿操作" title="更多位姿操作">···</summary><button type="button" class="pose-link" data-issue="${item.id}">登记异常</button></details></div>
    </div>`;
  }
  function renderPoseSection(){
    const inTask=taskAt(state.frame);
    withinTask.hidden=!inTask;outsideTask.hidden=inTask;
    const panel=inTask?withinTask:outsideTask;
    const visible=presentObjects(state.frame);
    if(state.selectedId&&!visible.some(item=>item.id===state.selectedId))state.selectedId=null;
    const heading=`<div class="pose-section-header"><button type="button" class="pose-section-heading" id="poseSectionToggle" aria-expanded="${state.poseOpen}"><span>${state.poseOpen?'▾':'▸'}</span><strong>物品三维位置与朝向</strong></button><span class="pose-current-time">当前画面 ${timecode(state.frame)} · ${visible.length} 件物品</span>${inTask?`<div class="pose-frame-navigation" aria-label="切换当前 Task 内的源帧"><button type="button" data-frame-step="-1" aria-label="上一帧" title="上一帧" ${state.frame<=taskStartFrame?'disabled':''}>‹</button><button type="button" data-frame-step="1" aria-label="下一帧" title="下一帧" ${state.frame>=taskEndFrame?'disabled':''}>›</button></div>`:''}</div>`;
    panel.innerHTML=heading+(state.poseOpen?`<div class="pose-section-body">${!inTask?'<div class="pose-outside-tip">当前画面未归属 Task；仍可查看和修改该画面的物品位姿。</div>':''}${visible.length?visible.map(item=>{
      const selected=state.selectedId===item.id;
      return `<div class="pose-item"><button type="button" class="pose-object ${selected?'selected':''}" data-object="${item.id}" aria-pressed="${selected}"><span class="pose-thumb" style="--thumb-x:${item.thumb.x}px;--thumb-y:${item.thumb.y}px"></span><span class="pose-object-main"><span class="pose-object-name">${esc(item.name)}</span><small>ID ${esc(item.id)}</small></span>${poseValid(item,state.frame)?'':'<span class="pose-status invalid">位姿不可用</span>'}</button>${selected?renderPoseEditor(item):''}</div>`;
    }).join(''):'<div class="pose-empty">当前画面无已识别物品。</div>'}<button type="button" class="pose-report" id="reportMissing">＋ 增加物品</button></div>`:'');
    boxLayer.innerHTML=visible.map(item=>`<button type="button" class="video-object-box ${state.selectedId===item.id?'selected':''}" data-box="${item.id}" style="left:${item.box.x}%;top:${item.box.y}%;width:${item.box.w}%;height:${item.box.h}%;--pose-color:${item.color}" title="${esc(item.name)} · ${esc(item.id)}" aria-label="选择${esc(item.name)}"><span>${esc(item.name)}</span><svg class="pose-wireframe" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="pose-wire-halo" d="M4 18H80V96H4Z M22 4H97V82H22Z M4 18L22 4 M80 18L97 4 M80 96L97 82 M4 96L22 82"/><path class="pose-wire-line" d="M4 18H80V96H4Z M22 4H97V82H22Z M4 18L22 4 M80 18L97 4 M80 96L97 82 M4 96L22 82"/></svg></button>`).join('');
    bindPoseEvents(panel);
  }
  function bindPoseEvents(panel){
    panel.querySelector('#poseSectionToggle')?.addEventListener('click',()=>{state.poseOpen=!state.poseOpen;renderPoseSection();});
    panel.querySelectorAll('[data-frame-step]').forEach(button=>button.addEventListener('click',()=>{pause();requestFrame(state.frame+Number(button.dataset.frameStep),true);}));
    panel.querySelectorAll('[data-object]').forEach(button=>button.addEventListener('click',()=>selectObject(button.dataset.object)));
    boxLayer.querySelectorAll('[data-box]').forEach(button=>button.addEventListener('click',()=>selectObject(button.dataset.box)));
    panel.querySelectorAll('[data-field]').forEach(input=>input.addEventListener('input',()=>{
      pause();
      const key=poseKey(state.selectedId,state.frame);
      const draft={...currentPose(state.selectedId),[input.dataset.field]:input.value};
      state.drafts.set(key,draft);
      panel.querySelector('.pose-editor').classList.add('pose-editor-dirty');
    }));
    panel.querySelectorAll('[data-step]').forEach(button=>button.addEventListener('click',()=>{
      pause();
      const field=button.dataset.step,step=field.startsWith('t')?.001:.1,digits=field.startsWith('t')?3:1;
      const key=poseKey(state.selectedId,state.frame),pose={...currentPose(state.selectedId)};
      pose[field]=((Number(pose[field])||0)+step*Number(button.dataset.delta)).toFixed(digits);
      state.drafts.set(key,pose);renderPoseSection();
    }));
    panel.querySelector('#restorePose')?.addEventListener('click',()=>{
      const key=poseKey(state.selectedId,state.frame);
      state.drafts.delete(key);
      state.saved.delete(key);
      renderPoseSection();
      showToast('已恢复当前物品在当前画面的模型默认值');
    });
    panel.querySelectorAll('[data-issue]').forEach(button=>button.addEventListener('click',()=>showToast('已记录当前画面异常（原型演示）')));
    panel.querySelector('#reportMissing')?.addEventListener('click',()=>showToast('增加物品：请先确认物品名称和目标 ID；新增物品的位姿需模型重跑生成'));
  }
  function selectObject(id){
    pause();state.selectedId=id;state.poseOpen=true;
    if(taskAt(state.frame)&&!state.taskExpanded){state.taskExpanded=true;syncTaskToggle();}
    renderPoseSection();
    (taskAt(state.frame)?withinTask:outsideTask).querySelector(`[data-object="${id}"]`)?.scrollIntoView({block:'nearest'});
  }
  function syncTaskToggle(){taskContent.hidden=!state.taskExpanded;taskToggle.setAttribute('aria-expanded',String(state.taskExpanded));taskToggle.querySelector('.caret').textContent=state.taskExpanded?'▾':'▸';}
  function syncTime(){
    timeline.style.setProperty('--progress',`${(state.frame/videoEndFrame*100).toFixed(2)}%`);
    readout.textContent=`${timecode(state.frame)} / ${timecode(videoEndFrame)}`;
    scrub.value=String(state.frame);
  }
  function switchFrame(frame,keepScroll=false){
    const previouslyInTask=taskAt(state.frame);
    state.frame=frame;
    if(!taskAt(frame))state.taskExpanded=false;
    else if(!previouslyInTask)state.taskExpanded=true;
    syncTaskToggle();
    const visible=presentObjects(frame);
    if(!visible.some(item=>item.id===state.selectedId))state.selectedId=null;
    syncTime();renderPoseSection();
    if(!keepScroll)(taskAt(frame)?withinTask:outsideTask).scrollIntoView({block:'nearest'});
  }
  function saveDrafts(){
    for(const pose of state.drafts.values()){
      if(fields.some(([field])=>String(pose[field]??'').trim()===''||!Number.isFinite(Number(pose[field])))){
        showToast('请把六项坐标都填写为有效数字后再保存');
        return false;
      }
    }
    for(const [key,pose] of state.drafts)state.saved.set(key,{...pose});
    state.drafts.clear();renderPoseSection();
    return true;
  }
  function requestFrame(frame,keepScroll=false){
    if(!Number.isInteger(frame)||frame<0||frame>videoEndFrame||frame===state.frame)return;
    pause();
    if(isDirty()){state.pendingFrame=frame;state.pendingKeepScroll=keepScroll;scrub.value=String(state.frame);dialog.hidden=false;return;}
    switchFrame(frame,keepScroll);
  }
  scrub.addEventListener('change',()=>requestFrame(Number(scrub.value)));
  playButton.addEventListener('click',()=>{
    if(isDirty()){showToast('请先保存或放弃当前坐标修改，再播放视频');return;}
    const playing=playButton.textContent==='▶';
    playButton.textContent=playing?'❚❚':'▶';
    playButton.setAttribute('aria-label',playing?'暂停':'播放');
    if(playing)showToast('播放控件为原型展示；按时间轴选择画面');
  });
  taskToggle.addEventListener('click',()=>{state.taskExpanded=!state.taskExpanded;syncTaskToggle();});
  document.querySelector('.top-button.save').addEventListener('click',()=>{if(saveDrafts())showToast('当前修改已保存到原型页面（未提交平台）');});
  document.querySelector('.top-button.submit').addEventListener('click',()=>showToast(isDirty()?'请先保存当前画面的坐标':'提交仅为原型展示'));
  dialog.querySelectorAll('[data-unsaved]').forEach(button=>button.addEventListener('click',()=>{
    const action=button.dataset.unsaved,pending=state.pendingFrame,keepScroll=state.pendingKeepScroll;
    if(action==='save'&&!saveDrafts())return;
    dialog.hidden=true;state.pendingFrame=null;state.pendingKeepScroll=false;
    if(action==='cancel')return;
    if(action==='discard')state.drafts.clear();
    switchFrame(pending,keepScroll);
  }));
  syncTime();renderPoseSection();
})();
