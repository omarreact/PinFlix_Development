import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
const script = resolve(process.cwd(), "scripts/repair-local.cjs");

test("repair old PinFlix_Development ZIP offline config without touching secret variables", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinflix-repair-"));
  try {
    const original = [
      "CINEPLEX_PLAYBACK_AUTHORIZED=true",
      "PINFLIX_MEDIA_PROXY_ENABLED=true",
      "MEDIA_PROXY_SECRET=the-existing-user-secret-stays-private",
      "PINFLIX_DOWNLOADS_AUTHORIZED=true",
      "PINFLIX_MATURE_ENABLED=true",
      "PINFLIX_OFFLINE_CATALOGUE=true",
      "",
    ].join("\n");
    writeFileSync(join(dir, ".env.local"), original);
    const output = execFileSync(process.execPath, [script], { cwd: dir, encoding: "utf8" });
    const updated = readFileSync(join(dir, ".env.local"), "utf8");
    assert.ok(output.includes("Fixed: PINFLIX_OFFLINE_CATALOGUE=false"));
    assert.ok(!output.includes("the-existing-user-secret"));
    assert.ok(updated.includes("PINFLIX_OFFLINE_CATALOGUE=false"));
    assert.ok(updated.includes("MEDIA_PROXY_SECRET=the-existing-user-secret-stays-private"));
    assert.ok(updated.includes("PINFLIX_DOWNLOADS_AUTHORIZED=true"));
    assert.ok(updated.includes("PINFLIX_MATURE_ENABLED=true"));
    const backup = readdirSync(dir).find((name) => name.startsWith(".env.local.backup-"));
    assert.ok(backup);
    assert.equal(readFileSync(join(dir, backup!), "utf8"), original);
    execFileSync(process.execPath, [script], { cwd: dir });
    assert.equal(readdirSync(dir).filter((name) => name.startsWith(".env.local.backup-")).length, 1);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("repair on fresh installs requires no environment files", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinflix-repair-"));
  try {
    const output = execFileSync(process.execPath, [script], { cwd: dir, encoding: "utf8" });
    assert.ok(output.includes("Fresh PinFlix installation"));
    assert.deepEqual(readdirSync(dir), []);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
