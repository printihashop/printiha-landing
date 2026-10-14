'use strict';
/**
 * Temporary PRINTIHA visual editor publishing endpoint.
 * GitHub credentials and editor password must exist ONLY in Vercel env vars.
 * This endpoint writes a restricted, permanent CSS block to index.html.
 * Remove this API after finalizing the landing page; the saved CSS remains.
 */
const crypto = require('node:crypto');

const OWNER = 'printihashop';
const REPO = 'printiha-landing';
const BRANCH = 'main';
const FILE = 'index.html';
const START = '/* PRINTIHA_PERMANENT_LAYOUT_START */';
const END = '/* PRINTIHA_PERMANENT_LAYOUT_END */';
const MAX_RULES = 160;

function reply(res, code, data) {
  res.status(code).json(data);
}

function authenticated(given, expected) {
  if (typeof given !== 'string' || given.length > 300 || typeof expected !== 'string') return false;
  const a = crypto.createHash('sha256').update(given).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function validSetting(s) {
  if (!s || typeof s !== 'object' || Array.isArray(s)) return false;
  const keys = Object.keys(s);
  if (keys.some(k => !['align','before','after','width','order'].includes(k))) return false;
  if (s.align !== undefined && !['default','left','center','right'].includes(s.align)) return false;
  if (s.width !== undefined && !['default','320','480','640','960','full'].includes(s.width)) return false;
  for (const k of ['before','after']) {
    if (s[k] !== undefined && (!Number.isInteger(s[k]) || s[k] < 0 || s[k] > 120 || s[k] % 8 !== 0)) return false;
  }
  if (s.order !== undefined && (!Number.isInteger(s.order) || s.order < 0 || s.order > 60)) return false;
  return true;
}

function validRules(rules) {
  if (!Array.isArray(rules) || rules.length > MAX_RULES) return false;
  const seen = new Set();
  for (const r of rules) {
    if (!r || typeof r !== 'object' || Array.isArray(r)) return false;
    if (Object.keys(r).some(k => !['selector','desktop','mobile'].includes(k))) return false;
    if (typeof r.selector !== 'string' || r.selector.length > 220) return false;
    if (!/^(?:body > |#[a-zA-Z])[a-zA-Z0-9 .#>:()_-]*$/.test(r.selector)) return false;
    if (/[:][^n]|[{};,\[\]\\\/]/.test(r.selector.replace(/:nth-child\(\d+\)/g,''))) return false;
    if (seen.has(r.selector)) return false;
    seen.add(r.selector);
    if (r.desktop !== undefined && !validSetting(r.desktop)) return false;
    if (r.mobile !== undefined && !validSetting(r.mobile)) return false;
  }
  return true;
}

function declarations(s) {
  if (!s) return '';
  const d = [];
  if (s.before) d.push('margin-top:' + s.before + 'px!important');
  if (s.after) d.push('margin-bottom:' + s.after + 'px!important');
  if (s.width && s.width !== 'default') {
    d.push('max-width:' + (s.width === 'full' ? '100%' : s.width + 'px') + '!important');
  }
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

function compile(rules) {
  const out = [];
  for (const device of ['desktop','mobile']) {
    const parts = rules.map(r => {
      const decl = declarations(r[device]);
      return decl ? '  ' + r.selector + '{' + decl + '}' : '';
    }).filter(Boolean);
    if (parts.length) {
      out.push('@media ' + (device === 'mobile' ? '(max-width:760px)' : '(min-width:761px)') + '{\n' + parts.join('\n') + '\n}');
    }
  }
  return out.join('\n');
}

function parseRules(html) {
  const match = html.match(/\/\* PRINTIHA_LAYOUT_JSON_BASE64:([A-Za-z0-9+/=]+) \*\//);
  if (!match) return [];
  try {
    const rules = JSON.parse(Buffer.from(match[1], 'base64').toString('utf8'));
    return validRules(rules) ? rules : [];
  } catch (_) {
    return [];
  }
}

function applyRules(html, rules) {
  const encoded = Buffer.from(JSON.stringify(rules), 'utf8').toString('base64');
  const block = START + '\n/* PRINTIHA_LAYOUT_JSON_BASE64:' + encoded + ' */\n' +
    compile(rules) + '\n' + END;
  const start = html.indexOf(START);
  const end = html.indexOf(END);
  if ((start === -1) !== (end === -1)) throw new Error('Layout markers are inconsistent');
  if (start !== -1) {
    return html.slice(0, start) + block + html.slice(end + END.length);
  }
  if (!html.includes('</style>')) throw new Error('Style tag not found');
  return html.replace('</style>', '\n' + block + '\n</style>');
}

async function github(method, body) {
  const url = 'https://api.github.com/repos/' + OWNER + '/' + REPO + '/contents/' + FILE +
    (method === 'GET' ? '?ref=' + BRANCH : '');
  const resp = await fetch(url, {
    method,
    headers: {
      'Authorization': 'Bearer ' + process.env.PRINTIHA_GITHUB_TOKEN,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
      'User-Agent': 'printiha-temporary-layout-editor'
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  if (!resp.ok) {
    const err = new Error('GitHub request failed');
    err.status = resp.status;
    throw err;
  }
  return resp.json();
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store, private');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') return reply(res, 405, { error: 'POST required' });
  const origin = req.headers.origin;
  if (origin) {
    try {
      if (new URL(origin).host !== req.headers.host || new URL(origin).protocol !== 'https:') {
        return reply(res, 403, { error: 'Invalid origin' });
      }
    } catch (_) { return reply(res, 403, { error: 'Invalid origin' }); }
  }
  if (!process.env.PRINTIHA_GITHUB_TOKEN || !process.env.PRINTIHA_EDITOR_PASSWORD ||
      process.env.PRINTIHA_EDITOR_PASSWORD.length < 20) {
    return reply(res, 503, { error: 'Editor not configured. Set PRINTIHA_GITHUB_TOKEN and a 20+ character PRINTIHA_EDITOR_PASSWORD in Vercel.' });
  }
  if (Number(req.headers['content-length'] || 0) > 65000) return reply(res, 413, { error: 'Request too large' });
  let input = req.body;
  if (typeof input === 'string') {
    try { input = JSON.parse(input); } catch (_) { return reply(res, 400, { error: 'Invalid JSON' }); }
  }
  if (!input || typeof input !== 'object') return reply(res, 400, { error: 'Invalid request' });
  if (!authenticated(input.password, process.env.PRINTIHA_EDITOR_PASSWORD)) {
    return reply(res, 401, { error: 'Incorrect editor password' });
  }
  if (!['load','save'].includes(input.action)) return reply(res, 400, { error: 'Invalid action' });
  if (input.action === 'save' && (!validRules(input.rules) ||
      typeof input.sha !== 'string' || !/^[0-9a-f]{40}$/i.test(input.sha))) {
    return reply(res, 400, { error: 'Invalid layout data' });
  }
  try {
    const file = await github('GET');
    if (file.encoding !== 'base64' || !file.content || !file.sha) throw new Error('Invalid GitHub file');
    const html = Buffer.from(file.content.replace(/\s/g,''), 'base64').toString('utf8');
    if (input.action === 'load') return reply(res, 200, { ok: true, sha: file.sha, rules: parseRules(html) });
    if (input.sha !== file.sha) return reply(res, 409, { error: 'The website changed on GitHub. Reload the editor before saving.' });
    const next = applyRules(html, input.rules);
    if (next === html) return reply(res, 200, { ok: true, sha: file.sha, unchanged: true });
    const saved = await github('PUT', {
      message: 'Save permanent PRINTIHA landing layout from temporary editor',
      branch: BRANCH,
      sha: file.sha,
      content: Buffer.from(next, 'utf8').toString('base64')
    });
    return reply(res, 200, { ok: true, sha: saved.content.sha, commit: saved.commit.sha, deploying: true });
  } catch (err) {
    if (err.status === 409) return reply(res, 409, { error: 'GitHub conflict. Reload and try again.' });
    return reply(res, 502, { error: 'Could not reach GitHub or save the layout. Check token permissions and retry.' });
  }
};
