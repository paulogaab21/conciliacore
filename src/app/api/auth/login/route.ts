import { compare } from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createSession } from "@/lib/auth";
import { handleApiError } from "@/lib/api";
import { prisma } from "@/lib/prisma";
import { writeAuditLog } from "@/lib/audit";

const loginSchema = z.object({
  email: z.string().email().transform((value) => value.toLowerCase()),
  password: z.string().min(8).max(128),
});

const INVALID_PASSWORD_HASH =
  "$2b$12$/8rLJDeR3D/f70Yz/ncfm.0dEXB.swCQ0LQ4vFLGHw/.lIbS0hR42";

export async function POST(request: Request) {
  try {
    const input = loginSchema.parse(await request.json());
    const user = await prisma.user.findUnique({
      where: { email: input.email },
      include: { organization: true },
    });
    const passwordMatches = await compare(
      input.password,
      user?.passwordHash ?? INVALID_PASSWORD_HASH,
    );

    if (!user || !passwordMatches) {
      return NextResponse.json(
        { error: "Invalid email or password", code: "INVALID_CREDENTIALS" },
        { status: 401 },
      );
    }

    await createSession(user.id);

    await writeAuditLog({
      organizationId: user.organizationId,
      actorId: user.id,
      action: "USER_LOGGED_IN",
      entityType: "User",
      entityId: user.id,
      summary: `${user.name} signed in.`,
      ipAddress: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    });

    return NextResponse.json({ ok: true, redirectTo: "/app" });
  } catch (error) {
    return handleApiError(error);
  }
}
