/**
 * setup-fonts.mjs
 *
 * Runs automatically after `npm install` (postinstall).
 *
 * On Windows: copies David.ttf / DavidBold.ttf from the system fonts
 *   directory (C:\Windows\Fonts\) if available.
 *
 * Fallback (macOS, Linux, or Windows CI without David):
 *   Downloads Noto Serif Hebrew from Google Fonts (OFL license).
 *   Uses a legacy User-Agent so Google Fonts returns TTF/obfuscated TTF URLs.
 *   Noto Serif Hebrew is a variable font — the same file covers all weights.
 */

import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fontsDir  = path.resolve(__dirname, '..', 'public', 'fonts')
const REGULAR   = path.join(fontsDir, 'David.ttf')
const BOLD      = path.join(fontsDir, 'DavidBold.ttf')

// Legacy UA → Google Fonts CSS returns TTF/obfuscated-TTF rather than WOFF2
const LEGACY_UA  = 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)'
// Request only weight 400 — Noto Serif Hebrew is a variable font, one file covers all weights
const FONTS_API  = 'https://fonts.googleapis.com/css?family=Noto+Serif+Hebrew:400&subset=hebrew'

fs.mkdirSync(fontsDir, { recursive: true })

if (fs.existsSync(REGULAR) && fs.existsSync(BOLD)) {
  console.log('Fonts already present, skipping setup.')
  process.exit(0)
}

if (process.platform === 'win32') {
  const sys     = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'Fonts')
  const srcReg  = path.join(sys, 'david.ttf')
  const srcBold = path.join(sys, 'davidbd.ttf')

  if (fs.existsSync(srcReg) && fs.existsSync(srcBold)) {
    fs.copyFileSync(srcReg,  REGULAR)
    fs.copyFileSync(srcBold, BOLD)
    console.log('David font copied from Windows system fonts.')
    process.exit(0)
  }

  console.log('David not found in system fonts, downloading fallback...')
}

await downloadFallback()

// ─── Fallback: Noto Serif Hebrew via Google Fonts API ────────────────────────

async function downloadFallback() {
  console.log('Fetching font URL from Google Fonts...')
  const css = await fetchText(FONTS_API, LEGACY_UA)

  // Match any URL inside src: url(...) — Google Fonts may use obfuscated URLs
  const match = css.match(/src:\s*url\(([^)]+)\)/)
  if (!match) throw new Error(`Could not find font URL in CSS response.\nCSS:\n${css.slice(0, 600)}`)

  const fontUrl = match[1].trim()
  console.log('Downloading Noto Serif Hebrew...')
  await download(fontUrl, REGULAR)

  // Variable font — same file works for all weights
  fs.copyFileSync(REGULAR, BOLD)
  console.log('Fonts ready.')
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fetchText(url, userAgent) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': userAgent } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return fetchText(res.headers.location, userAgent).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} fetching ${url}`))
      }
      let body = ''
      res.on('data', chunk => { body += chunk })
      res.on('end', () => resolve(body))
    }).on('error', reject)
  })
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    https.get(url, { headers: { 'User-Agent': LEGACY_UA } }, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close()
        if (fs.existsSync(dest)) fs.unlinkSync(dest)
        return download(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} downloading font`))
      }
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    }).on('error', err => {
      if (fs.existsSync(dest)) fs.unlinkSync(dest)
      reject(err)
    })
  })
}
