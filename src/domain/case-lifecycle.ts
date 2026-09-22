export type CaseLifecycleState = {
  status: "OPEN" | "IN_REVIEW" | "RESOLVED" | "DISMISSED";
  resolutionSource: "MANUAL" | "AUTOMATIC" | null;
};

export function shouldReopenRecurringCase(
  current: CaseLifecycleState,
): boolean {
  return (
    current.status === "RESOLVED" &&
    current.resolutionSource === "AUTOMATIC"
  );
}
