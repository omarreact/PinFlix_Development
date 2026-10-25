#!/usr/bin/env node
"use strict";

/**
 * Repairs an old PinFlix installation copied from PinFlix_Development.zip.
 * That archive included PINFLIX_OFFLINE_CATALOGUE=true in .env.local, forcing
 * the application to ignore live CineplexBD TV and movie pages.
 * This preserves the user's unrelated credentials and configuration.
 */
const fs = require("node:fs");
const path = require("node:path");

const filename = path.join(process.cwd(), ".env.local");
if (!fs.existsSync(filename)) {
  console.log("No .env.local found. Fresh PinFlix installation already uses live CineplexBD.");
  process.exit(0);
}
const before = fs.readFileSync(filename, "utf8");
const lines = before.split(/\r?\n/);
let changed = false;
let offline = false;
const after = lines.map((line) => {
  if (!/^\s*PINFLIX_OFFLINE_CATALOGUE\s*=/.test(line)) return line;
  offline = true;
  if (/^\s*PINFLIX_OFFLINE_CATALOGUE\s*=\s*false\s*$/.test(line)) return line;
  changed = true;
  return "PINFLIX_OFFLINE_CATALOGUE=false";
});
if (!offline) {
  after.push("PINFLIX_OFFLINE_CATALOGUE=false");
  changed = true;
}
if (!changed) {
  console.log("Live CineplexBD catalogue is already enabled; no changes made.");
  process.exit(0);
}
const backup = filename + ".backup-" + new Date().toISOString().replace(/[:.]/g, "-");
fs.copyFileSync(filename, backup, fs.constants.COPYFILE_EXCL);
fs.writeFileSync(filename, after.join("\n").replace(/\n*$/, "\n"), { encoding: "utf8", mode: 0o600 });
console.log("Fixed: PINFLIX_OFFLINE_CATALOGUE=false");
console.log("Backup saved beside .env.local (ignored by Git).");
console.log("All unrelated environment variables, credentials and preferences were preserved.");
console.log("Restart npm run dev or npm start to load the new value.");
