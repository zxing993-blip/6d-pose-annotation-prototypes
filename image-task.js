(() => {
  const photo = './image-source.png';
  const app = document.getElementById('app');
  const objects = [1, 2, 3, 4, 5, 9];
  const objectNames = Object.fromEntries(objects.map(id => [id, '红绿灯']));
  // 系统自动标注原值的原型示例；截图和现有项目资料均不包含这些物品的真实 6D 结果。
  const autoPose = Object.fromEntries(objects.map(id => [id, {
    tx: (id * 0.081).toFixed(3), ty: (id * 0.024).toFixed(3), tz: (0.7 + id * 0.013).toFixed(3),
    rx: '0.0', ry: '0.0', rz: (id * 2.5).toFixed(1)
  }]));
  const hotspots = [
    { id: 9, x: 44.1, y: 33.5, w: 4.7, h: 4.5, color: '#ef4052' },
    { id: 3, x: 68.2, y: 26.1, w: 2.4, h: 8.2, color: '#ef4052' },
    { id: 2, x: 73.6, y: 26.2, w: 2.4, h: 8.2, color: '#ef4052' },
    { id: 1, x: 80.4, y: 26.0, w: 2.4, h: 8.4, color: '#ef4052' },
    { id: 4, x: 92.4, y: 26.0, w: 2.4, h: 8.4, color: '#ef4052' },
    { id: 5, x: 85.6, y: 33.6, w: 2.7, h: 8.5, color: '#ef4052' }
  ];  const clonePose = pose => Object.fromEntries(objects.map(id => [id, { ...pose[id] }]));
  const state = { page: 9, tab: '对象', tool: '选择', selectedObject: 9, collapsed: false, valid: true, pose: clonePose(autoPose), savedByPage: { 9: clonePose(autoPose) }, dirty: false, pendingPage: null };
  let noticeTimer;
  function updateDirty() { state.dirty = JSON.stringify(state.pose) !== JSON.stringify(state.savedByPage[state.page] || autoPose); }
  function saveCurrent() {
    if (objects.some(id => Object.values(state.pose[id]).some(v => String(v).trim() === '' || !Number.isFinite(Number(v))))) {
      toast('六项坐标均须填写有效数字后才能保存'); return false;
    }
    state.savedByPage[state.page] = clonePose(state.pose);
    state.dirty = false;
    return true;
  }

  function iconButton(label, symbol, cls = '') {
    return `<button type="button" class="${cls}" aria-label="${label}" title="${label}">${symbol}</button>`;
  }

  function render() {
    app.innerHTML = `
      <main class="workspace" aria-label="图片标注工作台">
        <header class="topbar">
          <button type="button" class="close" title="关闭">× 关闭</button>
          <div class="file-pill" title="1746894026.1333..."><span>1746894026.1333...</span><span class="divider"></span><span class="info">ℹ</span></div>
          <span class="spacer"></span>
          ${iconButton('统计', '▥', 'top-icon')}
          ${iconButton('快捷键', '▦', 'top-icon')}
          ${iconButton('全屏', '⛶', 'top-icon fullscreen')}
          <span class="vline"></span>
          <button type="button" class="top-action save">▣ 保存</button>
          <button type="button" class="top-action submit">▤ 提交</button>
          <button type="button" class="top-action valid">数据${state.valid ? '有效' : '无效'}</button>
        </header>
        <div class="toolrow" aria-label="图片标注工具栏">
          ${tool('选择','➤',true)}
          ${tool('放大','⊕')}
          ${tool('缩小','⊖')}
          ${tool('预览','预',false,'text')}
          ${tool('更多预览选项','⋮',false,'slim')}
          ${tool('关联','♧')}
          ${tool('测量','◿',true)}
          ${tool('更多测量选项','⋮',false,'slim')}
          ${tool('旋转矩形','□',true)}
          ${tool('吸附','♧')}
          ${tool('更多绘制选项','⋮',false,'slim')}
          ${tool('复制','▢')}
          <span class="spacer"></span>
          <div class="center-tools"><button type="button" class="outline-btn sync">同步属性</button><button type="button" class="outline-btn copy-many">批量复制</button><span class="m-key">M</span><span class="active-object">◇ ${state.selectedObject}－${objectNames[state.selectedObject]}</span></div>
          <div class="right-tools">${iconButton('设置','☷','tool-icon')}${iconButton('适应画布','⛶','tool-icon')}<span class="zoom-text">R:0°<br>Z:21%</span></div>
        </div>
        <div class="content">
          <section class="canvas" aria-label="标注画布"><div class="reference-photo"><img src="${photo}" alt="现有图片标注画面中的红绿灯" draggable="false">${hotspots.map(box => `<button type="button" class="object-hotspot ${state.selectedObject === box.id ? 'selected' : ''}" data-hotspot="${box.id}" style="left:${box.x}%;top:${box.y}%;width:${box.w}%;height:${box.h}%;--pose-color:${box.color}" aria-label="选择${objectNames[box.id]}" title="${objectNames[box.id]}"><span>#${box.id} ${objectNames[box.id]}</span><svg class="pose-wireframe" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path class="pose-wire-halo" d="M4 18H80V96H4Z M22 4H97V82H22Z M4 18L22 4 M80 18L97 4 M80 96L97 82 M4 96L22 82"/><path class="pose-wire-line" d="M4 18H80V96H4Z M22 4H97V82H22Z M4 18L22 4 M80 18L97 4 M80 96L97 82 M4 96L22 82"/></svg></button>`).join('')}</div></section>
          <aside class="side" aria-label="标注对象面板">
            <div class="side-tabs">${['对象','批注','分类','检测'].map(tab => `<button type="button" class="side-tab ${state.tab === tab ? 'active' : ''}" data-tab="${tab}">${tab}</button>`).join('')}</div>
            <div class="side-body">${sideContent()}</div>
            <div class="side-utility"><button type="button" class="assistant-bubble" title="帮助">✦A</button></div>
          </aside>
        </div>
        <div class="image-footer"><div class="footer-left"><span>ⓘ</span><span class="diamond">◇</span><span class="count">9</span></div><span class="spacer"></span><div class="footer-middle"><button type="button" class="previous" aria-label="上一张">‹</button><input class="page-input" aria-label="当前图片序号" type="number" min="1" max="10" value="${state.page}"><span class="total">/ 10</span><button type="button" class="next" aria-label="下一张">›</button><button type="button" class="search" title="搜索">⌕</button></div><span class="spacer"></span><button type="button" class="autoload">自动加载</button><button type="button" class="delete-all" title="删除">♜</button></div>
        <div class="thumb-strip" aria-label="图片列表">${Array.from({length:10},(_,i) => `<button type="button" class="thumb ${[5,7,9].includes(i+1)?'flagged':''} ${state.page === i+1?'current':''}" data-page="${i+1}">${i+1}</button>`).join('')}</div>
      </main>${state.pendingPage !== null ? `<div class="unsaved-backdrop"><div class="unsaved-dialog" role="dialog" aria-modal="true" aria-label="未保存修改"><strong>当前图片的坐标尚未保存</strong><p>切换图片前，请处理本次修改。</p><div><button type="button" data-page-action="cancel">取消切换</button><button type="button" data-page-action="discard">放弃修改</button><button type="button" data-page-action="save">保存并切换</button></div></div></div>` : ''}`;
    bind();
  }

  function tool(name, symbol, active = false, extra = '') {
    const selected = state.tool === name || (active && ['测量','旋转矩形'].includes(name));
    return `<button type="button" class="tool-icon ${selected?'active':''} ${extra}" data-tool="${name}" title="${name}" aria-label="${name}">${symbol}</button>`;
  }

  function sideContent() {
    if (state.tab !== '对象') return `<div class="blank-tab">暂无${state.tab}数据</div>`;
    return `<div class="section-heading"><span>⌄</span><span>实例(1)</span><span class="more">⋯</span></div>
      <div class="instance-panel"><div class="instance-box"><div class="instance-group"><button type="button" class="collapse" aria-label="${state.collapsed?'展开':'折叠'}物品">${state.collapsed?'▸':'▾'}</button><span>◇</span><span class="name">红绿灯</span><span class="count">(6)</span><div class="actions"><button type="button" title="显示或隐藏">◎</button><button type="button" title="删除">♜</button></div></div>${state.collapsed?'':objects.map(n => `<div class="instance-row ${state.selectedObject===n?'selected':''}" data-object="${n}" tabindex="0" role="button" aria-label="选择${objectNames[n]}"><span class="number">#${n}</span><div class="actions"><button type="button" title="编辑 #${n}">✎</button><button type="button" title="显示或隐藏 #${n}">◎</button><button type="button" title="锁定 #${n}">♙</button><button type="button" title="删除 #${n}">♜</button></div></div>${state.selectedObject===n?poseEditor(n):''}`).join('')}</div></div>
      <div class="section-heading group-heading"><span>⌄</span><span>群组(0)</span></div><div class="empty-panel">暂无数据</div>`;
  }

  function poseEditor(id) {
    const fields = [
      ['tx', 'X', '位置'], ['ty', 'Y', '位置'], ['tz', 'Z', '位置'],
      ['rx', 'X', '旋转'], ['ry', 'Y', '旋转'], ['rz', 'Z', '旋转']
    ];
    return `<div class="pose-editor" aria-label="${objectNames[id]} 的 6D Pose 坐标">
      <div class="pose-heading"><strong>6D Pose 坐标</strong><span>${objectNames[id]} · #${id}</span></div>
      <div class="pose-fields">${fields.map(([key, axis, type]) => `<label class="pose-field"><span>${type} ${axis}（${key}）</span><span class="pose-input-wrap"><button type="button" class="pose-step" data-pose-step="${key}" data-direction="-1" aria-label="减小${type}${axis}">−</button><input type="number" inputmode="decimal" data-pose-field="${key}" value="${state.pose[id][key]}" step="${type==='位置'?'0.001':'0.1'}" aria-label="${type}${axis}"><button type="button" class="pose-step" data-pose-step="${key}" data-direction="1" aria-label="增大${type}${axis}">＋</button></span></label>`).join('')}</div>
      <div class="pose-footer"><button type="button" class="pose-reset">恢复默认值</button></div>
    </div>`;
  }

  function toast(message) {
    document.querySelector('.notice')?.remove();
    const node = document.createElement('div'); node.className = 'notice'; node.textContent = message;
    document.body.appendChild(node);
    clearTimeout(noticeTimer); noticeTimer = setTimeout(() => node.remove(), 2000);
  }

  function setPage(value) {
    const page = Number(value);
    if (!Number.isInteger(page) || page < 1 || page > 10) return;
    if (page === state.page) { render(); return; }
    if (state.dirty) { state.pendingPage = page; render(); return; }
    state.page = page;
    state.pose = clonePose(state.savedByPage[page] || autoPose);
    render();
  }

  function bind() {
    document.querySelectorAll('[data-hotspot]').forEach(button => button.addEventListener('click', () => selectObject(Number(button.dataset.hotspot))));
    document.querySelectorAll('[data-tab]').forEach(button => button.addEventListener('click', () => {state.tab = button.dataset.tab; render();}));
    document.querySelectorAll('[data-tool]').forEach(button => button.addEventListener('click', () => {state.tool = button.dataset.tool; render();}));
    document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => setPage(button.dataset.page)));
    document.querySelector('.page-input').addEventListener('change', e => setPage(e.target.value));
    document.querySelector('.previous').addEventListener('click', () => setPage(state.page - 1));
    document.querySelector('.next').addEventListener('click', () => setPage(state.page + 1));
    document.querySelector('.collapse')?.addEventListener('click', () => {state.collapsed = !state.collapsed; render();});
    document.querySelectorAll('[data-object]').forEach(row => {
      row.addEventListener('click', e => {if(e.target.tagName === 'BUTTON') return; selectObject(Number(row.dataset.object));});
      row.addEventListener('keydown', e => {if(e.key === 'Enter' || e.key === ' ') {e.preventDefault(); selectObject(Number(row.dataset.object));}});
    });
    document.querySelectorAll('[data-pose-field]').forEach(input => input.addEventListener('input', () => {
      state.pose[state.selectedObject][input.dataset.poseField] = input.value;
      updateDirty();
    }));
    document.querySelectorAll('[data-pose-step]').forEach(button => button.addEventListener('click', () => {
      const field = button.dataset.poseStep;
      const step = field.startsWith('t') ? 0.001 : 0.1;
      const digits = field.startsWith('t') ? 3 : 1;
      const current = Number(state.pose[state.selectedObject][field]) || 0;
      state.pose[state.selectedObject][field] = (current + step * Number(button.dataset.direction)).toFixed(digits);
      updateDirty(); render();
    }));
    document.querySelector('.pose-reset')?.addEventListener('click', () => {
      state.pose[state.selectedObject] = { ...autoPose[state.selectedObject] };
      if (!state.savedByPage[state.page]) state.savedByPage[state.page] = clonePose(autoPose);
      state.savedByPage[state.page][state.selectedObject] = { ...autoPose[state.selectedObject] };
      updateDirty(); render();
      toast('已恢复并保存当前图片中该物品的模型原值（原型演示）');
    });
    document.querySelector('.valid').addEventListener('click', () => {state.valid = !state.valid; render();});
    document.querySelector('.fullscreen').addEventListener('click', () => {if(!document.fullscreenElement) document.documentElement.requestFullscreen?.(); else document.exitFullscreen?.();});
    document.querySelector('.save').addEventListener('click', () => {if (saveCurrent()) toast('已保存当前图片的示例坐标（仅本页面演示）');});
    document.querySelector('.submit').addEventListener('click', () => toast(state.dirty ? '请先保存当前图片的坐标' : '已提交（原型演示）'));
    document.querySelector('.autoload').addEventListener('click', () => toast('自动加载（原型演示）'));
    document.querySelectorAll('.instance-row button,.instance-group .actions button').forEach(button => button.addEventListener('click', () => toast(`${button.title}（原型演示）`)));
    document.querySelector('.close').addEventListener('click', () => toast(state.dirty ? '当前有未保存修改，请先保存' : '关闭（原型演示）'));
    document.querySelectorAll('[data-page-action]').forEach(button => button.addEventListener('click', () => {
      const action = button.dataset.pageAction, next = state.pendingPage;
      if (action === 'save' && !saveCurrent()) return;
      if (action === 'discard') { state.pose = clonePose(state.savedByPage[state.page] || autoPose); state.dirty = false; }
      state.pendingPage = null;
      if (action === 'cancel') { render(); return; }
      setPage(next);
    }));
  }
  function selectObject(id) {
    state.selectedObject = id;
    state.tab = '对象';
    state.collapsed = false;
    render();
    document.querySelector(`[data-object="${id}"]`)?.scrollIntoView({block:'nearest'});
  }
  render();
})();
