import { describe, expect, it } from "vitest";
import { canManageCases, isAdmin } from "@/domain/permissions";

describe("role permissions", () => {
  it("allows administrators and analysts to manage reconciliation cases", () => {
    expect(canManageCases("ADMIN")).toBe(true);
    expect(canManageCases("ANALYST")).toBe(true);
  });

  it("keeps auditors read-only", () => {
    expect(canManageCases("AUDITOR")).toBe(false);
    expect(isAdmin("AUDITOR")).toBe(false);
  });

  it("restricts demo reset to administrators", () => {
    expect(isAdmin("ADMIN")).toBe(true);
    expect(isAdmin("ANALYST")).toBe(false);
  });
});
