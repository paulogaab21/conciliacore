"use client";

import { useState, type FormEvent } from "react";
import { ArrowRight, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail } from "lucide-react";
import { useRouter } from "next/navigation";
import { useLocale } from "@/i18n/locale-provider";

const DEMO_EMAIL = "admin@conciliacore.dev";
const DEMO_PASSWORD = "Demo@123";

export function LoginForm() {
  const router = useRouter();
  const { t } = useLocale();
  const [email, setEmail] = useState(DEMO_EMAIL);
  const [password, setPassword] = useState(DEMO_PASSWORD);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const body = (await response.json()) as {
        code?: string;
        redirectTo?: string;
      };
      if (!response.ok) {
        throw new Error(
          body.code === "INVALID_CREDENTIALS"
            ? t("login.invalidCredentials")
            : t("login.error"),
        );
      }
      router.push(body.redirectTo ?? "/app");
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("login.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={handleSubmit}>
      <label>
        <span>{t("login.email")}</span>
        <div className="input-wrap">
          <Mail size={17} aria-hidden="true" />
          <input
            type="email"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            required
          />
        </div>
      </label>
      <label>
        <span>{t("login.password")}</span>
        <div className="input-wrap">
          <LockKeyhole size={17} aria-hidden="true" />
          <input
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
          <button
            className="input-wrap__action"
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
          >
            {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
          </button>
        </div>
      </label>

      {error && <div className="form-error" role="alert">{error}</div>}

      <button className="button button--primary button--large" type="submit" disabled={loading}>
        {loading ? <LoaderCircle className="spin" size={18} /> : <>{t("login.submit")} <ArrowRight size={18} /></>}
      </button>

      <div className="demo-credentials">
        <span>{t("login.demoAccess")}</span>
        <code>{DEMO_EMAIL}</code>
        <code>{DEMO_PASSWORD}</code>
      </div>
    </form>
  );
}
