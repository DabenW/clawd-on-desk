#!/usr/bin/env node
// Merge CatPaw CatPaw IDE hooks into all known global settings/hooks.json locations
// (append-only, idempotent). Supports two install modes:
//
//  1. VS Code extension mode:
//     macOS:   ~/Library/Application Support/CatPaw/User/globalStorage/mt-idekit.mt-idekit-code/settings/hooks.json
//     Windows: %APPDATA%\CatPaw\User\globalStorage\mt-idekit.mt-idekit-code\settings\hooks.json
//     Linux:   ~/.config/CatPaw/User/globalStorage/mt-idekit.mt-idekit-code/settings/hooks.json
//
//  2. JetBrains plugin mode:
//     All platforms: ~/.sankuai/idekit/config/settings/hooks.json

const fs   = require("fs");
const path = require("path");
const os   = require("os");
const { resolveNodeBin } = require("./server-config");

const MARKER = "catpaw-hook.js";

// afterAgentResponse intentionally excluded: fires per-message, not on final stop.
// Auto-start logic is embedded inside catpaw-hook.js itself (triggered on beforeSubmitPrompt).
const CATPAW_HOOK_EVENTS = [
  "beforeSubmitPrompt",
  "beforeShellExecution",
  "afterShellExecution",
  "beforeMCPExecution",
  "afterMCPExecution",
  "beforeReadFile",
  "afterFileEdit",
  "stop",
  "afterAgentThought",
];

// VS Code extension mode path
function getCatPawVSCodeHooksPath() {
  const mid = path.join(
    "CatPaw", "User", "globalStorage",
    "mt-idekit.mt-idekit-code", "settings", "hooks.json"
  );
  switch (process.platform) {
    case "win32":
      return path.join(process.env.APPDATA || path.join(os.homedir(), "AppData", "Roaming"), mid);
    case "linux":
      return path.join(os.homedir(), ".config", mid);
    default: // macOS
      return path.join(os.homedir(), "Library", "Application Support", mid);
  }
}

// JetBrains plugin mode path (same on all platforms)
function getCatPawJetBrainsHooksPath() {
  return path.join(os.homedir(), ".sankuai", "idekit", "config", "settings", "hooks.json");
}

function writeJsonAtomic(filePath, data) {
  const dir = path.dirname(filePath);
  const tmpPath = path.join(dir, `.hooks.${process.pid}.${Date.now()}.tmp`);
  fs.mkdirSync(dir, { recursive: true });
  try {
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    try { fs.unlinkSync(tmpPath); } catch {}
    throw err;
  }
}

/**
 * Sync a single command entry in a hook array. Returns { found, changed }.
 */
function syncCommand(arr, marker, desiredCommand) {
  for (const entry of arr) {
    if (!entry || typeof entry !== "object" || typeof entry.command !== "string") continue;
    if (!entry.command.includes(marker)) continue;
    if (entry.command !== desiredCommand) {
      entry.command = desiredCommand;
      return { found: true, changed: true };
    }
    return { found: true, changed: false };
  }
  return { found: false, changed: false };
}

/**
 * Register CatPaw hooks into a single hooks.json file.
 * Auto-start is handled inside catpaw-hook.js itself, so only one command per event.
 * @param {string}  hooksPath
 * @param {string}  desiredCommand  - catpaw-hook.js command
 * @param {boolean} skipIfMissing   - if true, skip when the parent dir doesn't exist
 * @param {boolean} silent
 * @returns {{ added: number, skipped: number, updated: number } | null}  null = skipped
 */
function registerIntoFile(hooksPath, desiredCommand, skipIfMissing, silent) {
  if (skipIfMissing) {
    const settingsDir = path.dirname(hooksPath);
    let exists = false;
    try { exists = fs.statSync(settingsDir).isDirectory(); } catch {}
    if (!exists) {
      if (!silent) console.log(`  [skip] dir not found: ${settingsDir}`);
      return null;
    }
  }

  let settings = {};
  try {
    settings = JSON.parse(fs.readFileSync(hooksPath, "utf-8"));
  } catch (err) {
    if (err.code !== "ENOENT") {
      throw new Error(`Failed to read ${hooksPath}: ${err.message}`);
    }
  }

  if (!settings.hooks || typeof settings.hooks !== "object") settings.hooks = {};

  let added   = 0;
  let skipped = 0;
  let updated = 0;
  let changed = false;

  for (const event of CATPAW_HOOK_EVENTS) {
    if (!Array.isArray(settings.hooks[event])) {
      settings.hooks[event] = [];
      changed = true;
    }

    const arr = settings.hooks[event];
    const sync = syncCommand(arr, MARKER, desiredCommand);
    if (sync.found) {
      if (sync.changed) { updated++; changed = true; }
      else              { skipped++; }
    } else {
      arr.push({ command: desiredCommand });
      added++;
      changed = true;
    }
  }

  if (added > 0 || changed) {
    writeJsonAtomic(hooksPath, settings);
  }

  return { added, skipped, updated };
}

/**
 * Register CatPaw hooks into all detected CatPaw hooks.json locations.
 * @param {object}  [options]
 * @param {boolean} [options.silent]
 * @param {string}  [options.hooksPath]   override — registers only this single path
 * @param {string}  [options.nodeBin]     override node binary path
 * @returns {{ added: number, skipped: number, updated: number }}
 */
function registerCatPawHooks(options = {}) {
  // Global config MUST use absolute paths (per CatPaw docs)
  let hookScript = path.resolve(__dirname, "catpaw-hook.js").replace(/\\/g, "/");
  hookScript = hookScript.replace("app.asar/", "app.asar.unpacked/");

  const nodeBin = options.nodeBin || resolveNodeBin();
  const desiredCommand = `"${nodeBin}" "${hookScript}"`;

  // Single-path override (used by tests or manual calls)
  if (options.hooksPath) {
    const result = registerIntoFile(options.hooksPath, desiredCommand, false, options.silent);
    if (!options.silent) {
      console.log(`CatPaw hooks → ${options.hooksPath}`);
      console.log(`  Added: ${result.added}, updated: ${result.updated}, skipped: ${result.skipped}`);
    }
    return result;
  }

  // Auto-detect and register into all present locations
  const targets = [
    { label: "VS Code extension", path: getCatPawVSCodeHooksPath() },
    { label: "JetBrains plugin",  path: getCatPawJetBrainsHooksPath() },
  ];

  const totals = { added: 0, skipped: 0, updated: 0 };
  let anyFound = false;

  for (const target of targets) {
    const result = registerIntoFile(target.path, desiredCommand, true, options.silent);
    if (result === null) continue;  // dir not found, skipped
    anyFound = true;
    totals.added   += result.added;
    totals.skipped += result.skipped;
    totals.updated += result.updated;
    if (!options.silent) {
      console.log(`CatPaw hooks [${target.label}] → ${target.path}`);
      console.log(`  Added: ${result.added}, updated: ${result.updated}, skipped: ${result.skipped}`);
    }
  }

  if (!anyFound && !options.silent) {
    console.log("CatPaw not detected (no known settings dir found) — skipping hook registration.");
    console.log("  Checked:");
    for (const t of targets) console.log(`    ${t.path}`);
  }

  return totals;
}

const CATPAW_PREFS_PATH = path.join(os.homedir(), ".catpaw", "prefs.json");

function readCatPawPrefs() {
  try {
    const raw = JSON.parse(fs.readFileSync(CATPAW_PREFS_PATH, "utf8"));
    return raw && typeof raw === "object" ? raw : null;
  } catch {
    return null;
  }
}

/**
 * Write the autoStartWithCatPaw flag to ~/.catpaw/prefs.json so catpaw-hook.js
 * can read it at hook-invocation time without needing IPC to the Electron app.
 */
function writeCatPawAutoStartPref(enabled) {
  const dir = path.dirname(CATPAW_PREFS_PATH);
  fs.mkdirSync(dir, { recursive: true });
  const existing = readCatPawPrefs() || {};
  existing.autoStartWithCatPaw = !!enabled;
  fs.writeFileSync(CATPAW_PREFS_PATH, JSON.stringify(existing, null, 2), "utf8");
}

module.exports = {
  registerCatPawHooks,
  CATPAW_HOOK_EVENTS,
  getCatPawVSCodeHooksPath,
  getCatPawJetBrainsHooksPath,
  readCatPawPrefs,
  writeCatPawAutoStartPref,
  CATPAW_PREFS_PATH,
};

if (require.main === module) {
  try {
    registerCatPawHooks({});
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}
