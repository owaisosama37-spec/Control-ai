import { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  CreateOrchestrationTaskBody, SubmitOrchestrationPlanBody,
  DecideOrchestrationPlanBody, PauseOrchestrationTaskBody,
} from "@workspace/api-zod";
import { allows } from "../lib/permissions";
import { ProjectModel, event } from "../lib/projects";
import { OrchestrationTaskModel, serializeTask, type ManualTaskStatus } from "../lib/orchestration-tasks";

const router = Router();
const taskFilter = (owner: string, id: string) => ({ owner_id: owner, task_id: id });
const deny = (res: any, role: string | undefined, permission: "edit" | "delete") => {
  if (allows(role, permission)) return false;
  res.status(403).json({ error: "Your role does not permit this action." });
  return true;
};

router.get("/tasks", async (_req, res): Promise<void> => {
  const tasks = await OrchestrationTaskModel.find({ owner_id: res.locals.owner })
    .select("-room_events").sort({ updated_at: -1 }).limit(100).lean();
  res.json(tasks.map(task => serializeTask(task)));
});

router.post("/tasks", async (req, res): Promise<void> => {
  if (deny(res, res.locals.role, "edit")) return;
  const input = CreateOrchestrationTaskBody.strict().safeParse(req.body);
  if (!input.success || input.data.title.trim().length < 3 || input.data.requirement.trim().length < 10) {
    res.status(400).json({ error: "Provide an existing project, a title, and a requirement." }); return;
  }
  const { project_id } = input.data;
  const project = await ProjectModel.findOne({ owner_id: res.locals.owner, project_id, deleted_at: null })
    .select("project_id").lean();
  if (!project) { res.status(404).json({ error: "Project not found in this room." }); return; }
  const title = input.data.title.trim();
  const task = await OrchestrationTaskModel.create({
    task_id: randomUUID(), owner_id: res.locals.owner, project_id,
    title, requirement: input.data.requirement.trim(),
    room_events: [event(res.locals.actor, project_id, `Task: ${title}`, "task_created_manual", "Manual task created in Draft.")],
  });
  res.status(201).json(serializeTask(task));
});

router.get("/tasks/:taskId", async (req, res): Promise<void> => {
  const task = await OrchestrationTaskModel.findOne(taskFilter(res.locals.owner, String(req.params.taskId))).lean();
  if (!task) { res.status(404).json({ error: "Task not found." }); return; }
  res.json(serializeTask(task, true));
});

router.put("/tasks/:taskId/plan", async (req, res): Promise<void> => {
  if (deny(res, res.locals.role, "edit")) return;
  const input = SubmitOrchestrationPlanBody.strict().safeParse(req.body);
  if (!input.success || input.data.plan.trim().length < 20) {
    res.status(400).json({ error: "A manual plan of at least 20 characters and the expected state are required." }); return;
  }
  const task = await OrchestrationTaskModel.findOneAndUpdate({
    ...taskFilter(res.locals.owner, String(req.params.taskId)), status: input.data.expected_status,
  }, {
    $set: { plan: input.data.plan.trim(), plan_source: "manual", status: "plan_proposed",
      approved_by: null, approved_at: null, rejection_reason: "", updated_at: new Date() },
    $push: { room_events: event(res.locals.actor, String(req.params.taskId), "Task plan", "plan_submitted_manual",
      "A person submitted a plan for the owner's approval; no Claude request was made.") },
  }, { new: true, runValidators: true });
  if (!task) { res.status(409).json({ error: "Task not found or state changed. Refresh and retry." }); return; }
  res.json(serializeTask(task));
});

router.put("/tasks/:taskId/decision", async (req, res): Promise<void> => {
  if (deny(res, res.locals.role, "delete")) return;
  const input = DecideOrchestrationPlanBody.strict().safeParse(req.body);
  if (!input.success || (input.data.decision === "reject" && !input.data.reason?.trim())) {
    res.status(400).json({ error: "Choose approve or reject; rejection requires a reason." }); return;
  }
  const approved = input.data.decision === "approve";
  const task = await OrchestrationTaskModel.findOneAndUpdate({
    ...taskFilter(res.locals.owner, String(req.params.taskId)), status: "plan_proposed",
  }, {
    $set: { status: approved ? "plan_approved" : "rejected", updated_at: new Date(),
      approved_by: approved ? res.locals.actor : null, approved_at: approved ? new Date() : null,
      rejection_reason: approved ? "" : input.data.reason!.trim() },
    $push: { room_events: event(res.locals.actor, String(req.params.taskId), "Task plan",
      approved ? "plan_approved_manual" : "plan_rejected_manual",
      approved ? "Owner approved plan; autonomous execution remains disabled." : `Owner rejected plan: ${input.data.reason!.trim()}`) },
  }, { new: true, runValidators: true });
  if (!task) { res.status(409).json({ error: "Task not found or state changed. Refresh and retry." }); return; }
  res.json(serializeTask(task));
});

router.put("/tasks/:taskId/pause", async (req, res): Promise<void> => {
  if (deny(res, res.locals.role, "delete")) return;
  const input = PauseOrchestrationTaskBody.strict().safeParse(req.body);
  if (!input.success || input.data.reason.trim().length < 3) {
    res.status(400).json({ error: "A reason of at least 3 characters is required." }); return;
  }
  const filter = taskFilter(res.locals.owner, String(req.params.taskId));
  const prior = await OrchestrationTaskModel.findOne(filter).select("status").lean();
  if (!prior || !["draft", "plan_proposed", "plan_approved"].includes(prior.status)) {
    res.status(409).json({ error: "Task not found or cannot be paused in its current state." }); return;
  }
  const task = await OrchestrationTaskModel.findOneAndUpdate({ ...filter, status: prior.status }, {
    $set: { status: "paused", paused_from: prior.status, updated_at: new Date() },
    $push: { room_events: event(res.locals.actor, String(req.params.taskId), "Task plan", "task_paused_manual", input.data.reason.trim()) },
  }, { new: true, runValidators: true });
  if (!task) { res.status(409).json({ error: "Task changed. Refresh and retry." }); return; }
  res.json(serializeTask(task));
});

router.put("/tasks/:taskId/resume", async (req, res): Promise<void> => {
  if (deny(res, res.locals.role, "delete")) return;
  const filter = taskFilter(res.locals.owner, String(req.params.taskId));
  const prior = await OrchestrationTaskModel.findOne({ ...filter, status: "paused" }).select("paused_from").lean();
  if (!prior || !["draft", "plan_proposed", "plan_approved"].includes(prior.paused_from)) {
    res.status(409).json({ error: "Task not found or cannot be resumed." }); return;
  }
  const task = await OrchestrationTaskModel.findOneAndUpdate({
    ...filter, status: "paused", paused_from: prior.paused_from,
  }, {
    $set: { status: prior.paused_from, paused_from: null, updated_at: new Date() },
    $push: { room_events: event(res.locals.actor, String(req.params.taskId), "Task plan", "task_resumed_manual",
      "Owner resumed manual task tracking; no worker was started.") },
  }, { new: true, runValidators: true });
  if (!task) { res.status(409).json({ error: "Task changed. Refresh and retry." }); return; }
  res.json(serializeTask(task));
});

export default router;