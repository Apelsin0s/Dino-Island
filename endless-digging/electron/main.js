// The Steam build: the same game (src/) in a desktop window, plus Steam (sign-in ticket, overlay).
// Settings come from electron/config.json: the Steam app id and the co-op server address.
'use strict';
const { app, BrowserWindow, ipcMain, shell, protocol, net } = require('electron');
const path = require('path'), fs = require('fs'), { pathToFileURL } = require('url');
const cfg = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));

let steam = null, client = null;
try {
  steam = require('steamworks.js');
  client = steam.init(cfg.steamAppId);        // fails when Steam is not running (then the game still starts, solo only)
  steam.electronEnableSteamOverlay();
} catch (e) { console.warn('Steam is not available:', e.message); client = null; }

// a fresh session ticket for the co-op server (it checks the ticket with Steam)
ipcMain.handle('steam:ticket', async () => {
  if (!client) return null;
  try {
    if (client.auth.getAuthTicketForWebApi) { const t = await client.auth.getAuthTicketForWebApi(cfg.ticketIdentity || 'endless-digging'); return Buffer.from(t.getBytes()).toString('hex'); }
    const t = await client.auth.getSessionTicket(); return Buffer.from(t.getBytes()).toString('hex');
  } catch (e) { return null; }
});
ipcMain.handle('steam:me', () => client ? { name: client.localplayer.getName(), steamId: String(client.localplayer.getSteamId().steamId64) } : null);
ipcMain.handle('app:config', () => ({ server: cfg.server, version: app.getVersion(), steam: !!client }));

function createWindow() {
  const win = new BrowserWindow({
    width: 1600, height: 900, backgroundColor: '#8fc6ea', title: 'Endless Digging', autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, sandbox: false, backgroundThrottling: false }
  });
  win.loadURL('app://game/index.html');
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https:\/\//.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  if (cfg.fullscreen) win.setFullScreen(true);
  // ED_SMOKE=<file.png>: start, wait for the menu, save a screenshot, print how the game runs, quit (used by tests)
  if (process.env.ED_SMOKE) {
    const t0 = Date.now();
    const poll = async () => {
      const r = await win.webContents.executeJavaScript(`(() => { const b = document.getElementById('bPlay'); return b ? { menu: true, threads: window.Mesher ? (Mesher.sync ? 'main thread' : Mesher.workers.length + ' threads') : '?', steam: !!(window.ED_CONFIG && ED_CONFIG.steam), models: window.ModelCache ? ModelCache.stats() : null } : null; })()`).catch(() => null);
      if (r || Date.now() - t0 > 180000) { const img = await win.webContents.capturePage(); fs.writeFileSync(process.env.ED_SMOKE, img.toPNG()); console.log('ED_SMOKE', JSON.stringify(Object.assign({ seconds: (Date.now() - t0) / 1000 }, r))); app.quit(); }
      else setTimeout(poll, 500);
    };
    win.webContents.on('console-message', (e, level, msg) => { if (level >= 2) console.log('page:', msg); });
    win.webContents.on('did-finish-load', poll);
  }
}
// the game is served from app://game/ (not file://): fetch, threads (Web Workers) and IndexedDB all need a real origin
const ROOT = path.join(__dirname, '..', 'src');
protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true } }]);
function serveGame() {
  protocol.handle('app', req => {
    const rel = decodeURIComponent(new URL(req.url).pathname).replace(/^\/+/, '') || 'index.html', file = path.normalize(path.join(ROOT, rel));
    if (!file.startsWith(ROOT)) return new Response('no', { status: 403 });
    return net.fetch(pathToFileURL(file).toString());
  });
}
// the game wants the real GPU and no frame cap
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('disable-frame-rate-limit');
app.whenReady().then(() => { serveGame(); createWindow(); });
app.on('window-all-closed', () => app.quit());
