import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { Dashboard } from "@/components/dashboard";
import {
  defaultLocale,
  dictionaries,
  isLocale,
  localeCookieName,
} from "@/i18n/messages";

export async function generateMetadata(): Promise<Metadata> {
  const value = (await cookies()).get(localeCookieName)?.value;
  const locale = isLocale(value) ? value : defaultLocale;
  return { title: dictionaries[locale]["metadata.dashboardTitle"] };
}

export default async function AppPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  return <Dashboard initialSession={session} />;
}
