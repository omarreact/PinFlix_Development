'use strict';

const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

// This desktop shell uses the deployed PinFlix site instead of shipping
// a separate Next.js web server inside the Windows installer.
const HOME = 'https://pinflix.pincodeit.com/';
const HOME_ORIGIN = new URL(HOME).origin;
const OFFLINE_FILE = path.join(__dirname, 'offline.html');
const OFFLINE_URL = pathToFileURL(OFFLINE_FILE).href;
let primaryWindow;

function isAppUrl(value) {
  try {
    const target = new URL(value);
    return target.protocol === 'https:' && target.origin === HOME_ORIGIN;
  } catch {
    return false;
  }
}

function openSafeExternal(value) {
  try {
    const target = new URL(value);
    if (target.protocol === 'http:' || target.protocol === 'https:') {
      // Never open file:, javascript:, or custom-protocol links.
      void shell.openExternal(target.href).catch(() => {});
    }
  } catch {
    // Disallow malformed URLs.
  }
}

function createApplicationMenu(win) {
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    { label: 'PinFlix', submenu: [
      { label: 'Home', accelerator: 'Alt+Home', click: () => { void win.loadURL(HOME); } },
      { label: 'Refresh', accelerator: 'F5', click: () => win.webContents.reload() },
      { type: 'separator' },
      { label: 'Exit', role: 'quit' }
    ] },
    { label: 'Navigate', submenu: [
      { label: 'Back', accelerator: 'Alt+Left', click: () => {
        if (win.webContents.navigationHistory.canGoBack()) win.webContents.navigationHistory.goBack();
      } },
      { label: 'Forward', accelerator: 'Alt+Right', click: () => {
        if (win.webContents.navigationHistory.canGoForward()) win.webContents.navigationHistory.goForward();
      } },
      { label: 'Full Screen', accelerator: 'F11', click: () => win.setFullScreen(!win.isFullScreen()) }
    ] }
  ]));
}

function createWindow() {
  const win = new BrowserWindow({
    title: 'PinFlix',
    width: 1330,
    height: 820,
    minWidth: 740,
    minHeight: 480,
    backgroundColor: '#0e1019',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false
    }
  });

  primaryWindow = win;
  win.once('ready-to-show', () => win.show());
  win.webContents.on('did-fail-load', (_event, code, _description, _url, isMainFrame) => {
    if (isMainFrame && code !== -3 && !win.isDestroyed()) {
      void win.loadFile(OFFLINE_FILE).catch(() => {});
    }
  });
  win.webContents.on('will-navigate', (event, url) => {
    if (!isAppUrl(url) && url !== OFFLINE_URL) {
      event.preventDefault();
      openSafeExternal(url);
    }
  });
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (isAppUrl(url)) void win.loadURL(url).catch(() => {});
    else openSafeExternal(url);
    return { action: 'deny' };
  });
  win.on('closed', () => { if (primaryWindow === win) primaryWindow = undefined; });
  createApplicationMenu(win);
  void win.loadURL(HOME).catch(() => {});
}

app.whenReady().then(() => {
  session.defaultSession.setPermissionRequestHandler((_contents, permission, callback, details) => {
    callback(permission === 'fullscreen' && isAppUrl(details.requestingUrl));
  });
  app.on('web-contents-created', (_event, contents) => {
    contents.on('will-attach-webview', (event) => event.preventDefault());
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
