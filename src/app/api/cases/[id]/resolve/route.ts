import { CaseResolutionSource, CaseStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageCases } from "@/domain/permissions";
import { ApiError, handleApiError, requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";

const resolveSchema = z.object({
  resolution: z.string().trim().min(10).max(500),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiSession();
    if (!canManageCases(session.role)) {
      throw new ApiError(403, "Your role cannot resolve exceptions", "FORBIDDEN");
    }

    const { id } = await context.params;
    const input = resolveSchema.parse(await request.json());
    const current = await prisma.reconciliationCase.findFirst({
      where: { id, organizationId: session.organizationId },
    });
    if (!current) throw new ApiError(404, "Exception not found", "NOT_FOUND");

    const updated = await prisma.$transaction(async (tx) => {
      const item = await tx.reconciliationCase.update({
        where: { id },
        data: {
          status: CaseStatus.RESOLVED,
          resolution: input.resolution,
          resolutionSource: CaseResolutionSource.MANUAL,
          resolvedAt: new Date(),
          assignedToId: current.assignedToId ?? session.userId,
        },
        include: {
          order: true,
          payment: true,
          assignedTo: { select: { id: true, name: true, email: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          organizationId: session.organizationId,
          actorId: session.userId,
          action: "CASE_RESOLVED",
          entityType: "ReconciliationCase",
          entityId: id,
          summary: `${session.name} resolved “${current.title}”.`,
          metadata: { resolution: input.resolution },
        },
      });

      return item;
    });

    return NextResponse.json({ case: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
