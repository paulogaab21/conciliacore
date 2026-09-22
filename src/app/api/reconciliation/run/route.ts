import { NextResponse } from "next/server";
import { canManageCases } from "@/domain/permissions";
import { ApiError, handleApiError, requireApiSession } from "@/lib/api";
import { runReconciliation } from "@/lib/reconciliation-service";

export async function POST() {
  try {
    const session = await requireApiSession();
    if (!canManageCases(session.role)) {
      throw new ApiError(403, "Your role cannot start reconciliation", "FORBIDDEN");
    }

    const run = await runReconciliation(
      session.organizationId,
      "MANUAL",
      session.userId,
    );
    return NextResponse.json({ run });
  } catch (error) {
    return handleApiError(error);
  }
}
