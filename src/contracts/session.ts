import type { AppRole } from "@/domain/permissions";

export type Session = {
  userId: string;
  organizationId: string;
  organizationSlug: string;
  name: string;
  email: string;
  role: AppRole;
};
