"use client";

import {
  AlertTriangle,
  CheckCircle2,
  CreditCard,
  FileClock,
  FlaskConical,
  LayoutDashboard,
  LoaderCircle,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCcw,
  ShieldCheck,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from "react";
import { CaseDrawer } from "@/components/dashboard/case-drawer";
import { GuaranteesView } from "@/components/dashboard/guarantees-view";
import {
  AuditView,
  ExceptionsView,
  TransactionsView,
} from "@/components/dashboard/operations-views";
import { Overview } from "@/components/dashboard/overview-view";
import { humanize, initials } from "@/components/dashboard/shared";
import type {
  CaseStatus,
  DashboardData,
  ReconciliationCase,
  Toast,
  View,
} from "@/components/dashboard/types";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Logo } from "@/components/logo";
import type { Session } from "@/contracts/session";
import { useLocale } from "@/i18n/locale-provider";

const mobileNavigationQuery = "(max-width: 960px)";

function subscribeToMobileNavigation(onChange: () => void) {
  const media = window.matchMedia(mobileNavigationQuery);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

function getMobileNavigationSnapshot() {
  return window.matchMedia(mobileNavigationQuery).matches;
}

export function Dashboard({ initialSession }: { initialSession: Session }) {
  const router = useRouter();
  const { t } = useLocale();
  const [data, setData] = useState<DashboardData | null>(null);
  const [view, setView] = useState<View>("overview");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedCase, setSelectedCase] = useState<ReconciliationCase | null>(null);
  const [toast, setToast] = useState<Toast>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [caseSearch, setCaseSearch] = useState("");
  const [caseFilter, setCaseFilter] = useState<"ALL" | CaseStatus>("ALL");
  const mobileMenuRef = useRef<HTMLButtonElement>(null);
  const mobileCloseRef = useRef<HTMLButtonElement>(null);
  const isMobileNavigation = useSyncExternalStore(
    subscribeToMobileNavigation,
    getMobileNavigationSnapshot,
    () => false,
  );

  const loadDashboard = useCallback(async () => {
    const response = await fetch("/api/dashboard", { cache: "no-store" });
    if (response.status === 401) {
      router.push("/login");
      router.refresh();
      return;
    }
    if (!response.ok) throw new Error(t("dashboard.loadError"));
    setData((await response.json()) as DashboardData);
  }, [router, t]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadDashboard()
        .catch((error) => setToast({ tone: "error", message: error.message }))
        .finally(() => setLoading(false));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [loadDashboard]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    if (!sidebarOpen || !isMobileNavigation) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusFrame = window.requestAnimationFrame(() => mobileCloseRef.current?.focus());

    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setSidebarOpen(false);
        window.requestAnimationFrame(() => mobileMenuRef.current?.focus());
      }
    }

    window.addEventListener("keydown", closeOnEscape);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.cancelAnimationFrame(focusFrame);
      window.removeEventListener("keydown", closeOnEscape);
    };
  }, [isMobileNavigation, sidebarOpen]);

  useEffect(() => {
    if (isMobileNavigation || !sidebarOpen) return;
    const frame = window.requestAnimationFrame(() => setSidebarOpen(false));
    return () => window.cancelAnimationFrame(frame);
  }, [isMobileNavigation, sidebarOpen]);

  const filteredCases = useMemo(() => {
    if (!data) return [];
    const query = caseSearch.trim().toLowerCase();
    return data.cases.filter((item) => {
      const matchesStatus = caseFilter === "ALL" || item.status === caseFilter;
      const matchesQuery =
        !query ||
        item.title.toLowerCase().includes(query) ||
        item.order?.externalId.toLowerCase().includes(query) ||
        item.payment?.transactionId.toLowerCase().includes(query);
      return matchesStatus && matchesQuery;
    });
  }, [caseFilter, caseSearch, data]);

  async function runAction(
    key: string,
    url: string,
    body: Record<string, unknown> | undefined,
    successMessage: string,
  ) {
    setActionLoading(key);
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: body ? { "content-type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      if (!response.ok) throw new Error(t("dashboard.actionError"));
      await loadDashboard();
      setToast({ tone: "success", message: successMessage });
    } catch (error) {
      setToast({
        tone: "error",
        message: error instanceof Error ? error.message : t("dashboard.actionError"),
      });
    } finally {
      setActionLoading(null);
    }
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  function changeView(nextView: View) {
    setView(nextView);
    setSidebarOpen(false);
    if (isMobileNavigation) {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLElement>(".page-heading h1")?.focus();
      });
    }
  }

  function closeMobileSidebar() {
    setSidebarOpen(false);
    window.requestAnimationFrame(() => mobileMenuRef.current?.focus());
  }

  const navGroups: Array<{
    label: string;
    items: Array<{ id: View; label: string; icon: ReactNode; count?: number }>;
  }> = [
    {
      label: t("dashboard.nav.operation"),
      items: [
        { id: "overview", label: t("dashboard.nav.overview"), icon: <LayoutDashboard size={18} /> },
        {
          id: "exceptions",
          label: t("dashboard.nav.exceptions"),
          icon: <AlertTriangle size={18} />,
          count: data?.metrics.openCases,
        },
        { id: "transactions", label: t("dashboard.nav.transactions"), icon: <CreditCard size={18} /> },
      ],
    },
    {
      label: t("dashboard.nav.engineering"),
      items: [
        { id: "guarantees", label: t("dashboard.nav.guarantees"), icon: <ShieldCheck size={18} /> },
        { id: "audit", label: t("dashboard.nav.audit"), icon: <FileClock size={18} /> },
      ],
    },
  ];

  const organizationName = data?.organization.name ?? "Acme Commerce";

  return (
    <div className="app-shell">
      <button
        className={`mobile-scrim ${sidebarOpen ? "mobile-scrim--visible" : ""}`}
        onClick={closeMobileSidebar}
        aria-label={t("dashboard.closeNavigation")}
        aria-hidden={!sidebarOpen}
        tabIndex={sidebarOpen ? 0 : -1}
      />
      <aside
        id="primary-navigation"
        className={`sidebar ${sidebarOpen ? "sidebar--open" : ""} ${sidebarCollapsed ? "sidebar--collapsed" : ""}`}
        aria-label={t("dashboard.mainNavigation")}
        aria-hidden={isMobileNavigation && !sidebarOpen}
        inert={isMobileNavigation && !sidebarOpen ? true : undefined}
      >
        <div className="sidebar__brand-row">
          <Logo inverse />
          <button
            className="sidebar__collapse"
            onClick={() => setSidebarCollapsed((current) => !current)}
            aria-label={sidebarCollapsed ? t("dashboard.expandMenu") : t("dashboard.collapseMenu")}
            aria-controls="primary-navigation"
            aria-expanded={!sidebarCollapsed}
          >
            {sidebarCollapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <button ref={mobileCloseRef} className="sidebar__close" onClick={closeMobileSidebar} aria-label={t("dashboard.closeMenu")}>
            <X size={19} />
          </button>
        </div>

        <div className="workspace-switcher" title={sidebarCollapsed ? organizationName : undefined}>
          <span className="workspace-switcher__avatar">{initials(organizationName)}</span>
          <span><small>{t("dashboard.organization")}</small><strong>{organizationName}</strong></span>
        </div>

        <nav className="sidebar__nav" aria-label={t("dashboard.mainNavigation")}>
          {navGroups.map((group) => (
            <div className="sidebar__group" key={group.label}>
              <span className="sidebar__section-label">{group.label}</span>
              {group.items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  className={`nav-item ${view === item.id ? "nav-item--active" : ""}`}
                  onClick={() => changeView(item.id)}
                  aria-current={view === item.id ? "page" : undefined}
                  aria-label={item.count ? `${item.label}, ${t("dashboard.openCount", { count: item.count })}` : item.label}
                  data-tooltip={sidebarCollapsed ? `${item.label}${item.count ? ` · ${t("dashboard.openCount", { count: item.count })}` : ""}` : undefined}
                >
                  {item.icon}<span>{item.label}</span>
                  {!!item.count && <b aria-label={t("dashboard.openExceptionsCount", { count: item.count })}>{item.count}</b>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="sidebar__bottom">
          <div className="system-card">
            <div><span className="system-card__pulse" /><strong>{t("dashboard.demoAvailable")}</strong></div>
            <p>{t("dashboard.syntheticTestData")}</p>
          </div>
          <div className="sidebar-user" title={sidebarCollapsed ? `${initialSession.name} · ${humanize(initialSession.role, t)}` : undefined}>
            <span className="avatar">{initials(initialSession.name)}</span>
            <span><strong>{initialSession.name}</strong><small>{humanize(initialSession.role, t)}</small></span>
            <button onClick={logout} aria-label={t("dashboard.signOut")}><LogOut size={17} /></button>
          </div>
        </div>
      </aside>

      <main
        className={`main-area ${sidebarCollapsed ? "main-area--expanded" : ""}`}
        aria-hidden={isMobileNavigation && sidebarOpen}
        inert={isMobileNavigation && sidebarOpen ? true : undefined}
      >
        <header className="topbar">
          <button
            ref={mobileMenuRef}
            className="mobile-menu"
            onClick={() => setSidebarOpen(true)}
            aria-label={t("dashboard.openMenu")}
            aria-controls="primary-navigation"
            aria-expanded={sidebarOpen}
          >
            <Menu size={21} />
          </button>
          <div className="topbar__context">
            <strong>ConciliaCore</strong>
            <span>{t("dashboard.financialOperations")}</span>
          </div>
          <div className="topbar__right">
            <LanguageSwitcher compact />
            <span className="environment"><i /> {t("dashboard.demo")}</span>
            <span className="topbar__divider" />
            <span className="avatar avatar--small">{initials(initialSession.name)}</span>
          </div>
        </header>

        <div className="content-area">
          <div className="demo-banner">
            <div><FlaskConical size={16} /><span><strong>{t("dashboard.demoEnvironment")}</strong> {t("dashboard.demoNotice")}</span></div>
            <button
              onClick={() => runAction("reset", "/api/demo/reset", undefined, t("dashboard.resetSuccess"))}
              disabled={actionLoading === "reset"}
            >
              {actionLoading === "reset" ? <LoaderCircle className="spin" size={14} /> : <RefreshCcw size={14} />}
              {t("dashboard.restoreData")}
            </button>
          </div>

          {loading ? (
            <DashboardSkeleton />
          ) : !data ? (
            <div className="empty-state">
              <AlertTriangle size={28} />
              <h2>{t("dashboard.environmentUnavailable")}</h2>
              <p>{t("dashboard.reloadHint")}</p>
            </div>
          ) : (
            <>
              {view === "overview" && (
                <Overview
                  data={data}
                  actionLoading={actionLoading}
                  onRun={() => runAction("reconcile", "/api/reconciliation/run", undefined, t("dashboard.reconciliationSuccess"))}
                  onSimulate={(scenario) => runAction(
                    scenario,
                    "/api/demo/event",
                    { scenario },
                    t("dashboard.demoEventSuccess"),
                  )}
                  onCaseSelect={setSelectedCase}
                  onViewAll={() => setView("exceptions")}
                />
              )}
              {view === "guarantees" && <GuaranteesView />}
              {view === "exceptions" && (
                <ExceptionsView
                  cases={filteredCases}
                  search={caseSearch}
                  filter={caseFilter}
                  onSearch={setCaseSearch}
                  onFilter={setCaseFilter}
                  onSelect={setSelectedCase}
                />
              )}
              {view === "transactions" && <TransactionsView data={data} />}
              {view === "audit" && (
                <AuditView
                  logs={data.auditLogs}
                  retentionDays={data.organization.dataRetentionDays}
                />
              )}
            </>
          )}
        </div>
      </main>

      {selectedCase && (
        <CaseDrawer
          item={selectedCase}
          session={initialSession}
          busy={actionLoading === `case-${selectedCase.id}`}
          onClose={() => setSelectedCase(null)}
          onChanged={async (message) => {
            setSelectedCase(null);
            await loadDashboard();
            setToast({ tone: "success", message });
          }}
          onBusy={(busy) => setActionLoading(busy ? `case-${selectedCase.id}` : null)}
          onError={(message) => setToast({ tone: "error", message })}
        />
      )}

      {toast && (
        <div className={`toast toast--${toast.tone}`} role="status">
          {toast.tone === "success" ? <CheckCircle2 size={18} /> : <AlertTriangle size={18} />}
          <span>{toast.message}</span>
          <button onClick={() => setToast(null)} aria-label={t("dashboard.dismiss")}><X size={15} /></button>
        </div>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="skeleton-page">
      <div className="skeleton skeleton--heading" />
      <div className="skeleton-grid">
        {Array.from({ length: 4 }, (_, index) => <div className="skeleton skeleton--metric" key={index} />)}
      </div>
      <div className="skeleton skeleton--panel" />
      <div className="skeleton skeleton--table" />
    </div>
  );
}
