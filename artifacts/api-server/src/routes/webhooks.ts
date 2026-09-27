import { createHmac, timingSafeEqual } from "node:crypto";
import type { IncomingMessage, ServerResponse } from "node:http";
import { Router, type IRouter, type Request } from "express";

type WebhookRequest = Request & { rawWebhookBody?: Buffer };
const router: IRouter = Router();

// GitHub signs the original bytes, not JSON serialized again after parsing.
export function captureGitHubWebhookBody(req: IncomingMessage, _res: ServerResponse, body: Buffer): void {
  if (req.url?.split("?")[0] === "/api/webhooks/github") {
    (req as IncomingMessage & { rawWebhookBody?: Buffer }).rawWebhookBody = Buffer.from(body);
  }
}

function hasValidGitHubSignature(body: Buffer | undefined, signature: string | undefined, secret: string): boolean {
  if (!body || !signature || !/^sha256=[a-f0-9]{64}$/.test(signature)) return false;
  const expected = Buffer.from("sha256=" + createHmac("sha256", secret).update(body).digest("hex"));
  const received = Buffer.from(signature);
  return received.length === expected.length && timingSafeEqual(received, expected);
}

router.post("/webhooks/github", (req, res): void => {
  const secret = process.env.GITHUB_WEBHOOK_SECRET;
  const repo = process.env.GITHUB_REPO;
  if (!secret?.trim() || !repo?.trim()) {
    res.status(503).json({ error: "GitHub webhook is not configured." }); return;
  }
  if (!hasValidGitHubSignature((req as WebhookRequest).rawWebhookBody, req.get("x-hub-signature-256"), secret)) {
    res.status(401).json({ error: "Invalid GitHub signature." }); return;
  }
  if (req.body?.repository?.full_name !== repo.trim()) {
    res.status(403).json({ error: "GitHub repository does not match." }); return;
  }
  const event = req.get("x-github-event");
  if (!event) { res.status(400).json({ error: "Missing GitHub event." }); return; }

  const delivery = req.get("x-github-delivery");
  req.log.info({
    event,
    ...(delivery && /^[0-9a-f-]{10,80}$/i.test(delivery) ? { delivery } : {}),
  }, "Verified GitHub webhook received");

  if (event === "ping") {
    res.json({ accepted: true, event: "ping" }); return;
  }
  // Do not let a repository-wide event mutate account-scoped projects without
  // an explicit, authenticated mapping from a PR to its owning room.
  res.status(202).json({ accepted: true, processed: false });
});

export default router;