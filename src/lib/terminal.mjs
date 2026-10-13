const files = {
  "/home/learner/handoff.txt":
    "Relay handoff: inspect /var/log/relay.log before making changes.",
  "/var/log/relay.log":
    "worker stopped: configuration reload required\nbackup: /bin/sh: python: not found",
  "/home/learner/secret.env": "LAB_TOKEN=example-only",
  "/var/log/debug.log": "Repeated debug output (simulated 950 MB)",
  "/var/log/audit.log": "Required audit evidence: preserve this file.",
};
export function initialTerminal() {
  return {
    cwd: "/home/learner",
    files: { ...files },
    mode: "644",
    running: false,
    cleared: false,
    read: [],
    inspectedDisk: false,
  };
}
function path(v, cwd) {
  const p = v.startsWith("/") ? v : `${cwd}/${v}`;
  const parts = [];
  for (const x of p.split("/")) {
    if (!x || x === ".") continue;
    if (x === "..") parts.pop();
    else parts.push(x);
  }
  return "/" + parts.join("/");
}
export function command(state, input) {
  const s = structuredClone(state),
    bits = input.trim().split(/\s+/),
    [cmd, ...args] = bits;
  let output = "";
  const file = path(args.at(-1) || ".", s.cwd);
  if (!cmd) return { state: s, output: "" };
  if (cmd === "help")
    output =
      "Browser simulation: pwd, ls [-l] [path], cd path, cat file, chmod 600 file, df -h, du -h /var/log, truncate -s 0 file, service relay status|restart, command -v python3, whoami, clear. No commands run on your computer.";
  else if (cmd === "pwd") output = s.cwd;
  else if (cmd === "whoami") output = "learner";
  else if (cmd === "ls") {
    const folder = args.filter((x) => !x.startsWith("-"))[0];
    const base = folder ? path(folder, s.cwd) : s.cwd;
    output =
      Object.keys(s.files)
        .filter((x) => x.startsWith(base + "/") || x === base)
        .map(
          (x) =>
            `${args.includes("-l") ? (x.endsWith("secret.env") ? s.mode : "644") + " learner " : ""}${x}`,
        )
        .join("\n") || "(empty directory)";
  } else if (cmd === "cd") {
    if (["/", "/home", "/home/learner", "/var", "/var/log"].includes(file))
      s.cwd = file;
    else output = `cd: ${args[0]}: directory not found`;
  } else if (cmd === "cat") {
    if (Object.hasOwn(s.files, file)) {
      output = s.files[file];
      s.read = [...new Set([...s.read, file])];
    } else output = `cat: ${file}: file not found`;
  } else if (cmd === "chmod") {
    if (file === "/home/learner/secret.env" && /^[0-7]{3}$/.test(args[0])) {
      s.mode = args[0];
      output = `Updated permissions to ${s.mode}`;
    } else output = "This mission supports numeric permissions on secret.env.";
  } else if (cmd === "df" || cmd === "du") {
    s.inspectedDisk = true;
    output = s.cleared
      ? "Filesystem usage: 50 MB / 1 GB (5%)"
      : "Filesystem usage: 995 MB / 1 GB (99%)\n950 MB /var/log/debug.log\n45 MB /var/log/audit.log";
  } else if (cmd === "truncate" && args[0] === "-s" && args[1] === "0") {
    if (file === "/var/log/debug.log") {
      s.cleared = true;
      s.files[file] = "";
      output = "Debug log truncated; audit evidence preserved.";
    } else
      output = "Only the debug log can be truncated in this practice model.";
  } else if (cmd === "service" && args[0] === "relay") {
    if (args[1] === "restart") {
      s.running = true;
      output = "relay: running";
    } else output = `relay: ${s.running ? "running" : "stopped"}`;
  } else if (cmd === "command" && args.join(" ") === "-v python3")
    output = "/usr/bin/python3";
  else if (cmd === "clear") output = "__CLEAR__";
  else
    output = `${cmd}: not supported by this simulation. Type help for the command set. Use Docker tools for an actual shell.`;
  return { state: s, output };
}
export function terminalChecks(mission, state) {
  return (mission.checks || []).map(c => [c.label,
    c.type === "read" ? state.read.includes(c.value) :
    c.type === "state" ? state[c.key] === c.value :
    c.type === "filePresent" ? !!state.files[c.value] : false]);
}
export function configChecks(mission, code) {
  const lines = code.split("\n").map(x => x.trim()).filter(x => x && !x.startsWith("#"));
  return (mission.checks || []).map(c => [c.label,
    c.type === "line" ? lines.includes(c.value) :
    c.type === "oneOfLines" ? c.value.some(x => lines.includes(x)) :
    c.type === "lineCount" ? lines.length === c.value :
    c.type === "normalizedLine" ? lines.some(x => x.replace(/\s+/g, " ") === c.value) : false]);
}
