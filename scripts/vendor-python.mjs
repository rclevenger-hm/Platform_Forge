import { mkdir, copyFile, readdir } from "node:fs/promises";
// Ship the runtime with both Pages and Docker; no third-party CDN is needed at runtime.
await mkdir("public/pyodide", { recursive: true });
for (const file of await readdir("node_modules/pyodide"))
  if (/\.(m?js|wasm|zip|json)$/.test(file))
    await copyFile(`node_modules/pyodide/${file}`, `public/pyodide/${file}`);
