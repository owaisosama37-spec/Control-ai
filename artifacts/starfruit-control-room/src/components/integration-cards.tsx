import { useState } from "react";
import { Plug } from "lucide-react";
import {
  useGetIntegrationAccess, useListIntegrations, useTestIntegration, getListIntegrationsQueryKey,
} from "@workspace/api-client-react";
import { useLocale } from "@/lib/locale";

type IntegrationId = "claude" | "gemini" | "github" | "slack" | "email";
type Result = { ok: boolean; message: string };

const services: { id: IntegrationId; name: string }[] = [
  { id: "claude", name: "Claude" },
  { id: "gemini", name: "Gemini" },
  { id: "github", name: "GitHub" },
  { id: "slack", name: "Slack" },
  { id: "email", name: "Email" },
];

export function IntegrationCards({ status }: { status: Record<IntegrationId, { configured: boolean }> }) {
  const { t } = useLocale();
  const access = useGetIntegrationAccess();
  const details = useListIntegrations({ query: { queryKey: getListIntegrationsQueryKey(), enabled: access.data?.isAdmin === true } });
  const test = useTestIntegration();
  const [testing, setTesting] = useState<IntegrationId | null>(null);
  const [results, setResults] = useState<Partial<Record<IntegrationId, Result>>>({});

  async function check(id: IntegrationId) {
    setTesting(id);
    setResults(previous => ({ ...previous, [id]: undefined }));
    try {
      const result = await test.mutateAsync({ id });
      setResults(previous => ({ ...previous, [id]: result }));
    } catch {
      setResults(previous => ({ ...previous, [id]: { ok: false, message: t("Connection test could not be completed.") } }));
    } finally {
      setTesting(null);
    }
  }

  return <>
    <div className="eyebrow mb-4">{t("External services")}</div>
    {access.data?.needsSetup && <div className="notice mb-4" role="status">{t("Integration administration is locked until INTEGRATIONS_ADMIN_USER_ID is added to Secrets.")}</div>}
    {access.data && !access.data.isAdmin && !access.data.needsSetup && <div className="notice mb-4">{t("Only the integration administrator can see missing settings or run connection tests.")}</div>}
    {access.error && <div className="error mb-4" role="alert">{t("Could not check integration administrator access.")}</div>}
    {access.data?.isAdmin && details.error && <div className="error mb-4" role="alert">{t("Could not load integration settings.")} <button className="btn small" onClick={() => void details.refetch()}>{t("Try again")}</button></div>}
    <div className="cards">{services.map(service => {
      const config = details.data?.find(item => item.id === service.id);
      const configured = status[service.id].configured;
      const result = results[service.id];
      const state = !configured ? "not_connected" : result ? (result.ok ? "connected" : "unavailable") : "configured";
      return <section className="panel integration" key={service.id}>
        <div className="flex justify-between">
          <Plug size={21} className="text-primary" />
          <span className={`pill ${state}`} data-testid={`status-${state}`}>{t(state)}</span>
        </div>
        <h3>{service.name}</h3>
        <p>{t(!configured ? "Configuration is incomplete; connect this service in a later phase." : result ? result.message : "Configuration is present; connection has not been tested.")}</p>
        {access.data?.isAdmin && config && <>
          {config.missing.length > 0 && <div className="row-meta mt-3">{t("Missing settings")}: <span className="break-all">{config.missing.map((name, index) => <span key={name}>{index > 0 && ", "}<code>{name}</code></span>)}</span></div>}
          {config.alternatives.length > 0 && <div className="row-meta mt-2">{t("Complete one option")}: {config.alternatives.map((group, index) => <span key={index}>{index > 0 && ` ${t("or")} `}<span className="break-all">({group.map((name, item) => <span key={name}>{item > 0 && " + "}<code>{name}</code></span>)})</span></span>)}</div>}
          <button type="button" className="btn small mt-5" disabled={!configured || testing !== null} onClick={() => void check(service.id)} aria-label={`${t("Test connection")} — ${service.name}`} data-testid={`test-${service.id}`}>
            {testing === service.id ? t("Testing…") : t("Test connection")}
          </button>
          {service.id === "email" && <div className="row-meta mt-2">{t("Testing email sends a message to your verified primary address.")}</div>}
          {(service.id === "claude" || service.id === "gemini") && <div className="row-meta mt-2">{t("AI connection tests may use a small provider request.")}</div>}
        </>}
      </section>;
    })}</div>
  </>;
}