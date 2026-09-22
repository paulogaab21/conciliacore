import "server-only";

import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { z } from "zod";
import type { Session } from "@/contracts/session";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/prisma";

const SESSION_COOKIE = "conciliacore_session";

const sessionTokenSchema = z.object({
  userId: z.string(),
});

function authKey(): Uint8Array {
  return new TextEncoder().encode(getServerEnv().AUTH_SECRET);
}

function usesSecureCookies(): boolean {
  return new URL(getServerEnv().NEXT_PUBLIC_APP_URL).protocol === "https:";
}

export async function createSession(userId: string): Promise<void> {
  const token = await new SignJWT({ userId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h")
    .sign(authKey());

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: usesSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: usesSecureCookies(),
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, authKey(), {
      algorithms: ["HS256"],
    });
    const claims = sessionTokenSchema.parse(payload);
    const user = await prisma.user.findUnique({
      where: { id: claims.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        organizationId: true,
        organization: { select: { slug: true } },
      },
    });

    if (!user) return null;

    return {
      userId: user.id,
      organizationId: user.organizationId,
      organizationSlug: user.organization.slug,
      name: user.name,
      email: user.email,
      role: user.role,
    };
  } catch {
    return null;
  }
}
