// CatPaw IDE — hooks via ~/.catpaw/hooks.json or global settings/hooks.json
// Event names are camelCase (CatPaw hook spec); catpaw-hook.js normalizes to PascalCase for the state machine.

module.exports = {
  id: "catpaw-ide",
  name: "CatPaw IDE",
  processNames: {
    win: ["CatPaw.exe"],
    mac: ["CatPaw"],
    linux: ["catpaw"],
  },
  nodeCommandPatterns: [],
  eventSource: "hook",
  eventMap: {
    beforeSubmitPrompt: "thinking",
    beforeShellExecution: "working",
    afterShellExecution: "working",
    beforeMCPExecution: "working",
    afterMCPExecution: "working",
    beforeReadFile: "working",
    afterFileEdit: "working",
    stop: "attention",
    afterAgentThought: "thinking",
  },
  capabilities: {
    httpHook: false,
    permissionApproval: false,
    sessionEnd: false,
    subagent: false,
  },
  hookConfig: {
    configFormat: "catpaw-hooks-json",
  },
  stdinFormat: "catpawHookJson",
};
