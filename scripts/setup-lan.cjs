#!/usr/bin/env node
"use strict";

// Optional compatibility helper. A fresh installation needs NO setup and no
// MEDIA_PROXY_SECRET: Next.js generates a private media key automatically.
const fs = require("node:fs");
const path = require("node:path");
const filename = path.join(process.cwd(), ".env.local");
const args = new Set(process.argv.slice(2));
if (args.has("--disable-playback") && args.has("--enable-playback")) {
  console.error("Choose only one playback option.");
  process.exit(2);
}
const enabled = !args.has("--disable-playback");
const existing = fs.existsSync(filename) ? fs.readFileSync(filename, "utf8") : "";
const changes = new Map([
  ["PINFLIX_PLAYBACK_DISABLED", enabled ? "false" : "true"],
  ["PINFLIX_MEDIA_PROXY_DISABLED", enabled ? "false" : "true"],
]);
const seen = new Set();
const lines = existing.split(/\r?\n/).map((line) => {
  const match = line.match(/^(\s*)([A-Z][A-Z0-9_]*)(\s*=).*/);
  if (!match || !changes.has(match[2])) return line;
  seen.add(match[2]);
  return match[1] + match[2] + match[3] + changes.get(match[2]);
});
for (const [key, value] of changes) {
  if (!seen.has(key)) lines.push(key + "=" + value);
}
if (!enabled) {
  const index = lines.findIndex((line) => /^PINFLIX_DOWNLOADS_AUTHORIZED\s*=/.test(line));
  if (index >= 0) lines[index] = "PINFLIX_DOWNLOADS_AUTHORIZED=false";
}
fs.writeFileSync(filename, lines.join("\n").replace(/\n*$/, "\n"), { encoding: "utf8", mode: 0o600 });
console.log("PinFlix local playback:", enabled ? "enabled" : "disabled");
console.log("No secret, account, or manual setup is required for standard CineplexBD playback.");
console.log("Restart npm run dev or npm start to apply changes.");
