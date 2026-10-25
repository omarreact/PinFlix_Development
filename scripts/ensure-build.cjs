#!/usr/bin/env node
"use strict";

// npm start works on a fresh clone without a manual npm run build.
// After a successful build, restarts reuse Next.js's existing build.
const { existsSync } = require("node:fs");
const { join } = require("node:path");
const { spawnSync } = require("node:child_process");

if (existsSync(join(process.cwd(), ".next", "BUILD_ID"))) {
  console.log("Using existing Next.js production build.");
  process.exit(0);
}
console.log("First start: building PinFlix automatically...");
const nextBin = require.resolve("next/dist/bin/next");
const result = spawnSync(process.execPath, [nextBin, "build"], {
  cwd: process.cwd(),
  env: process.env,
  stdio: "inherit",
});
if (result.error) {
  console.error("Cannot build PinFlix:", result.error.message);
  process.exit(1);
}
process.exit(result.status ?? 1);
