/**
 * PRINTIHA Orders receiver — deploy as Google Apps Script Web App.
 * Script properties: PRINTIHA_ORDER_SECRET = same secret configured in Vercel.
 * Execute as: Me; Access: Anyone. Keep URL and secret private.
 */
const SPREADSHEET_ID = '19_EpmdRPjutej3w7_OsQcL_oR4RZLGGSYM0BRRFgSfw';
function doPost(e) {
  try {
    const payload = JSON.parse((e.postData && e.postData.contents) || '{}');
    const secret = PropertiesService.getScriptProperties().getProperty('PRINTIHA_ORDER_SECRET');
    if (!secret || payload.secret !== secret) return output_({ok:false,error:'Unauthorized'});
    const o = payload.order || {};
    if (!/^0[567][0-9]{8}$/.test(String(o.phone || '')) || !String(o.name||'').trim() || !String(o.city||'').trim()) return output_({ok:false,error:'Invalid customer details'});
    if (!/^PRINTIHA-[A-Z0-9-]{6,64}$/.test(String(o.reference||''))) return output_({ok:false,error:'Invalid reference'});
    const models = Array.isArray(o.models) ? o.models : [];
    if (!models.length || models.length > 30) return output_({ok:false,error:'Invalid products'});
    const quantity = models.reduce((n,m)=>n+Number(m.quantity||0),0);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 100) return output_({ok:false,error:'Invalid quantity'});
    const price = Number(o.price);
    if (!Number.isFinite(price) || price <= 0 || price > 100000) return output_({ok:false,error:'Invalid price'});
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('Orders');
      if (!sheet) throw Error('Orders sheet missing');
      const last = sheet.getLastRow();
      if (last > 1) {
        const existing = sheet.getRange(2,22,last-1,1).createTextFinder(String(o.reference)).matchEntireCell(true).findNext();
        if (existing) return output_({ok:true,reference:sheet.getRange(existing.getRow(),2).getDisplayValue(),duplicate:true});
      }
      const props = PropertiesService.getScriptProperties();
      const prior = Number(props.getProperty('PRINTIHA_LAST_ORDER_NUMBER') || 0);
      const allIds = last > 1 ? sheet.getRange(2,2,last-1,1).getDisplayValues() : [];
      const highest = allIds.reduce((n,row) => {
        const match = /^PRINTIHA-([0-9]{6,})$/.exec(String(row[0]));
        return match ? Math.max(n, Number(match[1])) : n;
      }, 0);
      const next = Math.max(prior, highest) + 1;
      const publicId = 'PRINTIHA-' + String(next).padStart(6,'0');
      const safe = v => { const s=String(v??'').slice(0,500); return /^[=+@\-\t\r]/.test(s) ? "'"+s : s; };
      const items = models.map(m => Number(m.quantity)+' × '+safe(m.version)).join(' | ');
      const colors = models.map(m => safe(m.color)).filter(Boolean).join(' | ');
      const phone = String(o.phone);
      const link = '=HYPERLINK("https://wa.me/212'+phone.slice(1)+'","Envoyer")';
      sheet.insertRowBefore(2);
      sheet.getRange(2,4).setNumberFormat('@');
      sheet.getRange(2,1,1,22).setValues([[new Date(),publicId,safe(o.name),phone,safe(o.city),safe(o.address),price,items,safe(o.size),colors,safe(o.pack),quantity,'En attente',false,false,false,false,false,false,link,'',String(o.reference)]]);
      props.setProperty('PRINTIHA_LAST_ORDER_NUMBER',String(next));
      return output_({ok:true,reference:publicId});
    } finally { lock.releaseLock(); }
  } catch(err) { console.error(err); return output_({ok:false,error:'Storage failed'}); }
}
function output_(v){ return ContentService.createTextOutput(JSON.stringify(v)).setMimeType(ContentService.MimeType.JSON); }
