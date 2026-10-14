/* PRINTIHA TEMPORARY STRUCTURED VISUAL EDITOR — NO PASSWORD / LOCAL EXPORT
 * Open ?edit=1. Edit the layout, then Save to download index.html.
 * Send the downloaded file to the assistant to publish it to GitHub.
 * Remove this file and the loader after finalizing the layout.
 * Permanent CSS saved in index.html remains independent of the editor.
 */
(function () {
  'use strict';
  if (new URLSearchParams(window.location.search).get('edit') !== '1') return;

  const HEADER = document.querySelector('header .wrap');
  if (!HEADER) return;

  const DRAFT_KEY = 'printiha-temporary-layout-draft-v1';
  const START = '/* PRINTIHA_PERMANENT_LAYOUT_START */';
  const END = '/* PRINTIHA_PERMANENT_LAYOUT_END */';
  let rules = [];
  let savedJSON = '[]';
  let active = false;
  let selected = null;
  let busy = false;

  const style = document.createElement('style');
  style.id = 'pi-editor-ui-style';
  style.textContent = `
    #pi-editor-actions{display:flex;gap:7px;align-items:center;margin-left:auto;flex-shrink:0}
    .pi-editor-btn{font:700 12px Inter,system-ui,sans-serif;padding:9px 12px;border-radius:8px;
      border:1px solid #ffffff;background:#ffffff;color:#0d0d0d;cursor:pointer}
    .pi-editor-btn.pi-save{background:#ff0000;color:#ffffff;border-color:#ff0000}
    .pi-editor-btn:disabled{opacity:.55;cursor:wait}
    .pi-editor-selected{outline:3px dashed #ff0000!important;outline-offset:3px!important}
    #pi-editor-panel{position:fixed;right:16px;top:74px;width:310px;max-width:calc(100vw - 24px);
      max-height:calc(100vh - 185px);overflow:auto;z-index:110;background:#ffffff;color:#0d0d0d;
      border:2px solid #0d0d0d;border-radius:12px;padding:15px;
      box-shadow:0 10px 30px rgba(13,13,13,.3);font:13px Inter,system-ui,sans-serif}
    #pi-editor-panel[hidden]{display:none}
    #pi-editor-panel .pi-title{font-size:15px;font-weight:800;margin-bottom:6px}
    #pi-editor-panel .pi-target{font-size:12px;overflow-wrap:anywhere;margin-bottom:10px}
    #pi-editor-panel .pi-row{display:flex;align-items:center;gap:6px;margin:9px 0;flex-wrap:wrap}
    #pi-editor-panel .pi-label{font-weight:700;min-width:75px}
    #pi-editor-panel button,#pi-editor-panel select{background:#ffffff;color:#0d0d0d;
      border:1px solid #0d0d0d;border-radius:6px;padding:7px 9px;font:700 12px Inter,system-ui,sans-serif;
      cursor:pointer;width:auto}
    #pi-editor-panel button.pi-on{background:#0d0d0d;color:#ffffff}
    #pi-editor-panel button:disabled{opacity:.35;cursor:not-allowed}
    #pi-editor-panel .pi-help{font-size:11px;line-height:1.5;margin-top:10px}
    #pi-editor-panel .pi-device{font-weight:800;color:#ff0000;margin:6px 0}
    #pi-editor-panel .pi-count{min-width:22px;text-align:center;font-weight:800}
    @media(max-width:760px){
      #pi-editor-actions{gap:5px}
      .pi-editor-btn{font-size:11px;padding:8px 9px}
      #pi-editor-panel{right:10px;left:10px;top:auto;bottom:92px;width:auto;
        max-width:none;max-height:52vh;padding:12px}
    }
  `;
  document.head.appendChild(style);

  const preview = document.createElement('style');
  preview.id = 'pi-editor-layout-preview';
  document.head.appendChild(preview);

  const actions = document.createElement('div');
  actions.id = 'pi-editor-actions';
  actions.innerHTML = '<button type="button" class="pi-editor-btn" id="pi-edit-btn">Edit</button>' +
    '<button type="button" class="pi-editor-btn pi-save" id="pi-save-btn">Save</button>';
  HEADER.appendChild(actions);

  const panel = document.createElement('aside');
  panel.id = 'pi-editor-panel';
  panel.hidden = true;
  panel.setAttribute('aria-label', 'PRINTIHA visual editor');
  document.body.appendChild(panel);

  function currentDevice() { return window.matchMedia('(max-width:760px)').matches ? 'mobile' : 'desktop'; }
  function isDirty() { return JSON.stringify(rules) !== savedJSON; }
  function esc(s) { return String(s).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])); }
  function getRule(selector, create) {
    let r = rules.find(x => x.selector === selector);
    if (!r && create) { r = { selector }; rules.push(r); }
    return r;
  }
  function getSettings(selector, device) {
    const r = getRule(selector, false);
    return r && r[device] ? r[device] : {};
  }
  function updateSettings(selector, update) {
    const r = getRule(selector, true);
    const device = currentDevice();
    r[device] = Object.assign({}, r[device] || {}, update);
    Object.keys(r[device]).forEach(k => {
      if (r[device][k] === undefined || r[device][k] === 'default' || r[device][k] === 0) delete r[device][k];
    });
    if (!Object.keys(r[device]).length) delete r[device];
    rules = rules.filter(x => x.desktop || x.mobile);
    renderPreview();
    renderPanel();
  }
  function declarations(s) {
    if (!s) return '';
    const d = [];
    if (s.before) d.push('margin-top:' + s.before + 'px!important');
    if (s.after) d.push('margin-bottom:' + s.after + 'px!important');
    if (s.width && s.width !== 'default') d.push('max-width:' + (s.width === 'full' ? '100%' : s.width + 'px') + '!important');
    if (s.align && s.align !== 'default') {
      const a = s.align;
      d.push('text-align:' + a + '!important');
      d.push('margin-left:' + (a === 'right' || a === 'center' ? 'auto' : '0') + '!important');
      d.push('margin-right:' + (a === 'left' || a === 'center' ? 'auto' : '0') + '!important');
      d.push('justify-self:' + (a === 'center' ? 'center' : a === 'right' ? 'end' : 'start') + '!important');
      d.push('align-self:' + (a === 'center' ? 'center' : a === 'right' ? 'flex-end' : 'flex-start') + '!important');
    }
    if (s.order) d.push('order:' + s.order + '!important');
    return d.join(';');
  }
  function compile() {
    const out = [];
    ['desktop','mobile'].forEach(device => {
      const lines = rules.map(r => {
        const d = declarations(r[device]);
        return d ? '  ' + r.selector + '{' + d + '}' : '';
      }).filter(Boolean);
      if (lines.length) out.push('@media ' + (device === 'mobile' ? '(max-width:760px)' : '(min-width:761px)') + '{\n' + lines.join('\n') + '\n}');
    });
    return out.join('\n');
  }
  function renderPreview() {
    preview.textContent = compile();
    document.getElementById('pi-save-btn').textContent = isDirty() ? 'Save *' : 'Save';
  }
  function selectorFor(el) {
    if (!(el instanceof Element)) return '';
    const parts = [];
    while (el && el !== document.body) {
      if (el.id && !el.id.startsWith('pi-')) {
        parts.unshift('#' + el.id);
        return parts.join(' > ');
      }
      if (!el.parentElement) return '';
      const n = Array.prototype.indexOf.call(el.parentElement.children, el) + 1;
      parts.unshift(el.tagName.toLowerCase() + ':nth-child(' + n + ')');
      el = el.parentElement;
    }
    return 'body > ' + parts.join(' > ');
  }
  function editable(el) {
    if (!el || el === document.body || el === document.documentElement) return false;
    if (el.closest('#pi-editor-panel,#pi-editor-actions')) return false;
    if (['SCRIPT','STYLE','HEAD','HTML'].includes(el.tagName)) return false;
    return true;
  }
  function orderable() {
    if (!selected || !selected.parentElement) return false;
    const d = window.getComputedStyle(selected.parentElement).display;
    return d.includes('grid') || d.includes('flex');
  }
  function reorder(direction) {
    if (!orderable()) return;
    const children = Array.from(selected.parentElement.children).filter(editable);
    const device = currentDevice();
    const originalOrder = children.slice();
    children.sort((a,b) => {
      const ar = getSettings(selectorFor(a),device).order;
      const br = getSettings(selectorFor(b),device).order;
      return (ar || originalOrder.indexOf(a) + 1) - (br || originalOrder.indexOf(b) + 1);
    });
    const idx = children.indexOf(selected);
    const other = idx + direction;
    if (other < 0 || other >= children.length) return;
    [children[idx],children[other]] = [children[other],children[idx]];
    children.forEach((el,i) => updateOrder(selectorFor(el),device,i + 1));
    renderPreview();
    renderPanel();
  }
  function updateOrder(selector,device,order) {
    const r = getRule(selector,true);
    r[device] = Object.assign({},r[device] || {},{order});
  }
  function select(el) {
    if (!editable(el)) return;
    if (selected) selected.classList.remove('pi-editor-selected');
    selected = el;
    selected.classList.add('pi-editor-selected');
    renderPanel();
  }
  function renderPanel() {
    if (!active) { panel.hidden = true; return; }
    panel.hidden = false;
    if (!selected) {
      panel.innerHTML = '<div class="pi-title">PRINTIHA Layout Editor</div>' +
        '<div class="pi-device">Editing: ' + currentDevice().toUpperCase() + '</div>' +
        '<p>Click any text, image, card or button on the page to select it.</p>' +
        '<p class="pi-help">Adjust spacing, alignment and width. In grids and rows, use Earlier / Later to reorder. Save downloads index.html; send that file to publish on GitHub.</p>';
      return;
    }
    const selector = selectorFor(selected);
    const s = getSettings(selector,currentDevice());
    const label = selected.textContent.trim().slice(0,54) || selected.getAttribute('alt') || selected.tagName.toLowerCase();
    const opts = [['default','Original'],['320','320px'],['480','480px'],['640','640px'],['960','960px'],['full','Full width']];
    panel.innerHTML =
      '<div class="pi-title">PRINTIHA Layout Editor</div>' +
      '<div class="pi-device">Editing: ' + currentDevice().toUpperCase() + '</div>' +
      '<div class="pi-target"><b>Selected:</b> ' + esc(label) + '</div>' +
      '<div class="pi-row"><span class="pi-label">Alignment</span>' +
      ['left','center','right'].map(a => '<button data-align="' + a + '" class="' + (s.align === a ? 'pi-on' : '') + '">' + a + '</button>').join('') + '</div>' +
      '<div class="pi-row"><span class="pi-label">Space above</span>' +
      '<button data-action="before-minus">−</button><span class="pi-count">' + (s.before || 0) + '</span>' +
      '<button data-action="before-plus">+</button></div>' +
      '<div class="pi-row"><span class="pi-label">Space below</span>' +
      '<button data-action="after-minus">−</button><span class="pi-count">' + (s.after || 0) + '</span>' +
      '<button data-action="after-plus">+</button></div>' +
      '<div class="pi-row"><span class="pi-label">Max width</span><select id="pi-width">' +
      opts.map(([v,t]) => '<option value="' + v + '"' + ((s.width || 'default') === v ? ' selected' : '') + '>' + t + '</option>').join('') +
      '</select></div>' +
      '<div class="pi-row"><span class="pi-label">Reorder</span>' +
      '<button data-action="earlier"' + (!orderable() ? ' disabled' : '') + '>↑ Earlier</button>' +
      '<button data-action="later"' + (!orderable() ? ' disabled' : '') + '>↓ Later</button></div>' +
      '<div class="pi-row"><button data-action="parent">Select parent</button>' +
      '<button data-action="reset">Reset this element</button></div>' +
      '<p class="pi-help">Changes are previewed immediately. Save downloads index.html and keeps a local draft. Send the file to publish it. Mobile and desktop are saved separately.</p>';
  }
  // A permanent layout block can be removed from the final page's editor code
  // without losing the user's saved design.
  function parseSavedRules(html) {
    const match = html.match(/\/\* PRINTIHA_LAYOUT_JSON_BASE64:([A-Za-z0-9+/=]+) \*\//);
    if (!match) return [];
    try {
      const parsed = JSON.parse(atob(match[1]));
      return Array.isArray(parsed) ? parsed : [];
    } catch (_) { return []; }
  }

  function applyToSource(html) {
    if (!html.includes('<style>') || !html.includes('</style>')) {
      throw new Error('index.html has no stylesheet.');
    }
    const block = START + '\n/* PRINTIHA_LAYOUT_JSON_BASE64:' +
      btoa(JSON.stringify(rules)) + ' */\n' + compile() + '\n' + END;
    const begin = html.indexOf(START);
    const end = html.indexOf(END);
    if ((begin === -1) !== (end === -1)) {
      throw new Error('The saved layout markers are incomplete.');
    }
    if (begin !== -1) {
      return html.slice(0,begin) + block + html.slice(end + END.length);
    }
    return html.replace('</style>', '\n' + block + '\n</style>');
  }

  async function getPageSource() {
    const response = await fetch(window.location.pathname, {
      method:'GET',cache:'no-store',credentials:'same-origin'
    });
    if (!response.ok) throw new Error('Could not read the website source.');
    const html = await response.text();
    if (!/^\s*<!doctype html>/i.test(html) || !html.includes('PRINTIHA')) {
      throw new Error('The downloaded source does not look like PRINTIHA index.html.');
    }
    return html;
  }

  async function initialize() {
    const html = await getPageSource();
    rules = parseSavedRules(html);
    try {
      const local = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (Array.isArray(local)) rules = local;
    } catch (_) { /* Local storage is optional. */ }
    savedJSON = JSON.stringify(rules);
    renderPreview();
  }

  async function edit() {
    if (busy) return;
    if (active) {
      active = false;
      if (selected) selected.classList.remove('pi-editor-selected');
      selected = null;
      renderPanel();
      document.getElementById('pi-edit-btn').textContent = 'Edit';
      return;
    }
    busy = true;
    try {
      if (!edit.initialized) {
        await initialize();
        edit.initialized = true;
      }
      active = true;
      document.getElementById('pi-edit-btn').textContent = 'Stop editing';
      renderPanel();
    } catch (e) {
      window.alert(e.message);
    } finally { busy = false; }
  }

  async function save() {
    if (busy) return;
    if (!edit.initialized) {
      await edit();
      if (!edit.initialized) return;
    }
    busy = true;
    const btn = document.getElementById('pi-save-btn');
    btn.disabled = true;
    btn.textContent = 'Preparing...';
    try {
      const html = await getPageSource();
      const updated = applyToSource(html);
      const blob = new Blob([updated],{type:'text/html;charset=utf-8'});
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'index.html';
      link.style.display = 'none';
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(function(){ URL.revokeObjectURL(url); }, 15000);
      try { localStorage.setItem(DRAFT_KEY,JSON.stringify(rules)); } catch (_) { /* Optional */ }
      savedJSON = JSON.stringify(rules);
      renderPreview();
      window.alert('index.html downloaded. Send the file in this chat to publish the layout on GitHub. Save does not change the live website yet.');
    } catch (e) {
      window.alert('Could not download index.html: ' + e.message);
    } finally {
      busy = false;
      btn.disabled = false;
      renderPreview();
    }
  }

  document.getElementById('pi-edit-btn').addEventListener('click', edit);
  document.getElementById('pi-save-btn').addEventListener('click', save);

  document.addEventListener('click', function (e) {
    if (!active || e.target.closest('#pi-editor-panel,#pi-editor-actions')) return;
    const el = e.target.closest('a,button,img,h1,h2,h3,p,span,b,small,div,section,summary,details,label,input,textarea,footer,header');
    if (!el || !editable(el)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    select(el);
  }, true);

  panel.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!selected) return;
    const align = e.target.closest('[data-align]');
    if (align) { updateSettings(selectorFor(selected),{align:align.dataset.align}); return; }
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const selector = selectorFor(selected);
    const s = getSettings(selector,currentDevice());
    if (action === 'parent') {
      if (editable(selected.parentElement)) select(selected.parentElement);
    } else if (action === 'reset') {
      const r = getRule(selector,false);
      if (r) {
        delete r[currentDevice()];
        rules = rules.filter(x => x.desktop || x.mobile);
        renderPreview(); renderPanel();
      }
    } else if (action === 'earlier' || action === 'later') {
      reorder(action === 'earlier' ? -1 : 1);
    } else if (action.startsWith('before-') || action.startsWith('after-')) {
      const key = action.split('-')[0];
      const amount = action.endsWith('plus') ? 8 : -8;
      updateSettings(selector,{[key]:Math.max(0,Math.min(120,(s[key] || 0) + amount))});
    }
  });
  panel.addEventListener('change',function(e){
    if (selected && e.target.id === 'pi-width') updateSettings(selectorFor(selected),{width:e.target.value});
  });
  window.addEventListener('resize',function(){if(active)renderPanel();});
  window.addEventListener('beforeunload',function(e){
    if (isDirty()) {e.preventDefault();e.returnValue='';}
  });
})();
