/**
 * setup-fonts.mjs
 *
 * Runs automatically after `npm install` (postinstall).
 *
 * 1. Windows: copies David.ttf / DavidBold.ttf from C:\Windows\Fonts\.
 * 2. macOS:   searches for David in Microsoft Office font directories.
 * 3. Fallback (font not found): downloads NotoSerifHebrew-Regular.ttf
 *    from the official GitHub release (SIL OFL 1.1).
 *
 * David.ttf is a proprietary Microsoft font — NOT committed to this repo.
 */

import fs     from 'node:fs'
import https  from 'node:https'
import os     from 'node:os'
import path   from 'node:path'
import zlib   from 'node:zlib'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const fontsDir  = path.resolve(__dirname, '..', 'public', 'fonts')
const REGULAR   = path.join(fontsDir, 'David.ttf')
const BOLD      = path.join(fontsDir, 'DavidBold.ttf')
const NOTO      = path.join(fontsDir, 'NotoSerifHebrew.ttf')

// Noto Serif Hebrew — SIL OFL 1.1
// Source: https://github.com/notofonts/hebrew/releases/tag/NotoSerifHebrew-v2.004
const NOTO_ZIP_URL = 'https://github.com/notofonts/hebrew/releases/download/NotoSerifHebrew-v2.004/NotoSerifHebrew-v2.004.zip'
const NOTO_TTF_IN_ZIP = 'NotoSerifHebrew/full/ttf/NotoSerifHebrew-Regular.ttf'

fs.mkdirSync(fontsDir, { recursive: true })

// ── 1. Try to find David fonts on the system ─────────────────────────────────

if (process.platform === 'win32') {
  const sys     = path.join(process.env.SystemRoot ?? 'C:\\Windows', 'Fonts')
  const srcReg  = path.join(sys, 'david.ttf')
  const srcBold = path.join(sys, 'davidbd.ttf')

  if (fs.existsSync(srcReg) && fs.existsSync(srcBold)) {
    if (!fs.existsSync(REGULAR))  fs.copyFileSync(srcReg,  REGULAR)
    if (!fs.existsSync(BOLD))     fs.copyFileSync(srcBold, BOLD)
    console.log('David font copied from Windows system fonts.')
  } else {
    console.log('David not found in Windows system fonts — will use Noto Serif Hebrew.')
  }
}

if (process.platform === 'darwin') {
  // Microsoft Office for Mac installs Hebrew fonts in these locations.
  // The bold variant may be named "David Bold.ttf" or "DavidBD.ttf".
  const home = os.homedir()
  const candidates = [
    ['/Library/Fonts/Microsoft/David.ttf',            '/Library/Fonts/Microsoft/David Bold.ttf'],
    ['/Library/Fonts/Microsoft/David.ttf',            '/Library/Fonts/Microsoft/DavidBD.ttf'],
    [`${home}/Library/Fonts/Microsoft/David.ttf`,     `${home}/Library/Fonts/Microsoft/David Bold.ttf`],
    [`${home}/Library/Fonts/Microsoft/David.ttf`,     `${home}/Library/Fonts/Microsoft/DavidBD.ttf`],
    // Office 365 / newer Office versions bundle fonts inside the app
    ['/Applications/Microsoft Word.app/Contents/Resources/Fonts/David.ttf',
     '/Applications/Microsoft Word.app/Contents/Resources/Fonts/David Bold.ttf'],
    ['/Applications/Microsoft Word.app/Contents/Resources/Fonts/David.ttf',
     '/Applications/Microsoft Word.app/Contents/Resources/Fonts/DavidBD.ttf'],
  ]

  let found = false
  for (const [srcReg, srcBold] of candidates) {
    if (fs.existsSync(srcReg) && fs.existsSync(srcBold)) {
      if (!fs.existsSync(REGULAR))  fs.copyFileSync(srcReg,  REGULAR)
      if (!fs.existsSync(BOLD))     fs.copyFileSync(srcBold, BOLD)
      console.log('David font copied from Microsoft Office for Mac.')
      found = true
      break
    }
  }

  if (!found) {
    console.log('David not found (Microsoft Office not installed) — will use Noto Serif Hebrew.')
  }
}

// ── 2. Ensure NotoSerifHebrew.ttf is present as fallback ─────────────────────

if (fs.existsSync(NOTO)) {
  console.log('NotoSerifHebrew.ttf already present.')
  process.exit(0)
}

console.log('Downloading NotoSerifHebrew.ttf from GitHub releases...')

// Use os.tmpdir() to avoid issues with Hebrew/Unicode characters in the project path
const tmpDir = os.tmpdir()
const tmpZip = path.join(tmpDir, `sheleg-noto-${Date.now()}.zip`)
await download(NOTO_ZIP_URL, tmpZip)

// Extract using pure Node.js — works on Windows, macOS, Linux, no external tools
try {
  await extractFromZip(tmpZip, NOTO_TTF_IN_ZIP, NOTO)

  const size = fs.statSync(NOTO).size
  if (size < 10_000) throw new Error(`Font file too small (${size} bytes) — extraction may have failed`)
  console.log(`NotoSerifHebrew.ttf ready (${Math.round(size / 1024)} KB).`)
} finally {
  if (fs.existsSync(tmpZip)) fs.unlinkSync(tmpZip)
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Pure Node.js ZIP extractor — no external tools needed.
 * Reads the ZIP central directory to find the entry, then inflates it.
 */
function extractFromZip(zipPath, entryName, destPath) {
  return new Promise((resolve, reject) => {
    try {
      const buf = fs.readFileSync(zipPath)

      // Find End-of-Central-Directory record (signature 0x06054b50)
      let eocdOffset = -1
      for (let i = buf.length - 22; i >= 0; i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) { eocdOffset = i; break }
      }
      if (eocdOffset === -1) throw new Error('EOCD not found — not a valid ZIP')

      const cdOffset = buf.readUInt32LE(eocdOffset + 16)
      const cdEntries = buf.readUInt16LE(eocdOffset + 10)

      let pos = cdOffset
      for (let i = 0; i < cdEntries; i++) {
        if (buf.readUInt32LE(pos) !== 0x02014b50) throw new Error('Invalid central directory')
        const compression  = buf.readUInt16LE(pos + 10)
        const compSize     = buf.readUInt32LE(pos + 20)
        const uncompSize   = buf.readUInt32LE(pos + 24)
        const fileNameLen  = buf.readUInt16LE(pos + 28)
        const extraLen     = buf.readUInt16LE(pos + 30)
        const commentLen   = buf.readUInt16LE(pos + 32)
        const localOffset  = buf.readUInt32LE(pos + 42)
        const name         = buf.toString('utf8', pos + 46, pos + 46 + fileNameLen)

        if (name === entryName) {
          // Read local file header to get actual data offset
          const localExtra = buf.readUInt16LE(localOffset + 28)
          const dataStart  = localOffset + 30 + fileNameLen + localExtra
          const compressed = buf.slice(dataStart, dataStart + compSize)

          if (compression === 0) {
            // Stored (no compression)
            fs.writeFileSync(destPath, compressed)
            resolve()
          } else if (compression === 8) {
            // Deflate
            zlib.inflateRaw(compressed, (err, result) => {
              if (err) return reject(err)
              if (result.length !== uncompSize) return reject(new Error('Size mismatch after inflate'))
              fs.writeFileSync(destPath, result)
              resolve()
            })
          } else {
            reject(new Error(`Unsupported compression method: ${compression}`))
          }
          return
        }

        pos += 46 + fileNameLen + extraLen + commentLen
      }

      reject(new Error(`Entry not found in ZIP: ${entryName}`))
    } catch (err) {
      reject(err)
    }
  })
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest)
    const req  = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, res => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        file.close()
        if (fs.existsSync(dest)) fs.unlinkSync(dest)
        return download(res.headers.location, dest).then(resolve).catch(reject)
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`HTTP ${res.statusCode} downloading ${url}`))
      }
      res.pipe(file)
      file.on('finish', () => file.close(resolve))
    })
    req.on('error', err => { if (fs.existsSync(dest)) fs.unlinkSync(dest); reject(err) })
  })
}
