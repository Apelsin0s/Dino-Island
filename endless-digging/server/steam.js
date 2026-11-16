// Sign-in with Steam: the game (Steam build) gets a session ticket from the Steam client and sends it here;
// the server asks Steam who it belongs to. Needs the publisher Web API key and the app id (environment variables).
'use strict';
const https = require('https');
const KEY = process.env.STEAM_WEB_API_KEY || '', APP = process.env.STEAM_APP_ID || '';
const IDENTITY = 'endless-digging';   // must match what the game passes to getAuthTicketForWebApi

function getJSON(url) {
  return new Promise((res, rej) => {
    const q = https.get(url, { timeout: 8000 }, r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(new Error('steam: bad answer ' + r.statusCode)); } }); });
    q.on('timeout', () => q.destroy(new Error('steam: timeout'))); q.on('error', rej);
  });
}
const enabled = () => !!(KEY && APP);
// ticket (hex) -> { steamid, name, avatar } or throws
async function verify(ticket) {
  if (!enabled()) throw new Error('steam sign-in is not configured');
  if (!/^[0-9a-fA-F]{16,4096}$/.test(ticket || '')) throw new Error('bad ticket');
  const a = await getJSON(`https://partner.steam-api.com/ISteamUserAuth/AuthenticateUserTicket/v1/?key=${KEY}&appid=${APP}&ticket=${ticket}&identity=${IDENTITY}`);
  const p = a && a.response && a.response.params;
  if (!p || p.result !== 'OK' || !p.steamid) throw new Error('ticket rejected');
  if (p.publisherbanned) throw new Error('banned');
  let name = 'Digger', avatar = '';
  try {
    const s = await getJSON(`https://api.steampowered.com/ISteamUser/GetPlayerSummaries/v2/?key=${KEY}&steamids=${p.steamid}`);
    const pl = s.response.players[0]; if (pl) { name = pl.personaname || name; avatar = pl.avatarfull || ''; }
  } catch (e) {}
  return { steamid: String(p.steamid), owner: String(p.ownersteamid || p.steamid), name, avatar };
}
module.exports = { enabled, verify, IDENTITY };

// ---------- Steam microtransactions (gold): InitTxn -> the player approves in the Steam overlay -> FinalizeTxn ----------
// Docs: partner.steamgames.com/doc/webapi/ISteamMicroTxn. STEAM_TXN_SANDBOX=1 uses the sandbox interface for testing.
const IFACE = () => process.env.STEAM_TXN_SANDBOX === '1' ? 'ISteamMicroTxnSandbox' : 'ISteamMicroTxn';
function post(path, form) {
  return new Promise((res, rej) => {
    const body = new URLSearchParams(form).toString();
    const q = https.request({ host: 'partner.steam-api.com', path, method: 'POST', timeout: 10000, headers: { 'content-type': 'application/x-www-form-urlencoded', 'content-length': Buffer.byteLength(body) } },
      r => { let b = ''; r.on('data', d => b += d); r.on('end', () => { try { res(JSON.parse(b)); } catch (e) { rej(new Error('steam txn: bad answer ' + r.statusCode)); } }); });
    q.on('timeout', () => q.destroy(new Error('steam txn: timeout'))); q.on('error', rej); q.end(body);
  });
}
async function initTxn(orderid, steamid, pack, language) {
  const a = await post(`/${IFACE()}/InitTxn/v3/`, { key: KEY, orderid: String(orderid), steamid, appid: APP, itemcount: 1, language: language || 'en', currency: 'USD', usersession: 'client',
    'itemid[0]': String(pack.id), 'qty[0]': 1, 'amount[0]': String(pack.cents), 'description[0]': pack.gold + ' gold' });
  if (!a.response || a.response.result !== 'OK') throw new Error((a.response && a.response.error && a.response.error.errordesc) || 'InitTxn failed');
  return a.response.params;
}
async function queryTxn(orderid) {
  const a = await getJSON(`https://partner.steam-api.com/${IFACE()}/QueryTxn/v3/?key=${KEY}&appid=${APP}&orderid=${orderid}`);
  return a.response && a.response.result === 'OK' ? a.response.params : null;
}
async function finalizeTxn(orderid) {
  const a = await post(`/${IFACE()}/FinalizeTxn/v2/`, { key: KEY, orderid: String(orderid), appid: APP });
  return !!(a.response && a.response.result === 'OK');
}
module.exports.initTxn = initTxn; module.exports.queryTxn = queryTxn; module.exports.finalizeTxn = finalizeTxn;
