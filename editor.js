/* PRINTIHA TEMPORARY FREE-MOVE VISUAL EDITOR — NO PASSWORD / LOCAL EXPORT
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
  let pageSource = '';
  let active = false;
  let selected = null;
  let busy = false;
  let dragSession = null;

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
    #pi-editor-panel input[type=number]{width:68px;min-width:0;padding:7px 5px;background:#ffffff;
      color:#0d0d0d;border:1px solid #0d0d0d;border-radius:6px;font:700 12px Inter,system-ui,sans-serif}
    #pi-editor-panel .pi-mini{font-size:11px;font-weight:700}
    #pi-editor-panel .pi-color-row{gap:7px}
    #pi-editor-panel button.pi-color-swatch{width:26px;height:26px;min-width:26px;padding:0;
      border:1px solid #0d0d0d;border-radius:5px;flex:0 0 26px}
    #pi-editor-panel button.pi-color-swatch.pi-color-active{outline:2px solid #ff0000;outline-offset:2px}
    #pi-editor-panel input[type=color]{width:36px;height:30px;min-width:36px;padding:2px;
      border:1px solid #0d0d0d;border-radius:6px;background:#ffffff;cursor:pointer;flex:0 0 36px}
    #pi-editor-panel button.pi-color-reset{padding:6px 7px;font-size:10px}
    #pi-editor-panel .pi-section{border-top:1px solid #0d0d0d;padding-top:10px;margin-top:12px}
    #pi-editor-overlay{position:fixed;z-index:109;border:2px dashed #ff0000;box-sizing:border-box;
      pointer-events:none;display:block}
    #pi-editor-overlay[hidden]{display:none}
    .pi-editor-handle{position:absolute;display:flex;align-items:center;justify-content:center;
      min-width:34px;min-height:34px;background:#ff0000;color:#ffffff;border:2px solid #ffffff;
      border-radius:7px;font:800 17px Inter,system-ui,sans-serif;pointer-events:auto;
      touch-action:none;user-select:none;cursor:grab;box-shadow:0 2px 9px rgba(13,13,13,.35)}
    .pi-editor-handle:active{cursor:grabbing}
    #pi-move-handle{top:-19px;left:-19px}
    #pi-resize-handle{right:-19px;bottom:-19px;cursor:nwse-resize}
    body.pi-editor-dragging,body.pi-editor-dragging *{user-select:none!important}
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

  const overlay = document.createElement('div');
  overlay.id = 'pi-editor-overlay';
  overlay.hidden = true;
  overlay.innerHTML = '<button type="button" class="pi-editor-handle" id="pi-move-handle" aria-label="Drag to move selected element" title="Drag to move">✥</button>' +
    '<button type="button" class="pi-editor-handle" id="pi-resize-handle" aria-label="Drag to resize selected element" title="Drag to resize">↘</button>';
  document.body.appendChild(overlay);

  function currentDevice() { return window.matchMedia('(max-width:760px)').matches ? 'mobile' : 'desktop'; }
  function isDirty() { return JSON.stringify(rules) !== savedJSON; }
  function esc(s) { return String(s).replace(/[&<>"']/g, x => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[x])); }
  function validHex(value) {
    return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
  }
  function hexFromComputed(value, fallback) {
    if (validHex(value)) return value.toLowerCase();
    const rgb = String(value || '').match(/^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)/i);
    if (!rgb) return fallback;
    return '#' + rgb.slice(1,4).map(n => Math.min(255,Number(n)).toString(16).padStart(2,'0')).join('');
  }
  function colorRow(label, key, chosen, computed) {
    const current = validHex(chosen) ? chosen.toLowerCase() : '';
    const value = current || hexFromComputed(computed, key === 'bgColor' ? '#ffffff' : '#0d0d0d');
    const colors = [['#0d0d0d','Black'],['#ffffff','White'],['#ff0000','Red']];
    return '<div class="pi-row pi-color-row">' +
      '<span class="pi-label">' + label + '</span>' +
      colors.map(([hex,name]) =>
        '<button type="button" class="pi-color-swatch' + (current === hex ? ' pi-color-active' : '') +
        '" style="background-color:' + hex + '" data-color-key="' + key + '" data-color-value="' + hex +
        '" title="' + name + '" aria-label="Set ' + label.toLowerCase() + ' to ' + name + '"></button>'
      ).join('') +
      '<input type="color" data-color-picker="' + key + '" value="' + value +
      '" title="Choose custom ' + label.toLowerCase() + ' color" aria-label="Custom ' + label.toLowerCase() + ' color">' +
      '<button type="button" class="pi-color-reset" data-color-reset="' + key +
      '"' + (!current ? ' disabled' : '') + '>Reset</button></div>';
  }
  function getRule(selector, create) {
    let r = rules.find(x => x.selector === selector);
    if (!r && create) { r = { selector }; rules.push(r); }
    return r;
  }
  function getSettings(selector, device) {
    const r = getRule(selector, false);
    return r && r[device] ? r[device] : {};
  }
  function updateSettings(selector, update, fast) {
    const r = getRule(selector, true);
    const device = currentDevice();
    r[device] = Object.assign({}, r[device] || {}, update);
    Object.keys(r[device]).forEach(k => {
      if (r[device][k] === undefined || r[device][k] === 'default' || r[device][k] === 0) delete r[device][k];
    });
    if (!Object.keys(r[device]).length) delete r[device];
    rules = rules.filter(x => x.desktop || x.mobile);
    renderPreview();
    if (!fast) renderPanel();
  }
  function declarations(s, selector) {
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
    if (Number.isFinite(s.x) || Number.isFinite(s.y)) {
      d.push('translate:' + (s.x || 0) + 'px ' + (s.y || 0) + 'px!important');
    }
    if (s.w) {
      if (/(?:^|> )(?:span|em|b|small|strong|i):nth-child\(\d+\)$/.test(selector)) {
        d.push('display:inline-block!important');
      }
      d.push('width:' + s.w + 'px!important');
      d.push('max-width:none!important');
      d.push('box-sizing:border-box!important');
    }
    if (s.h) {
      if (/(?:^|> )img:nth-child\(\d+\)$/.test(selector)) {
        d.push('height:' + s.h + 'px!important');
        d.push('max-height:none!important');
      } else {
        d.push('min-height:' + s.h + 'px!important');
      }
    }
    if (s.font) d.push('font-size:' + s.font + 'px!important');
    if (validHex(s.textColor)) d.push('color:' + s.textColor + '!important');
    if (validHex(s.bgColor)) d.push('background-color:' + s.bgColor + '!important');
    if (validHex(s.borderColor)) d.push('border-color:' + s.borderColor + '!important');
    return d.join(';');
  }
  function compile() {
    const out = [];
    ['desktop','mobile'].forEach(device => {
      const lines = rules.map(r => {
        const d = declarations(r[device],r.selector);
        return d ? '  ' + r.selector + '{' + d + '}' : '';
      }).filter(Boolean);
      if (lines.length) out.push('@media ' + (device === 'mobile' ? '(max-width:760px)' : '(min-width:761px)') + '{\n' + lines.join('\n') + '\n}');
    });
    return out.join('\n');
  }
  function renderPreview() {
    preview.textContent = compile();
    document.getElementById('pi-save-btn').textContent = isDirty() ? 'Save *' : 'Save';
    updateOverlay();
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
    if (el.closest('#pi-editor-panel,#pi-editor-actions,#pi-editor-overlay')) return false;
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
    updateOverlay();
    renderPanel();
  }
  function renderPanel() {
    if (!active) { panel.hidden = true; overlay.hidden = true; return; }
    panel.hidden = false;
    updateOverlay();
    if (!selected) {
      panel.innerHTML = '<div class="pi-title">PRINTIHA Layout Editor</div>' +
        '<div class="pi-device">Editing: ' + currentDevice().toUpperCase() + '</div>' +
        '<p>Click any text, image, card or button to select it.</p>' +
        '<p class="pi-help">Drag the red ✥ handle to move in any direction. Drag ↘ to resize. Save downloads index.html; send it here to publish.</p>';
      return;
    }
    const selector = selectorFor(selected);
    const s = getSettings(selector,currentDevice());
    const label = selected.textContent.trim().slice(0,54) || selected.getAttribute('alt') || selected.tagName.toLowerCase();
    const isText = textLike(selected);
    const dims = selected.getBoundingClientRect();
    const computed = window.getComputedStyle(selected);
    const baseFont = Math.round(parseFloat(computed.fontSize)) || 16;
    panel.innerHTML =
      '<div class="pi-title">PRINTIHA Free Layout Editor</div>' +
      '<div class="pi-device">Editing: ' + currentDevice().toUpperCase() + '</div>' +
      '<div class="pi-target"><b>Selected:</b> ' + esc(label) + '</div>' +
      '<div class="pi-section"><b>MOVE FREELY</b> — drag ✥ on the element</div>' +
      '<div class="pi-row"><span class="pi-label">X / Y (px)</span>' +
      '<input type="number" data-number="x" min="-5000" max="5000" step="1" value="' + (s.x || 0) + '" aria-label="Horizontal position">' +
      '<input type="number" data-number="y" min="-5000" max="5000" step="1" value="' + (s.y || 0) + '" aria-label="Vertical position"></div>' +
      '<div class="pi-row"><span class="pi-label">Nudge</span>' +
      '<button data-nudge="left" title="Move left 1px">←</button>' +
      '<button data-nudge="up" title="Move up 1px">↑</button>' +
      '<button data-nudge="down" title="Move down 1px">↓</button>' +
      '<button data-nudge="right" title="Move right 1px">→</button></div>' +
      '<div class="pi-section"><b>RESIZE</b> — drag ↘ on the element</div>' +
      '<div class="pi-row"><span class="pi-label">Width (px)</span>' +
      '<input type="number" data-number="w" min="24" max="3000" step="1" placeholder="' + Math.round(dims.width) + '" value="' + (s.w || '') + '" aria-label="Element width">' +
      '<span class="pi-mini">Height (px)</span>' +
      '<input type="number" data-number="h" min="24" max="3000" step="1" placeholder="' + Math.round(dims.height) + '" value="' + (s.h || '') + '" aria-label="Element height"></div>' +
      (isText ? '<div class="pi-row"><span class="pi-label">Text size</span>' +
        '<button data-font="-1">−</button>' +
        '<input type="number" data-number="font" min="8" max="250" step="1" value="' + (s.font || baseFont) + '" aria-label="Font size in pixels">' +
        '<button data-font="1">+</button></div>' : '') +
      '<div class="pi-section"><b>COLORS</b> — choose a swatch or custom color</div>' +
      colorRow('Text', 'textColor', s.textColor, computed.color) +
      colorRow('Background', 'bgColor', s.bgColor, computed.backgroundColor) +
      colorRow('Border', 'borderColor', s.borderColor, computed.borderTopColor) +
      '<div class="pi-section"><b>OTHER LAYOUT</b></div>' +
      '<div class="pi-row"><span class="pi-label">Align</span>' +
      ['left','center','right'].map(a => '<button data-align="' + a + '" class="' + (s.align === a ? 'pi-on' : '') + '">' + a + '</button>').join('') + '</div>' +
      '<div class="pi-row"><span class="pi-label">Above</span>' +
      '<button data-action="before-minus">−</button><span class="pi-count">' + (s.before || 0) + '</span>' +
      '<button data-action="before-plus">+</button>' +
      '<span class="pi-label">Below</span>' +
      '<button data-action="after-minus">−</button><span class="pi-count">' + (s.after || 0) + '</span>' +
      '<button data-action="after-plus">+</button></div>' +
      '<div class="pi-row"><span class="pi-label">Reorder</span>' +
      '<button data-action="earlier"' + (!orderable() ? ' disabled' : '') + '>↑ Earlier</button>' +
      '<button data-action="later"' + (!orderable() ? ' disabled' : '') + '>↓ Later</button></div>' +
      '<div class="pi-row"><button data-action="parent">Select parent</button>' +
      '<button data-action="position-reset">Reset position</button>' +
      '<button data-action="size-reset">Reset size</button>' +
      '<button data-action="reset">Reset all</button></div>' +
      '<p class="pi-help">Mobile and desktop layouts are separate. Free movement may overlap nearby content, so check both sizes before saving. Save downloads index.html without a password.</p>';
  }

  function textLike(el) {
    return !!el && /^(H[1-6]|P|SPAN|B|STRONG|SMALL|EM|I|A|BUTTON|LABEL|SUMMARY|LI)$/.test(el.tagName);
  }
  function updateOverlay() {
    if (!active || !selected || !selected.isConnected) {
      overlay.hidden = true;
      return;
    }
    const rect = selected.getBoundingClientRect();
    if (!Number.isFinite(rect.left) || !Number.isFinite(rect.top)) {
      overlay.hidden = true;
      return;
    }
    overlay.hidden = false;
    overlay.style.left = rect.left + 'px';
    overlay.style.top = rect.top + 'px';
    overlay.style.width = Math.max(1,rect.width) + 'px';
    overlay.style.height = Math.max(1,rect.height) + 'px';
  }
  function clamp(n,min,max) { return Math.max(min,Math.min(max,Math.round(n))); }
  function startPointer(e,mode) {
    if (!active || !selected || busy || (e.pointerType === 'mouse' && e.button !== 0)) return;
    e.preventDefault();
    e.stopPropagation();
    const handle = e.currentTarget;
    const s = getSettings(selectorFor(selected),currentDevice());
    const rect = selected.getBoundingClientRect();
    dragSession = {
      mode, pointerId:e.pointerId, selector:selectorFor(selected),
      startX:e.clientX, startY:e.clientY,
      x:s.x || 0, y:s.y || 0, w:s.w || rect.width, h:s.h || rect.height,
      font:s.font || parseFloat(window.getComputedStyle(selected).fontSize) || 16,
      text:textLike(selected)
    };
    handle.setPointerCapture(e.pointerId);
    document.body.classList.add('pi-editor-dragging');
  }
  function movePointer(e) {
    const d = dragSession;
    if (!d || d.pointerId !== e.pointerId) return;
    e.preventDefault();
    const dx = e.clientX - d.startX, dy = e.clientY - d.startY;
    if (d.mode === 'move') {
      updateSettings(d.selector,{
        x:clamp(d.x + dx,-5000,5000),
        y:clamp(d.y + dy,-5000,5000)
      },true);
    } else {
      const w = clamp(d.w + dx,24,3000);
      const h = clamp(d.h + dy,24,3000);
      if (d.text) {
        const scale = Math.min(w / Math.max(d.w,1),h / Math.max(d.h,1));
        updateSettings(d.selector,{w,font:clamp(d.font * scale,8,250)},true);
      } else {
        updateSettings(d.selector,{w,h},true);
      }
    }
  }
  function endPointer(e) {
    if (!dragSession || dragSession.pointerId !== e.pointerId) return;
    dragSession = null;
    document.body.classList.remove('pi-editor-dragging');
    renderPanel();
  }
  for (const [id,mode] of [['pi-move-handle','move'],['pi-resize-handle','resize']]) {
    const handle = document.getElementById(id);
    handle.addEventListener('pointerdown',e => startPointer(e,mode));
    handle.addEventListener('pointermove',movePointer);
    handle.addEventListener('pointerup',endPointer);
    handle.addEventListener('pointercancel',endPointer);
    handle.addEventListener('lostpointercapture',endPointer);
  }
  document.addEventListener('scroll',updateOverlay,true);
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
    pageSource = await getPageSource();
    rules = parseSavedRules(pageSource);
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
      // Use the source loaded when Edit was clicked so download begins
      // directly from the Save click (without waiting for another request).
      const updated = applyToSource(pageSource);
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
    if (!active || e.target.closest('#pi-editor-panel,#pi-editor-actions,#pi-editor-overlay')) return;
    const el = e.target.closest('a,button,img,h1,h2,h3,p,span,b,small,div,section,summary,details,label,input,textarea,footer,header');
    if (!el || !editable(el)) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    select(el);
  }, true);

  panel.addEventListener('click', function (e) {
    e.stopPropagation();
    if (!selected) return;
    const swatch = e.target.closest('[data-color-key][data-color-value]');
    if (swatch && validHex(swatch.dataset.colorValue)) {
      updateSettings(selectorFor(selected),{[swatch.dataset.colorKey]:swatch.dataset.colorValue});
      return;
    }
    const colorReset = e.target.closest('[data-color-reset]');
    if (colorReset) {
      updateSettings(selectorFor(selected),{[colorReset.dataset.colorReset]:''});
      return;
    }
    const nudge = e.target.closest('[data-nudge]');
    if (nudge) {
      const key = ['left','right'].includes(nudge.dataset.nudge) ? 'x' : 'y';
      const delta = ['left','up'].includes(nudge.dataset.nudge) ? -1 : 1;
      const s = getSettings(selectorFor(selected),currentDevice());
      updateSettings(selectorFor(selected),{[key]:clamp((s[key] || 0) + delta,-5000,5000)});
      return;
    }
    const font = e.target.closest('[data-font]');
    if (font) {
      const s = getSettings(selectorFor(selected),currentDevice());
      const base = s.font || parseFloat(window.getComputedStyle(selected).fontSize) || 16;
      updateSettings(selectorFor(selected),{font:clamp(base + Number(font.dataset.font),8,250)});
      return;
    }
    const align = e.target.closest('[data-align]');
    if (align) { updateSettings(selectorFor(selected),{align:align.dataset.align}); return; }
    const button = e.target.closest('[data-action]');
    if (!button) return;
    const action = button.dataset.action;
    const selector = selectorFor(selected);
    const s = getSettings(selector,currentDevice());
    if (action === 'parent') {
      if (editable(selected.parentElement)) select(selected.parentElement);
    } else if (action === 'position-reset') {
      updateSettings(selector,{x:0,y:0});
    } else if (action === 'size-reset') {
      updateSettings(selector,{w:0,h:0,font:0});
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
  panel.addEventListener('input',function(e){
    if (!selected) return;
    const picker = e.target.closest('input[data-color-picker]');
    if (!picker || !validHex(picker.value)) return;
    updateSettings(selectorFor(selected),{[picker.dataset.colorPicker]:picker.value.toLowerCase()},true);
  });
  panel.addEventListener('change',function(e){
    if (!selected) return;
    const picker = e.target.closest('input[data-color-picker]');
    if (picker) {
      if (validHex(picker.value)) {
        updateSettings(selectorFor(selected),{[picker.dataset.colorPicker]:picker.value.toLowerCase()});
      }
      return;
    }
    const field = e.target.closest('[data-number]');
    if (!field) return;
    const key = field.dataset.number;
    const limits = {x:[-5000,5000],y:[-5000,5000],w:[24,3000],h:[24,3000],font:[8,250]};
    if (!limits[key]) return;
    const n = field.value.trim() === '' ? 0 : Number(field.value);
    if (!Number.isFinite(n)) return;
    updateSettings(selectorFor(selected),{[key]:n === 0 ? 0 : clamp(n,...limits[key])});
  });
  window.addEventListener('resize',function(){if(active){updateOverlay();renderPanel();}});
  window.addEventListener('beforeunload',function(e){
    if (isDirty()) {e.preventDefault();e.returnValue='';}
  });
})();
