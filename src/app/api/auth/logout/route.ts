import { NextResponse } from "next/server";
import { clearSession, getSession } from "@/lib/auth";
import { writeAuditLog } from "@/lib/audit";

export async function POST() {
  const session = await getSession();
  if (session) {
    await writeAuditLog({
      organizationId: session.organizationId,
      actorId: session.userId,
      action: "USER_LOGGED_OUT",
      entityType: "User",
      entityId: session.userId,
      summary: `${session.name} signed out.`,
    });
  }

  await clearSession();
  return NextResponse.json({ ok: true });
}
