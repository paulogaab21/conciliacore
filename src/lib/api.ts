import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import type { Session } from "@/contracts/session";
import { getSession } from "@/lib/auth";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "API_ERROR",
  ) {
    super(message);
  }
}

export async function requireApiSession(): Promise<Session> {
  const session = await getSession();
  if (!session) {
    throw new ApiError(401, "Authentication required", "UNAUTHORIZED");
  }
  return session;
}

export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status },
    );
  }

  if (error instanceof ZodError) {
    return NextResponse.json(
      {
        error: "Invalid request",
        code: "VALIDATION_ERROR",
        details: error.issues,
      },
      { status: 400 },
    );
  }

  if (error instanceof SyntaxError) {
    return NextResponse.json(
      { error: "Invalid JSON body", code: "INVALID_JSON" },
      { status: 400 },
    );
  }

  console.error(error);
  return NextResponse.json(
    { error: "Unexpected server error", code: "INTERNAL_ERROR" },
    { status: 500 },
  );
}
