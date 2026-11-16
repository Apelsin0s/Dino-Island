// Gives the page (src/) what only the desktop build has: the co-op server address and Steam sign-in.
'use strict';
const { contextBridge, ipcRenderer } = require('electron');
contextBridge.exposeInMainWorld('Steam', {
  ticket: () => ipcRenderer.invoke('steam:ticket'),
  me: () => ipcRenderer.invoke('steam:me')
});
// net.js reads window.ED_CONFIG when it starts, so the address is put there synchronously from config.json
const fs = require('fs'), path = require('path');
const c = JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8'));
contextBridge.exposeInMainWorld('ED_CONFIG', { server: c.server, version: c.version || '', steam: true, hd: c.hd !== false });
