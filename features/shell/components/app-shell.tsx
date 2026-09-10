"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  CalendarCheck2,
  CalendarDays,
  ClipboardList,
  DoorOpen,
  LayoutDashboard,
  LogOut,
  Menu,
  Sparkles,
  X,
  UsersRound,
  UserRound,
} from "lucide-react";
import type { ReactNode } from "react";

import { logoutAction } from "@/app/logout/actions";

type ShellUser = {
  role: "ADMIN" | "EMPLOYEE";
  canManageSalon: boolean;
};

type AppShellProps = {
  user: ShellUser;
  organizationIssueCount: number;
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof CalendarDays;
  visible: boolean;
};

export function AppShell({
  user,
  organizationIssueCount,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isAdmin = user.role === "ADMIN";
  const canManage = isAdmin || user.canManageSalon;
  const homeHref = canManage ? "/dashboard" : "/my-day";

  const items: NavItem[] = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      visible: canManage,
    },
    {
      href: "/my-day",
      label: "Ma journée",
      icon: CalendarCheck2,
      visible: user.role === "EMPLOYEE",
    },
    { href: "/planning", label: "Planning", icon: CalendarDays, visible: true },
    {
      href: "/organize",
      label: "Organisation",
      icon: ClipboardList,
      visible: true,
    },
    {
      href: "/clients",
      label: "Clientes",
      icon: UsersRound,
      visible: canManage,
    },
    { href: "/employees", label: "Équipe", icon: UserRound, visible: isAdmin },
    { href: "/rooms", label: "Salles", icon: DoorOpen, visible: canManage },
    {
      href: "/services",
      label: "Prestations",
      icon: Sparkles,
      visible: isAdmin,
    },
  ];

  const visibleItems = items.filter((item) => item.visible);

  return (
    <div className="min-h-screen bg-[#fcf9f7] lg:grid lg:grid-cols-[236px_minmax(0,1fr)]">
      <aside className="hidden h-screen border-r border-slate-200/80 bg-[#fffaf8] px-4 py-6 lg:sticky lg:top-0 lg:flex lg:flex-col">
        <Link href={homeHref} className="mb-8 flex items-center gap-3 px-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-violet-50 text-violet-700 ring-1 ring-violet-100">
            <Sparkles className="h-5 w-5" strokeWidth={1.7} />
          </span>
          <span>
            <span className="block font-[family-name:var(--font-salonflow-display)] text-[27px] font-semibold leading-none text-violet-900">
              SalonFlow
            </span>
            <span className="mt-1 block text-[10px] font-medium tracking-wide text-slate-500">
              Le 7ème Sens · Marrakech
            </span>
          </span>
        </Link>

        <nav aria-label="Navigation principale" className="space-y-1.5">
          {visibleItems.map((item) => {
            const Icon = item.icon;
            const active =
              pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 text-sm font-semibold transition ${
                  active
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-700 hover:bg-violet-50 hover:text-violet-800"
                }`}
              >
                <Icon className="h-4.5 w-4.5 shrink-0" strokeWidth={1.8} />
                <span>{item.label}</span>
                {item.href === "/organize" && organizationIssueCount > 0 ? (
                  <span
                    aria-label={`${organizationIssueCount} élément${organizationIssueCount > 1 ? "s" : ""} à organiser`}
                    className={`ml-auto inline-flex min-w-6 items-center justify-center rounded-full px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                      active
                        ? "bg-white/20 text-white"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {organizationIssueCount > 99
                      ? "99+"
                      : organizationIssueCount}
                  </span>
                ) : null}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto pt-6">
          <div className="mb-4 h-px bg-slate-200" />
          <p className="mb-4 px-3 text-xs text-slate-500">
            Salon ouvert de 10h à 21h
          </p>
          <form action={logoutAction}>
            <button
              type="submit"
              className="flex min-h-11 w-full items-center gap-3 rounded-xl px-3.5 text-sm font-semibold text-slate-700 transition hover:bg-rose-50 hover:text-rose-800"
            >
              <LogOut className="h-4.5 w-4.5" strokeWidth={1.8} />
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>

      <div className="min-w-0">
        <div className="sticky top-0 z-40 border-b border-slate-200/80 bg-[#fffaf8]/95 px-4 py-3 backdrop-blur lg:hidden">
          <Link href={homeHref} className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-violet-700" strokeWidth={1.8} />
            <span className="font-[family-name:var(--font-salonflow-display)] text-xl font-semibold text-violet-900">
              SalonFlow
            </span>
          </Link>
        </div>

        {mobileMenuOpen ? (
          <div
            className="fixed inset-0 z-[70] bg-slate-950/30 backdrop-blur-sm lg:hidden"
            onClick={() => setMobileMenuOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Menu SalonFlow"
              className="absolute inset-x-3 bottom-24 rounded-3xl bg-white p-4 shadow-2xl ring-1 ring-slate-200"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="mb-3 flex items-center justify-between">
                <p className="font-semibold text-slate-950">Menu</p>
                <button
                  type="button"
                  aria-label="Fermer le menu"
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-700"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {visibleItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileMenuOpen(false)}
                      className="flex min-h-12 items-center gap-3 rounded-2xl bg-slate-50 px-3 text-sm font-semibold text-slate-800 ring-1 ring-slate-200"
                    >
                      <Icon className="h-4.5 w-4.5 text-violet-700" />
                      {item.label}
                    </Link>
                  );
                })}
              </div>
              <form action={logoutAction} className="mt-3">
                <button
                  type="submit"
                  className="flex min-h-12 w-full items-center justify-center gap-2 rounded-2xl bg-rose-50 text-sm font-semibold text-rose-800 ring-1 ring-rose-100"
                >
                  <LogOut className="h-4.5 w-4.5" /> Se déconnecter
                </button>
              </form>
            </div>
          </div>
        ) : null}

        <nav
          aria-label="Navigation mobile"
          className="fixed inset-x-0 bottom-0 z-50 border-t border-slate-200 bg-white/95 px-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden"
        >
          <div
            className={`mx-auto grid max-w-lg gap-1 ${canManage ? "grid-cols-5" : "grid-cols-4"}`}
          >
            {(canManage
              ? [
                  items.find((item) => item.href === "/dashboard"),
                  items.find((item) => item.href === "/planning"),
                  items.find((item) => item.href === "/organize"),
                  items.find((item) => item.href === "/clients"),
                ]
              : [
                  items.find((item) => item.href === "/my-day"),
                  items.find((item) => item.href === "/planning"),
                  items.find((item) => item.href === "/organize"),
                ]
            )
              .filter((item): item is NavItem => Boolean(item?.visible))
              .map((item) => {
                const Icon = item.icon;
                const active =
                  pathname === item.href ||
                  pathname.startsWith(`${item.href}/`);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-bold ${active ? "bg-violet-50 text-violet-800" : "text-slate-500"}`}
                  >
                    <Icon className="h-5 w-5" strokeWidth={1.8} />
                    <span className="max-w-full truncate">
                      {item.label === "Dashboard" ? "Accueil" : item.label}
                    </span>
                    {item.href === "/organize" && organizationIssueCount > 0 ? (
                      <span className="absolute right-2 top-1 inline-flex min-h-4 min-w-4 items-center justify-center rounded-full bg-amber-500 px-1 text-[9px] font-bold text-white">
                        {organizationIssueCount > 9
                          ? "9+"
                          : organizationIssueCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="flex min-h-14 flex-col items-center justify-center gap-1 rounded-2xl px-1 text-[10px] font-bold text-slate-500"
            >
              <Menu className="h-5 w-5" strokeWidth={1.8} />
              <span>Plus</span>
            </button>
          </div>
        </nav>

        <div className="pb-24 lg:pb-0">{children}</div>
      </div>
    </div>
  );
}
