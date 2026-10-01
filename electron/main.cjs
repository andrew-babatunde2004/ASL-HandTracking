const { app, BrowserWindow, protocol, net, session, Menu } = require('electron');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true, stream: true } }]);
const trusted = value => {
  try { const url = new URL(value); return url.protocol === 'app:' && url.host === 'studio'; }
  catch { return false; }
};
// Tests use a temporary profile, never the club's real recordings.
if (!app.isPackaged && process.env.ASL_TEST_PROFILE) app.setPath('userData', process.env.ASL_TEST_PROFILE);

function createWindow() {
  const window = new BrowserWindow({
    width: 1440, height: 940, minWidth: 800, minHeight: 650, backgroundColor: '#f7f7f2',
    title: 'ASL Studio', autoHideMenuBar: true,
    webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true, webSecurity: true },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', (event, url) => { if (!trusted(url)) event.preventDefault(); });
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.loadURL('app://studio/index.html');
}

app.whenReady().then(() => {
  const root = path.join(app.getAppPath(), 'dist');
  protocol.handle('app', request => {
    if (!trusted(request.url)) return new Response('Forbidden', { status: 403 });
    let pathname;
    try { pathname = decodeURIComponent(new URL(request.url).pathname); }
    catch { return new Response('Invalid path', { status: 400 }); }
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) return new Response('Forbidden', { status: 403 });
    return net.fetch(pathToFileURL(file).href);
  });
  session.defaultSession.setPermissionRequestHandler((contents, permission, callback, details) => {
    callback(permission === 'media' && trusted(contents?.getURL()) && trusted(details.requestingUrl)
      && details.mediaTypes?.length > 0 && details.mediaTypes.every(type => type === 'video'));
  });
  session.defaultSession.setPermissionCheckHandler((contents, permission, origin, details) =>
    permission === 'media' && trusted(contents?.getURL()) && trusted(origin) && details.mediaType === 'video');
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({ responseHeaders: { ...details.responseHeaders,
      'Content-Security-Policy': ["default-src 'self'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; worker-src 'self'; object-src 'none'; base-uri 'self'; frame-src 'none'"] } });
  });
  Menu.setApplicationMenu(Menu.buildFromTemplate([
    ...(process.platform === 'darwin' ? [{ role: 'appMenu' }] : []),
    { role: 'fileMenu' }, { role: 'editMenu' },
    { label: 'View', submenu: [{ role: 'reload' }, { role: 'resetZoom' }, { role: 'zoomIn' }, { role: 'zoomOut' }, { role: 'togglefullscreen' }, ...(!app.isPackaged ? [{ role: 'toggleDevTools' }] : [])] },
    { role: 'windowMenu' },
  ]));
  createWindow();
  app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
