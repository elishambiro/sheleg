# Sheleg - Legal Document Compiler ❄️

**Open-source desktop app for compiling legal document bundles into a single PDF.**

Built for lawyers and legal teams working with Hebrew documents - upload main documents and annexes, arrange them, and export a professionally formatted PDF with automatic annex stamps, table of contents, page numbers, and cover pages.

---

## Features

- **Drag-and-drop upload** - main documents and annexes, sorted automatically
- **Live PDF preview** - see the final compiled document as you work
- **Annex management** - reorder, rename, set page ranges, with flexible numbering styles (numeric, Hebrew alphabetic, English alphabetic, or manual)
- **PDF editor** - basic redaction and highlighting directly in the app
- **Document viewer** - preview PDF and image files inline
- **PDF compilation** - merges all documents into one PDF with:
  - Automatic annex stamps on first pages
  - Table of contents
  - Page numbering (top or bottom)
  - Cover page
  - Volume splitting by size (MB) or page count
- **Project management** - save and load projects, stored locally in IndexedDB
- **Fully offline** - no backend, no cloud, no telemetry

### Supported Input Formats

| Format | Compilation |
|--------|------------|
| PDF | ✅ Native |
| Word (`.docx`, `.doc`) | ✅ Converted via mammoth |
| Excel (`.xlsx`, `.xls`) | ✅ Converted to HTML table |
| Images (JPG, PNG, GIF, TIFF) | ✅ Embedded |
| HTML / EML / MSG | ✅ Rendered |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| UI | React 18 + TypeScript + Tailwind CSS |
| State | Zustand |
| Build | Vite 6 |
| Desktop | Electron 41 + Electron Forge 7 |
| PDF generation | pdf-lib + pdfjs-dist |
| Word parsing | mammoth |
| Excel parsing | xlsx |
| Drag & drop | @dnd-kit |
| Storage | IndexedDB (idb) |

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 20+
- npm 10+

### Install

```bash
git clone https://github.com/your-org/sheleg.git
cd sheleg
npm install
```

### Run in browser (dev)

```bash
npm run dev
```

Opens at `http://localhost:3000`.

### Run as desktop app (dev)

```bash
npm run dev:desktop
```

Launches Vite + Electron together with hot reload.

---

## Building for Distribution

### Windows installer (`.exe`)

Run on a Windows machine or CI:

```bash
npm run make:win
```

Output in `desktop-release/win32-x64/`:
- `Sheleg-Legal-Setup.exe` - installer
- `sheleg_legal-<version>-full.nupkg` - update package

### macOS (`.dmg` + `.zip`)

Run on a Mac - macOS icon generation requires macOS tools (`sips`, `iconutil`):

```bash
# Apple Silicon
npm run make:mac:arm64

# Intel
npm run make:mac:x64
```

Output in `desktop-release/darwin-arm64/` or `desktop-release/darwin-x64/`.

### Code signing (optional)

Set these environment variables before building:

| Variable | Purpose |
|----------|---------|
| `APPLE_ID` | Apple Developer account email |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password for notarization |
| `APPLE_TEAM_ID` | Apple Developer Team ID |
| `WINDOWS_CERT_FILE` | Path to `.pfx` certificate file |
| `WINDOWS_CERT_PASSWORD` | Certificate password |

Without these, unsigned builds are produced - fine for local use, but macOS Gatekeeper will warn users.

---

## CI/CD (GitHub Actions)

The workflow at `.github/workflows/desktop-release.yml` triggers on any `v*` tag push or manual dispatch.

It builds in parallel:

| Job | Runner | Output |
|-----|--------|--------|
| Windows | `windows-latest` | `Sheleg-Legal-Setup.exe` |
| macOS ARM64 | `macos-latest` | DMG + ZIP |
| macOS Intel | `macos-13` | DMG + ZIP |

Artifacts are uploaded to GitHub and available for download from the Actions run.

To release a new version:

```bash
git tag v1.0.0
git push origin v1.0.0
```

---

## Project Structure

```
sheleg/
├── electron/
│   ├── assets/          # App icons (.ico, .png, .icns)
│   └── main.ts          # Electron main process
├── scripts/
│   └── desktop/
│       └── prepare-macos-icon.mjs  # PNG → ICNS conversion
├── src/
│   ├── components/
│   │   ├── documents/   # DocumentArea, AnnexTable, DropZone, PageRangeModal
│   │   ├── editor/      # PdfEditorModal (redaction, highlights)
│   │   ├── layout/      # TopBar, Sidebar
│   │   ├── settings/    # SettingsPanel
│   │   ├── ui/          # Modal, Spinner, ProgressBar, EmptyState
│   │   └── viewer/      # DocumentViewer, PdfPreviewPanel
│   ├── constants/       # Default settings, accepted file types
│   ├── hooks/           # useFileUpload, useProject
│   ├── lib/             # IndexedDB, font loading, page count, document data
│   ├── services/        # compiler.ts - PDF compilation engine
│   ├── store/           # Zustand store (single source of truth)
│   ├── types/           # TypeScript type definitions
│   └── utils/           # Color helpers, file helpers, numbering logic
├── forge.config.cjs     # Electron Forge packaging config
├── vite.config.ts
└── tailwind.config.ts
```

---

## Architecture

### State Management

All application state lives in `src/store/index.ts` (Zustand):

- `documentFiles` - uploaded file metadata + binary data
- `mainDocuments` - ordered list of main documents
- `annexes` - ordered list of annexes (supports sub-annexes)
- `settings` - compilation settings (numbering, layout, design)
- `currentProject` / `recentProjects` - project management

### Data Persistence

Files are stored in **IndexedDB** via `src/lib/db.ts`:
- File binaries are stored separately by key, keeping project JSON small
- Projects are serialized to JSON (metadata only, no binaries)

### Compilation Pipeline

`src/services/compiler.ts`:

1. Load binary data for all documents from IndexedDB
2. Convert non-PDF formats → PDF (Word via mammoth→HTML, Excel via xlsx→HTML, images embedded)
3. Merge main documents
4. Insert annex separator pages with stamps
5. Build table of contents
6. Add page numbers
7. Split into volumes if configured

### Security (Electron)

- `contextIsolation: true`, `nodeIntegration: false`, `sandbox: true`
- Custom `app://bundle` protocol instead of `file://`
- Strict Content Security Policy (no external scripts, no eval)
- All Electron Fuses hardened
- External links open in system browser, not in-app

---

## Known Limitations

- No backend - everything is local to the machine
- Projects are stored in IndexedDB and are not portable between browsers/machines (use the save/load project feature)
- Page counts for Word/Excel/HTML files are unknown until compilation runs
- Sub-annexes exist in the data model but have limited UI support
- Building macOS `.dmg` requires running on macOS

---

## Contributing

Contributions are welcome! Please:

1. Fork the repo and create a feature branch
2. Keep PRs focused - one feature or fix per PR
3. Follow the existing TypeScript and Tailwind patterns
4. Test that compilation works end-to-end before submitting

### Running locally

```bash
npm install
npm run dev          # browser dev server
npm run dev:desktop  # Electron dev mode
```

### Building

```bash
npm run build        # renderer only
npm run build:desktop  # full desktop build (renderer + electron)
```

---

## License

[MIT](LICENSE)
