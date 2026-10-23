(() => {
  const data = JSON.parse(document.getElementById('demo-data').textContent);
  const tagSets = [['release','backend'], ['backend'], ['research','backend'], ['mobile','release'], ['release'], ['research','backend']];
  const vendors = ['codex','claude','opencode','cursor','claude','codex'];
  const colors = ['#0f766e','#42685a','#8e5e27','#8b4e66','#536f38','#5d5e9a'];
  const tasks = data.titles.map((title,i)=>({title,label:data.labels[i],project:data.projects[i],tags:tagSets[i],vendor:vendors[i],color:colors[i]}));
  const initialLabels = tasks.map(t=>t.label);
  const selected = new Set();
  let match = 'any', editing = null;
  const grid = document.getElementById('task-grid');
  const dialog = document.getElementById('label-dialog');
  function text(tag, value, className) {const e=document.createElement(tag);e.textContent=value;if(className)e.className=className;return e;}
  function foreground(hex) {const rgb=hex.match(/[0-9a-f]{2}/gi).map(x=>parseInt(x,16));return (rgb[0]*299+rgb[1]*587+rgb[2]*114)/1000>145?'#142a20':'#ffffff';}
  function paintLabel(button, task) {button.textContent=task.label+' ✎';button.style.backgroundColor=task.color;button.style.color=foreground(task.color);}
  function edit(index) {editing=index;const task=index==='featured'?featured:tasks[index];document.getElementById('label-text').value=task.label;document.getElementById('label-color').value=task.color;dialog.showModal();document.getElementById('label-text').focus();}
  function render() {
    const query=document.getElementById('demo-search').value.toLowerCase().trim();
    grid.replaceChildren();let total=0;
    tasks.forEach((t,i)=>{
      const tagsMatch=!selected.size||(match==='all'?[...selected].every(x=>t.tags.includes(x)):[...selected].some(x=>t.tags.includes(x)));
      const queryMatch=[t.title,t.label,t.project,t.vendor,...t.tags].join(' ').toLowerCase().includes(query);
      if(!tagsMatch||!queryMatch)return;total++;
      const card=text('article','','task-card');
      const top=text('div','','task-top');top.append(text('span',t.vendor+' / '+t.project,'mono'),text('span','↗','card-arrow'));
      card.append(top,text('h3',t.title));
      const badge=text('button','','state-label');badge.type='button';paintLabel(badge,t);badge.addEventListener('click',()=>edit(i));card.append(badge);
      const tags=text('div','','card-tags');t.tags.forEach(tag=>tags.append(text('span','# '+tag)));card.append(tags);grid.append(card);
    });
    if(!total)grid.append(text('p',data.empty,'empty-state'));
    document.getElementById('demo-count').textContent=total+' '+data.count;
    document.getElementById('view-name').textContent=selected.size?'Focus: '+[...selected].join(' + '):'All';
    document.querySelectorAll('[data-tag]').forEach(b=>{const active=selected.has(b.dataset.tag);b.setAttribute('aria-pressed',String(active));b.classList.toggle('active',active);b.lastElementChild.textContent=active?' ×':' +';});
  }
  document.querySelectorAll('[data-tag]').forEach(b=>b.addEventListener('click',()=>{selected.has(b.dataset.tag)?selected.delete(b.dataset.tag):selected.add(b.dataset.tag);render();}));
  document.querySelectorAll('[data-match]').forEach(b=>b.addEventListener('click',()=>{match=b.dataset.match;document.querySelectorAll('[data-match]').forEach(x=>{x.classList.toggle('active',x===b);x.setAttribute('aria-pressed',String(x===b));});render();}));
  document.getElementById('demo-search').addEventListener('input',render);
  const featured={label:document.getElementById('featured-label').textContent.replace('✎','').trim(),color:'#0f766e'};
  document.getElementById('featured-label').addEventListener('click',()=>edit('featured'));
  document.getElementById('label-form').addEventListener('submit',event=>{event.preventDefault();const label=document.getElementById('label-text').value.trim();if(!label)return;const target=editing==='featured'?featured:tasks[editing];target.label=label;target.color=document.getElementById('label-color').value;if(editing==='featured')paintLabel(document.getElementById('featured-label'),featured);else render();dialog.close();});
  for(const id of ['close-dialog','cancel-label'])document.getElementById(id).addEventListener('click',()=>dialog.close());
  document.getElementById('demo-reset').addEventListener('click',()=>{selected.clear();match='any';tasks.forEach((t,i)=>{t.label=initialLabels[i];t.color=colors[i];});document.getElementById('demo-search').value='';document.querySelectorAll('[data-match]').forEach(b=>{const active=b.dataset.match==='any';b.classList.toggle('active',active);b.setAttribute('aria-pressed',String(active));});render();});
  const tabs=[...document.querySelectorAll('[data-workflow]')];
  function selectTab(index,focus=false){tabs.forEach((tab,i)=>{tab.setAttribute('aria-selected',String(i===index));tab.tabIndex=i===index?0:-1;document.getElementById(tab.getAttribute('aria-controls')).hidden=i!==index;});if(focus)tabs[index].focus();}
  tabs.forEach((tab,i)=>{tab.addEventListener('click',()=>selectTab(i));tab.addEventListener('keydown',e=>{let index=i;if(e.key==='ArrowDown')index=(i+1)%tabs.length;else if(e.key==='ArrowUp')index=(i+tabs.length-1)%tabs.length;else if(e.key==='Home')index=0;else if(e.key==='End')index=tabs.length-1;else return;e.preventDefault();selectTab(index,true);});});
  document.querySelectorAll('[data-copy]').forEach(button=>button.addEventListener('click',async()=>{try{await navigator.clipboard.writeText(button.dataset.copy);document.getElementById('copy-status').textContent=data.copied;}catch{document.getElementById('copy-status').textContent=data.copyFail;}}));
  render();
})();
