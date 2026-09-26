import { useState } from "react";
import { Link, useLocation } from "wouter";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProjects, useGetProject, getGetProjectQueryKey, useGetDashboard, useListActivity,
  useGetSystemStatus, useTransitionProject, useDeleteProject, type Project, type ProjectStatus, type Activity,
} from "@workspace/api-client-react";
import { Plus, ArrowUpRight, ArrowLeft, Layers, CheckCheck, GitMerge, Wallet, Search, ShieldCheck, GitBranch, Clock3, Pencil, Trash2, Plug, Database, LockKeyhole, FileCheck2 } from "lucide-react";
import { ProjectForm, errorMessage } from "@/components/project-form";
import { useToast } from "@/hooks/use-toast";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { useLocale } from "@/lib/locale";
import { useRoomAccess } from "@/components/team";

const money = (v:number,lang="en")=>new Intl.NumberFormat(lang==="ar"?"ar":"en-US",{style:"currency",currency:"USD",maximumFractionDigits:0}).format(v);
const date = (v:string,lang="en")=>new Date(v).toLocaleString(lang==="ar"?"ar":"en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});
const labels: Record<ProjectStatus,string> = {draft:"Draft",approved_plan:"Plan approved",awaiting_review:"Awaiting review",merged:"Merged",paused:"Paused",rejected:"Rejected"};
const actions: Record<ProjectStatus, {status:ProjectStatus;label:string}[]> = {
  draft:[{status:"approved_plan",label:"Approve plan"},{status:"rejected",label:"Reject"}],
  approved_plan:[{status:"awaiting_review",label:"Submit for review"}],
  awaiting_review:[{status:"merged",label:"Approve & mark merged"},{status:"rejected",label:"Reject"}],
  merged:[{status:"paused",label:"Pause"}], paused:[{status:"merged",label:"Resume"}], rejected:[{status:"draft",label:"Return to draft"}],
};
function Badge({ status }: {status:string}) { const {t}=useLocale(); return <span className={`pill ${status}`} data-testid={`status-${status}`}>{t(labels[status as ProjectStatus] || status)}</span>; }
function ErrorPanel({error,retry}:{error:unknown;retry:()=>unknown}) { const {t}=useLocale();return <div className="error" role="alert"><strong>{t("We couldn’t load this information.")}</strong><p>{t(errorMessage(error))}</p><button className="btn small" onClick={()=>retry()} data-testid="button-retry">{t("Try again")}</button></div>; }
function Empty({title="No projects yet",text="Start with a project brief. Your work, budget, and approval history will appear here.",onCreate}:{title?:string;text?:string;onCreate?:()=>void}) { const {t}=useLocale(); const {canEdit}=useRoomAccess();return <div className="empty"><Layers size={31} /><h3>{t(title)}</h3><p>{t(text)}</p>{onCreate && canEdit && <button className="btn primary" onClick={onCreate} data-testid="button-empty-create"><Plus size={15} />{t("Create your first project")}</button>}</div>; }
function Heading({title,description,children}:{title:string;description:string;children?:React.ReactNode}) { const {t}=useLocale();return <div className="page-heading"><div><div className="eyebrow">{t("Your control room")}</div><h1>{t(title)}</h1><p>{t(description)}</p></div>{children}</div>; }
function ActivityList({items}:{items:Activity[]}) {
  const {t,language}=useLocale();
  const describe=(value:string)=> {
    const match=value.match(/^(draft|approved_plan|awaiting_review|merged|paused|rejected) → (draft|approved_plan|awaiting_review|merged|paused|rejected)(: (.*))?$/);
    return match ? `${t(labels[match[1] as ProjectStatus])} ← ${t(labels[match[2] as ProjectStatus])}${match[4] ? `: ${match[4]}` : ""}` : t(value);
  };
  return <div className="timeline">{items.map(e=><div key={e.id} className="timeline-item" data-testid={`activity-${e.id}`}><div className="timeline-icon"><FileCheck2 size={15} /></div><div className="min-w-0"><p><strong>{e.project_name}</strong><br />{describe(e.description)}</p><small>{date(e.created_at,language)} · {t(e.verified ? "Signature verified" : "Signature could not be verified")}</small></div></div>)}</div>;
}
export function DashboardPage() {
  const { canEdit } = useRoomAccess();
  const {t,language}=useLocale();
  const summary = useGetDashboard();
  const projects = useListProjects();
  const activity = useListActivity();
  const [creating,setCreating] = useState(false);
  const pending = projects.data?.filter(p=>["draft","awaiting_review"].includes(p.status)) || [];
  const failures=[summary.error,projects.error,activity.error].filter(Boolean);
  const refreshAll=()=>{ void Promise.all([summary.refetch(),projects.refetch(),activity.refetch()]); };
  return <>
    <Heading title="The big picture." description="A clear view of your work, from first draft to final delivery."><button disabled={!canEdit} className="btn primary" onClick={()=>setCreating(true)} data-testid="button-new-project"><Plus size={16} />{t("New project")}</button></Heading>
    {failures.length>0 && <div className="error mb-6" role="alert"><strong>{t("We couldn't refresh your project data.")}</strong><p>{t(errorMessage(failures[0]))}</p><div className="flex flex-wrap gap-3 items-center"><button className="btn small" onClick={refreshAll} data-testid="button-refresh-dashboard">{t("Try again")}</button>{/mongodb|database/i.test(errorMessage(failures[0]) || "") && <Link href="/settings" className="underline text-xs">{t("Connections")}</Link>}</div></div>}
    {summary.isLoading ? <div className="skeleton mb-6" /> : summary.error ? null : summary.data && <div className="metric-grid">
      {[[Layers,"Projects",summary.data.total,"Across your private room"],[GitBranch,"In progress",summary.data.active,"Approved and under review"],[CheckCheck,"Needs approval",summary.data.pending,"Drafts and final reviews"],[Wallet,"Total budget",money(summary.data.budget,language),`${money(summary.data.spent,language)} ${t("recorded cost")}`]].map(([Icon,title,value,note])=>{const I=Icon as typeof Layers;return <div className="metric" key={String(title)}><div className="metric-top"><span>{t(String(title))}</span><I size={16} /></div><div className="metric-value" data-testid={`metric-${title}`}>{String(value)}</div><div className="metric-note">{t(String(note))}</div></div>;})}
    </div>}
    <div className="split-grid"><div className="stack">
      <section className="panel"><div className="panel-head"><h2>{t("Project pipeline")}</h2><Link href="/projects" data-testid="link-all-projects">{t("View all")} <ArrowUpRight size={13} className="inline" /></Link></div>
        {projects.isLoading ? <div className="skeleton" /> : projects.error ? <p className="empty">{t("This section is unavailable until MongoDB reconnects.")}</p> : !projects.data?.length ? <Empty onCreate={()=>setCreating(true)} /> : projects.data.slice(0,6).map(p=><Link href={`/projects/${p.project_id}`} key={p.project_id} className="row" data-testid={`link-project-${p.project_id}`}><div><span className="project-name">{p.name}</span><div className="row-meta"><span dir="ltr">{p.project_id}</span><span>·</span><span>{p.client_name || t("Internal project")}</span></div></div><Badge status={p.status} /></Link>)}
      </section>
      <section className="panel"><div className="panel-head"><h2>{t("Latest activity")}</h2><Link href="/activity" data-testid="link-all-activity">{t("Full history")} <ArrowUpRight size={13} className="inline" /></Link></div>{activity.error ? <p className="empty">{t("This section is unavailable until MongoDB reconnects.")}</p> : activity.isLoading ? <div className="skeleton" /> : activity.data?.length ? <ActivityList items={activity.data.slice(0,4)} /> : <Empty title="A fresh start" text="Create a project to start your activity history. Every edit and decision is recorded." />}</section>
    </div><div className="stack">
      <section className="panel"><div className="panel-head"><h2>{t("Attention required")}</h2><span className="pill awaiting_review">{projects.error ? "—" : pending.length} {t("pending")}</span></div>{projects.error ? <p className="empty">{t("This section is unavailable until MongoDB reconnects.")}</p> : pending.length ? pending.slice(0,4).map(p=><Link className="row" href={`/projects/${p.project_id}`} key={p.project_id} data-testid={`approval-${p.project_id}`}><div><span className="project-name">{p.name}</span><span className="row-meta">{t(p.status==="draft" ? "Plan approval" : "Final review")} · {t("Priority")} {p.priority}</span></div><ArrowUpRight size={17} className="text-primary" /></Link>) : <Empty title="Nothing waiting on you" text="Projects awaiting plan approval or final review will appear here." />}</section>
      <section className="panel p-6"><div className="eyebrow mb-5">{t("Delivery workflow")}</div>{Object.entries(labels).slice(0,4).map(([status,label],i)=><div className="flex items-center gap-3 py-3" key={status}><span className="text-primary text-xs">0{i+1}</span><span className="text-sm flex-1">{t(label)}</span><span className="muted text-xs">{projects.data?.filter(p=>p.status===status).length || 0}</span></div>)}<p className="text-xs muted leading-6 mt-4 border-t pt-4">{t("You control each transition. Updating a status records a decision; it does not execute code or merge a GitHub pull request.")}</p></section>
    </div></div>
    {creating && <ProjectForm onClose={()=>setCreating(false)} />}
  </>;
}
export function ProjectsPage({approvals=false}:{approvals?:boolean}) {
  const { canEdit } = useRoomAccess();
  const {t,language}=useLocale();
  const query = useListProjects();
  const [search,setSearch]=useState("");
  const [status,setStatus]=useState("all");
  const [creating,setCreating]=useState(false);
  const items = (query.data || []).filter(p=>(!approvals || ["draft","awaiting_review"].includes(p.status)) && (status==="all" || p.status===status) && `${p.name} ${p.project_id} ${p.client_name}`.toLowerCase().includes(search.toLowerCase()));
  return <><Heading title={approvals ? "Decisions that move work." : "Your projects."} description={approvals ? "Review project plans and deliveries before moving them forward." : "Prioritized work, with the details that matter."}>{!approvals && canEdit && <button className="btn primary" onClick={()=>setCreating(true)} data-testid="button-new-project"><Plus size={16} />{t("New project")}</button>}</Heading>
    <div className="toolbar"><div className="search"><Search size={16} /><input className="input" aria-label={t("Search projects")} placeholder={t("Search by name, client, or project ID…")} value={search} onChange={e=>setSearch(e.target.value)} data-testid="input-search" /></div><select className="input" aria-label={t("Filter by status")} value={status} onChange={e=>setStatus(e.target.value)} data-testid="select-status"><option value="all">{t("All stages")}</option>{Object.entries(labels).filter(([v])=>!approvals || ["draft","awaiting_review"].includes(v)).map(([v,label])=><option key={v} value={v}>{t(label)}</option>)}</select><span className="muted text-xs ml-auto">{items.length} {t("projects")}</span></div>
    {query.error ? <ErrorPanel error={query.error} retry={query.refetch} /> : query.isLoading ? <div className="skeleton" /> : <section className="panel">{!items.length ? <Empty title={search || status!=="all" ? "No matching projects" : approvals ? "Your approval queue is clear" : "No projects yet"} text={approvals ? "New drafts and deliveries awaiting review will appear here." : "Create a project or adjust your filters to get started."} onCreate={!approvals && !query.data?.length ? ()=>setCreating(true) : undefined} /> : <div className="table-scroll"><table><thead><tr>{["Project","Stage","Priority","Budget / Cost","Updated"].map(label=><th key={label}>{t(label)}</th>)}<th><span className="sr-only">{t("Open")}</span></th></tr></thead><tbody>{items.map(p=><tr key={p.project_id} data-testid={`row-project-${p.project_id}`}><td><Link className="project-name" href={`/projects/${p.project_id}`}>{p.name}</Link><div className="row-meta"><span dir="ltr">{p.project_id}</span> · {p.client_name || t("Internal")}</div></td><td><Badge status={p.status} /></td><td><span className={p.priority>=8 ? "text-primary" : "muted"}>{t(p.priority>=8 ? "High" : p.priority>=4 ? "Normal" : "Low")} · {p.priority}</span></td><td className="money">{money(p.budget,language)}<div className="row-meta mt-1">{money(p.actual_cost,language)} {t("spent")}</div></td><td className="muted">{date(p.updated_at,language)}</td><td><Link href={`/projects/${p.project_id}`} className="btn small ghost" aria-label={`${t("Open")} ${p.name}`} data-testid={`open-${p.project_id}`}><ArrowUpRight size={16} /></Link></td></tr>)}</tbody></table></div>}</section>}
    {creating && <ProjectForm onClose={()=>setCreating(false)} />}
  </>;
}
export function ProjectPage({id}:{id:string}) {
  const { canEdit, canReview, isOwner } = useRoomAccess();
  const {t,language}=useLocale();
  const query=useGetProject(id,{query:{queryKey:getGetProjectQueryKey(id),enabled:!!id}});
  const history=useListActivity();
  const transition=useTransitionProject();
  const remove=useDeleteProject();
  const client=useQueryClient();
  const {toast}=useToast();
  const [,navigate]=useLocation();
  const [editing,setEditing]=useState(false);
  const [decision,setDecision]=useState<ProjectStatus | null>(null);
  const [reason,setReason]=useState("");
  const [deleting,setDeleting]=useState(false);
  const [message,setMessage]=useState("");
  async function changeStatus() {
    if (!query.data || !decision) return;
    try {
      await transition.mutateAsync({id,data:{status:decision,expected_status:query.data.status,reason}});
      await client.invalidateQueries();
      setDecision(null); setReason(""); setMessage("");
      toast({title:t("Decision recorded"),description:t("Project stage and signed activity have been updated.")});
    } catch(e) { setMessage(t(errorMessage(e))); }
  }
  async function deleteItem() {
    try { await remove.mutateAsync({id}); await client.invalidateQueries(); navigate("/projects"); toast({title:t("Project removed"),description:t("Its signed history has been retained.")}); }
    catch(e) {setMessage(t(errorMessage(e)));}
  }
  if(query.isLoading) return <div className="skeleton" />;
  if(query.error) return <ErrorPanel error={query.error} retry={query.refetch} />;
  const p=query.data;
  if(!p) return null;
  return <>
    <Link href="/projects" className="inline-flex items-center gap-2 muted text-xs mb-7" data-testid="link-back-projects"><ArrowLeft size={14} />{t("Back to projects")}</Link>
    <Heading title={p.name} description={`${p.project_id} · ${p.client_name || t("Internal project")}`}><div className="flex gap-2">{canEdit && <button className="btn" onClick={()=>setEditing(true)} data-testid="button-edit"><Pencil size={15} />{t("Edit")}</button>}{isOwner && <button className="btn danger" onClick={()=>{setMessage("");setDeleting(true);}} aria-label={t("Remove project")} data-testid="button-delete"><Trash2 size={15} /></button>}</div></Heading>
    <div className="metric-grid">{[["Budget",money(p.budget,language)],["Recorded cost",money(p.actual_cost,language)],["Remaining",money(p.budget-p.actual_cost,language)],["Priority",`${p.priority} / 10`]].map(([label,value])=><div className="metric" key={label}><div className="metric-top">{t(label)}</div><div className="metric-value">{value}</div></div>)}</div>
    <div className="split-grid"><div className="stack"><section className="panel"><div className="panel-head"><h2>{t("Project brief")}</h2><Badge status={p.status} /></div><div className="detail-summary"><div className="eyebrow">{t(p.project_type)}</div><p>{p.description || t("No project brief has been added yet.")}</p>{p.rejection_reason && <div className="notice"><strong>{t("Rejection reason")}</strong><br />{p.rejection_reason}</div>}<div className="detail-actions">{actions[p.status].filter(a=>["awaiting_review","draft"].includes(a.status) ? canEdit : canReview).map(a=><button className={`btn ${a.status==="rejected" ? "danger" : "primary"}`} key={a.status} onClick={()=>{setMessage("");setReason("");setDecision(a.status);}} data-testid={`button-${a.status}`}>{a.status==="merged" ? <GitMerge size={15} /> : <CheckCheck size={15} />}{t(a.label)}</button>)}</div></div></section>
      <section className="panel"><div className="panel-head"><h2>{t("Project activity")}</h2><ShieldCheck size={17} className="text-primary" /></div>{history.error ? <ErrorPanel error={history.error} retry={history.refetch} /> : history.isLoading ? <div className="skeleton" /> : <ActivityList items={(history.data || []).filter(e=>e.project_id===id)} />}</section>
    </div><section className="panel h-fit p-6"><Clock3 size={20} className="text-primary mb-5" /><h2 className="text-lg">{t("A clear path to delivery")}</h2><p className="muted text-xs leading-7 mt-3">{t("Draft → Plan approved → Awaiting review → Merged.")}</p><p className="muted text-xs leading-7 mt-3">{t("Approvals here record your decisions. They do not start an AI agent, deploy software, or merge a repository.")}</p><div className="border-t mt-6 pt-5 text-xs muted leading-7">{t("Created")} {date(p.created_at,language)}<br />{t("Updated")} {date(p.updated_at,language)}</div></section></div>
    {editing && <ProjectForm project={p} onClose={()=>setEditing(false)} />}
    <Dialog open={!!decision} onOpenChange={open=>{if(!open && !transition.isPending)setDecision(null);}}><DialogContent className="bg-card text-foreground"><DialogTitle>{decision ? t(labels[decision]) : ""}</DialogTitle><DialogDescription>{t("Record this workflow decision for")} {p.name}. {t("No external automation will run.")}</DialogDescription><label className="form-field mt-3">{t("Decision note")} {t(decision==="rejected" ? "(required)" : "(optional)")}<textarea className="input" rows={3} value={reason} onChange={e=>setReason(e.target.value)} maxLength={2000} data-testid="input-decision-reason" /></label>{message && <p className="error" role="alert">{message}</p>}<div className="form-footer"><button className="btn" disabled={transition.isPending} onClick={()=>setDecision(null)} data-testid="button-cancel-decision">{t("Cancel")}</button><button className="btn primary" disabled={transition.isPending || (decision==="rejected" && !reason.trim())} onClick={changeStatus} data-testid="button-confirm-decision">{t(transition.isPending ? "Recording…" : "Confirm decision")}</button></div></DialogContent></Dialog>
    <Dialog open={deleting} onOpenChange={open=>{if(!remove.isPending)setDeleting(open);}}><DialogContent className="bg-card text-foreground"><DialogTitle>{t("Remove this project?")}</DialogTitle><DialogDescription>{p.name} {t("will be removed from your project list and totals. Its existing signed history will remain in the activity log.")}</DialogDescription>{message && <p className="error">{message}</p>}<div className="form-footer"><button className="btn" disabled={remove.isPending} onClick={()=>setDeleting(false)}>{t("Cancel")}</button><button className="btn danger" disabled={remove.isPending} onClick={deleteItem} data-testid="button-confirm-delete">{t(remove.isPending ? "Removing…" : "Remove project")}</button></div></DialogContent></Dialog>
  </>;
}
export function ActivityPage() {
  const {t}=useLocale();
  const query=useListActivity();
  return <><Heading title="Every decision, recorded." description="The latest 200 signed events across your private room, including removed projects." /><div className="notice">{t("Signatures detect changes to recorded payloads. This is an application audit log, not a compliance-certified or tamper-proof external archive.")}</div>{query.error ? <ErrorPanel error={query.error} retry={query.refetch} /> : query.isLoading ? <div className="skeleton" /> : <section className="panel">{query.data?.length ? <ActivityList items={query.data} /> : <Empty title="No activity yet" text="Create or update a project to start recording your delivery decisions." />}</section>}</>;
}
export function SettingsPage() {
  const {t}=useLocale();
  const query=useGetSystemStatus();
  const integrationCards=[
    {id:"claude",name:"Claude"},
    {id:"gemini",name:"Gemini"},
    {id:"github",name:"GitHub"},
    {id:"slack",name:"Slack"},
    {id:"email",name:"Email"},
  ] as const;
  return <><Heading title="Connection health." description="Real connection state. No simulated agents or automatic actions." />{query.error ? <ErrorPanel error={query.error} retry={query.refetch} /> : query.isLoading ? <div className="skeleton" /> : query.data && <>
    <section className="panel mb-6"><div className="row"><div className="flex items-center gap-4"><Database size={20} className="text-primary" /><div><strong>MongoDB</strong><div className="row-meta mt-1">{t("Persistent project and signed event storage")} · {query.data.dbName} · {t(query.data.environment)}</div></div></div><Badge status={query.data.database} /></div><div className="row"><div className="flex items-center gap-4"><LockKeyhole size={20} className="text-primary" /><div><strong>{query.data.authentication} {t("authentication")}</strong><div className="row-meta mt-1">{t("Verified sign-in · Private account-scoped data")}</div></div></div><span className="pill connected">{t(query.data.clerkMode)}</span></div></section>
    <div className="eyebrow mb-4">{t("External services")}</div><div className="cards">{integrationCards.map(i=>{const configured=query.data.integrations[i.id].configured;return <section className="panel integration" key={i.id}><div className="flex justify-between"><Plug size={21} className="text-primary" /><Badge status={configured?"configured":"not_connected"} /></div><h3>{i.name}</h3><p>{t(configured?"Configuration is present; connection has not been tested.":"Configuration is incomplete; connect this service in a later phase.")}</p></section>})}</div><div className="notice mt-6">{t(query.data.orchestration)} {t("Connection status reflects credential configuration only; it does not verify provider access or enable actions.")}</div>
  </>}</>;
}