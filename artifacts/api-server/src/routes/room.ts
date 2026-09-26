import { Router } from "express";
import { getAuth } from "@clerk/express";
import { randomUUID } from "node:crypto";
import { CreateProjectBody, UpdateProjectBody, TransitionProjectBody } from "@workspace/api-zod";
import { connectMongo, mongoose } from "../lib/mongo";
import { ProjectModel, serializeProject, event, activity, transitions } from "../lib/projects";

const router = Router();

router.get("/system/status", (_req, res) => {
  res.json({
    database: mongoose.connection.readyState === 1 ? "connected" : "unavailable",
    authentication: "Clerk",
    orchestration: "Manual workflow tracking. Autonomous agent execution is not enabled.",
    integrations: [
      { name: "GitHub", status: "not_connected", description: "Repository automation requires an authorized GitHub connection." },
      { name: "Slack", status: "not_connected", description: "Approval notifications require an authorized Slack connection." },
      { name: "Email", status: "not_connected", description: "SMTP delivery has not been configured or verified." },
    ],
  });
});

router.use((req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Sign in to access your control room." }); return; }
  res.locals.owner = userId;
  // Cookie-authenticated mutations must originate from this app.
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    if (req.get("sec-fetch-site") === "cross-site") {
      res.status(403).json({ error: "Cross-site requests are not allowed." }); return;
    }
    const origin = req.get("origin");
    const host = (req.get("x-forwarded-host") || req.get("host") || "").split(",")[0].trim();
    try {
      if (origin && new URL(origin).host !== host) {
        res.status(403).json({ error: "Request origin is not allowed." }); return;
      }
    } catch { res.status(403).json({ error: "Invalid request origin." }); return; }
  }
  connectMongo().then(() => next()).catch(() => res.status(503).json({
    error: "MongoDB is unavailable. Check your Atlas connection and network access, then retry.",
  }));
});

router.get("/projects", async (_req, res) => {
  const items = await ProjectModel.find({ owner_id: res.locals.owner, deleted_at: null })
    .select("-room_events").sort({ priority: -1, created_at: -1 }).lean();
  res.json(items.map(serializeProject));
});

router.post("/projects", async (req, res) => {
  const input = CreateProjectBody.safeParse(req.body);
  if (!input.success || !input.data.name.trim()) {
    res.status(400).json({ error: "Enter a project name and valid project details." }); return;
  }
  const id = `PRJ-${randomUUID().slice(0, 8).toUpperCase()}`;
  const data = { ...input.data, name: input.data.name.trim() };
  const p = await ProjectModel.create({
    ...data, project_id: id, owner_id: res.locals.owner,
    room_events: [event(res.locals.owner, id, data.name, "project_created", "Project created in Draft.")],
  });
  res.status(201).json(serializeProject(p));
});

router.get("/projects/:id", async (req, res) => {
  const p = await ProjectModel.findOne({ project_id: req.params.id, owner_id: res.locals.owner, deleted_at: null }).lean();
  if (!p) { res.status(404).json({ error: "Project not found." }); return; }
  res.json(serializeProject(p));
});

router.patch("/projects/:id", async (req, res) => {
  const input = UpdateProjectBody.safeParse(req.body);
  if (!input.success || !input.data.name.trim()) {
    res.status(400).json({ error: "Enter a project name and valid project details." }); return;
  }
  const data = { ...input.data, name: input.data.name.trim() };
  const p = await ProjectModel.findOneAndUpdate(
    { project_id: req.params.id, owner_id: res.locals.owner, deleted_at: null },
    { $set: { ...data, updated_at: new Date() },
      $push: { room_events: event(res.locals.owner, String(req.params.id), data.name, "project_updated", "Project details updated.") } },
    { new: true, runValidators: true },
  );
  if (!p) { res.status(404).json({ error: "Project not found." }); return; }
  res.json(serializeProject(p));
});

router.put("/projects/:id/status", async (req, res) => {
  const input = TransitionProjectBody.safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Invalid transition." }); return; }
  const { status, expected_status, reason } = input.data;
  if (!transitions[expected_status]?.includes(status)) {
    res.status(400).json({ error: "This status transition is not allowed." }); return;
  }
  if (status === "rejected" && !reason?.trim()) {
    res.status(400).json({ error: "A rejection reason is required." }); return;
  }
  const filter = { project_id: req.params.id, owner_id: res.locals.owner, deleted_at: null };
  const old = await ProjectModel.findOne(filter);
  if (!old) { res.status(404).json({ error: "Project not found." }); return; }
  const p = await ProjectModel.findOneAndUpdate(
    { ...filter, status: expected_status },
    { $set: { status, updated_at: new Date(), rejection_reason: status === "rejected" ? reason!.trim() : "" },
      $push: { room_events: event(res.locals.owner, old.project_id, old.name, "status_changed",
        `${expected_status} → ${status}${reason?.trim() ? ": " + reason.trim() : ""}`) } },
    { new: true },
  );
  if (!p) { res.status(409).json({ error: "The project has changed. Refresh before continuing." }); return; }
  res.json(serializeProject(p));
});

router.delete("/projects/:id", async (req, res) => {
  const filter = { project_id: req.params.id, owner_id: res.locals.owner, deleted_at: null };
  const existing = await ProjectModel.findOne(filter);
  if (!existing) { res.status(404).json({ error: "Project not found." }); return; }
  const p = await ProjectModel.findOneAndUpdate(
    filter,
    { $set: { deleted_at: new Date(), updated_at: new Date() },
      $push: { room_events: event(res.locals.owner, existing.project_id, existing.name, "project_removed", "Project removed; history retained.") } },
    { new: true },
  );
  if (!p) { res.status(404).json({ error: "Project not found." }); return; }
  // Soft deletion retains existing signed history.
  res.status(204).end();
});

router.get("/dashboard", async (_req, res) => {
  const [totals] = await ProjectModel.aggregate([
    { $match: { owner_id: res.locals.owner, deleted_at: null } },
    { $group: {
      _id: null, total: { $sum: 1 },
      active: { $sum: { $cond: [{ $in: ["$status", ["approved_plan", "awaiting_review"]] }, 1, 0] } },
      pending: { $sum: { $cond: [{ $in: ["$status", ["draft", "awaiting_review"]] }, 1, 0] } },
      completed: { $sum: { $cond: [{ $eq: ["$status", "merged"] }, 1, 0] } },
      budget: { $sum: "$budget" }, spent: { $sum: "$actual_cost" },
    } },
    { $project: { _id: 0 } },
  ]);
  res.json(totals || { total: 0, active: 0, pending: 0, completed: 0, budget: 0, spent: 0 });
});

router.get("/audit", async (_req, res) => {
  const events = await ProjectModel.aggregate([
    { $match: { owner_id: res.locals.owner } },
    { $unwind: "$room_events" },
    { $replaceRoot: { newRoot: "$room_events" } },
    { $sort: { created_at: -1 } }, { $limit: 200 },
  ]);
  res.json(events.map(activity));
});

export default router;