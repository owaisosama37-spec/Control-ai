import { Router } from "express";
import { getAuth, clerkClient } from "@clerk/express";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { CreateProjectBody, UpdateProjectBody, TransitionProjectBody, SaveMemberBody } from "@workspace/api-zod";
import { connectMongo, mongoose } from "../lib/mongo";
import { getClerkMode, getRuntimeEnvironment } from "../lib/config";
import { ProjectModel, serializeProject, event, activity, transitions } from "../lib/projects";
import { OrchestrationTaskModel } from "../lib/orchestration-tasks";
import orchestrationRouter from "./orchestration";
import { Membership } from "../lib/teams";
import { RoomControl } from "../lib/room-control";
import { allows, roomFilter } from "../lib/permissions";
import { isConfigured } from "../integrations/registry";

const router = Router();

const configuredIntegrationSchema = z.object({ configured: z.boolean() });
const systemStatusSchema = z.object({
  database: z.enum(["connected", "unavailable"]),
  dbName: z.string(),
  environment: z.enum(["development", "production", "test"]),
  authentication: z.literal("Clerk"),
  clerkMode: z.enum(["development", "production"]),
  integrations: z.object({
    claude: configuredIntegrationSchema,
    gemini: configuredIntegrationSchema,
    github: configuredIntegrationSchema,
    slack: configuredIntegrationSchema,
    email: configuredIntegrationSchema,
  }),
  orchestration: z.string(),
});

router.get("/system/status", (_req, res) => {
  const status = {
    database: mongoose.connection.readyState === 1 ? "connected" : "unavailable",
    dbName: process.env.MONGODB_DB_NAME?.trim() || "test",
    environment: getRuntimeEnvironment(),
    authentication: "Clerk",
    clerkMode: getClerkMode(),
    integrations: {
      claude: { configured: isConfigured("claude") },
      gemini: { configured: isConfigured("gemini") },
      github: { configured: isConfigured("github") },
      slack: { configured: isConfigured("slack") },
      email: { configured: isConfigured("email") },
    },
    orchestration: "Manual workflow tracking. Autonomous agent execution is not enabled.",
  };
  res.json(systemStatusSchema.parse(status));
});

router.use((req, res, next) => {
  const userId = getAuth(req).userId;
  if (!userId) { res.status(401).json({ error: "Sign in to access your control room." }); return; }
  res.locals.owner = userId;
  res.locals.actor = userId;
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

router.get("/rooms", async (_req, res) => {
  const memberships = await Membership.find({ user_id: res.locals.actor }).lean();
  res.json([{ owner_id: res.locals.actor, role: "owner" },
    ...memberships.map(m => ({ owner_id: m.owner_id, role: m.role }))]);
});

router.use(async (req, res, next) => {
  const owner = req.get("x-room-owner") || res.locals.actor;
  if (!/^user_[a-zA-Z0-9]+$/.test(owner)) {
    res.status(400).json({ error: "Invalid room identifier." }); return;
  }
  const role = owner === res.locals.actor ? "owner" :
    (await Membership.findOne({ owner_id: owner, user_id: res.locals.actor }).lean())?.role;
  if (!allows(role, "read")) { res.status(403).json({ error: "You do not have access to this room." }); return; }
  res.locals.owner = owner;
  res.locals.role = role;
  res.locals.scope = roomFilter(owner);
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const permission = req.path === "/emergency-stop" || req.path === "/emergency-resume" ||
      (req.path.endsWith("/status") && req.body?.status === "merged" && req.body?.expected_status === "awaiting_review") ? "delete" :
      req.path.startsWith("/members") ? "members" :
      req.method === "DELETE" ? "delete" :
      req.path.endsWith("/status") && req.body?.status !== "awaiting_review" && req.body?.status !== "draft" ? "review" : "edit";
    if (!allows(role, permission)) {
      res.status(403).json({ error: "Your role does not permit this action." }); return;
    }
    if (req.path !== "/emergency-stop" && req.path !== "/emergency-resume") {
      const control = await RoomControl.findOne({ owner_id: owner }).select("stopped_at").lean();
      if (control?.stopped_at) {
        res.status(423).json({ error: "Emergency stop is active. Only the room owner can resume changes." }); return;
      }
    }
  }
  next();
});

router.get("/operations", async (_req, res) => {
  const control = await RoomControl.findOne({ owner_id: res.locals.owner }).select("stopped_at").lean();
  res.json({ stopped: Boolean(control?.stopped_at), stopped_at: control?.stopped_at?.toISOString() ?? null,
    autonomous_execution: false });
});

router.use("/orchestration", orchestrationRouter);

router.post("/emergency-stop", async (_req, res) => {
  await RoomControl.init();
  const now = new Date();
  const control = await RoomControl.findOneAndUpdate(
    { owner_id: res.locals.owner, stopped_at: null },
    { $set: { stopped_at: now, stopped_by: res.locals.actor },
      $push: { room_events: event(res.locals.actor, "OPS", "Room controls", "emergency_stopped", "Emergency stop activated.") } },
    { new: true, upsert: true, runValidators: true },
  ).catch((error: unknown) => {
    if ((error as { code?: number }).code === 11000) return null;
    throw error;
  });
  if (!control) { res.status(409).json({ error: "Emergency stop is already active." }); return; }
  res.json({ stopped: true, stopped_at: control.stopped_at.toISOString(), autonomous_execution: false });
});

router.post("/emergency-resume", async (_req, res) => {
  const control = await RoomControl.findOneAndUpdate(
    { owner_id: res.locals.owner, stopped_at: { $ne: null } },
    { $set: { stopped_at: null, stopped_by: null },
      $push: { room_events: event(res.locals.actor, "OPS", "Room controls", "emergency_resumed", "Emergency stop cleared by room owner.") } },
    { new: true },
  );
  if (!control) { res.status(409).json({ error: "The room is not stopped." }); return; }
  res.json({ stopped: false, stopped_at: null, autonomous_execution: false });
});

router.get("/members", async (_req, res) => {
  const members = await Membership.find({ owner_id: res.locals.owner }).lean();
  res.json([{ user_id: res.locals.owner, role: "owner" },
    ...members.map(m => ({ user_id: m.user_id, role: m.role }))]);
});

const memberInput = SaveMemberBody.strict();
router.put("/members", async (req, res) => {
  const parsed = memberInput.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: "Provide a Clerk user ID and a valid member role." }); return; }
  const { user_id, role } = parsed.data;
  if (user_id === res.locals.owner) { res.status(400).json({ error: "The room owner cannot be changed." }); return; }
  try { await clerkClient.users.getUser(user_id); }
  catch (error: any) {
    res.status(error.status === 404 ? 400 : 503).json({ error: error.status === 404 ? "This account does not exist. Ask the member to sign up first." : "Unable to verify the account. Retry later." }); return;
  }
  await Membership.init();
  await RoomControl.init();
  try {
    await mongoose.connection.transaction(async session => {
      const filter = { owner_id: res.locals.owner, user_id };
      const previous = await Membership.findOne(filter).session(session).lean();
      if (previous?.role === role) return;
      await Membership.findOneAndUpdate(filter, { $set: { role } },
        { upsert: true, runValidators: true, session });
      await RoomControl.findOneAndUpdate({ owner_id: res.locals.owner, stopped_at: null },
        { $push: { room_events: event(res.locals.actor, "TEAM", "Room members", previous ? "member_role_changed" : "member_granted",
          `${user_id}: ${previous?.role ?? "none"} → ${role}`) } },
        { upsert: true, runValidators: true, session });
    });
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 11000) {
      const control = await RoomControl.findOne({ owner_id: res.locals.owner }).select("stopped_at").lean();
      res.status(control?.stopped_at ? 423 : 409).json({ error: control?.stopped_at
        ? "Emergency stop is active. Only the room owner can resume changes."
        : "A concurrent membership change occurred. Retry the request." }); return;
    }
    throw error;
  }
  res.json({ user_id, role });
});

router.delete("/members/:userId", async (req, res) => {
  const userId = String(req.params.userId);
  if (userId === res.locals.owner) {
    res.status(400).json({ error: "The room owner cannot be removed." }); return;
  }
  if (!/^user_[a-zA-Z0-9]+$/.test(userId)) {
    res.status(400).json({ error: "Invalid member identifier." }); return;
  }
  await RoomControl.init();
  try {
    await mongoose.connection.transaction(async session => {
      const previous = await Membership.findOneAndDelete({ owner_id: res.locals.owner, user_id: userId }).session(session);
      if (!previous) return;
      await RoomControl.findOneAndUpdate({ owner_id: res.locals.owner, stopped_at: null },
        { $push: { room_events: event(res.locals.actor, "TEAM", "Room members", "member_removed",
          `${userId}: ${previous.role} → none`) } },
        { upsert: true, runValidators: true, session });
    });
  } catch (error: unknown) {
    if ((error as { code?: number }).code === 11000) {
      const control = await RoomControl.findOne({ owner_id: res.locals.owner }).select("stopped_at").lean();
      res.status(control?.stopped_at ? 423 : 409).json({ error: control?.stopped_at
        ? "Emergency stop is active. Only the room owner can resume changes."
        : "A concurrent membership change occurred. Retry the request." }); return;
    }
    throw error;
  }
  res.status(204).end();
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
    room_events: [event(res.locals.actor, id, data.name, "project_created", "Project created in Draft.")],
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
      $push: { room_events: event(res.locals.actor, String(req.params.id), data.name, "project_updated", "Project details updated.") } },
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
      $push: { room_events: event(res.locals.actor, old.project_id, old.name, "status_changed",
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
      $push: { room_events: event(res.locals.actor, existing.project_id, existing.name, "project_removed", "Project removed; history retained.") } },
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
  const [projectEvents, taskEvents, controlEvents] = await Promise.all([ProjectModel.aggregate([
    { $match: { owner_id: res.locals.owner } },
    { $unwind: "$room_events" },
    { $replaceRoot: { newRoot: "$room_events" } },
    { $sort: { created_at: -1 } }, { $limit: 200 },
  ]), OrchestrationTaskModel.aggregate([
    { $match: { owner_id: res.locals.owner } },
    { $unwind: "$room_events" },
    { $replaceRoot: { newRoot: "$room_events" } },
    { $sort: { created_at: -1 } }, { $limit: 200 },
  ]), RoomControl.findOne({ owner_id: res.locals.owner }).select("room_events").lean()]);
  const events = [...projectEvents, ...taskEvents, ...(controlEvents?.room_events ?? [])]
    .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, 200);
  res.json(events.map(activity));
});

export default router;