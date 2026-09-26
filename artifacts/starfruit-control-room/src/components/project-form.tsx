import { useForm } from "react-hook-form";
import { useQueryClient } from "@tanstack/react-query";
import { useCreateProject, useUpdateProject, type Project, type ProjectInput } from "@workspace/api-client-react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Form } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useLocale } from "@/lib/locale";

export function errorMessage(error: unknown) {
  const e = error as { data?: { error?: string }; message?: string };
  return e?.data?.error || e?.message || "The request failed. Please try again.";
}
export function ProjectForm({ project, onClose }: { project?: Project; onClose: () => void }) {
  const {t}=useLocale();
  const client = useQueryClient();
  const { toast } = useToast();
  const create = useCreateProject();
  const update = useUpdateProject();
  const form = useForm<ProjectInput>({ defaultValues: project || {
    name: "", description: "", client_name: "", budget: 0, actual_cost: 0, priority: 5, project_type: "other",
  } });
  const pending = create.isPending || update.isPending;
  const error = create.error || update.error;
  async function submit(data: ProjectInput) {
    try {
      if (project) await update.mutateAsync({ id: project.project_id, data });
      else await create.mutateAsync({ data });
      await client.invalidateQueries();
      toast({ title: t(project ? "Project updated" : "Project created"), description: t("Your changes are saved in MongoDB.") });
      onClose();
    } catch { /* Inline error keeps form values available for retry. */ }
  }
  return <Dialog open onOpenChange={value=>{if (!value && !pending) onClose();}}>
    <DialogContent className="max-w-xl max-h-[90dvh] overflow-auto bg-card text-foreground">
      <DialogTitle className="text-xl">{t(project ? "Edit project" : "Start a new project")}</DialogTitle>
      <DialogDescription>{t("Define the work. Every new project starts as a draft.")}</DialogDescription>
      <Form {...form}><form onSubmit={form.handleSubmit(submit)} className="mt-4">
        <div className="form-grid">
          <div className="form-field wide"><label htmlFor="project-name">{t("Project name")}</label><input id="project-name" className="input" data-testid="input-project-name" {...form.register("name",{ required:true, maxLength:160, validate:v=>!!v.trim() })} placeholder={t("What are you building?")} /></div>
          <div className="form-field wide"><label htmlFor="project-description">{t("Project brief")}</label><textarea id="project-description" className="input" rows={3} data-testid="input-project-description" {...form.register("description",{maxLength:5000})} placeholder={t("Scope, goals, and important context…")} /></div>
          <div className="form-field"><label htmlFor="project-client">{t("Client")}</label><input id="project-client" className="input" data-testid="input-client" {...form.register("client_name",{maxLength:160})} placeholder={t("Client or internal project")} /></div>
          <div className="form-field"><label htmlFor="project-type">{t("Project type")}</label><select id="project-type" className="input" data-testid="select-project-type" {...form.register("project_type")}>{["other","crm","analytics","whatsapp_bot","email_campaign","ecommerce"].map(v=><option key={v} value={v}>{t(v)}</option>)}</select></div>
          <div className="form-field"><label htmlFor="project-budget">{t("Budget (USD)")}</label><input id="project-budget" className="input" type="number" min={0} max={1000000000} step=".01" data-testid="input-budget" {...form.register("budget",{valueAsNumber:true,required:true,min:0,max:1000000000})} /></div>
          <div className="form-field"><label htmlFor="project-cost">{t("Actual cost (USD)")}</label><input id="project-cost" className="input" type="number" min={0} max={1000000000} step=".01" data-testid="input-cost" {...form.register("actual_cost",{valueAsNumber:true,required:true,min:0,max:1000000000})} /></div>
          <div className="form-field wide"><label htmlFor="project-priority">{t("Priority · 1 (lowest) to 10 (highest)")}</label><input id="project-priority" className="input" type="number" min={1} max={10} step={1} data-testid="input-priority" {...form.register("priority",{valueAsNumber:true,required:true,min:1,max:10,validate:Number.isInteger})} /></div>
        </div>
        {Object.keys(form.formState.errors).length > 0 && <p className="error" role="alert">{t("Check the name, amounts, and priority. Amounts must be positive or zero; priority must be a whole number from 1 to 10.")}</p>}
        {error && <p className="error" role="alert">{t(errorMessage(error))}</p>}
        <div className="form-footer"><button type="button" disabled={pending} className="btn" onClick={onClose} data-testid="button-cancel-project">{t("Cancel")}</button><button disabled={pending} className="btn primary" data-testid="button-save-project">{t(pending ? "Saving…" : project ? "Save changes" : "Create project")}</button></div>
      </form></Form>
    </DialogContent>
  </Dialog>;
}