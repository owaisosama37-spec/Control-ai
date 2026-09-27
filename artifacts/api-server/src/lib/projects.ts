import { randomUUID, createHmac, timingSafeEqual } from "node:crypto";
import { mongoose } from "./mongo";

// Preserve the uploaded project's field names and collection. Existing records
// without an owner_id are deliberately not claimed by new sign-ups.
const schema = new mongoose.Schema({
  project_id: { type: String, required: true, unique: true },
  owner_id: { type: String, required: true, index: true },
  name: { type: String, required: true },
  description: { type: String, default: "" },
  client_name: { type: String, default: "" },
  budget: { type: Number, default: 0 },
  actual_cost: { type: Number, default: 0 },
  priority: { type: Number, min: 1, max: 10, default: 5 },
  project_type: { type: String, default: "other" },
  status: { type: String, default: "draft" },
  rejection_reason: { type: String, default: "" },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now },
  deleted_at: { type: Date, default: null },
  room_events: { type: [mongoose.Schema.Types.Mixed], default: [] },
}, { collection: "projects" });
schema.index({ owner_id: 1, deleted_at: 1, priority: -1 });
export const ProjectModel = mongoose.models.RoomProject || mongoose.model("RoomProject", schema);

export function serializeProject(p: any) {
  return {
    project_id: p.project_id, name: p.name, description: p.description ?? "",
    client_name: p.client_name ?? "", budget: p.budget ?? 0, actual_cost: p.actual_cost ?? 0,
    priority: p.priority ?? 5, project_type: p.project_type ?? "other", status: p.status,
    created_at: new Date(p.created_at).toISOString(), updated_at: new Date(p.updated_at).toISOString(),
    rejection_reason: p.rejection_reason ?? "",
  };
}

function sign(payload: string) {
  const key = process.env.SESSION_SECRET || process.env.CLERK_SECRET_KEY;
  if (!key) throw new Error("Signing configuration unavailable");
  return createHmac("sha256", key).update("starfruit-audit-v1:" + payload).digest("hex");
}

export function event(owner: string, id: string, name: string, action: string, description: string) {
  const record = {
    id: randomUUID(), owner, project_id: id, project_name: name,
    action, description, created_at: new Date().toISOString(),
  };
  const payload = JSON.stringify(record);
  return { ...record, payload, signature: sign(payload) };
}

export function activity(e: any) {
  const expected = Buffer.from(sign(e.payload));
  const actual = Buffer.from(e.signature ?? "");
  const verified = actual.length === expected.length && timingSafeEqual(actual, expected);
  const record = JSON.parse(e.payload);
  return {
    id: record.id, actor_id: record.owner, project_id: record.project_id, project_name: record.project_name,
    action: record.action, description: record.description, created_at: record.created_at, verified,
  };
}

export const transitions: Record<string, string[]> = {
  draft: ["approved_plan", "rejected"],
  approved_plan: ["awaiting_review"],
  awaiting_review: ["merged", "rejected"],
  merged: ["paused"],
  paused: ["merged"],
  rejected: ["draft"],
};