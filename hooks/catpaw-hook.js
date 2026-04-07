#!/usr/bin/env node
// CatPaw — CatPaw IDE hook (stdin JSON, hook_event_name; stdout JSON for before/stop hooks)
// Registered in global settings/hooks.json by hooks/catpaw-install.js
// Or project-level at <workspace>/.catpaw/hooks.json (use relative path)
//
// Also handles auto-start: if CatPaw is not running when beforeSubmitPrompt fires,
// it launches the app in the background before posting the state update.

const { postStateToRunningServer, readHostPrefix, discoverCatPawPort } = require("./server-config");

const HOOK_TO_STATE = {
  beforeSubmitPrompt:  { state: "thinking", event: "UserPromptSubmit" },
  beforeShellExecution:{ state: "working",  event: "PreToolUse" },
  afterShellExecution: { state: "working",  event: "PostToolUse" },
  beforeMCPExecution:  { state: "working",  event: "PreToolUse" },
  afterMCPExecution:   { state: "working",  event: "PostToolUse" },
  beforeReadFile:      { state: "working",  event: "PreToolUse" },
  afterFileEdit:       { state: "working",  event: "PostToolUse" },
  afterAgentThought:   { state: "thinking", event: "AfterAgentThought" },
  // afterAgentResponse intentionally omitted: fires per-message, not on final stop.
  // Only `stop` triggers the attention/done state.
  // stop is handled specially below (error → StopFailure, else → attention/Stop)
};

// Hooks that require a JSON response on stdout
const BEFORE_HOOKS = new Set([
  "beforeShellExecution",
  "beforeMCPExecution",
  "beforeReadFile",
  "beforeSubmitPrompt",
]);

const TERMINAL_NAMES_MAC   = new Set(["terminal","iterm2","alacritty","wezterm-gui","kitty","hyper","tabby","warp","ghostty"]);
const TERMINAL_NAMES_WIN   = new Set(["windowsterminal.exe","cmd.exe","powershell.exe","pwsh.exe","alacritty.exe","wezterm-gui.exe"]);
const TERMINAL_NAMES_LINUX = new Set(["gnome-terminal","kgx","konsole","xfce4-terminal","alacritty","wezterm-gui","kitty","xterm","tabby"]);
const SYSTEM_BOUNDARY_MAC   = new Set(["launchd","init"]);
const SYSTEM_BOUNDARY_WIN   = new Set(["explorer.exe","services.exe","winlogon.exe"]);
const SYSTEM_BOUNDARY_LINUX = new Set(["systemd","init"]);

let _stablePid = null;

function getStablePid() {
  if (_stablePid) return _stablePid;
  const { execSync } = require("child_process");
  const isWin = process.platform === "win32";
  const terminalNames  = isWin ? TERMINAL_NAMES_WIN  : (process.platform === "linux" ? TERMINAL_NAMES_LINUX  : TERMINAL_NAMES_MAC);
  const systemBoundary = isWin ? SYSTEM_BOUNDARY_WIN : (process.platform === "linux" ? SYSTEM_BOUNDARY_LINUX : SYSTEM_BOUNDARY_MAC);
  let pid = process.ppid;
  let lastGoodPid = pid;
  let terminalPid = null;
  for (let i = 0; i < 8; i++) {
    let name, parentPid;
    try {
      if (isWin) {
        const out = execSync(
          `wmic process where "ProcessId=${pid}" get Name,ParentProcessId /format:csv`,
          { encoding: "utf8", timeout: 1500, windowsHide: true }
        );
        const lines = out.trim().split("\n").filter(l => l.includes(","));
        if (!lines.length) break;
        const parts = lines[lines.length - 1].split(",");
        name = (parts[1] || "").trim().toLowerCase();
        parentPid = parseInt(parts[2], 10);
      } else {
        const cp = require("child_process");
        const ppidOut = cp.execSync(`ps -o ppid= -p ${pid}`, { encoding: "utf8", timeout: 1000 }).trim();
        const commOut = cp.execSync(`ps -o comm= -p ${pid}`, { encoding: "utf8", timeout: 1000 }).trim();
        name = require("path").basename(commOut).toLowerCase();
        parentPid = parseInt(ppidOut, 10);
      }
    } catch { break; }
    if (systemBoundary.has(name)) break;
    if (terminalNames.has(name)) terminalPid = pid;
    lastGoodPid = pid;
    if (!parentPid || parentPid === pid || parentPid <= 1) break;
    pid = parentPid;
  }
  _stablePid = terminalPid || lastGoodPid;
  return _stablePid;
}

/** Maps hook name to display_svg hint for better animation granularity */
function displaySvgFromHook(hookName) {
  if (hookName === "beforeShellExecution" || hookName === "afterShellExecution") return "catpaw-working-building.svg";
  if (hookName === "beforeMCPExecution"   || hookName === "afterMCPExecution")   return "catpaw-working-juggling.svg";
  if (hookName === "beforeReadFile")  return "catpaw-idle-reading.svg";
  if (hookName === "afterFileEdit")   return "catpaw-working-typing.svg";
  return undefined;
}

/** What to write to stdout so CatPaw allows the action to proceed */
function stdoutForHook(hookName) {
  if (BEFORE_HOOKS.has(hookName)) return JSON.stringify({ continue: true });
  if (hookName === "stop") return JSON.stringify({});  // no followup_message = stop for real
  return "";
}

function resolveStateAndEvent(payload, hookName) {
  if (!hookName) return null;
  if (hookName === "stop") {
    const st = payload && payload.status;
    if (st === "error") return { state: "error", event: "StopFailure" };
    return { state: "attention", event: "Stop" };
  }
  return HOOK_TO_STATE[hookName] || null;
}

/** Launch CatPaw in background if not already running (called on beforeSubmitPrompt).
 *  After launching, polls until the HTTP server is up (up to 8s) before calling cb,
 *  so the first state update isn't lost to a race condition. */
function maybeAutoStart(cb) {
  discoverCatPawPort({ timeoutMs: 300 }, (port) => {
    if (port) { cb(); return; }

    const { spawn } = require("child_process");
    const path = require("path");
    const isPackaged = __dirname.includes("app.asar");
    const isWin = process.platform === "win32";
    const isMac = process.platform === "darwin";

    try {
      if (isPackaged) {
        if (isWin) {
          const exe = path.join(path.resolve(__dirname, "..", "..", ".."), "CatPaw on Desk.exe");
          spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
        } else if (isMac) {
          const appBundle = path.resolve(__dirname, "..", "..", "..", "..");
          spawn("open", ["-a", appBundle], { detached: true, stdio: "ignore" }).unref();
        } else {
          const appImage = process.env.APPIMAGE;
          const exe = appImage || path.join(path.resolve(__dirname, "..", "..", ".."), "catpaw-on-desk");
          spawn(exe, [], { detached: true, stdio: "ignore" }).unref();
        }
      } else {
        const projectDir = path.resolve(__dirname, "..");
        const npm = isWin ? "npm.cmd" : "npm";
        spawn(npm, ["start"], { cwd: projectDir, detached: true, stdio: "ignore" }).unref();
      }
    } catch (err) {
      process.stderr.write(`catpaw auto-start: ${err.message}\n`);
      cb();
      return;
    }

    // Poll until the server comes up, then fire cb so doPost() reaches a live server.
    // Give up after ~8s and call cb anyway (state update will silently fail, but hook exits clean).
    const POLL_INTERVAL_MS = 500;
    const MAX_ATTEMPTS = 16; // 16 × 500ms = 8s
    let attempts = 0;
    function poll() {
      discoverCatPawPort({ timeoutMs: 400 }, (p) => {
        if (p) { cb(); return; }
        attempts++;
        if (attempts >= MAX_ATTEMPTS) { cb(); return; }
        setTimeout(poll, POLL_INTERVAL_MS);
      });
    }
    setTimeout(poll, POLL_INTERVAL_MS);
  });
}

function runWithPayload(payload) {
  const hookName = (payload && payload.hook_event_name) || (process.argv[2] || "");
  const mapped   = resolveStateAndEvent(payload, hookName);
  const outLine  = stdoutForHook(hookName);

  if (!mapped) {
    if (outLine) process.stdout.write(outLine + "\n");
    process.exit(0);
    return;
  }

  const buildBody = () => {
    const { state, event } = mapped;
    const sessionId = (payload && payload.conversation_id) || "default";

    let cwd = (payload && payload.cwd) || "";
    if (!cwd && payload && Array.isArray(payload.workspace_roots) && payload.workspace_roots[0]) {
      cwd = payload.workspace_roots[0];
    }

    const body = { state, session_id: sessionId, event, agent_id: "catpaw-ide" };
    const hint = displaySvgFromHook(hookName);
    if (hint !== undefined) body.display_svg = hint;
    if (cwd) body.cwd = cwd;
    if (process.env.CATPAW_REMOTE) {
      body.host = readHostPrefix();
    } else {
      body.source_pid = getStablePid();
    }
    return JSON.stringify(body);
  };

  // Auto-start CatPaw on the first user prompt if not running — only when enabled in prefs.
  // For before-hooks: immediately return stdout to unblock CatPaw, then post state
  // asynchronously once the server is up (detached so the hook process can exit).
  if (hookName === "beforeSubmitPrompt") {
    if (outLine) process.stdout.write(outLine + "\n");
    const bodyStr = buildBody();
    const autoStartEnabled = (() => {
      try {
        const { readCatPawPrefs } = require("./catpaw-install.js");
        const prefs = readCatPawPrefs();
        return prefs && prefs.autoStartWithCatPaw === true;
      } catch { return false; }
    })();
    if (autoStartEnabled) {
      maybeAutoStart(() => {
        postStateToRunningServer(bodyStr, { timeoutMs: 100 }, () => process.exit(0));
      });
    } else {
      postStateToRunningServer(bodyStr, { timeoutMs: 100 }, () => process.exit(0));
    }
  } else {
    postStateToRunningServer(buildBody(), { timeoutMs: 100 }, () => {
      if (outLine) process.stdout.write(outLine + "\n");
      process.exit(0);
    });
  }
}

let _ran = false;
let _stdinTimer = null;

function finishOnce(payload) {
  if (_ran) return;
  _ran = true;
  if (_stdinTimer) clearTimeout(_stdinTimer);
  runWithPayload(payload || {});
}

const chunks = [];
process.stdin.on("data", (c) => chunks.push(c));
process.stdin.on("end", () => {
  let payload = {};
  try {
    const raw = Buffer.concat(chunks).toString();
    if (raw.trim()) payload = JSON.parse(raw);
  } catch { payload = {}; }
  finishOnce(payload);
});

_stdinTimer = setTimeout(() => finishOnce({}), 400);
