// Verify the application's HMAC audit helpers without opening a database connection.
import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

process.env.SESSION_SECRET = "test-only-audit-signing-key";
globalThis.__auditTest = {
  mongoose: {
    Schema: Object.assign(class { index() {} }, { Types: { Mixed: {} } }),
    models: {},
    model: () => ({}),
  },
};

const temp = await mkdtemp(path.join(tmpdir(), "audit-signature-tests-"));
const outfile = path.join(temp, "projects.mjs");
try {
  await build({
    entryPoints: [new URL("../src/lib/projects.ts", import.meta.url).pathname],
    outfile, bundle: true, platform: "node", format: "esm",
    plugins: [{ name: "isolated-mongoose", setup(b) {
      b.onResolve({ filter: /^\.\/mongo$/ }, () => ({ path: "mongo-adapter", namespace: "adapter" }));
      b.onLoad({ filter: /.*/, namespace: "adapter" }, () => ({
        contents: "export const mongoose = globalThis.__auditTest.mongoose;",
        loader: "js",
      }));
    } }],
  });
  const { event, activity } = await import(pathToFileURL(outfile));

  await test("signed audit event verifies and preserves the event payload", () => {
    const signed = event("user_owner", "PRJ-PILOT", "Local pilot", "project_created", "Created locally.");
    const verified = activity(signed);
    assert.equal(verified.verified, true);
    assert.equal(verified.project_id, "PRJ-PILOT");
    assert.equal(verified.action, "project_created");
    assert.equal(verified.description, "Created locally.");
  });

  await test("modified payloads and signatures fail verification", () => {
    const signed = event("user_owner", "PRJ-PILOT", "Local pilot", "project_updated", "Original.");
    const changedPayload = { ...signed, payload: signed.payload.replace("Original.", "Changed.") };
    const changedSignature = { ...signed, signature: "0".repeat(64) };
    assert.equal(activity(changedPayload).verified, false);
    assert.equal(activity(changedSignature).verified, false);
  });

  await test("verification fails under a different signing key", () => {
    const signed = event("user_owner", "PRJ-PILOT", "Local pilot", "project_created", "Created locally.");
    process.env.SESSION_SECRET = "different-test-only-key";
    assert.equal(activity(signed).verified, false);
    process.env.SESSION_SECRET = "test-only-audit-signing-key";
  });

  await test("event signing fails closed when no signing key exists", () => {
    delete process.env.SESSION_SECRET;
    delete process.env.CLERK_SECRET_KEY;
    assert.throws(
      () => event("user_owner", "PRJ-PILOT", "Local pilot", "project_created", "Created locally."),
      /Signing configuration unavailable/,
    );
    process.env.SESSION_SECRET = "test-only-audit-signing-key";
  });
} finally {
  await rm(temp, { recursive: true, force: true });
  delete globalThis.__auditTest;
}