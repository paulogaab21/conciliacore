import { CaseStatus } from "@prisma/client";
import { NextResponse } from "next/server";
import { z } from "zod";
import { canManageCases } from "@/domain/permissions";
import { ApiError, handleApiError, requireApiSession } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

const updateCaseSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "DISMISSED"]).optional(),
  assignedToId: z.string().nullable().optional(),
}).refine(
  (input) => input.status !== undefined || input.assignedToId !== undefined,
  { message: "Provide a status or assignedToId" },
);

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiSession();
    const { id } = await context.params;
    const item = await prisma.reconciliationCase.findFirst({
      where: { id, organizationId: session.organizationId },
      include: {
        order: true,
        payment: true,
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });
    if (!item) throw new ApiError(404, "Exception not found", "NOT_FOUND");
    return NextResponse.json({ case: item });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const session = await requireApiSession();
    if (!canManageCases(session.role)) {
      throw new ApiError(403, "Your role cannot update exceptions", "FORBIDDEN");
    }

    const { id } = await context.params;
    const input = updateCaseSchema.parse(await request.json());
    const current = await prisma.reconciliationCase.findFirst({
      where: { id, organizationId: session.organizationId },
    });
    if (!current) throw new ApiError(404, "Exception not found", "NOT_FOUND");

    if (input.assignedToId) {
      const assignee = await prisma.user.findFirst({
        where: { id: input.assignedToId, organizationId: session.organizationId },
      });
      if (!assignee) throw new ApiError(400, "Invalid assignee", "INVALID_ASSIGNEE");
    }

    const updated = await prisma.reconciliationCase.update({
      where: { id },
      data: {
        ...(input.status
          ? {
              status: input.status as CaseStatus,
              resolution: null,
              resolutionSource: null,
              resolvedAt: null,
            }
          : {}),
        ...(input.assignedToId !== undefined
          ? { assignedToId: input.assignedToId }
          : {}),
      },
      include: {
        order: true,
        payment: true,
        assignedTo: { select: { id: true, name: true, email: true } },
      },
    });

    await writeAuditLog({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "CASE_UPDATED",
      entityType: "ReconciliationCase",
      entityId: id,
      summary: `${session.name} updated the exception workflow.`,
      metadata: input,
    });

    return NextResponse.json({ case: updated });
  } catch (error) {
    return handleApiError(error);
  }
}
