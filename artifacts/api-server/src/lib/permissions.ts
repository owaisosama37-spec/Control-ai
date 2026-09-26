export type Role = "owner" | "editor" | "reviewer" | "viewer";
export type Permission = "read" | "edit" | "review" | "delete" | "members";
export function allows(role: string | undefined, permission: Permission) {
  return role === "owner" ||
    (["editor", "reviewer", "viewer"].includes(role ?? "") && permission === "read") ||
    (role === "editor" && permission === "edit") ||
    (role === "reviewer" && permission === "review");
}
export function roomFilter(owner: string) {
  if (!owner) throw new Error("Room owner is required");
  return { owner_id: owner };
}