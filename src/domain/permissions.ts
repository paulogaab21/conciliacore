export type AppRole = "ADMIN" | "ANALYST" | "AUDITOR";

export function canManageCases(role: AppRole): boolean {
  return role === "ADMIN" || role === "ANALYST";
}

export function isAdmin(role: AppRole): boolean {
  return role === "ADMIN";
}
