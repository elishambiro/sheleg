/**
 * setup-fonts.mjs
 *
 * Runs automatically after `npm install` (postinstall).
 *
 * On Windows: copies David.ttf / DavidBold.ttf from the system fonts
 *   directory (C:\Windows\Fonts\) if available.
 *
 * Fallback (macOS, Linux, or Windows CI without David):
 *   Downloads Noto Serif Hebrew from Google Fonts (OFL license, TTF format).
 *   Uses a legacy User-Agent so Google Fonts returns TTF instead of WOFF2.
 */

import fs from 'node:fs'
import https from 'node:https'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fontsDir  = path.resolve(__dirname, '..', 'public', 'fonts')
const REGULAR   = path.join(fontsDir, 'David.ttf')
const BOLD      = path.join(fontsDir, 'DavidBold.ttf')

// Legacy UA → Google Fonts returns TTF (not WOFF2)
const LEGACY_UA = 'Mozilla/4.0 (compatible; MSIE 8.0; Windows NT 6.1)'
const FONTS_API = 'https://fonts.googleapis.com/css?family=Noto+Serif+Hebrew:400,700&subset=hebrew'

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
  console.log('Fetching font URLs from Google Fonts...')
  const css = await fetchText(FONTS_API, LEGACY_UA)

  const urls = [...css.matchAll(/url\((https:\/\/[^)]+\.ttf)\)/g)].map(m => m[1])
  if (urls.length < 2) throw new Error(`Expected 2 TTF URLs, got ${urls.length}.\nCSS snippet:\n${css.slice(0, 500)}`)

  console.log(`Downloading Noto Serif Hebrew (${urls.length} files)...`)
  await download(urls[0], REGULAR)
  await download(urls[1], BOLD)
  console.log('Fonts downloaded.')
}

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
        fs.unlinkSync(dest)
        return download(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`))
      }
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    }).on('error', err => { fs.unlinkSync(dest); reject(err) })
  })
}
