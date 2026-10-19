// Vercel Serverless Function: browser -> this API -> private Apps Script receiver.
export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow','POST'); return res.status(405).json({ok:false}); }
  const endpoint = process.env.PRINTIHA_SHEETS_WEBAPP_URL;
  const secret = process.env.PRINTIHA_ORDER_SECRET;
  if (!endpoint || !secret) return res.status(503).json({ok:false,error:'Order storage not configured'});
  try {
    const o = req.body || {};
    if (!/^0[567][0-9]{8}$/.test(String(o.phone||'')) || !String(o.name||'').trim() || !String(o.city||'').trim()) return res.status(400).json({ok:false,error:'Invalid customer details'});
    if (!/^PRINTIHA-[A-Z0-9-]{6,64}$/.test(String(o.reference||''))) return res.status(400).json({ok:false,error:'Invalid reference'});
    if (!Array.isArray(o.models) || o.models.length<1 || o.models.length>30) return res.status(400).json({ok:false,error:'Invalid products'});
    const controller = new AbortController();
    const timer = setTimeout(()=>controller.abort(),12000);
    let response;
    try {
      response = await fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify({secret,order:o}),redirect:'follow',signal:controller.signal});
    } finally { clearTimeout(timer); }
    const data = await response.json();
    if (!response.ok || data.ok!==true) throw new Error('Sheets write failed');
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({ok:true,reference:data.reference});
  } catch(e) { console.error('Order storage failure',e.message); return res.status(502).json({ok:false,error:'Impossible d’enregistrer la commande. Réessaie.'}); }
}
