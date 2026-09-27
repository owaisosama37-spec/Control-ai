// Exercise the real Express router with isolated identity/persistence adapters.
// No live Clerk accounts, database records, or auth bypasses are created.
import assert from "node:assert/strict";
import { test } from "node:test";
import { build } from "esbuild";
import express from "express";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";

const memberships = [];
const records = [];
const roomControls = [];
const orchestrationTasks = [];
const aiCalls = [];
const aiFailures = new Set();
let calls = [];
const sameValue = (a, b) => a instanceof Date && b instanceof Date ? a.getTime() === b.getTime() : a === b;
const matches = (r, f) => Object.entries(f).every(([k, v]) => v === null ? r[k] == null : sameValue(r[k], v));
const query = value => ({ select() { return this; }, sort() { return this; }, limit() { return this; }, session() { return this; }, lean: async () => structuredClone(value), then: (resolve, reject) => Promise.resolve(value).then(resolve, reject) });
const Membership = {
  find: f => query(memberships.filter(r => matches(r, f))),
  findOne: f => query(memberships.find(r => matches(r, f))),
  init: async () => {},
  findOneAndUpdate: async (f, update) => {
    const m = memberships.find(r => matches(r, f));
    if (m) Object.assign(m, update.$set); else memberships.push({ ...f, ...update.$set });
  },
  findOneAndDelete: f => {
    const i = memberships.findIndex(r => matches(r, f));
    return query(i >= 0 ? memberships.splice(i, 1)[0] : null);
  },
  deleteOne: async f => { const i = memberships.findIndex(r => matches(r, f)); if (i >= 0) memberships.splice(i, 1); },
};
const ProjectModel = {
  find: f => { calls.push(f); return query(records.filter(r => matches(r, f))); },
  findOne: f => { calls.push(f); return query(records.find(r => matches(r, f))); },
  create: async data => { records.push(data); return data; },
  findOneAndUpdate: async (f, u) => {
    calls.push(f);
    const r = records.find(r => matches(r, f));
    if (!r) return null;
    Object.assign(r, u.$set);
    if (u.$push) r.room_events.push(u.$push.room_events);
    return r;
  },
  aggregate: async pipeline => { calls.push(pipeline[0].$match); return []; },
};
const OrchestrationTaskModel = {
  find: f => query(orchestrationTasks.filter(r => matches(r, f))),
  findOne: f => query(orchestrationTasks.find(r => matches(r, f))),
  create: async data => {
    const task = { status: "draft", plan: "", plan_source: "manual", approved_by: null, approved_at: null,
      ai_architecture_draft: "", ai_architecture_updated_at: null, ai_architecture_review: "",
      ai_architecture_review_source: "none", ai_architecture_reviewed_at: null,
      ai_implementation_result: "", ai_implementation_validation: "", ai_implementation_validated_at: null,
      paused_from: null, rejection_reason: "", created_at: new Date(), updated_at: new Date(), ...data };
    orchestrationTasks.push(task);
    return task;
  },
  findOneAndUpdate: async (f, update) => {
    const task = orchestrationTasks.find(r => matches(r, f));
    if (!task) return null;
    Object.assign(task, update.$set);
    task.room_events.push(update.$push.room_events);
    return task;
  },
  aggregate: async () => [],
};
const RoomControl = {
  init: async () => {},
  findOne: f => query(roomControls.find(r => r.owner_id === f.owner_id)),
  findOneAndUpdate: async (f, u, options = {}) => {
    let r = roomControls.find(r => r.owner_id === f.owner_id);
    const matching = f.stopped_at === null ? !r?.stopped_at :
      f.stopped_at?.$ne === null ? Boolean(r?.stopped_at) : true;
    if (!matching) return null;
    if (!r) {
      if (!options.upsert) return null;
      r = { owner_id: f.owner_id, room_events: [] };
      roomControls.push(r);
    }
    Object.assign(r, u.$set);
    if (u.$push) r.room_events.push(u.$push.room_events);
    return r;
  },
};
globalThis.__roomTest = {
  getAuth: req => ({ userId: req.get("test-identity") || null }),
  clerkClient: { users: { getUser: async id => {
    if (id === "user_missing") throw Object.assign(new Error(), { status: 404 });
    return { id };
  } } },
  connectMongo: async () => {}, mongoose: { connection: { readyState: 1,
    transaction: async fn => {
      const beforeMembers = structuredClone(memberships);
      const beforeControls = structuredClone(roomControls);
      try { return await fn({}); }
      catch (error) {
        memberships.splice(0, memberships.length, ...beforeMembers);
        roomControls.splice(0, roomControls.length, ...beforeControls);
        throw error;
      }
    },
  } },
  Membership, ProjectModel, RoomControl, OrchestrationTaskModel,
  serializeTask: (task, detail = false) => ({ id: task.task_id, project_id: task.project_id,
    title: task.title, requirement: task.requirement, plan: task.plan, plan_source: task.plan_source,
    status: task.status, created_at: new Date(task.created_at).toISOString(),
    updated_at: new Date(task.updated_at).toISOString(), approved_by: task.approved_by ?? null,
    approved_at: task.approved_at ? new Date(task.approved_at).toISOString() : null,
    paused_from: task.paused_from ?? null, rejection_reason: task.rejection_reason ?? "",
    ...(detail ? {
      ai_architecture_draft: task.ai_architecture_draft ?? "",
      ai_architecture_updated_at: task.ai_architecture_updated_at ? new Date(task.ai_architecture_updated_at).toISOString() : null,
      ai_architecture_review: task.ai_architecture_review ?? "",
      ai_architecture_review_source: task.ai_architecture_review_source ?? "none",
      ai_architecture_reviewed_at: task.ai_architecture_reviewed_at ? new Date(task.ai_architecture_reviewed_at).toISOString() : null,
      ai_implementation_result: task.ai_implementation_result ?? "",
      ai_implementation_validation: task.ai_implementation_validation ?? "",
      ai_implementation_validated_at: task.ai_implementation_validated_at ? new Date(task.ai_implementation_validated_at).toISOString() : null,
      history: task.room_events,
    } : {}) }),
  serializeProject: p => ({ project_id: p.project_id, name: p.name, status: p.status }),
  isConfigured: () => true,
  draftArchitecture: async input => {
    aiCalls.push({ action: "draft", input });
    if (aiFailures.has("draft")) throw new Error("provider-detail-must-not-leak");
    return "Draft architecture: separate the API contract, scoped persistence, and review UI.";
  },
  improveArchitecture: async input => {
    aiCalls.push({ action: "improve", input });
    if (aiFailures.has("improve")) throw new Error("provider-detail-must-not-leak");
    return "Improved architecture: validate inputs, persist advisory outputs, and retain human approval.";
  },
  reviewArchitecture: async input => {
    aiCalls.push({ action: "review", input });
    if (aiFailures.has("review")) throw new Error("provider-detail-must-not-leak");
    return "Review: add explicit failure handling and verify role boundaries.";
  },
  validateImplementation: async input => {
    aiCalls.push({ action: "validate", input });
    if (aiFailures.has("validate")) throw new Error("provider-detail-must-not-leak");
    return "Validation: compare the supplied notes with the approved plan; tests remain unverified.";
  },
  event: (actor, id, name, action, description) => ({ actor, project_id: id, project_name: name, action, description }), activity: e => e,
  transitions: { draft: ["approved_plan", "rejected"], approved_plan: ["awaiting_review"], awaiting_review: ["merged", "rejected"], rejected: ["draft"], merged: ["paused"], paused: ["merged"] },
  logger: { warn() {}, error() {}, info() {} },
};
const temp = await mkdtemp(path.join(tmpdir(), "room-tests-"));
const outfile = path.join(temp, "router.mjs");
await build({
  entryPoints: [new URL("../src/routes/room.ts", import.meta.url).pathname],
  outfile, bundle: true, platform: "node", format: "esm",
  plugins: [{ name: "isolated-adapters", setup(b) {
    for (const [filter, names] of [
      [/^@clerk\/express$/, ["getAuth", "clerkClient"]],
      [/\/lib\/mongo$/, ["connectMongo", "mongoose"]],
      [/\/lib\/teams$/, ["Membership"]],
      [/\/lib\/room-control$/, ["RoomControl"]],
      [/\/lib\/projects$/, ["ProjectModel", "serializeProject", "event", "activity", "transitions"]],
      [/\/lib\/orchestration-tasks$/, ["OrchestrationTaskModel", "serializeTask"]],
      [/\/integrations\/registry$/, ["isConfigured"]],
      [/\/integrations\/orchestration-ai$/, ["draftArchitecture", "improveArchitecture", "reviewArchitecture", "validateImplementation"]],
      [/^\.\/logger$/, ["logger"]],
    ]) {
      b.onResolve({ filter }, args => ({ path: names.join(","), namespace: "adapter" }));
    }
    b.onResolve({ filter: /^express$/ }, () => ({ path: import.meta.resolve("express").replace("file://", ""), external: true }));
    b.onLoad({ filter: /.*/, namespace: "adapter" }, args => ({ contents: `export const {${args.path}} = globalThis.__roomTest;`, loader: "js" }));
  } }],
});
const { default: router } = await import(pathToFileURL(outfile));
const app = express();
app.use(express.json());
app.use(router);
const server = app.listen(0, "127.0.0.1");
await new Promise(resolve => server.once("listening", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
async function request(method, url, actor, owner, body) {
  return fetch(base + url, {
    method, headers: { "content-type": "application/json", ...(actor ? { "test-identity": actor } : {}), ...(owner ? { "x-room-owner": owner } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
}
const input = { name: "Test", description: "", client_name: "", budget: 0, actual_cost: 0, priority: 5, project_type: "other" };
try {
  await test("anonymous denied; personal scopes exclude other owners and unowned legacy records", async () => {
    assert.equal((await request("GET", "/projects")).status, 401);
    records.push({ project_id: "legacy", name: "Legacy" }, { project_id: "foreign", owner_id: "user_other", name: "Foreign" });
    assert.deepEqual(await (await request("GET", "/projects", "user_owner")).json(), []);
    for (const id of ["legacy", "foreign"]) {
      assert.equal((await request("GET", `/projects/${id}`, "user_owner")).status, 404);
      assert.equal((await request("PATCH", `/projects/${id}`, "user_owner", null, input)).status, 404);
      assert.equal((await request("DELETE", `/projects/${id}`, "user_owner")).status, 404);
      assert.equal((await request("PUT", `/projects/${id}/status`, "user_owner", null, { status: "approved_plan", expected_status: "draft" })).status, 404);
    }
  });
  await test("forged room header denies every read/mutation including summaries and audit", async () => {
    for (const [method, url] of [["GET","/projects"],["GET","/projects/foreign"],["POST","/projects"],["PATCH","/projects/foreign"],["PUT","/projects/foreign/status"],["DELETE","/projects/foreign"],["GET","/dashboard"],["GET","/audit"],["GET","/members"],["PUT","/members"],["DELETE","/members/user_owner"]]) {
      assert.equal((await request(method, url, "user_stranger", "user_owner", method === "GET" ? undefined : input)).status, 403, `${method} ${url}`);
    }
  });
  await test("only owner grants known accounts and owner cannot be replaced, demoted or removed", async () => {
    for (const role of ["viewer", "editor", "reviewer"]) {
      assert.equal((await request("PUT", "/members", "user_owner", null, { user_id: `user_${role}`, role })).status, 200);
    }
    const control = roomControls.find(r => r.owner_id === "user_owner");
    assert.equal(control.room_events.filter(e => e.action === "member_granted").length, 3);
    assert.equal(control.room_events[0].description, "user_viewer: none → viewer");
    assert.equal(control.room_events.at(-1).actor, "user_owner");
    assert.equal((await request("PUT", "/members", "user_owner", null, { user_id: "user_missing", role: "viewer" })).status, 400);
    assert.equal((await request("PUT", "/members", "user_owner", null, { user_id: "user_other", role: "owner" })).status, 400);
    assert.equal((await request("PUT", "/members", "user_owner", null, { user_id: "user_owner", role: "viewer" })).status, 400);
    assert.equal((await request("DELETE", "/members/user_owner", "user_owner")).status, 400);
    for (const role of ["viewer", "editor", "reviewer"]) {
      assert.equal((await request("PUT", "/members", `user_${role}`, "user_owner", { user_id: `user_${role}`, role: "editor" })).status, 403);
      assert.equal((await request("DELETE", "/members/user_owner", `user_${role}`, "user_owner")).status, 403);
    }
  });
  await test("role matrix, scoped creation, actor attribution and cross-room isolation", async () => {
    const created = await request("POST", "/projects", "user_editor", "user_owner", { ...input, owner_id: "user_other", status: "merged" });
    assert.equal(created.status, 201);
    const { project_id: id } = await created.json();
    const record = records.find(p => p.project_id === id);
    record.status = "draft"; // Mongoose default in the real adapter.
    assert.equal(record.owner_id, "user_owner");
    assert.equal(record.room_events[0].actor, "user_editor");
    for (const role of ["viewer", "reviewer"]) {
      assert.equal((await request("POST", "/projects", `user_${role}`, "user_owner", input)).status, 403);
      assert.equal((await request("PATCH", `/projects/${id}`, `user_${role}`, "user_owner", input)).status, 403);
    }
    for (const role of ["viewer", "editor", "reviewer"]) {
      assert.equal((await request("GET", `/projects/${id}`, `user_${role}`, "user_owner")).status, 200);
      assert.equal((await request("DELETE", `/projects/${id}`, `user_${role}`, "user_owner")).status, 403);
      assert.equal((await request("GET", "/projects/foreign", `user_${role}`, "user_owner")).status, 404);
    }
    assert.equal((await request("PUT", `/projects/${id}/status`, "user_editor", "user_owner", { status: "approved_plan", expected_status: "draft" })).status, 403);
    assert.equal((await request("PUT", `/projects/${id}/status`, "user_reviewer", "user_owner", { status: "approved_plan", expected_status: "draft" })).status, 200);
    assert.equal((await request("PUT", `/projects/${id}/status`, "user_editor", "user_owner", { status: "awaiting_review", expected_status: "approved_plan" })).status, 200);
    assert.equal((await request("PUT", `/projects/${id}/status`, "user_viewer", "user_owner", { status: "merged", expected_status: "awaiting_review" })).status, 403);
    assert.equal((await request("PUT", `/projects/${id}/status`, "user_reviewer", "user_owner", { status: "merged", expected_status: "awaiting_review" })).status, 403);
    assert.equal((await request("PUT", `/projects/${id}/status`, "user_owner", null, { status: "merged", expected_status: "awaiting_review" })).status, 200);
    assert.equal((await request("PUT", `/projects/${id}/status`, "user_reviewer", "user_owner", { status: "paused", expected_status: "merged" })).status, 200);
    assert.equal((await request("PUT", `/projects/${id}/status`, "user_reviewer", "user_owner", { status: "merged", expected_status: "paused" })).status, 200);
    calls = [];
    await request("GET", "/dashboard", "user_viewer", "user_owner");
    await request("GET", "/audit", "user_viewer", "user_owner");
    assert.ok(calls.every(f => f.owner_id === "user_owner"));
    assert.equal((await request("DELETE", `/projects/${id}`, "user_owner")).status, 204);
  });
  await test("manual task plans remain room-scoped, owner-approved, and never execute or merge", async () => {
    const project = await request("POST", "/projects", "user_owner", null, input);
    const { project_id } = await project.json();
    const body = { project_id, title: "Check access rules", requirement: "Review the access boundaries before implementation." };
    assert.equal((await request("POST", "/orchestration/tasks", "user_viewer", "user_owner", body)).status, 403);
    assert.equal((await request("POST", "/orchestration/tasks", "user_reviewer", "user_owner", body)).status, 403);
    assert.equal((await request("POST", "/orchestration/tasks", "user_other", null, body)).status, 404);
    const created = await request("POST", "/orchestration/tasks", "user_editor", "user_owner", body);
    assert.equal(created.status, 201);
    const task = await created.json();
    assert.equal(task.status, "draft");
    assert.equal((await request("GET", `/orchestration/tasks/${task.id}`, "user_other")).status, 404);
    assert.equal((await request("GET", `/orchestration/tasks/${task.id}`, "user_reviewer", "user_owner")).status, 200);
    assert.equal((await (await request("GET", "/orchestration/tasks", "user_other")).json()).length, 0);
    const plan = { plan: "Check each permission and create isolated integration checks before changing any production state.",
      expected_status: "draft" };
    assert.equal((await request("PUT", `/orchestration/tasks/${task.id}/plan`, "user_reviewer", "user_owner", plan)).status, 403);
    assert.equal((await request("PUT", `/orchestration/tasks/${task.id}/plan`, "user_editor", "user_owner", plan)).status, 200);
    assert.equal((await request("PUT", `/orchestration/tasks/${task.id}/plan`, "user_editor", "user_owner", plan)).status, 409);
    assert.equal((await request("PUT", `/orchestration/tasks/${task.id}/decision`, "user_reviewer", "user_owner", { decision: "approve" })).status, 403);
    assert.equal((await request("PUT", `/orchestration/tasks/${task.id}/decision`, "user_owner", null, { decision: "approve" })).status, 200);
    assert.equal((await request("PUT", `/orchestration/tasks/${task.id}/decision`, "user_owner", null, { decision: "approve" })).status, 409);
    const stored = orchestrationTasks.find(t => t.task_id === task.id);
    assert.equal(stored.status, "plan_approved");
    assert.equal(stored.approved_by, "user_owner");
    assert.equal(stored.plan_source, "manual");
    assert.equal(stored.room_events.at(-1).action, "plan_approved_manual");
    assert.equal((await request("PUT", `/orchestration/tasks/${task.id}/pause`, "user_editor", "user_owner", { reason: "Wait for owner" })).status, 403);
    assert.equal((await request("PUT", `/orchestration/tasks/${task.id}/pause`, "user_owner", null, { reason: "Wait for owner" })).status, 200);
    assert.equal((await request("PUT", `/orchestration/tasks/${task.id}/resume`, "user_owner")).status, 200);
    assert.equal(stored.status, "plan_approved");
    const detail = await (await request("GET", `/orchestration/tasks/${task.id}`, "user_owner")).json();
    assert.equal(detail.history.length, 5);
    assert.equal(detail.history[0].actor, "user_editor");
    const rejected = await (await request("POST", "/orchestration/tasks", "user_owner", null, body)).json();
    assert.equal((await request("PUT", `/orchestration/tasks/${rejected.id}/plan`, "user_owner", null, plan)).status, 200);
    assert.equal((await request("PUT", `/orchestration/tasks/${rejected.id}/decision`, "user_owner", null, { decision: "reject" })).status, 400);
    assert.equal((await request("PUT", `/orchestration/tasks/${rejected.id}/decision`, "user_owner", null,
      { decision: "reject", reason: "Revise the scope" })).status, 200);
    assert.equal((await request("PUT", `/orchestration/tasks/${rejected.id}/plan`, "user_editor", "user_owner",
      { ...plan, expected_status: "rejected" })).status, 200);
  });
  await test("Claude and Gemini assistance is explicit, role-gated, persisted, and never changes approval state", async () => {
    const projectResponse = await request("POST", "/projects", "user_owner", null, input);
    const { project_id } = await projectResponse.json();
    const taskResponse = await request("POST", "/orchestration/tasks", "user_editor", "user_owner", {
      project_id, title: "Review architecture", requirement: "Design and validate a room-scoped service with human approval.",
    });
    assert.equal(taskResponse.status, 201);
    const task = await taskResponse.json();
    const path = `/orchestration/tasks/${task.id}`;
    const version = current => ({ expected_status: current.status, expected_updated_at: current.updated_at });
    const beforeCalls = aiCalls.length;

    assert.equal((await request("POST", `${path}/claude-architecture`, "user_viewer", "user_owner", version(task))).status, 403);
    assert.equal((await request("POST", `${path}/claude-architecture`, "user_reviewer", "user_owner", version(task))).status, 403);
    assert.equal((await request("POST", `${path}/claude-architecture`, "user_other", null, version(task))).status, 404);
    assert.equal(aiCalls.length, beforeCalls);

    const draftResponse = await request("POST", `${path}/claude-architecture`, "user_editor", "user_owner", version(task));
    assert.equal(draftResponse.status, 200);
    let detail = await draftResponse.json();
    assert.equal(detail.status, "draft");
    assert.equal(detail.plan, "");
    assert.equal(detail.plan_source, "manual");
    assert.match(detail.ai_architecture_draft, /Draft architecture/);
    assert.equal(detail.history.at(-1).actor, "user_editor");
    assert.equal(detail.history.at(-1).action, "claude_architecture_drafted");
    assert.equal(aiCalls.at(-1).action, "draft");

    assert.equal((await request("POST", `${path}/gemini-review`, "user_editor", "user_owner", version(detail))).status, 403);
    const reviewResponse = await request("POST", `${path}/gemini-review`, "user_reviewer", "user_owner", version(detail));
    assert.equal(reviewResponse.status, 200);
    detail = await reviewResponse.json();
    assert.equal(detail.status, "draft");
    assert.match(detail.ai_architecture_review, /Review:/);
    assert.equal(detail.ai_architecture_review_source, "architecture_draft");
    assert.equal(detail.history.at(-1).actor, "user_reviewer");

    const improveResponse = await request("POST", `${path}/claude-improve`, "user_editor", "user_owner", {
      ...version(detail), feedback: "Add explicit validation and keep outputs advisory.",
    });
    assert.equal(improveResponse.status, 200);
    detail = await improveResponse.json();
    assert.match(detail.ai_architecture_draft, /Improved architecture/);
    assert.equal(detail.ai_architecture_review, "");
    assert.equal(detail.status, "draft");

    const submitted = await request("PUT", `${path}/plan`, "user_editor", "user_owner", {
      plan: "Use separate API and persistence layers, validate access, and require owner approval.",
      expected_status: "draft",
    });
    assert.equal(submitted.status, 200);
    const proposed = await submitted.json();
    const approvedResponse = await request("PUT", `${path}/decision`, "user_owner", null, { decision: "approve" });
    assert.equal(approvedResponse.status, 200);
    const approved = await approvedResponse.json();
    assert.equal(approved.status, "plan_approved");
    assert.equal((await request("POST", `${path}/gemini-validation`, "user_editor", "user_owner", {
      ...version(approved), implementation_result: "The service and route were implemented; unit tests were added.",
    })).status, 403);
    const validationResponse = await request("POST", `${path}/gemini-validation`, "user_reviewer", "user_owner", {
      ...version(approved), implementation_result: "The service and route were implemented; unit tests were added.",
    });
    assert.equal(validationResponse.status, 200);
    detail = await validationResponse.json();
    assert.equal(detail.status, "plan_approved");
    assert.equal(detail.ai_implementation_result, "The service and route were implemented; unit tests were added.");
    assert.match(detail.ai_implementation_validation, /Validation:/);
    assert.equal(detail.history.at(-1).action, "gemini_implementation_validated");
    const reloaded = await (await request("GET", path, "user_viewer", "user_owner")).json();
    assert.equal(reloaded.ai_implementation_validation, detail.ai_implementation_validation);
    assert.equal(reloaded.status, "plan_approved");
    assert.ok(orchestrationTasks.find(t => t.task_id === task.id).room_events.every(e =>
      !["agent_started", "task_executed", "merged"].includes(e.action)));

    const failingResponse = await request("POST", "/orchestration/tasks", "user_owner", null, {
      project_id, title: "Provider failure", requirement: "A model failure must not expose provider details or change state.",
    });
    const failingTask = await failingResponse.json();
    aiFailures.add("draft");
    try {
      const response = await request("POST", `/orchestration/tasks/${failingTask.id}/claude-architecture`,
        "user_owner", null, version(failingTask));
      assert.equal(response.status, 502);
      assert.doesNotMatch(await response.text(), /provider-detail-must-not-leak/);
    } finally {
      aiFailures.delete("draft");
    }
    const failedRecord = orchestrationTasks.find(t => t.task_id === failingTask.id);
    assert.equal(failedRecord.status, "draft");
    assert.equal(failedRecord.ai_architecture_draft, "");
    assert.equal(proposed.status, "plan_proposed");
  });
  await test("only owner can stop or resume a room; reads continue but room mutations freeze", async () => {
    assert.equal((await request("POST", "/emergency-stop", "user_stranger", "user_owner")).status, 403);
    assert.equal((await request("POST", "/emergency-stop", "user_reviewer", "user_owner")).status, 403);
    assert.equal((await request("POST", "/emergency-stop", "user_owner")).status, 200);
    assert.equal((await request("POST", "/emergency-stop", "user_owner")).status, 409);
    assert.equal((await (await request("GET", "/operations", "user_owner")).json()).stopped, true);
    assert.equal((await request("GET", "/projects", "user_owner")).status, 200);
    assert.equal((await request("POST", "/projects", "user_owner", null, input)).status, 423);
    assert.equal((await request("PUT", "/members", "user_owner", null, { user_id: "user_editor", role: "viewer" })).status, 423);
    assert.equal((await request("POST", "/orchestration/tasks", "user_owner", null,
      { project_id: "anything", title: "Blocked task", requirement: "Should not be created when room is stopped." })).status, 423);
    assert.equal((await request("POST", "/projects", "user_other", null, input)).status, 201);
    assert.equal((await request("POST", "/emergency-resume", "user_reviewer", "user_owner")).status, 403);
    assert.equal((await request("POST", "/emergency-resume", "user_owner")).status, 200);
    assert.equal((await request("POST", "/emergency-resume", "user_owner")).status, 409);
    assert.equal((await (await request("GET", "/operations", "user_owner")).json()).stopped, false);
    assert.equal((await request("POST", "/projects", "user_owner", null, input)).status, 201);
  });
  await test("membership change rolls back if its audit write fails", async () => {
    const original = RoomControl.findOneAndUpdate;
    const role = memberships.find(m => m.user_id === "user_editor").role;
    RoomControl.findOneAndUpdate = async () => { throw new Error("Audit write unavailable"); };
    try {
      assert.equal((await request("PUT", "/members", "user_owner", null,
        { user_id: "user_editor", role: "viewer" })).status, 500);
      assert.equal(memberships.find(m => m.user_id === "user_editor").role, role);
    } finally {
      RoomControl.findOneAndUpdate = original;
    }
  });
  await test("role changes and revocation take effect on next request; room list is identity scoped", async () => {
    assert.equal((await (await request("GET", "/rooms", "user_viewer")).json()).length, 2);
    const audit = roomControls.find(r => r.owner_id === "user_owner").room_events;
    const before = audit.length;
    assert.equal((await request("PUT", "/members", "user_owner", null, { user_id: "user_editor", role: "viewer" })).status, 200);
    assert.equal(audit.length, before + 1);
    assert.equal(audit.at(-1).actor, "user_owner");
    assert.equal(audit.at(-1).description, "user_editor: editor → viewer");
    assert.equal((await request("PUT", "/members", "user_owner", null, { user_id: "user_editor", role: "viewer" })).status, 200);
    assert.equal(audit.length, before + 1);
    assert.equal((await request("POST", "/projects", "user_editor", "user_owner", input)).status, 403);
    assert.equal((await request("DELETE", "/members/user_viewer", "user_owner")).status, 204);
    assert.equal(audit.at(-1).actor, "user_owner");
    assert.equal(audit.at(-1).description, "user_viewer: viewer → none");
    assert.equal(audit.length, before + 2);
    assert.equal((await request("DELETE", "/members/user_viewer", "user_owner")).status, 204);
    assert.equal(audit.length, before + 2);
    assert.equal((await request("GET", "/projects", "user_viewer", "user_owner")).status, 403);
    assert.equal((await (await request("GET", "/rooms", "user_viewer")).json()).length, 1);
    assert.equal((await request("GET", "/projects", "user_viewer")).status, 200);
  });
} finally {
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await rm(temp, { recursive: true, force: true });
  delete globalThis.__roomTest;
}