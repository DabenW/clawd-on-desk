#!/usr/bin/env node
// CatPaw on Desk — CLI launcher
// Usage: npx catpaw-on-desk  OR  catpaw  (after npm install -g)
//
// Requires either:
//   - `electron` npm package installed (auto-found via require.resolve)
//   - ELECTRON_PATH env var pointing to the electron binary

const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const appDir = path.resolve(__dirname, "..");

function findElectron() {
  if (process.env.ELECTRON_PATH) return process.env.ELECTRON_PATH;

  // Try require.resolve("electron") — works when electron is a dependency
  try {
    // electron's main export is the path to the binary
    return require("electron");
  } catch {}

  // Fallback: look for electron binary next to node_modules/.bin/electron
  const bin = path.join(appDir, "node_modules", ".bin", "electron");
  if (fs.existsSync(bin)) return bin;

  return null;
}

const electronBin = findElectron();
if (!electronBin) {
  console.error(
    "catpaw: electron not found.\n" +
    "  Install it locally: npm install electron --save-optional\n" +
    "  Or set ELECTRON_PATH=/path/to/electron"
  );
  process.exit(1);
}

// Clear ELECTRON_RUN_AS_NODE so Electron starts in app mode (same as launch.js)
const env = Object.assign({}, process.env);
delete env.ELECTRON_RUN_AS_NODE;

const child = spawn(electronBin, [appDir], {
  env,
  stdio: "ignore",
  detached: true,
});
child.unref();
