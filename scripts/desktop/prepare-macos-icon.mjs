import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const rootDir = path.resolve(__dirname, '..', '..')
const sourceIcon = path.join(rootDir, 'electron', 'assets', 'icon.png')
const outputIcon = path.join(rootDir, 'electron', 'assets', 'icon.icns')
const iconsetDir = path.join(rootDir, 'electron', 'assets', 'icon.iconset')

if (process.platform !== 'darwin') {
  console.error("prepare-macos-icon must run on macOS. 'sips' and 'iconutil' are Apple tools.")
  console.error('Build the macOS installer on a Mac or on a macOS GitHub Actions runner.')
  process.exit(1)
}

if (!fs.existsSync(sourceIcon)) {
  console.error(`Missing source icon: ${sourceIcon}`)
  process.exit(1)
}

function runTool(command, args) {
  try {
    execFileSync(command, args, { stdio: 'ignore' })
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      console.error(`Missing required macOS tool: ${command}`)
      process.exit(1)
    }

    throw error
  }
}

fs.rmSync(iconsetDir, { recursive: true, force: true })
fs.rmSync(outputIcon, { force: true })
fs.mkdirSync(iconsetDir, { recursive: true })

for (const size of [16, 32, 64, 128, 256, 512]) {
  const baseTarget = path.join(iconsetDir, `icon_${size}x${size}.png`)
  const retinaSize = size * 2
  const retinaTarget = path.join(iconsetDir, `icon_${size}x${size}@2x.png`)

  runTool('sips', ['-z', String(size), String(size), sourceIcon, '--out', baseTarget])
  runTool('sips', ['-z', String(retinaSize), String(retinaSize), sourceIcon, '--out', retinaTarget])
}

runTool('iconutil', ['-c', 'icns', iconsetDir, '-o', outputIcon])
fs.rmSync(iconsetDir, { recursive: true, force: true })
