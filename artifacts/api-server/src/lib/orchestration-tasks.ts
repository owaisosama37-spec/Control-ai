import { mongoose } from "./mongo";
import { activity } from "./projects";

export type ManualTaskStatus = "draft" | "plan_proposed" | "plan_approved" | "rejected" | "paused";

const schema = new mongoose.Schema({
  task_id: { type: String, required: true, unique: true },
  owner_id: { type: String, required: true, index: true },
  project_id: { type: String, required: true },
  title: { type: String, required: true },
  requirement: { type: String, required: true },
  status: { type: String, enum: ["draft", "plan_proposed", "plan_approved", "rejected", "paused"], default: "draft" },
  plan: { type: String, default: "" },
  plan_source: { type: String, enum: ["manual"], default: "manual" },
  approved_by: { type: String, default: null },
  approved_at: { type: Date, default: null },
  paused_from: { type: String, default: null },
  rejection_reason: { type: String, default: "" },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  room_events: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { collection: "room_orchestration_tasks" });
schema.index({ owner_id: 1, updated_at: -1 });
export const OrchestrationTaskModel = mongoose.models.RoomOrchestrationTask ||
  mongoose.model("RoomOrchestrationTask", schema);

export function serializeTask(task: any, includeHistory = false) {
  return {
    id: task.task_id,
    project_id: task.project_id,
    title: task.title,
    requirement: task.requirement,
    status: task.status as ManualTaskStatus,
    plan: task.plan ?? "",
    plan_source: "manual" as const,
    created_at: new Date(task.created_at).toISOString(),
    updated_at: new Date(task.updated_at).toISOString(),
    approved_by: task.approved_by ?? null,
    approved_at: task.approved_at ? new Date(task.approved_at).toISOString() : null,
    paused_from: task.paused_from ?? null,
    rejection_reason: task.rejection_reason ?? "",
    ...(includeHistory ? { history: (task.room_events ?? []).map(activity) } : {}),
  };
}