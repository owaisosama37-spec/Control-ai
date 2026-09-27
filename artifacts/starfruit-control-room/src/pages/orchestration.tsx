import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProjects, useListOrchestrationTasks, useGetOrchestrationTask,
  getGetOrchestrationTaskQueryKey,
  useCreateOrchestrationTask, useSubmitOrchestrationPlan, useDecideOrchestrationPlan,
  usePauseOrchestrationTask, useResumeOrchestrationTask,
  type OrchestrationTaskStatus,
} from "@workspace/api-client-react";
import { useLocale } from "@/lib/locale";
import { useRoomAccess } from "@/components/team";
import { errorMessage } from "@/components/project-form";

export function OrchestrationPage() {
  const { language } = useLocale();
  const say = (ar: string, en: string) => language === "ar" ? ar : en;
  const { canEdit, isOwner } = useRoomAccess();
  const client = useQueryClient();
  const projects = useListProjects();
  const tasks = useListOrchestrationTasks();
  const [selectedId, setSelectedId] = useState("");
  const detail = useGetOrchestrationTask(selectedId, { query: {
    queryKey: getGetOrchestrationTaskQueryKey(selectedId), enabled: Boolean(selectedId),
  } });
  const create = useCreateOrchestrationTask();
  const submitPlan = useSubmitOrchestrationPlan();
  const decide = useDecideOrchestrationPlan();
  const pause = usePauseOrchestrationTask();
  const resume = useResumeOrchestrationTask();
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [requirement, setRequirement] = useState("");
  const [plan, setPlan] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const busy = create.isPending || submitPlan.isPending || decide.isPending || pause.isPending || resume.isPending;
  const statusLabels: Record<OrchestrationTaskStatus, string> = {
    draft: say("مسودة", "Draft"),
    plan_proposed: say("خطة تنتظر المالك", "Plan awaiting owner"),
    plan_approved: say("خطة معتمدة — التنفيذ غير مفعّل", "Plan approved — execution disabled"),
    rejected: say("الخطة مرفوضة", "Plan rejected"),
    paused: say("موقوفة", "Paused"),
  };
  async function run(action: () => Promise<unknown>, success: string) {
    setMessage(""); setNotice("");
    try {
      await action();
      await client.invalidateQueries();
      setNotice(success);
    } catch (error) { setMessage(errorMessage(error)); }
  }
  return <div className="stack">
    <div className="page-heading"><div><div className="eyebrow">{say("مسار العمل اليدوي", "MANUAL WORKFLOW")}</div>
      <h1>{say("مهام التنسيق", "Orchestration tasks")}</h1>
      <p>{say("اكتب المهمة والخطة، ثم سجّل قرار المالك. اعتماد الخطة لا يشغّل نموذجًا أو منفذًا ولا ينشئ PR.",
        "Record a task and plan, then the owner's decision. Approval does not call a model, start a worker, or create a PR.")}</p></div></div>
    <div className="notice">{say("التنفيذ الآلي وClaude وGemini وفتح PR متوقفون. الإيقاف هنا يغيّر حالة السجل اليدوي فقط، وليس عملية خارجية جارية.",
      "Autonomous execution, Claude, Gemini, and PR creation are disabled. Pausing here changes a manual record, not a running external process.")}</div>
    {canEdit && <form className="panel p-6" onSubmit={e => {
      e.preventDefault();
      void run(async () => {
        const result = await create.mutateAsync({ data: { project_id: projectId, title: title.trim(), requirement: requirement.trim() } });
        setSelectedId(result.id); setTitle(""); setRequirement(""); setProjectId("");
      }, say("أُنشئت المهمة كمسودة.", "Task created as a draft."));
    }}>
      <h2>{say("مهمة جديدة", "New task")}</h2>
      {projects.error ? <p className="error" role="alert">{errorMessage(projects.error)} <button type="button" className="btn small" onClick={() => void projects.refetch()}>{say("إعادة المحاولة", "Retry")}</button></p> :
        <><label className="form-field mt-4">{say("المشروع", "Project")}
          <select className="input" value={projectId} onChange={e => setProjectId(e.target.value)} required>
            <option value="">{say("اختر مشروعًا", "Select a project")}</option>
            {projects.data?.map(p => <option key={p.project_id} value={p.project_id}>{p.name}</option>)}
          </select></label>
          <label className="form-field mt-4">{say("عنوان المهمة", "Task title")}
            <input className="input" minLength={3} maxLength={160} required value={title} onChange={e => setTitle(e.target.value)} /></label>
          <label className="form-field mt-4">{say("المطلوب", "Requirement")}
            <textarea className="input" rows={4} minLength={10} maxLength={5000} required value={requirement} onChange={e => setRequirement(e.target.value)} /></label>
          <button className="btn primary mt-4" disabled={busy || !projects.data?.length}>{say("سجّل المهمة", "Record task")}</button></>}
    </form>}
    {message && <p className="error" role="alert">{message}</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    <section className="panel p-6"><h2>{say("مهام الغرفة", "Room tasks")}</h2>
      {tasks.error ? <p className="error" role="alert">{errorMessage(tasks.error)} <button type="button" className="btn small" onClick={() => void tasks.refetch()}>{say("إعادة المحاولة", "Retry")}</button></p> :
        tasks.isLoading ? <p className="muted">{say("جارٍ التحميل…", "Loading…")}</p> :
        !tasks.data?.length ? <p className="muted mt-4">{say("لا توجد مهام بعد.", "No tasks yet.")}</p> :
        tasks.data.map(task => <button type="button" key={task.id} onClick={() => { setSelectedId(task.id); setPlan(""); setReason(""); setMessage(""); }}
          className="row w-full text-start gap-4" aria-pressed={selectedId === task.id} data-testid={`task-${task.id}`}>
          <span className="min-w-0"><strong className="block break-words">{task.title}</strong><small className="row-meta">{task.project_id}</small></span>
          <span className="pill">{statusLabels[task.status]}</span>
        </button>)}
    </section>
    {selectedId && <section className="panel p-6" aria-label={say("تفاصيل المهمة", "Task details")}>
      {detail.error ? <p className="error" role="alert">{errorMessage(detail.error)} <button type="button" className="btn small" onClick={() => void detail.refetch()}>{say("إعادة المحاولة", "Retry")}</button></p> :
        detail.isLoading ? <p className="muted">{say("جارٍ تحميل المهمة…", "Loading task…")}</p> :
        detail.data && <>
          <h2>{detail.data.title}</h2><p className="muted mt-2 whitespace-pre-wrap break-words">{detail.data.requirement}</p>
          <p className="row-meta mt-3">{statusLabels[detail.data.status]} · {detail.data.project_id}</p>
          {detail.data.plan && <div className="notice mt-4"><strong>{say("الخطة (أدخلها شخص، ليست رد Claude)", "Plan (entered by a person, not Claude)")}</strong>
            <p className="whitespace-pre-wrap break-words mt-2">{detail.data.plan}</p></div>}
          {detail.data.rejection_reason && <p className="error mt-3">{detail.data.rejection_reason}</p>}
          {canEdit && (detail.data.status === "draft" || detail.data.status === "rejected") && <form className="mt-5" onSubmit={e => {
            e.preventDefault();
            const current = detail.data!;
            void run(async () => {
              await submitPlan.mutateAsync({ taskId: current.id,
                data: { plan: plan.trim(), expected_status: current.status as "draft" | "rejected" } });
              setPlan("");
            }, say("أُرسلت الخطة لموافقة المالك.", "Plan submitted for owner approval."));
          }}>
            <label className="form-field">{say("اكتب الخطة يدويًا", "Write the plan manually")}
              <textarea className="input" rows={6} required minLength={20} maxLength={12000} value={plan} onChange={e => setPlan(e.target.value)} /></label>
            <button className="btn primary mt-3" disabled={busy}>{say("أرسل الخطة", "Submit plan")}</button>
          </form>}
          {isOwner && detail.data.status === "plan_proposed" && <div className="mt-5">
            <label className="form-field">{say("سبب الرفض (إذا رفضت)", "Rejection reason (if rejecting)")}
              <input className="input" maxLength={2000} value={reason} onChange={e => setReason(e.target.value)} /></label>
            <div className="flex flex-wrap gap-3 mt-3">
              <button className="btn primary" disabled={busy} onClick={() => void run(
                () => decide.mutateAsync({ taskId: detail.data!.id, data: { decision: "approve" } }),
                say("اعتُمدت الخطة. لن يبدأ أي تنفيذ تلقائي.", "Plan approved. No automatic work will start."))}>
                {say("اعتمد الخطة فقط", "Approve plan only")}</button>
              <button className="btn danger" disabled={busy || !reason.trim()} onClick={() => void run(
                () => decide.mutateAsync({ taskId: detail.data!.id, data: { decision: "reject", reason: reason.trim() } }),
                say("رُفضت الخطة.", "Plan rejected."))}>{say("ارفض الخطة", "Reject plan")}</button>
            </div>
          </div>}
          {isOwner && !["paused", "rejected"].includes(detail.data.status) && <button className="btn mt-5" disabled={busy}
            onClick={() => { const why = window.prompt(say("سبب الإيقاف", "Reason for pausing")); if (why?.trim() && why.trim().length >= 3) void run(
              () => pause.mutateAsync({ taskId: detail.data!.id, data: { reason: why.trim() } }),
              say("أُوقفت المهمة اليدوية.", "Manual task paused.")); }}>
            {say("أوقف المهمة", "Pause task")}</button>}
          {isOwner && detail.data.status === "paused" && <button className="btn primary mt-5" disabled={busy} onClick={() => void run(
            () => resume.mutateAsync({ taskId: detail.data!.id }),
            say("استُؤنفت المهمة اليدوية.", "Manual task resumed."))}>{say("استأنف", "Resume")}</button>}
          <h3 className="mt-6">{say("السجل الموقّع", "Signed history")}</h3>
          <div className="timeline">{detail.data.history.map(entry => <div className="timeline-item" key={entry.id}>
            <div className="min-w-0"><strong>{entry.action}</strong><p className="break-words">{entry.description}</p>
              <small className="row-meta break-all">{entry.created_at} · {entry.actor_id} · {entry.verified ? say("التوقيع صالح", "Signature verified") : say("التوقيع غير صالح", "Signature invalid")}</small></div>
          </div>)}</div>
        </>}
    </section>}
  </div>;
}