import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  app,
  BrowserWindow,
  protocol,
  session,
  shell,
  type WebContents,
} from 'electron'
import started from 'electron-squirrel-startup'

const APP_PROTOCOL = 'app'
const APP_HOST = 'bundle'
const APP_ORIGIN = `${APP_PROTOCOL}://${APP_HOST}`
const APP_ID = 'com.sheleg.legal'
const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const appRoot = path.resolve(__dirname, '..')
const rendererDist = path.join(appRoot, 'dist')
const devServerUrl = process.env.SHELEG_RENDERER_URL
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.ico', 'image/x-icon'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.mjs', 'text/javascript; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.ttf', 'font/ttf'],
  ['.txt', 'text/plain; charset=utf-8'],
  ['.woff', 'font/woff'],
  ['.woff2', 'font/woff2'],
])

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_PROTOCOL,
    privileges: {
      secure: true,
      standard: true,
      supportFetchAPI: true,
      stream: true,
      corsEnabled: true,
    },
  },
])

if (started) {
  app.quit()
}

if (!app.requestSingleInstanceLock()) {
  app.quit()
}

let mainWindow: BrowserWindow | null = null

function buildCsp(): string {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "connect-src 'self'",
    "font-src 'self' data:",
    "frame-ancestors 'none'",
    "img-src 'self' data: blob:",
    "media-src 'self' data: blob:",
    "object-src 'none'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline'",
    "worker-src 'self' blob:",
  ].join('; ')
}

async function registerAppProtocol(): Promise<void> {
  await protocol.handle(APP_PROTOCOL, async (request) => {
    const url = new URL(request.url)

    if (url.host !== APP_HOST) {
      return new Response('Not found', { status: 404 })
    }

    const pathname = decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)
    const targetPath = path.normalize(path.join(rendererDist, pathname))

    if (!targetPath.startsWith(rendererDist)) {
      return new Response('Forbidden', { status: 403 })
    }

    try {
      const body = await readFile(targetPath)
      const headers = new Headers()
      headers.set('Content-Security-Policy', buildCsp())
      headers.set('Content-Type', mimeTypes.get(path.extname(targetPath)) ?? 'application/octet-stream')
      return new Response(body, { headers })
    } catch (error) {
      const status = error instanceof Error && 'code' in error && error.code === 'ENOENT' ? 404 : 500
      return new Response(status === 404 ? 'Not found' : 'Internal error', { status })
    }
  })
}

function isTrustedNavigation(url: string): boolean {
  if (devServerUrl) return url.startsWith(devServerUrl)
  return url.startsWith(APP_ORIGIN)
}

function hardenWebContents(contents: WebContents): void {
  contents.on('will-navigate', (event, url) => {
    if (!isTrustedNavigation(url)) event.preventDefault()
  })

  contents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      void shell.openExternal(url)
    }
    return { action: 'deny' }
  })
}

async function createMainWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1440,
    height: 920,
    minWidth: 1180,
    minHeight: 760,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#f1f3f5',
    title: 'Sheleg - Legal Document Compiler',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  })

  mainWindow = window
  hardenWebContents(window.webContents)

  window.once('ready-to-show', () => window.show())
  window.on('closed', () => {
    mainWindow = null
  })

  if (devServerUrl) {
    await window.loadURL(devServerUrl)
    return
  }

  await window.loadURL(`${APP_ORIGIN}/index.html`)
}

app.setAppUserModelId(APP_ID)

app.on('second-instance', () => {
  if (!mainWindow) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.focus()
})

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-attach-webview', (attachEvent) => {
    attachEvent.preventDefault()
  })

  hardenWebContents(contents)
})

app.whenReady().then(async () => {
  session.defaultSession.setPermissionRequestHandler((_wc, _permission, callback) => {
    callback(false)
  })
  session.defaultSession.setPermissionCheckHandler(() => false)

  if (!devServerUrl) {
    await registerAppProtocol()
  }

  await createMainWindow()

  app.on('activate', async () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      await createMainWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
