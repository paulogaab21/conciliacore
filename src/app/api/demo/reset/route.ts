import { NextResponse } from "next/server";
import { isAdmin } from "@/domain/permissions";
import { ApiError, handleApiError, requireApiSession } from "@/lib/api";
import { seedDemoData } from "@/lib/demo-data";
import { getServerEnv } from "@/lib/env";

export async function POST() {
  try {
    const session = await requireApiSession();
    if (!isAdmin(session.role)) {
      throw new ApiError(403, "Only administrators can restore demo data", "FORBIDDEN");
    }

    if (session.organizationSlug !== "acme-commerce") {
      throw new ApiError(403, "Restore is available only in the demo environment", "FORBIDDEN");
    }

    const env = getServerEnv();
    await seedDemoData({
      encryptionKey: env.ENCRYPTION_KEY,
      webhookSecret: env.DEMO_WEBHOOK_SECRET,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return handleApiError(error);
  }
}
