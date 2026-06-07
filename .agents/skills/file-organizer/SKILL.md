---
name: file-organizer
description: Audits, organizes, and cleans up the XKSH808 workspace. Scans all files, categorizes them, flags dead weight, moves files to clean folder structure, and generates a full report.
argument-hint: [command] — audit | organize | clean | report
---

# XKSH808 FILE ORGANIZER

Scans the full workspace and organizes files into clean categories.

## Commands
- `audit`    — Scan everything, categorize, flag junk vs. keep
- `organize` — Move files into clean folder structure
- `clean`    — Delete confirmed junk files (logs, dupes, temp)
- `report`   — Print full file inventory with status tags

## Target Structure
xksh808/
  agents/       — All agent JS/TS files
  skills/       — Built skills (already in .agents/skills/)
  workflows/    — n8n JSON workflows
  frameworks/   — MD framework docs
  incoming/     — Raw uploads (to review)
  archive/      — Old/unused but kept for reference
  junk/         — Flagged for deletion
