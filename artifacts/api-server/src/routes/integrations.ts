import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { getAuth } from "@clerk/express";
import {
  GetIntegrationAccessResponse, ListIntegrationsResponse, TestIntegrationParams, TestIntegrationResponse,
} from "@workspace/api-zod";
import {
  getIntegrationConfiguration, integrationAdminConfigured, integrationIds, isConfigured, isIntegrationAdmin,
} from "../integrations/registry";
import { testIntegrationConnection } from "../integrations/test-connection";

const router: IRouter = Router();

router.use("/integrations", (req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Sign in to access integrations." }); return; }
  if (req.method === "POST") {
    if (req.get("sec-fetch-site") === "cross-site") {
      res.status(403).json({ error: "Cross-site requests are not allowed." }); return;
    }
    const origin = req.get("origin");
    const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
    try {
      if (origin && new URL(origin).host !== host) {
        res.status(403).json({ error: "Request origin is not allowed." }); return;
      }
    } catch {
      res.status(403).json({ error: "Invalid request origin." }); return;
    }
  }
  res.locals.integrationUserId = userId;
  next();
});

function requireIntegrationAdmin(_req: Request, res: Response, next: NextFunction): void {
  if (!isIntegrationAdmin(res.locals.integrationUserId)) {
    res.status(403).json({ error: "Integration administrator access required." }); return;
  }
  next();
}

router.get("/integrations/access", (_req, res) => {
  res.json(GetIntegrationAccessResponse.parse({
    isAdmin: isIntegrationAdmin(res.locals.integrationUserId),
    needsSetup: !integrationAdminConfigured(),
  }));
});

router.get("/integrations", requireIntegrationAdmin, (_req, res) => {
  res.json(ListIntegrationsResponse.parse(integrationIds.map(getIntegrationConfiguration)));
});

router.post("/integrations/:id/test", requireIntegrationAdmin, async (req, res): Promise<void> => {
  const parsed = TestIntegrationParams.safeParse(req.params);
  if (!parsed.success) { res.status(400).json({ ok: false, message: "Unknown integration." }); return; }
  const { id } = parsed.data;
  // Slack's account-access probe uses the connector. It does not need the
  // separate bot/channel/signing setup required for incoming commands.
  if (id !== "slack" && !isConfigured(id)) {
    res.status(400).json({ ok: false, message: "Not connected. Add the required configuration before testing." }); return;
  }
  try {
    const result = await testIntegrationConnection(id, res.locals.integrationUserId);
    res.json(TestIntegrationResponse.parse(result));
  } catch {
    // Provider errors can include request headers or recipient data. Never return or log raw exceptions.
    res.json(TestIntegrationResponse.parse({
      ok: false, message: "Connection test failed. Check the provider credentials, permissions and availability.",
    }));
  }
});

export default router;