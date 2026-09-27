import { Router } from "express";
import { randomUUID } from "node:crypto";
import {
  CreateOrchestrationTaskBody, SubmitOrchestrationPlanBody,
  DecideOrchestrationPlanBody, PauseOrchestrationTaskBody,
  DraftOrchestrationArchitectureBody, ImproveOrchestrationArchitectureBody,
  ReviewOrchestrationArchitectureBody, ValidateOrchestrationImplementationBody,
} from "@workspace/api-zod";
import { allows } from "../lib/permissions";
import { ProjectModel, event } from "../lib/projects";
import { OrchestrationTaskModel, serializeTask, type ManualTaskStatus } from "../lib/orchestration-tasks";
import { isConfigured } from "../integrations/registry";
import {
  draftArchitecture, improveArchitecture, reviewArchitecture, validateImplementation,
} from "../integrations/orchestration-ai";

const router = Router();
const taskFilter = (owner: string, id: string) => ({ owner_id: owner, task_id: id });
const deny = (res: any, role: string | undefined, permission: "edit" | "delete" | "review") => {
  if (allows(role, permission)) return false;
  res.status(403).json({ error: "Your role does not permit this action." });
  return true;
};
function matchesExpectedVersion(task: any, input: { expected_status: string; expected_updated_at: string | Date }) {
  const savedAt = new Date(task.updated_at).getTime();
  const expectedAt = new Date(input.expected_updated_at).getTime();
  return task.status === input.expected_status && Number.isFinite(savedAt) && savedAt === expectedAt;
}
function providerFailure(req: any, res: any, provider: "Claude" | "Gemini", error: unknown) {
  const errorName = error instanceof Error ? error.name : "UnknownError";
  const upstreamStatus = error && typeof error === "object" && "status" in error &&
    typeof error.status === "number" ? error.status : null;
  req.log?.error({ provider, error_name: errorName, upstream_status: upstreamStatus }, "Architecture assistance request failed");
  if (upstreamStatus !== null && [429, 502, 503, 504].includes(upstreamStatus)) {
    res.setHeader("Retry-After", "30");
    res.status(503).json({ error: `${provider} is temporarily unavailable. Try again later; this request did not change the task.` });
    return;
  }
  res.status(502).json({ error: `${provider} could not complete the request. Check its integration settings and try again.` });
}

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
      approved_by: null, approved_at: null, rejection_reason: "",
      ai_architecture_review: "", ai_architecture_review_source: "none", ai_architecture_reviewed_at: null,
      ai_implementation_result: "", ai_implementation_validation: "", ai_implementation_validated_at: null,
      updated_at: new Date() },
    $push: { room_events: event(res.locals.actor, String(req.params.taskId), "Task plan", "plan_submitted_manual",
      "A person submitted a plan for the owner's approval; no Claude request was made.") },
  }, { new: true, runValidators: true });
  if (!task) { res.status(409).json({ error: "Task not found or state changed. Refresh and retry." }); return; }
  res.json(serializeTask(task));
});

router.post("/tasks/:taskId/claude-architecture", async (req, res): Promise<void> => {
  if (deny(res, res.locals.role, "edit")) return;
  const input = DraftOrchestrationArchitectureBody.strict().safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Refresh the task and provide its current state." }); return; }
  if (!["draft", "rejected"].includes(input.data.expected_status)) {
    res.status(409).json({ error: "Architecture drafts can only be created for draft or rejected tasks." }); return;
  }
  const filter = taskFilter(res.locals.owner, String(req.params.taskId));
  const current = await OrchestrationTaskModel.findOne(filter).lean();
  if (!current) { res.status(404).json({ error: "Task not found." }); return; }
  if (!matchesExpectedVersion(current, input.data)) {
    res.status(409).json({ error: "Task state changed. Refresh and retry." }); return;
  }
  if (!isConfigured("claude")) { res.status(503).json({ error: "Claude is not configured for this workspace." }); return; }
  let architecture: string;
  try {
    architecture = await draftArchitecture({ title: current.title, requirement: current.requirement });
  } catch (error) { providerFailure(req, res, "Claude", error); return; }
  const now = new Date();
  const task = await OrchestrationTaskModel.findOneAndUpdate({
    ...filter, status: current.status, updated_at: current.updated_at,
  }, {
    $set: { ai_architecture_draft: architecture, ai_architecture_updated_at: now,
      ai_architecture_review: "", ai_architecture_review_source: "none", ai_architecture_reviewed_at: null,
      ai_implementation_result: "", ai_implementation_validation: "", ai_implementation_validated_at: null,
      updated_at: now },
    $push: { room_events: event(res.locals.actor, String(req.params.taskId), `Task: ${current.title}`,
      "claude_architecture_drafted", "Claude produced a draft for human review; it was not submitted or approved.") },
  }, { new: true, runValidators: true });
  if (!task) { res.status(409).json({ error: "Task changed while the request was running. Refresh and retry." }); return; }
  res.json(serializeTask(task, true));
});

router.post("/tasks/:taskId/claude-improve", async (req, res): Promise<void> => {
  if (deny(res, res.locals.role, "edit")) return;
  const input = ImproveOrchestrationArchitectureBody.strict().safeParse(req.body);
  if (!input.success || input.data.feedback.trim().length < 3) {
    res.status(400).json({ error: "Provide feedback and the current task state." }); return;
  }
  if (!["draft", "rejected"].includes(input.data.expected_status)) {
    res.status(409).json({ error: "Only draft or rejected tasks can be improved." }); return;
  }
  const filter = taskFilter(res.locals.owner, String(req.params.taskId));
  const current = await OrchestrationTaskModel.findOne(filter).lean();
  if (!current) { res.status(404).json({ error: "Task not found." }); return; }
  if (!matchesExpectedVersion(current, input.data)) {
    res.status(409).json({ error: "Task state changed. Refresh and retry." }); return;
  }
  const base = current.ai_architecture_draft?.trim() || current.plan?.trim();
  if (!base) { res.status(409).json({ error: "Create an architecture draft or enter a plan before improving it." }); return; }
  if (!isConfigured("claude")) { res.status(503).json({ error: "Claude is not configured for this workspace." }); return; }
  let architecture: string;
  try {
    architecture = await improveArchitecture({
      title: current.title, requirement: current.requirement, currentPlan: base, feedback: input.data.feedback.trim(),
    });
  } catch (error) { providerFailure(req, res, "Claude", error); return; }
  const now = new Date();
  const task = await OrchestrationTaskModel.findOneAndUpdate({
    ...filter, status: current.status, updated_at: current.updated_at,
  }, {
    $set: { ai_architecture_draft: architecture, ai_architecture_updated_at: now,
      ai_architecture_review: "", ai_architecture_review_source: "none", ai_architecture_reviewed_at: null,
      ai_implementation_result: "", ai_implementation_validation: "", ai_implementation_validated_at: null,
      updated_at: now },
    $push: { room_events: event(res.locals.actor, String(req.params.taskId), `Task: ${current.title}`,
      "claude_architecture_improved", "Claude revised the draft from user feedback; the task state did not change.") },
  }, { new: true, runValidators: true });
  if (!task) { res.status(409).json({ error: "Task changed while the request was running. Refresh and retry." }); return; }
  res.json(serializeTask(task, true));
});

router.post("/tasks/:taskId/gemini-review", async (req, res): Promise<void> => {
  if (deny(res, res.locals.role, "review")) return;
  const input = ReviewOrchestrationArchitectureBody.strict().safeParse(req.body);
  if (!input.success) { res.status(400).json({ error: "Refresh the task and provide its current state." }); return; }
  if (!["draft", "rejected", "plan_proposed"].includes(input.data.expected_status)) {
    res.status(409).json({ error: "Architecture reviews are available before owner approval." }); return;
  }
  const filter = taskFilter(res.locals.owner, String(req.params.taskId));
  const current = await OrchestrationTaskModel.findOne(filter).lean();
  if (!current) { res.status(404).json({ error: "Task not found." }); return; }
  if (!matchesExpectedVersion(current, input.data)) {
    res.status(409).json({ error: "Task state changed. Refresh and retry." }); return;
  }
  const architecture = current.ai_architecture_draft?.trim() || current.plan?.trim();
  const source = current.ai_architecture_draft?.trim() ? "architecture_draft" : "plan";
  if (!architecture) { res.status(409).json({ error: "Create a draft or enter a plan before requesting a review." }); return; }
  if (!isConfigured("gemini")) { res.status(503).json({ error: "Gemini is not configured for this workspace." }); return; }
  let review: string;
  try {
    review = await reviewArchitecture({ title: current.title, requirement: current.requirement, architecture });
  } catch (error) { providerFailure(req, res, "Gemini", error); return; }
  const now = new Date();
  const task = await OrchestrationTaskModel.findOneAndUpdate({
    ...filter, status: current.status, updated_at: current.updated_at,
  }, {
    $set: { ai_architecture_review: review, ai_architecture_review_source: source,
      ai_architecture_reviewed_at: now, updated_at: now },
    $push: { room_events: event(res.locals.actor, String(req.params.taskId), `Task: ${current.title}`,
      "gemini_architecture_reviewed", "Gemini reviewed the saved draft or plan; owner approval remains separate.") },
  }, { new: true, runValidators: true });
  if (!task) { res.status(409).json({ error: "Task changed while the request was running. Refresh and retry." }); return; }
  res.json(serializeTask(task, true));
});

router.post("/tasks/:taskId/gemini-validation", async (req, res): Promise<void> => {
  if (deny(res, res.locals.role, "review")) return;
  const input = ValidateOrchestrationImplementationBody.strict().safeParse(req.body);
  if (!input.success || input.data.implementation_result.trim().length < 20) {
    res.status(400).json({ error: "Provide implementation notes of at least 20 characters and the current task state." }); return;
  }
  if (input.data.expected_status !== "plan_approved") {
    res.status(409).json({ error: "Implementation validation requires an owner-approved plan." }); return;
  }
  const filter = taskFilter(res.locals.owner, String(req.params.taskId));
  const current = await OrchestrationTaskModel.findOne(filter).lean();
  if (!current) { res.status(404).json({ error: "Task not found." }); return; }
  if (!matchesExpectedVersion(current, input.data)) {
    res.status(409).json({ error: "Task state changed. Refresh and retry." }); return;
  }
  if (!current.plan?.trim()) { res.status(409).json({ error: "There is no approved plan to validate against." }); return; }
  if (!isConfigured("gemini")) { res.status(503).json({ error: "Gemini is not configured for this workspace." }); return; }
  let validation: string;
  try {
    validation = await validateImplementation({
      title: current.title, requirement: current.requirement,
      approvedPlan: current.plan, implementation: input.data.implementation_result.trim(),
    });
  } catch (error) { providerFailure(req, res, "Gemini", error); return; }
  const now = new Date();
  const task = await OrchestrationTaskModel.findOneAndUpdate({
    ...filter, status: current.status, updated_at: current.updated_at,
  }, {
    $set: { ai_implementation_result: input.data.implementation_result.trim(),
      ai_implementation_validation: validation, ai_implementation_validated_at: now, updated_at: now },
    $push: { room_events: event(res.locals.actor, String(req.params.taskId), `Task: ${current.title}`,
      "gemini_implementation_validated", "Gemini compared user-provided implementation notes with the approved plan.") },
  }, { new: true, runValidators: true });
  if (!task) { res.status(409).json({ error: "Task changed while the request was running. Refresh and retry." }); return; }
  res.json(serializeTask(task, true));
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