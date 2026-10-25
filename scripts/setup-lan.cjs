#!/usr/bin/env node
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { randomBytes } = require("node:crypto");

const file = path.join(process.cwd(), ".env.local");
const example = path.join(process.cwd(), ".env.example");
const args = new Set(process.argv.slice(2));
if (args.has("--enable-playback") && args.has("--disable-playback")) {
  console.error("Choose either --enable-playback or --disable-playback.");
  process.exit(2);
}
if (!fs.existsSync(example)) {
  console.error("Run this command inside the PinFlix project root.");
  process.exit(2);
}
const existing = fs.existsSync(file)
  ? fs.readFileSync(file, "utf8")
  : fs.readFileSync(example, "utf8");
const entries = new Map();
for (const line of existing.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z][A-Z0-9_]*)\s*=\s*(.*)$/);
  if (match) entries.set(match[1], match[2].trim().replace(/^["']|["']$/g, ""));
}
const approved = args.has("--disable-playback")
  ? false
  : args.has("--enable-playback") || entries.get("CINEPLEX_PLAYBACK_AUTHORIZED") === "true";
const updates = new Map([
  ["CINEPLEX_REQUEST_TIMEOUT_MS", entries.get("CINEPLEX_REQUEST_TIMEOUT_MS") || "8000"],
  ["CINEPLEX_PLAYBACK_AUTHORIZED", approved ? "true" : "false"],
  ["PINFLIX_MEDIA_PROXY_ENABLED", approved ? "true" : "false"],
]);
if (approved && (!entries.get("MEDIA_PROXY_SECRET") || entries.get("MEDIA_PROXY_SECRET").length < 32)) {
  updates.set("MEDIA_PROXY_SECRET", randomBytes(32).toString("hex"));
}
if (args.has("--disable-playback")) updates.set("PINFLIX_DOWNLOADS_AUTHORIZED", "false");

const seen = new Set();
let output = existing.split(/\r?\n/).map((line) => {
  const m = line.match(/^(\s*)([A-Z][A-Z0-9_]*)(\s*=).*/);
  if (!m || !updates.has(m[2])) return line;
  seen.add(m[2]);
  return m[1] + m[2] + m[3] + updates.get(m[2]);
});
for (const [key, value] of updates) {
  if (!seen.has(key)) output.push(key + "=" + value);
}
fs.writeFileSync(file, output.join("\n").replace(/\n*$/, "\n"), {
  encoding: "utf8",
  mode: 0o600,
});
console.log("Local PinFlix configuration updated: .env.local");
console.log("CineplexBD playback:", approved ? "enabled (explicit local setting)" : "disabled");
console.log("Secure media proxy:", approved ? "enabled" : "disabled");
console.log("No signing secret is printed. Existing download and mature-content preferences are preserved.");
console.log("Restart npm run dev to apply changes.");
if (approved) console.log("Use only streams you are authorized to access and embed.");
