import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type AuditInput = {
  organizationId: string;
  actorId?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  summary: string;
  metadata?: Prisma.InputJsonValue;
  ipAddress?: string | null;
};

export async function writeAuditLog(input: AuditInput): Promise<void> {
  await prisma.auditLog.create({
    data: {
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      summary: input.summary,
      metadata: input.metadata,
      ipAddress: input.ipAddress,
    },
  });
}
