import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";

const setup = resolve(process.cwd(), "scripts/setup-lan.cjs");
function settings(dir: string) {
  return Object.fromEntries(
    readFileSync(join(dir, ".env.local"), "utf8")
      .split(/\r?\n/)
      .filter((line) => /^[A-Z][A-Z0-9_]*=/.test(line))
      .map((line) => {
        const pos = line.indexOf("=");
        return [line.slice(0, pos), line.slice(pos + 1)];
      }),
  );
}

test("LAN setup migrates the user's working ZIP configuration without leaking secrets", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinflix-lan-"));
  try {
    writeFileSync(join(dir, ".env.example"), "CINEPLEX_PLAYBACK_AUTHORIZED=false\nPINFLIX_MEDIA_PROXY_ENABLED=false\n");
    writeFileSync(join(dir, ".env.local"),
      "CINEPLEX_PLAYBACK_AUTHORIZED=true\nPINFLIX_DOWNLOADS_AUTHORIZED=true\nPINFLIX_MATURE_ENABLED=true\n");
    const result = execFileSync(process.execPath, [setup], { cwd: dir, encoding: "utf8" });
    const parsed = settings(dir);
    assert.equal(parsed.CINEPLEX_PLAYBACK_AUTHORIZED, "true");
    assert.equal(parsed.PINFLIX_MEDIA_PROXY_ENABLED, "true");
    assert.equal(parsed.PINFLIX_DOWNLOADS_AUTHORIZED, "true");
    assert.equal(parsed.PINFLIX_MATURE_ENABLED, "true");
    assert.match(parsed.MEDIA_PROXY_SECRET, /^[a-f0-9]{64}$/);
    assert.ok(!result.includes(parsed.MEDIA_PROXY_SECRET), "secret must not appear in console output");
    execFileSync(process.execPath, [setup], { cwd: dir });
    assert.equal(settings(dir).MEDIA_PROXY_SECRET, parsed.MEDIA_PROXY_SECRET, "rerun preserves secret");
    execFileSync(process.execPath, [setup, "--disable-playback"], { cwd: dir });
    const disabled = settings(dir);
    assert.equal(disabled.CINEPLEX_PLAYBACK_AUTHORIZED, "false");
    assert.equal(disabled.PINFLIX_MEDIA_PROXY_ENABLED, "false");
    assert.equal(disabled.PINFLIX_DOWNLOADS_AUTHORIZED, "false");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("fresh LAN setup fails closed unless explicitly enabled", () => {
  const dir = mkdtempSync(join(tmpdir(), "pinflix-lan-"));
  try {
    writeFileSync(join(dir, ".env.example"), "CINEPLEX_PLAYBACK_AUTHORIZED=false\n");
    execFileSync(process.execPath, [setup], { cwd: dir });
    assert.equal(settings(dir).CINEPLEX_PLAYBACK_AUTHORIZED, "false");
    execFileSync(process.execPath, [setup, "--enable-playback"], { cwd: dir });
    const active = settings(dir);
    assert.equal(active.CINEPLEX_PLAYBACK_AUTHORIZED, "true");
    assert.equal(active.PINFLIX_MEDIA_PROXY_ENABLED, "true");
    assert.match(active.MEDIA_PROXY_SECRET, /^[a-f0-9]{64}$/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
