/**
 * watch-assets.js
 * ----------------
 * Watches the assets/dashboards/ folder for new or removed images.
 * Automatically regenerates assets/manifest.json so the portfolio
 * renders the dashboard gallery dynamically without any manual HTML edits.
 *
 * Usage:  node scripts/watch-assets.js
 */

const fs = require('fs');
const path = require('path');

const DASHBOARDS_DIR = path.join(__dirname, '..', 'assets', 'dashboards');
const MANIFEST_PATH  = path.join(__dirname, '..', 'assets', 'manifest.json');
const IMAGE_EXTS     = new Set(['.jpg', '.jpeg', '.png', '.webp', '.gif', '.avif']);

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Convert a filename into a readable title.
 *  e.g.  "sales_performance_2024.png" → "Sales Performance 2024"
 */
function toTitle(filename) {
  return path.basename(filename, path.extname(filename))
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, c => c.toUpperCase());
}

/** Read the existing manifest so we can preserve any metadata the user edited. */
function readExistingManifest() {
  try {
    const raw = fs.readFileSync(MANIFEST_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return { dashboards: [] };
  }
}

// ── Core: rebuild manifest ────────────────────────────────────────────────────

function rebuildManifest() {
  // List all image files currently in the dashboards folder
  let files = [];
  try {
    files = fs.readdirSync(DASHBOARDS_DIR).filter(f => {
      return IMAGE_EXTS.has(path.extname(f).toLowerCase());
    });
  } catch (err) {
    console.error('❌  Could not read dashboards folder:', err.message);
    return;
  }

  const existing = readExistingManifest();

  // Build a lookup map from existing entries so we preserve user-edited metadata
  const existingMap = {};
  (existing.dashboards || []).forEach(d => { existingMap[d.filename] = d; });

  // Build updated entries — preserve existing metadata, add defaults for new files
  const dashboards = files.map((filename, index) => {
    if (existingMap[filename]) {
      // Preserve everything the user may have already customised
      return existingMap[filename];
    }
    // Brand-new file: generate sensible defaults
    return {
      filename,
      title:       toTitle(filename),
      description: 'Replace this with a description of what this dashboard shows.',
      tool:        'Power BI',
      tags:        ['Power BI', 'DAX', 'Data Modeling'],
      link:        ''          // optional: URL to live dashboard or GitHub
    };
  });

  const manifest = { dashboards };
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(manifest, null, 2), 'utf8');

  console.log(`✅  manifest.json updated — ${dashboards.length} dashboard(s) found:`);
  dashboards.forEach(d => console.log(`    • ${d.filename}  →  "${d.title}"`));
}

// ── Watcher ───────────────────────────────────────────────────────────────────

// Ensure the dashboards directory exists
if (!fs.existsSync(DASHBOARDS_DIR)) {
  fs.mkdirSync(DASHBOARDS_DIR, { recursive: true });
  console.log('📁  Created assets/dashboards/ folder.');
}

// Run once immediately on startup
console.log('🚀  Asset watcher started. Drop images into assets/dashboards/\n');
rebuildManifest();

// Watch for changes
let debounceTimer = null;
fs.watch(DASHBOARDS_DIR, { persistent: true }, (eventType, filename) => {
  if (!filename) return;
  const ext = path.extname(filename).toLowerCase();
  if (!IMAGE_EXTS.has(ext)) return;   // ignore non-image files

  // Debounce: wait 300 ms after the last event before rebuilding
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    console.log(`\n🔔  Change detected: [${eventType}] ${filename}`);
    rebuildManifest();
  }, 300);
});

console.log(`👀  Watching: ${DASHBOARDS_DIR}`);
console.log('    Press Ctrl+C to stop.\n');
