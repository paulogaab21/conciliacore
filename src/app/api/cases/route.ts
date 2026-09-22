import { NextResponse } from "next/server";
import { z } from "zod";
import { handleApiError, requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const caseFiltersSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED", "DISMISSED"]).optional(),
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]).optional(),
  type: z
    .enum([
      "UNMATCHED_PAYMENT",
      "AMOUNT_MISMATCH",
      "DUPLICATE_PAYMENT",
      "ORDER_STATUS_MISMATCH",
      "REFUND_MISMATCH",
      "MISSING_PAYMENT",
    ])
    .optional(),
});

export async function GET(request: Request) {
  try {
    const session = await requireApiSession();
    const url = new URL(request.url);
    const filters = caseFiltersSchema.parse({
      status: url.searchParams.get("status") ?? undefined,
      severity: url.searchParams.get("severity") ?? undefined,
      type: url.searchParams.get("type") ?? undefined,
    });

    const cases = await prisma.reconciliationCase.findMany({
      where: {
        organizationId: session.organizationId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.severity ? { severity: filters.severity } : {}),
        ...(filters.type ? { type: filters.type } : {}),
      },
      include: {
        order: true,
        payment: true,
        assignedTo: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    });

    return NextResponse.json({ cases });
  } catch (error) {
    return handleApiError(error);
  }
}
