import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldAlert } from "lucide-react";
import { getGetRoomOperationsQueryKey, useEmergencyResume, useEmergencyStop, useGetRoomOperations } from "@workspace/api-client-react";
import { errorMessage } from "./project-form";

export function RoomSafetyControls({ isOwner }: { isOwner: boolean }) {
  const query = useGetRoomOperations({ query: { queryKey: getGetRoomOperationsQueryKey(), refetchInterval: 15_000 } });
  const stop = useEmergencyStop();
  const resume = useEmergencyResume();
  const client = useQueryClient();
  const [message, setMessage] = useState("");
  const busy = stop.isPending || resume.isPending;

  async function change(stopped: boolean) {
    if (!window.confirm(stopped
      ? "Freeze all project and member changes in this room until you resume them?"
      : "Allow project and member changes in this room again?")) return;
    setMessage("");
    try {
      if (stopped) await stop.mutateAsync();
      else await resume.mutateAsync();
      await client.invalidateQueries();
    } catch (error) {
      setMessage(errorMessage(error));
      await query.refetch();
    }
  }

  return <section className="panel p-5 mb-6" aria-label="Room safety controls">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-start gap-3">
        <ShieldAlert size={20} className="text-primary mt-1 shrink-0" />
        <div>
          <strong>Room safety · أمان الغرفة</strong>
          <p className="row-meta mt-1" role="status" data-testid="status-emergency-stop">
            {query.isLoading ? "Checking room state…" : query.error ? "Could not check room state." :
              query.data?.stopped ? "Emergency stop active · الإيقاف الطارئ مفعّل" : "Manual mode · الوضع اليدوي"}
          </p>
          {query.error && <button type="button" className="btn small mt-2" onClick={() => void query.refetch()} data-testid="button-retry-room-state">Retry · إعادة المحاولة</button>}
          <p className="row-meta mt-1">Emergency stop freezes project and member changes. No autonomous agents run in this app.</p>
        </div>
      </div>
      {isOwner && query.data && <button type="button"
        className={`btn ${query.data.stopped ? "primary" : "danger"}`}
        disabled={busy} onClick={() => void change(!query.data!.stopped)}
        data-testid={query.data.stopped ? "button-emergency-resume" : "button-emergency-stop"}>
        {busy ? "Updating…" : query.data.stopped ? "Resume room · استئناف" : "Emergency stop · إيقاف طارئ"}
      </button>}
    </div>
    {message && <p className="error mt-3" role="alert">{message}</p>}
  </section>;
}