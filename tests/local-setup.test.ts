import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const setup = resolve(process.cwd(), "scripts/setup-lan.cjs");
function settings(dir: string) {
  const data = readFileSync(join(dir, ".env.local"), "utf8");
  return Object.fromEntries(
    data.split(/\r?\n/).filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => line.split(/=(.*)/s).slice(0, 2)),
  );
}

test("optional LAN helper preserves the user's working ZIP settings without a secret", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinflix-lan-"));
  try {
    writeFileSync(join(dir, ".env.local"),
      "CINEPLEX_PLAYBACK_AUTHORIZED=true\nPINFLIX_DOWNLOADS_AUTHORIZED=true\nPINFLIX_MATURE_ENABLED=true\n");
    execFileSync(process.execPath, [setup], { cwd: dir });
    const parsed = settings(dir);
    assert.equal(parsed.PINFLIX_PLAYBACK_DISABLED, "false");
    assert.equal(parsed.PINFLIX_MEDIA_PROXY_DISABLED, "false");
    assert.equal(parsed.PINFLIX_DOWNLOADS_AUTHORIZED, "true");
    assert.equal(parsed.PINFLIX_MATURE_ENABLED, "true");
    assert.equal(parsed.MEDIA_PROXY_SECRET, undefined, "manual key is not required");
    execFileSync(process.execPath, [setup, "--disable-playback"], { cwd: dir });
    const disabled = settings(dir);
    assert.equal(disabled.PINFLIX_PLAYBACK_DISABLED, "true");
    assert.equal(disabled.PINFLIX_MEDIA_PROXY_DISABLED, "true");
    assert.equal(disabled.PINFLIX_DOWNLOADS_AUTHORIZED, "false");
    execFileSync(process.execPath, [setup, "--enable-playback"], { cwd: dir });
    const enabled = settings(dir);
    assert.equal(enabled.PINFLIX_PLAYBACK_DISABLED, "false");
    assert.equal(enabled.PINFLIX_MEDIA_PROXY_DISABLED, "false");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("optional LAN helper works without a pre-existing environment file", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinflix-lan-"));
  try {
    execFileSync(process.execPath, [setup], { cwd: dir });
    const active = settings(dir);
    assert.equal(active.PINFLIX_PLAYBACK_DISABLED, "false");
    assert.equal(active.PINFLIX_MEDIA_PROXY_DISABLED, "false");
    assert.equal(active.MEDIA_PROXY_SECRET, undefined);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
