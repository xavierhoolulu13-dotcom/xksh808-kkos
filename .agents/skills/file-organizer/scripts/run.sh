#!/bin/bash
# ═══════════════════════════════════════════════════════════════
# XKSH808 FILE ORGANIZER — Workspace Audit + Cleanup
# Usage: bash run.sh [audit|organize|clean|report]
# ═══════════════════════════════════════════════════════════════

source /app/.agents/.env
CMD="${1:-audit}"
TIMESTAMP=$(date '+%Y-%m-%d %H:%M HST')

print_header() {
  echo ""
  echo "╔══════════════════════════════════════════════════╗"
  echo "║     XKSH808 FILE ORGANIZER — KKOS SYSTEM        ║"
  echo "║  $TIMESTAMP                    ║"
  echo "╚══════════════════════════════════════════════════╝"
  echo ""
}

# ─── AUDIT ──────────────────────────────────────────────────────
audit() {
  echo "🔍 FULL WORKSPACE AUDIT"
  echo "────────────────────────────────────"
  echo ""

  python3 << 'PYEOF'
import os, json
from pathlib import Path

ROOT = "/app"
SKIP_DIRS = {'.git', 'node_modules', '__pycache__', '.agents/.memory'}

# Category rules
CATEGORIES = {
    "🤖 AGENTS":      [".js", ".ts"],
    "📋 FRAMEWORKS":  [".md"],
    "⚙️  WORKFLOWS":  [".json"],
    "🌐 PAGES/UI":    [".html", ".jsx", ".tsx", ".css"],
    "🐍 SCRIPTS":     [".py", ".sh"],
    "📦 DATA":        [".xlsx", ".csv", ".jsonc"],
    "🎵 MEDIA":       [".mp3", ".mp4", ".jpg", ".png", ".gif", ".zip"],
    "📝 TEXT":        [".txt", ".log"],
    "❓ UNKNOWN":     [],
}

# Junk patterns
JUNK_PATTERNS = [
    "creation.log", "localstore.json", ".env.example",
    "whatsapp_image", "AIToolsDirectory-dealsbe.com",
    "void-headless-build.zip", "void-headless-environments.zip"
]

# High value patterns
HIGH_VALUE = [
    "808-FRAMEWORK", "revenue-agent-808", "kkos-master",
    "promo-post-generator", "A_LEAD", "A_SALES", "A_DELIV",
    "A_MON", "A_RET", "ghost-output", "808-tg-bot",
    "groqRouter", "anytypeClient", "router.js", "telegram-bot"
]

all_files = []
for dirpath, dirnames, filenames in os.walk(ROOT):
    # Skip system dirs
    dirnames[:] = [d for d in dirnames if d not in {'.git', 'node_modules', '__pycache__'}]
    if '.agents/.memory' in dirpath:
        continue
    for f in filenames:
        full = os.path.join(dirpath, f)
        rel = os.path.relpath(full, ROOT)
        ext = Path(f).suffix.lower()
        size = os.path.getsize(full)

        # Categorize
        cat = "❓ UNKNOWN"
        for c, exts in CATEGORIES.items():
            if ext in exts:
                cat = c
                break

        # Tag
        tags = []
        if any(j.lower() in f.lower() for j in JUNK_PATTERNS):
            tags.append("🗑️ JUNK")
        elif any(h.lower() in f.lower() for h in HIGH_VALUE):
            tags.append("⭐ HIGH VALUE")
        elif rel.startswith(".agents/skills/"):
            tags.append("✅ ACTIVE SKILL")
        elif rel.startswith("entities/") or rel.startswith("functions/"):
            tags.append("✅ SYSTEM")
        elif rel.startswith("incoming_files/"):
            tags.append("📥 INCOMING")
        elif size < 100:
            tags.append("⚠️ TINY/EMPTY")
        else:
            tags.append("📁 KEEP")

        all_files.append({
            "file": f,
            "path": rel,
            "size": size,
            "cat": cat,
            "tags": tags
        })

# Summary
total = len(all_files)
junk = [f for f in all_files if "🗑️ JUNK" in f["tags"]]
high = [f for f in all_files if "⭐ HIGH VALUE" in f["tags"]]
skills = [f for f in all_files if "✅ ACTIVE SKILL" in f["tags"]]
incoming = [f for f in all_files if "📥 INCOMING" in f["tags"]]

print(f"📊 TOTAL FILES SCANNED: {total}")
print(f"⭐ High Value:          {len(high)}")
print(f"✅ Active Skills:       {len(skills)}")
print(f"📥 Incoming/Uploads:   {len(incoming)}")
print(f"🗑️  Flagged as Junk:    {len(junk)}")
print(f"💾 Total size:          {sum(f['size'] for f in all_files) / 1024:.1f} KB")
print("")

print("─── 🗑️  JUNK — SAFE TO DELETE ───")
for f in junk:
    print(f"  {f['path']} ({f['size']} bytes)")

print("")
print("─── ⭐ HIGH VALUE — KEEP + PROMOTE ───")
for f in high:
    print(f"  {f['path']}")

print("")
print("─── 📥 INCOMING — NEEDS REVIEW ───")
for f in incoming:
    print(f"  {f['file']} [{f['cat']}]")

print("")
print("─── 📁 PROPOSED CLEAN STRUCTURE ───")
print("  xksh808/")
print("  ├── agents/        ← netlify-brain agents + telegram bot")
print("  ├── frameworks/    ← 808-FRAMEWORK.md + docs")
print("  ├── workflows/     ← n8n JSON workflows")
print("  ├── ui/            ← HTML/JSX pages")
print("  ├── scripts/       ← utility scripts")
print("  └── archive/       ← void-headless + old builds")
print("")
print("  .agents/skills/    ← Active skills (already clean)")
print("  entities/          ← DB schemas (system — don't touch)")

PYEOF
  echo ""
  echo "────────────────────────────────────"
  echo "Run 'organize' to move files into clean structure."
  echo "Run 'clean' to delete junk files."
}

# ─── ORGANIZE ───────────────────────────────────────────────────
organize() {
  echo "📁 ORGANIZING WORKSPACE..."
  echo "────────────────────────────────────"

  # Create clean structure
  mkdir -p /app/xksh808/agents
  mkdir -p /app/xksh808/frameworks
  mkdir -p /app/xksh808/workflows
  mkdir -p /app/xksh808/ui
  mkdir -p /app/xksh808/scripts
  mkdir -p /app/xksh808/archive
  mkdir -p /app/xksh808/incoming

  # Move netlify-brain agents
  echo "→ Moving agents..."
  cp /app/netlify-brain/agents/*.js /app/xksh808/agents/ 2>/dev/null && echo "  ✅ Netlify agents moved"
  cp /app/netlify-brain/agents/*.md /app/xksh808/agents/ 2>/dev/null
  cp /app/netlify-brain/agents/*.json /app/xksh808/agents/ 2>/dev/null
  cp /app/netlify-brain/lib/*.js /app/xksh808/agents/ 2>/dev/null

  # Move frameworks
  echo "→ Moving frameworks..."
  cp /app/incoming_files/69d419a36e1e12f63188ba3c/3231b1abb_808-FRAMEWORK.md /app/xksh808/frameworks/808-FRAMEWORK.md 2>/dev/null && echo "  ✅ 808-FRAMEWORK.md"

  # Move n8n workflows
  echo "→ Moving workflows..."
  cp /app/incoming_files/69d419a36e1e12f63188ba3c/263baa438_agentic-telegram-bot-with-dall-e-image-generation.json /app/xksh808/workflows/telegram-dalle-bot.json 2>/dev/null && echo "  ✅ Telegram DALL-E bot workflow"
  cp /app/incoming_files/69d419a36e1e12f63188ba3c/ae9fe670e_advanced-ai-agent-system-with-think-act-reasoning-using-openrouter.json /app/xksh808/workflows/ai-think-mode.json 2>/dev/null && echo "  ✅ AI Think Mode workflow"
  cp /app/incoming_files/69d419a36e1e12f63188ba3c/0411c1ae1_AgenticAIBlogContentPipelineforGhostCMSusingGPTandClaude_n8nworkflow. /app/xksh808/workflows/ghost-blog-pipeline.json 2>/dev/null && echo "  ✅ Ghost blog pipeline workflow"

  # Move UI pages
  echo "→ Moving UI files..."
  cp /app/incoming_files/69d419a36e1e12f63188ba3c/ef96549ac_808-lead-machine-1.html /app/xksh808/ui/808-lead-machine.html 2>/dev/null && echo "  ✅ 808 Lead Machine UI"
  cp /app/incoming_files/69d419a36e1e12f63188ba3c/b2150f988_808-revenue-leak-scanner-1jsx.txt /app/xksh808/ui/808-revenue-leak-scanner.jsx 2>/dev/null && echo "  ✅ Revenue Leak Scanner JSX"
  cp /app/pages/*.jsx /app/xksh808/ui/ 2>/dev/null
  cp /app/pages/*.html /app/xksh808/ui/ 2>/dev/null

  # Move scripts
  echo "→ Moving scripts..."
  cp /app/incoming_files/69d419a36e1e12f63188ba3c/9deb30595_808-tg-bot.js /app/xksh808/scripts/808-tg-bot.js 2>/dev/null && echo "  ✅ 808 TG Bot script"

  # Archive void-headless
  echo "→ Archiving old builds..."
  cp -r /app/void-headless /app/xksh808/archive/void-headless 2>/dev/null && echo "  ✅ void-headless archived"

  echo ""
  echo "✅ ORGANIZE COMPLETE"
  echo "Clean structure created at: /app/xksh808/"
  echo "────────────────────────────────────"
}

# ─── CLEAN (delete junk) ─────────────────────────────────────────
clean() {
  echo "🗑️  CLEANING JUNK FILES..."
  echo "────────────────────────────────────"

  DELETED=0

  delete_if_exists() {
    if [ -f "$1" ]; then
      rm "$1"
      echo "  🗑️  Deleted: $(basename $1)"
      DELETED=$((DELETED + 1))
    fi
  }

  # Confirmed junk
  delete_if_exists "/app/incoming_files/scoumet_data/creation.log"
  delete_if_exists "/app/incoming_files/scoumet_data2/creation.log"
  delete_if_exists "/app/incoming_files/scoumet_data/localstore.json"
  delete_if_exists "/app/incoming_files/scoumet_data2/localstore.json"
  delete_if_exists "/app/void-headless/.env.example"
  delete_if_exists "/app/incoming_files/69d419a36e1e12f63188ba3c/86840fe33_AIToolsDirectory-dealsbe.com"
  delete_if_exists "/app/incoming_files/f0265cdf7_whatsapp_image_1447061516895156.jpg"
  delete_if_exists "/app/void-headless-build.zip"
  delete_if_exists "/app/void-headless-environments.zip"

  echo ""
  echo "✅ $DELETED junk files deleted"
  echo "────────────────────────────────────"
}

# ─── REPORT ─────────────────────────────────────────────────────
report() {
  echo "📊 FULL FILE INVENTORY"
  echo "────────────────────────────────────"
  find /app/xksh808 -type f 2>/dev/null | while read f; do
    size=$(du -sh "$f" 2>/dev/null | cut -f1)
    echo "  [$size] $(basename $f)"
  done
  echo ""
  echo "🗂️  Active Skills:"
  ls /app/.agents/skills/ 2>/dev/null | while read s; do
    echo "  ✅ $s"
  done
  echo "────────────────────────────────────"
}

# ─── MAIN ───────────────────────────────────────────────────────
print_header

case "$CMD" in
  organize) organize ;;
  clean)    clean ;;
  report)   report ;;
  audit|*)  audit ;;
esac

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  KKOS FILE SYSTEM — XKSH808                     ║"
echo "╚══════════════════════════════════════════════════╝"
