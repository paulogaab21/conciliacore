import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import "./styles/foundation.css";
import "./styles/login.css";
import "./styles/shell.css";
import "./styles/overview.css";
import "./styles/secondary-views.css";
import "./styles/case-drawer.css";
import "./styles/feedback.css";
import "./styles/theme-shell.css";
import "./styles/theme-overview.css";
import "./styles/theme-data.css";
import "./styles/theme-login.css";
import "./styles/motion.css";
import { PwaRegister } from "@/components/pwa-register";
import { LocaleProvider } from "@/i18n/locale-provider";
import {
  defaultLocale,
  dictionaries,
  isLocale,
  localeCookieName,
  type Locale,
} from "@/i18n/messages";

async function getRequestLocale(): Promise<Locale> {
  const value = (await cookies()).get(localeCookieName)?.value;
  return isLocale(value) ? value : defaultLocale;
}

export async function generateMetadata(): Promise<Metadata> {
  const locale = await getRequestLocale();
  const messages = dictionaries[locale];

  return {
    applicationName: "ConciliaCore",
    title: {
      default: messages["metadata.defaultTitle"],
      template: "%s | ConciliaCore",
    },
    description: messages["metadata.description"],
    manifest: "/manifest.webmanifest",
    icons: {
      icon: "/favicon.svg",
      apple: "/icons/apple-touch-icon.png",
    },
    appleWebApp: {
      capable: true,
      title: "ConciliaCore",
      statusBarStyle: "black-translucent",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#f3f7f4",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const locale = await getRequestLocale();

  return (
    <html lang={locale}>
      <body>
        <LocaleProvider initialLocale={locale}>
          {children}
          <PwaRegister />
        </LocaleProvider>
      </body>
    </html>
  );
}
