import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProjects, useListOrchestrationTasks, useGetOrchestrationTask,
  getGetOrchestrationTaskQueryKey,
  useCreateOrchestrationTask, useSubmitOrchestrationPlan, useDecideOrchestrationPlan,
  usePauseOrchestrationTask, useResumeOrchestrationTask,
  useDraftOrchestrationArchitecture, useImproveOrchestrationArchitecture,
  useReviewOrchestrationArchitecture, useValidateOrchestrationImplementation,
  type OrchestrationTaskStatus,
} from "@workspace/api-client-react";
import { useLocale } from "@/lib/locale";
import { useRoomAccess } from "@/components/team";
import { errorMessage } from "@/components/project-form";

export function OrchestrationPage() {
  const { language } = useLocale();
  const say = (ar: string, en: string) => language === "ar" ? ar : en;
  const { canEdit, canReview, isOwner } = useRoomAccess();
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
  const draftArchitecture = useDraftOrchestrationArchitecture();
  const improveArchitecture = useImproveOrchestrationArchitecture();
  const reviewArchitecture = useReviewOrchestrationArchitecture();
  const validateImplementation = useValidateOrchestrationImplementation();
  const [projectId, setProjectId] = useState("");
  const [title, setTitle] = useState("");
  const [requirement, setRequirement] = useState("");
  const [plan, setPlan] = useState("");
  const [improvementFeedback, setImprovementFeedback] = useState("");
  const [implementationResult, setImplementationResult] = useState("");
  const [reason, setReason] = useState("");
  const [message, setMessage] = useState("");
  const [notice, setNotice] = useState("");
  const busy = create.isPending || submitPlan.isPending || decide.isPending || pause.isPending || resume.isPending ||
    draftArchitecture.isPending || improveArchitecture.isPending || reviewArchitecture.isPending || validateImplementation.isPending;
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
  function selectTask(id: string) {
    setSelectedId(id); setPlan(""); setReason(""); setImprovementFeedback(""); setImplementationResult("");
    setMessage(""); setNotice("");
  }
  function aiVersion(task: { status: OrchestrationTaskStatus; updated_at: string }) {
    return {
      expected_status: task.status as "draft" | "rejected" | "plan_proposed" | "plan_approved",
      expected_updated_at: task.updated_at,
    };
  }
  function savedAt(value: string | null) {
    return value ? new Date(value).toLocaleString(language === "ar" ? "ar" : "en") : "";
  }
  return <div className="stack">
    <div className="page-heading"><div><div className="eyebrow">{say("مسار بإشراف بشري", "HUMAN-LED WORKFLOW")}</div>
      <h1>{say("مهام التنسيق", "Orchestration tasks")}</h1>
      <p>{say("أنشئ مسودات معمارية واطلب مراجعتها يدويًا. اعتماد الخطة يبقى قرارًا بشريًا ولا يبدأ التنفيذ.",
        "Create architecture drafts and request reviews manually. Plan approval remains a human decision and never starts execution.")}</p></div></div>
    <div className="notice">{say("لا تُرسل بيانات إلى Claude أو Gemini إلا عند ضغط زر الإجراء المناسب. لا يوجد تشغيل تلقائي أو تنفيذ لوكيل Replit أو إنشاء PR أو دمج.",
      "Task data is sent to Claude or Gemini only when you press the matching action button. There is no automatic run, Replit Agent execution, PR creation, or merge.")}</div>
    {canEdit && <form className="panel p-6" onSubmit={e => {
      e.preventDefault();
      void run(async () => {
        const result = await create.mutateAsync({ data: { project_id: projectId, title: title.trim(), requirement: requirement.trim() } });
        selectTask(result.id); setTitle(""); setRequirement(""); setProjectId("");
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
        tasks.data.map(task => <button type="button" key={task.id} onClick={() => selectTask(task.id)}
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
          {detail.data.plan && <div className="notice mt-4"><strong>{say("الخطة المقدّمة للموافقة", "Plan submitted for approval")}</strong>
            <p className="whitespace-pre-wrap break-words mt-2">{detail.data.plan}</p></div>}
          {detail.data.rejection_reason && <p className="error mt-3">{detail.data.rejection_reason}</p>}
          {detail.data.ai_architecture_draft && <div className="panel mt-5 p-5">
            <div className="panel-head"><h3>{say("مسودة Claude المعمارية", "Claude architecture draft")}</h3>
              {detail.data.ai_architecture_updated_at && <small className="row-meta">{savedAt(detail.data.ai_architecture_updated_at)}</small>}</div>
            <div className="whitespace-pre-wrap break-words">{detail.data.ai_architecture_draft}</div>
            {canEdit && (detail.data.status === "draft" || detail.data.status === "rejected") &&
              <button type="button" className="btn mt-4" onClick={() => setPlan(detail.data!.ai_architecture_draft)}>
                {say("انسخ المسودة إلى محرر الخطة", "Use draft in the manual plan editor")}
              </button>}
          </div>}
          <div className="panel mt-5 p-5">
            <h3>{say("مساعدة معمارية عند الطلب", "On-demand architecture assistance")}</h3>
            <p className="muted mt-2">{say("كل استدعاء يرسل المهمة والمسودة أو النص الذي أدخلته إلى المزوّد المحدد. النتائج استشارية ولا تغيّر حالة المهمة.",
              "Each request sends the task and the relevant draft or text you entered to the selected provider. Results are advisory and do not change task status.")}</p>
            {canEdit && (detail.data.status === "draft" || detail.data.status === "rejected") && <div className="mt-4">
              <div className="flex flex-wrap gap-3">
                <button type="button" className="btn primary" disabled={busy} onClick={() => {
                  const current = detail.data!;
                  void run(() => draftArchitecture.mutateAsync({ taskId: current.id, data: aiVersion(current) }),
                    say("حُفظت مسودة Claude. راجعها قبل تقديم أي خطة.", "Claude's draft was saved. Review it before submitting any plan."));
                }}>{say("أنشئ مسودة بـ Claude", "Draft with Claude")}</button>
              </div>
              {(detail.data.ai_architecture_draft || detail.data.plan) && <form className="mt-4" onSubmit={e => {
                e.preventDefault();
                const current = detail.data!;
                void run(() => improveArchitecture.mutateAsync({ taskId: current.id,
                  data: { ...aiVersion(current), feedback: improvementFeedback.trim() } }),
                  say("حُفظت المسودة المحسّنة.", "Improved draft saved."));
              }}>
                <label className="form-field">{say("ملاحظات التحسين", "Improvement feedback")}
                  <textarea className="input" rows={3} minLength={3} maxLength={4000} required value={improvementFeedback}
                    onChange={e => setImprovementFeedback(e.target.value)} /></label>
                <button className="btn mt-3" disabled={busy || improvementFeedback.trim().length < 3}>
                  {say("حسّن المسودة بـ Claude", "Improve draft with Claude")}
                </button>
              </form>}
            </div>}
            {canReview && (detail.data.status === "draft" || detail.data.status === "rejected" || detail.data.status === "plan_proposed") &&
              (detail.data.ai_architecture_draft || detail.data.plan) && <button type="button" className="btn mt-4" disabled={busy}
                onClick={() => {
                  const current = detail.data!;
                  void run(() => reviewArchitecture.mutateAsync({ taskId: current.id, data: aiVersion(current) }),
                    say("حُفظت مراجعة Gemini. قرار المالك منفصل.", "Gemini's review was saved. Owner approval remains separate."));
                }}>{say("راجع بـ Gemini", "Review with Gemini")}</button>}
            {detail.data.ai_architecture_review && <div className="notice mt-4">
              <strong>{say("مراجعة Gemini", "Gemini review")}
                {detail.data.ai_architecture_reviewed_at && <span className="row-meta"> · {savedAt(detail.data.ai_architecture_reviewed_at)}</span>}
              </strong>
              <p className="row-meta mt-1">{say("المراجَع: ", "Reviewed: ")}
                {detail.data.ai_architecture_review_source === "plan" ? say("الخطة", "submitted plan") : say("المسودة المعمارية", "architecture draft")}</p>
              <div className="whitespace-pre-wrap break-words mt-2">{detail.data.ai_architecture_review}</div>
            </div>}
            {canReview && detail.data.status === "plan_approved" && <form className="mt-5" onSubmit={e => {
              e.preventDefault();
              const current = detail.data!;
              void run(() => validateImplementation.mutateAsync({ taskId: current.id,
                data: { ...aiVersion(current), implementation_result: implementationResult.trim() } }),
                say("حُفظ تحقق Gemini. راجعه يدويًا قبل اتخاذ القرار.", "Gemini's validation was saved. Review it manually before deciding."));
            }}>
              <label className="form-field">{say("ملخص التنفيذ أو أدلته", "Implementation summary or evidence")}
                <textarea className="input" rows={4} minLength={20} maxLength={12000} required value={implementationResult}
                  onChange={e => setImplementationResult(e.target.value)} /></label>
              <p className="muted mt-2">{say("يعتمد التحقق على النص الذي تدخله هنا؛ Gemini لا يصل إلى المستودع ولا يشغّل الاختبارات.",
                "Validation is based only on the text you provide; Gemini cannot access the repository or run tests.")}</p>
              <button className="btn mt-3" disabled={busy || implementationResult.trim().length < 20}>
                {say("تحقق من التنفيذ بـ Gemini", "Validate implementation with Gemini")}
              </button>
            </form>}
            {detail.data.ai_implementation_validation && <div className="notice mt-4">
              <strong>{say("نتيجة تحقق Gemini", "Gemini implementation validation")}
                {detail.data.ai_implementation_validated_at && <span className="row-meta"> · {savedAt(detail.data.ai_implementation_validated_at)}</span>}
              </strong>
              <h4 className="mt-3">{say("النص المقدّم للتحقق", "Submitted implementation notes")}</h4>
              <div className="whitespace-pre-wrap break-words mt-2">{detail.data.ai_implementation_result}</div>
              <h4 className="mt-4">{say("التحليل الاستشاري", "Advisory analysis")}</h4>
              <div className="whitespace-pre-wrap break-words mt-2">{detail.data.ai_implementation_validation}</div>
            </div>}
          </div>
          {canEdit && (detail.data.status === "draft" || detail.data.status === "rejected") && <form className="mt-5" onSubmit={e => {
            e.preventDefault();
            const current = detail.data!;
            void run(async () => {
              await submitPlan.mutateAsync({ taskId: current.id,
                data: { plan: plan.trim(), expected_status: current.status as "draft" | "rejected" } });
              setPlan("");
            }, say("أُرسلت الخطة لموافقة المالك.", "Plan submitted for owner approval."));
          }}>
            <label className="form-field">{say("راجع واكتب الخطة التي ستُرسل للموافقة", "Review and enter the plan to submit for approval")}
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