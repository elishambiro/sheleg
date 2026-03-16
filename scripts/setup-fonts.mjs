/**
 * setup-fonts.mjs
 *
 * Runs automatically after `npm install` (postinstall).
 *
 * On Windows: copies David.ttf and DavidBold.ttf from the system fonts
 *   directory (C:\Windows\Fonts\). David ships with every Windows installation.
 *
 * On macOS / Linux: downloads Frank Ruhl Libre from Google Fonts as a
 *   compatible open-source alternative (OFL licensed, similar serif style).
 */

import fs from 'node:fs'
import path from 'node:path'
import https from 'node:https'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fontsDir = path.resolve(__dirname, '..', 'public', 'fonts')

const REGULAR_DEST = path.join(fontsDir, 'David.ttf')
const BOLD_DEST    = path.join(fontsDir, 'DavidBold.ttf')

// Google Fonts — Frank Ruhl Libre (OFL), closest open-source match to David
const FALLBACK_REGULAR_URL = 'https://fonts.gstatic.com/s/frankruhllibre/v14/j8_v6-zQ3rXpceZj9cqnVhF5NH-iSq_E.ttf'
const FALLBACK_BOLD_URL    = 'https://fonts.gstatic.com/s/frankruhllibre/v14/j8_w6-zQ3rXpceZj9cqnVhV5NH-iSq_2_oC7.ttf'

fs.mkdirSync(fontsDir, { recursive: true })

const alreadyDone = fs.existsSync(REGULAR_DEST) && fs.existsSync(BOLD_DEST)
if (alreadyDone) {
  console.log('Fonts already present, skipping setup.')
  process.exit(0)
}

if (process.platform === 'win32') {
  setupWindows()
} else {
  await setupFallback()
}

// ─── Windows ─────────────────────────────────────────────────────────────────

function setupWindows() {
  const systemFonts = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'Fonts')
  const srcRegular  = path.join(systemFonts, 'david.ttf')
  const srcBold     = path.join(systemFonts, 'davidbd.ttf')

  if (!fs.existsSync(srcRegular) || !fs.existsSync(srcBold)) {
    console.warn('David font not found in system fonts. Falling back to Frank Ruhl Libre.')
    setupFallback()
    return
  }

  fs.copyFileSync(srcRegular, REGULAR_DEST)
  fs.copyFileSync(srcBold, BOLD_DEST)
  console.log('David font copied from system fonts.')
}

// ─── macOS / Linux fallback ───────────────────────────────────────────────────

async function setupFallback() {
  console.log('Downloading Frank Ruhl Libre (open-source Hebrew font)...')
  await download(FALLBACK_REGULAR_URL, REGULAR_DEST)
  await download(FALLBACK_BOLD_URL, BOLD_DEST)
  console.log('Fonts downloaded.')
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        fs.unlinkSync(dest)
        download(res.headers.location, dest).then(resolve).catch(reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`Failed to download font: HTTP ${res.statusCode}`))
        return
      }
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    }).on('error', (err) => {
      fs.unlinkSync(dest)
      reject(err)
    })
  })
}
