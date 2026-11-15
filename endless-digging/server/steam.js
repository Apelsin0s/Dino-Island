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
