# 06. Pivot to Gemini AI Editor

> **Date**: 2026-05-05
> **Status**: Decision adopted; v1 architecture (pdf2slides + PyQt6) discarded.

## What changed

The original plan (documents 01–05) targeted a **PyQt6 desktop converter** using `pdf2slides` as a fully local conversion engine. After end-to-end testing on a real-world PDF, that direction was abandoned in favor of a **FastAPI + Gemini AI Editor**.

## Why we pivoted

### Trigger 1 — Real input was an image-only PDF

A test conversion of `Dify_Prototype_to_Production.pdf` (15 pages, 18 MB; produced by NotebookLM) revealed:

```text
Pages: 15
Page 1..15 — text length: 0 chars, images: 1 each
```

Every page was a **single rasterized image**. No selectable text whatsoever. This is the typical output of modern AI/design tools (NotebookLM, Canva, Figma → PDF), not an edge case.

`pdf2slides` produced a 191 MB .pptx with `slides_with_text: 0` — every slide was an embedded image, not editable. Even with OCR enabled, the result would be approximated text glued onto image backgrounds — not the per-element editability the user wanted.

### Trigger 2 — User showed the actual reference UX

The reference application (Google AI Studio's "CUP PDF to PPTX") is not a converter at all. It is a **per-element visual editor**:

- AI vision detects each text box / image / shape on each page
- User clicks elements in-app to select and edit (text content, font size, color, position)
- App exports a real editable .pptx with each element as a separate PowerPoint shape

This pattern fundamentally requires an **AI vision model**. Local OCR + heuristic layout cannot reproduce it.

## What this means for the original plan

| Document | Status after pivot |
|---|---|
| 01 — Engine decision (pdf2slides) | **Superseded.** Engine is now Gemini 2.5 Flash. |
| 02 — Libraries reviewed | Mostly invalidated. New comparison would be vision models (Gemini, Claude, GPT-4o, local LLaVA). |
| 03 — No API keys policy | **Amended.** Free-tier Gemini API is now used. Still no paid commitment, still no third-party server stores user data, but a cloud LLM call is involved. |
| 04 — License (GPL-3.0 due to pdf2slides) | **Changed to MIT.** With pdf2slides removed, all remaining deps are MIT/Apache/BSD-compatible. PyMuPDF AGPL still applies for distribution. |
| 05 — Relation to pptx_writer | Largely unchanged — pptx_writer remains separate; we use python-pptx directly. |

The historical documents are **kept** (not deleted) so the project's decision trail is auditable. They each carry an "Updated" footer pointing to this pivot note.

## New architecture (summary)

```
Browser (localhost:8000) — Tailwind/Alpine.js/SVG
  ↕ HTTP
FastAPI backend
  ├── PyMuPDF: PDF → page PNG
  ├── google-genai: page PNG → structured element list (Gemini 2.5 Flash)
  └── python-pptx: edited element list → real editable .pptx
```

- **Single Python process**, served from `python app.py` → opens `localhost:8000`
- **No Node.js / no build step** — frontend is plain HTML + CDN libraries
- **API key entered in-app** (modal on first run) — stored in user-local `.env` if "remember" is checked
- **Free-tier Gemini limit (15 RPM)** is enough for typical 10–30 page PDFs

## What we kept from v1

- The **research/decision-trail discipline**: this very document is its continuation.
- **PyMuPDF** for PDF rendering (still the best Python option).
- **python-pptx** for output writing.
- The general project goals (fully Korean+English support, faithful-ish layout, real editable output).

## What we discarded

| File / module | Reason |
|---|---|
| `src/core/converter.py`, `preview.py`, `progress.py`, `exceptions.py`, `_vendor/` | Wrapped pdf2slides; no longer used |
| `src/ui/` (PyQt6) | Desktop UI replaced by web UI |
| `src/config.py` | Replaced by `src/settings.py` |
| `cli_convert.py`, `smoke_test.py` | Tied to the old converter; new tests will be backend-route tests |
| `setup.bat`, `setup.sh`, `install.bat` | Single-process app needs only `pip install -r requirements.txt` and `python app.py` |
| GPL-3.0 license | Switched to MIT now that pdf2slides is gone |
| Heavy installed packages (paddleocr, paddlepaddle, pdf2slides, PyQt6) | Listed for uninstall to free disk space |

## Lesson for future planning

The misalignment came from **not seeing the reference UI early enough**. The original YouTube link couldn't be fetched (consent redirect), and verbal description (PDF → editable PowerPoint) was satisfied by both interpretations: simple converter and per-element editor. The screenshot of the reference app, shared after the failed test, immediately resolved the ambiguity.

**Mitigation**: when a reference link fails to fetch, **ask the user for a screenshot or a textual feature list before committing to architecture** — not after.
