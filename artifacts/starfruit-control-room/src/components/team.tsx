import { createContext, useContext, useState } from "react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { setRoomOwner, useListRooms, useListMembers, useSaveMember, useRemoveMember, type MemberInput } from "@workspace/api-client-react";
import { errorMessage } from "./project-form";
import { RoomSafetyControls } from "./room-safety-controls";

const Access = createContext({ role: "viewer", owner: "" });
export const useRoomAccess = () => {
  const access = useContext(Access);
  return { ...access, canEdit: ["owner", "editor"].includes(access.role), canReview: ["owner", "reviewer"].includes(access.role), isOwner: access.role === "owner" };
};
export function TeamBoundary({ children }: { children: React.ReactNode }) {
  const { user } = useUser();
  const [owner] = useState(() => {
    const selected = sessionStorage.getItem(`room:${user!.id}`) || user!.id;
    setRoomOwner(selected);
    return selected;
  });
  const rooms = useListRooms();
  const access = rooms.data?.find(r => r.owner_id === owner);
  function switchRoom(value: string) {
    sessionStorage.setItem(`room:${user!.id}`, value);
    // A fresh page prevents cached results and in-flight mutations crossing rooms.
    window.location.assign(`${import.meta.env.BASE_URL}dashboard`);
  }
  if (rooms.error) return <div className="error" role="alert">{errorMessage(rooms.error)}<button className="btn" onClick={() => rooms.refetch()}>Retry</button></div>;
  if (!rooms.data) return <p>Loading room access…</p>;
  return <Access.Provider value={{ role: access?.role ?? "viewer", owner }}>
    <div className="toolbar"><label className="form-field">Active room<select aria-label="Active room" className="input" value={access ? owner : ""} onChange={e => switchRoom(e.target.value)}>
      {!access && <option value="">Access revoked — choose a room</option>}
      {rooms.data.map(r => <option key={r.owner_id} value={r.owner_id}>{r.owner_id === user!.id ? "My room" : `Team: ${r.owner_id}`} · {r.role}</option>)}
    </select></label><span className="muted text-xs">{access ? `Your role: ${access.role}` : "You no longer have access to this room."}</span></div>
    {access && <><RoomSafetyControls isOwner={access.role === "owner"} />{children}</>}
  </Access.Provider>;
}

export function TeamPage() {
  const { user } = useUser();
  const { owner, isOwner } = useRoomAccess();
  const members = useListMembers();
  const save = useSaveMember();
  const remove = useRemoveMember();
  const client = useQueryClient();
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<MemberInput["role"]>("viewer");
  const [message, setMessage] = useState("");
  const busy = save.isPending || remove.isPending;
  async function update(data: MemberInput) {
    setMessage("");
    try { await save.mutateAsync({ data }); setUserId(""); await client.invalidateQueries(); }
    catch (e) { setMessage(errorMessage(e)); }
  }
  async function revoke(id: string) {
    if (!window.confirm("Remove this member’s access to all projects and history in this room?")) return;
    setMessage("");
    try { await remove.mutateAsync({ userId: id }); await client.invalidateQueries(); }
    catch (e) { setMessage(errorMessage(e)); }
  }
  return <><div className="page-heading"><div><div className="eyebrow">Room permissions</div><h1>Team & access.</h1><p>Sharing grants access to all projects and history in the selected room.</p></div></div>
    <div className="notice">Your account ID: <code className="break-all">{user?.id}</code><br />Share this ID with a room owner to join their team. Members must sign up first.</div>
    <section className="panel p-6 mb-6"><h2>Roles</h2><p className="muted leading-7 text-sm">Owner: all actions, final delivery decision, member management, and deletion.<br />Editor: create and edit projects, submit for review, and return rejected work to draft.<br />Reviewer: approve plans, reject, pause, and resume projects; cannot record final delivery.<br />Viewer: read projects, budgets, members, and activity only.</p><p className="muted text-xs mt-4">The owner is permanent. Unowned legacy records remain inaccessible.</p></section>
    {isOwner && <form className="panel p-6 mb-6" onSubmit={e => { e.preventDefault(); void update({ user_id: userId.trim(), role }); }}>
      <h2>Add a member</h2><label className="form-field mt-4">Clerk account ID<input className="input" required pattern="user_[a-zA-Z0-9]+" maxLength={128} value={userId} onChange={e => setUserId(e.target.value)} placeholder="user_…" /></label>
      <label className="form-field mt-4">Role<select className="input" value={role} onChange={e => setRole(e.target.value as MemberInput["role"])}>{["viewer", "editor", "reviewer"].map(r => <option key={r}>{r}</option>)}</select></label>
      <p className="muted text-xs my-4">Saving an existing member updates their role. This immediately grants access; no invitation email is sent.</p><button className="btn primary" disabled={busy}>Save membership</button>
    </form>}
    {message && <p className="error" role="alert">{message}</p>}
    {members.error ? <div className="error" role="alert">{errorMessage(members.error)}<button className="btn" onClick={() => members.refetch()}>Retry</button></div> : members.isLoading ? <p>Loading members…</p> : <section className="panel">{members.data?.map(m => <div className="row flex-wrap gap-3" key={m.user_id}><code className="break-all text-xs">{m.user_id}{m.user_id === user?.id ? " (you)" : ""}</code>
      {isOwner && m.user_id !== owner ? <div className="flex gap-2"><select className="input" aria-label={`Role for ${m.user_id}`} value={m.role} disabled={busy} onChange={e => void update({ user_id: m.user_id, role: e.target.value as MemberInput["role"] })}>{["viewer", "editor", "reviewer"].map(r => <option key={r}>{r}</option>)}</select><button className="btn danger" disabled={busy} onClick={() => void revoke(m.user_id)}>Remove</button></div> : <span className="pill">{m.role}</span>}
    </div>)}</section>}
  </>;
}