// Local HTTP contract checks only: these do not prove provider-to-production delivery.
import assert from "node:assert/strict";
import { test } from "node:test";
import { createHmac } from "node:crypto";
import { build } from "esbuild";
import express from "express";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const secret = "test-only-webhook-signing-key";
const repo = "example/approved-repo";
process.env.GITHUB_WEBHOOK_SECRET = secret;
process.env.GITHUB_REPO = repo;

const temp = await mkdtemp(path.join(tmpdir(), "github-webhook-tests-"));
const outfile = path.join(temp, "webhooks.mjs");
let server;
try {
  await build({
    entryPoints: [new URL("../src/routes/webhooks.ts", import.meta.url).pathname],
    outfile, bundle: true, platform: "node", format: "esm",
    plugins: [{ name: "resolve-express", setup(b) {
      b.onResolve({ filter: /^express$/ }, () => ({
        path: import.meta.resolve("express").replace("file://", ""),
        external: true,
      }));
    } }],
  });
  const { default: router, captureGitHubWebhookBody } = await import(pathToFileURL(outfile));
  const app = express();
  app.use(express.json({ verify: captureGitHubWebhookBody }));
  app.use((req, _res, next) => {
    req.log = { info() {} };
    next();
  });
  app.use("/api", router);
  server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/webhooks/github`;

  function signed(body) {
    return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
  }
  async function send(body, { signature = signed(body), event = "ping" } = {}) {
    return fetch(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(signature ? { "x-hub-signature-256": signature } : {}),
        ...(event ? { "x-github-event": event } : {}),
        "x-github-delivery": "11111111-2222-3333-4444-555555555555",
      },
      body,
    });
  }

  await test("rejects unsigned, incorrect and malformed signatures", async () => {
    const body = JSON.stringify({ repository: { full_name: repo } });
    for (const signature of ["", signed(body + " "), "sha256=invalid", "sha1=abc"]) {
      assert.equal((await send(body, { signature })).status, 401);
    }
  });
  await test("checks the configured repository after signature verification", async () => {
    const body = JSON.stringify({ repository: { full_name: "other/repo" } });
    assert.equal((await send(body)).status, 403);
  });
  await test("requires an event and accepts a signed ping over HTTP", async () => {
    const body = '{ "repository": { "full_name": "example/approved-repo" } }';
    assert.equal((await send(body, { event: "" })).status, 400);
    const response = await send(body);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { accepted: true, event: "ping" });
    assert.equal((await send(body, { signature: signed(JSON.stringify(JSON.parse(body))) })).status, 401,
      "signature must match original bytes, not reserialized JSON");
  });
  await test("acknowledges other signed events without processing room data", async () => {
    const body = JSON.stringify({ repository: { full_name: repo }, pull_request: { number: 17 } });
    const response = await send(body, { event: "pull_request" });
    assert.equal(response.status, 202);
    assert.deepEqual(await response.json(), { accepted: true, processed: false });
  });
  await test("fails closed when the webhook is not configured", async () => {
    delete process.env.GITHUB_WEBHOOK_SECRET;
    const body = JSON.stringify({ repository: { full_name: repo } });
    assert.equal((await send(body)).status, 503);
  });
} finally {
  if (server) {
    server.closeAllConnections();
    await new Promise(resolve => server.close(resolve));
  }
  await rm(temp, { recursive: true, force: true });
}