// Desktop wrapper for Steam builds. Loads the same game files as the web version.
const { app, BrowserWindow, Menu, shell } = require('electron');
const path = require('path');

// Old or blocklisted GPUs: still allow WebGL, falling back to software rendering.
// The game renders at low resolution, so the software path stays playable.
app.commandLine.appendSwitch('ignore-gpu-blocklist');
app.commandLine.appendSwitch('enable-unsafe-swiftshader');

function createWindow() {
  const win = new BrowserWindow({
    width: 1280, height: 760, minWidth: 960, minHeight: 600,
    backgroundColor: '#17110c', title: 'Stuck in the Stone Age', autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, sandbox: true, nodeIntegration: false }
  });
  win.loadFile(path.join(__dirname, '..', 'src', 'index.html'));
  // F11 toggles fullscreen; links open in the system browser
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type === 'keyDown' && input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

app.whenReady().then(() => { Menu.setApplicationMenu(null); createWindow(); });
app.on('window-all-closed', () => app.quit());
