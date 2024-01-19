// app.js —— 《临江怪谈档案》交互引擎
(function(){
  const STORAGE_KEY = 'linjiang_progress_v1';
  const BONUS_KEY = 'linjiang_bonus';
  const chapters = window.CHAPTERS;
  const byId = id => chapters.find(c => c.id === id);
  const maxId = Math.max(...chapters.map(c=>c.id));

  function loadProgress(){
    try{
      const raw = localStorage.getItem(STORAGE_KEY);
      if(!raw) return { solved: [] };
      const parsed = JSON.parse(raw);
      if(!Array.isArray(parsed.solved)) return { solved: [] };
      return parsed;
    }catch(e){ return { solved: [] }; }
  }
  function saveProgress(p){
    try{ localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }catch(e){}
  }

  let progress = loadProgress();
  let solvedSet = new Set(progress.solved);

  function persist(){
    progress.solved = Array.from(solvedSet);
    saveProgress(progress);
  }

  function isUnlocked(id){
    if(id === 0) return true;
    return solvedSet.has(id-1);
  }
  function isSolved(id){ return solvedSet.has(id); }

  function firstUnsolvedId(){
    for(const c of chapters){ if(!isSolved(c.id)) return c.id; }
    return maxId;
  }

  let currentId = (function(){
    const h = parseInt((location.hash||'').replace('#ch=',''), 10);
    if(!isNaN(h) && byId(h) && isUnlocked(h)) return h;
    return firstUnsolvedId();
  })();

  async function sha256Hex(str){
    const enc = new TextEncoder().encode(str);
    const buf = await crypto.subtle.digest('SHA-256', enc);
    return Array.from(new Uint8Array(buf)).map(b=>b.toString(16).padStart(2,'0')).join('');
  }
  function normalize(str){
    return String(str||'').trim().toLowerCase().replace(/\s+/g,'').replace(/[\u3000]/g,'');
  }

  const sidebarEl = document.getElementById('sidebar-list');
  const mainEl = document.getElementById('main-content');
  const progressFillEl = document.getElementById('progress-fill');
  const progressLabelEl = document.getElementById('progress-label');

  function redactedTitle(len){
    const blocks = ['█▉▊▋','████','███▍','▉▉▉▉'];
    let s = '';
    const n = Math.max(4, Math.min(10, len||6));
    for(let i=0;i<n;i++){ s += '█'; }
    return s;
  }

  function renderSidebar(){
    sidebarEl.innerHTML = '';
    chapters.forEach(c => {
      const li = document.createElement('li');
      const unlocked = isUnlocked(c.id);
      const solved = isSolved(c.id);
      li.className = 'nav-item ' + (solved ? 'solved' : (unlocked ? '' : 'locked')) + (c.id===currentId ? ' active' : '');
      const num = document.createElement('span');
      num.className = 'num';
      num.textContent = String(c.id).padStart(4,'0');
      const label = document.createElement('span');
      label.className = 'label';
      label.textContent = unlocked ? (c.kind==='final' ? c.title : c.eyebrow.split('·').pop().trim()) : redactedTitle((c.title||'').length);
      const mark = document.createElement('span');
      mark.className = 'mark';
      mark.textContent = solved ? '✓' : (unlocked ? '·' : '🔒');
      li.appendChild(num); li.appendChild(label); li.appendChild(mark);
      if(unlocked){
        li.addEventListener('click', () => { currentId = c.id; location.hash = '#ch=' + c.id; renderAll(); });
      }
      sidebarEl.appendChild(li);
    });

    const total = chapters.filter(c=>c.kind!=='prologue').length;
    const solvedCount = chapters.filter(c=>c.kind!=='prologue' && isSolved(c.id)).length;
    const pct = Math.round((solvedCount/total)*100);
    progressFillEl.style.width = pct + '%';
    progressLabelEl.textContent = `已破解 ${solvedCount} / ${total} 卷 · ${pct}%`;
  }

  function el(tag, cls, html){
    const e = document.createElement(tag);
    if(cls) e.className = cls;
    if(html !== undefined) e.innerHTML = html;
    return e;
  }

  function renderMain(){
    const c = byId(currentId);
    mainEl.innerHTML = '';
    if(!c || !isUnlocked(c.id)){
      mainEl.appendChild(el('div','locked-notice','这一页尚未解锁。先完成前面的档案。'));
      return;
    }

    const wrap = el('div','entry');
    wrap.appendChild(el('div','entry-eyebrow', c.eyebrow));
    wrap.appendChild(el('h2', null, c.title));
    const meta = el('div','meta');
    (c.meta||[]).forEach(m => meta.appendChild(el('span', null, m)));
    wrap.appendChild(meta);

    const prose = el('div','prose');
    (c.prose||[]).forEach(p => prose.appendChild(el('p', null, p)));
    wrap.appendChild(prose);

    if(c.kind === 'prologue'){
      const btn = el('button','next-btn', c.ctaLabel || '继续');
      btn.addEventListener('click', () => {
        solvedSet.add(0); persist();
        currentId = 1; location.hash = '#ch=1';
        renderAll();
      });
      wrap.appendChild(btn);
      mainEl.appendChild(wrap);
      return;
    }

    // puzzle / final
    if(c.cipherText){
      const card = el('div','card');
      card.appendChild(el('h4', null, c.cipherLabel || '线索'));
      card.appendChild(el('div','cipher-block', escapeHtml(c.cipherText)));
      wrap.appendChild(card);
    }

    if(c.external){
      const hc = el('div','card hidden-card');
      hc.appendChild(el('h4', null, '关于这条线索'));
      hc.appendChild(el('p', null, c.externalNote||''));
      if(c.externalHint){
        const hint = el('p', null, '<strong>' + c.externalHint + '</strong>');
        hc.appendChild(hint);
      }
      if(c.logPage){
        const a = document.createElement('a');
        a.href = c.logPage; a.target = '_blank'; a.rel = 'noopener';
        a.className = 'ext-link-btn';
        a.textContent = '打开原始档案页面 ↗';
        hc.appendChild(a);
      }
      wrap.appendChild(hc);
    }

    const solved = isSolved(c.id);

    if(c.hintBody){
      const details = el('details','hint');
      const summary = el('summary', null, solved ? '查看提示（已破解）' : '需要提示？点击展开');
      details.appendChild(summary);
      details.appendChild(el('div','hint-body', c.hintBody));
      wrap.appendChild(details);
    }

    if(!solved){
      const row = el('div','answer-row');
      const input = document.createElement('input');
      input.type = 'text';
      input.placeholder = c.kind==='final' ? '输入14位合成密钥' : '输入解出的拼音答案';
      input.autocomplete = 'off';
      input.spellcheck = false;
      const btn = document.createElement('button');
      btn.textContent = '验证';
      const feedback = el('div','feedback');

      async function tryAnswer(){
        const val = input.value;
        if(!val.trim()) return;
        btn.disabled = true;
        const hash = await sha256Hex(normalize(val));
        btn.disabled = false;
        if(hash === c.answerHash){
          solvedSet.add(c.id); persist();
          renderAll();
        } else {
          feedback.className = 'feedback err';
          feedback.textContent = '不对。再想想——档案里的提示往往藏在细节里。';
        }
      }
      btn.addEventListener('click', tryAnswer);
      input.addEventListener('keydown', e => { if(e.key === 'Enter') tryAnswer(); });

      row.appendChild(input); row.appendChild(btn);
      wrap.appendChild(row);
      wrap.appendChild(feedback);
    } else {
      const reveal = el('div','reveal');
      reveal.appendChild(el('h4', null, '✓ ' + (c.revealTitle||'已破解')));
      (c.revealBody||[]).forEach(p => reveal.appendChild(el('p', null, p)));
      if(c.kind === 'final' && localStorage.getItem(BONUS_KEY) === 'true'){
        reveal.appendChild(el('p', null, '<em>（你似乎还发现了一些本不该存在的东西……那部分，只有你自己知道意味着什么。）</em>'));
      }
      wrap.appendChild(reveal);

      const next = byId(c.id+1);
      if(next){
        const nb = el('button','next-btn','下一页档案 →');
        nb.addEventListener('click', () => { currentId = next.id; location.hash = '#ch='+next.id; renderAll(); });
        wrap.appendChild(nb);
      } else {
        wrap.appendChild(el('div','footer-note','—— 档案到此结束。感谢你认真地找。 ——'));
      }
    }

    mainEl.appendChild(wrap);
  }

  function escapeHtml(s){
    return String(s).replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m]));
  }

  function renderAll(){ renderSidebar(); renderMain(); window.scrollTo({top:0, behavior:'smooth'}); }

  window.addEventListener('hashchange', () => {
    const h = parseInt((location.hash||'').replace('#ch=',''), 10);
    if(!isNaN(h) && byId(h) && isUnlocked(h)){ currentId = h; renderAll(); }
  });

  renderAll();
})();

// [U] 更新交互逻辑，校对文字
