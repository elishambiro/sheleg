# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-03-17

### Added
- Drag-and-drop upload for main documents and annexes
- PDF compilation engine — merges all documents into a single PDF with annex stamps, table of contents, page numbers, and cover page
- Live PDF preview panel — automatically re-compiles on document changes
- Annex management — reorder, rename, set page ranges
- Flexible annex numbering: numeric, Hebrew alphabetic, English alphabetic, or manual
- PDF editor — redaction and highlighting
- Document viewer — inline preview for PDF and image files
- Project save/load via IndexedDB
- Volume splitting by size (MB) or page count
- Fully offline — no backend, no telemetry
- Desktop app for Windows (`.exe`) and macOS (`.dmg`)
- GitHub Actions CI for automated builds
- Font setup script — copies David from Windows system fonts, downloads Noto Serif Hebrew on macOS
