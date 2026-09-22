import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { LoginPageContent } from "@/components/login-page-content";
import {
  defaultLocale,
  dictionaries,
  isLocale,
  localeCookieName,
} from "@/i18n/messages";

export async function generateMetadata(): Promise<Metadata> {
  const value = (await cookies()).get(localeCookieName)?.value;
  const locale = isLocale(value) ? value : defaultLocale;
  return { title: dictionaries[locale]["metadata.loginTitle"] };
}

export default async function LoginPage() {
  if (await getSession()) redirect("/app");

  return <LoginPageContent />;
}
