import { describe, expect, it } from "vitest";
import { shouldReopenRecurringCase } from "@/domain/case-lifecycle";

describe("shouldReopenRecurringCase", () => {
  it("reopens a recurring case that the reconciliation engine resolved", () => {
    expect(
      shouldReopenRecurringCase({
        status: "RESOLVED",
        resolutionSource: "AUTOMATIC",
      }),
    ).toBe(true);
  });

  it("preserves a manual resolution when the same fingerprint recurs", () => {
    expect(
      shouldReopenRecurringCase({
        status: "RESOLVED",
        resolutionSource: "MANUAL",
      }),
    ).toBe(false);
  });

  it("treats legacy resolutions without a source conservatively", () => {
    expect(
      shouldReopenRecurringCase({
        status: "RESOLVED",
        resolutionSource: null,
      }),
    ).toBe(false);
  });

  it("does not change a case that is already actionable", () => {
    expect(
      shouldReopenRecurringCase({
        status: "IN_REVIEW",
        resolutionSource: "AUTOMATIC",
      }),
    ).toBe(false);
  });
});
