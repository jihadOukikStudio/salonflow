"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  CalendarDays,
  ClipboardList,
  DoorOpen,
  LayoutDashboard,
  LogOut,
  Sparkles,
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
  children: ReactNode;
};

type NavItem = {
  href: string;
  label: string;
  icon: typeof CalendarDays;
  visible: boolean;
};

export function AppShell({ user, children }: AppShellProps) {
  const pathname = usePathname();
  const isAdmin = user.role === "ADMIN";
  const canManage = isAdmin || user.canManageSalon;

  const items: NavItem[] = [
    {
      href: "/dashboard",
      label: "Dashboard",
      icon: LayoutDashboard,
      visible: canManage,
    },
    { href: "/planning", label: "Planning", icon: CalendarDays, visible: true },
    {
      href: "/organize",
      label: "À organiser",
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
        <Link
          href={canManage ? "/dashboard" : "/planning"}
          className="mb-8 flex items-center gap-3 px-2"
        >
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
        <div className="sticky top-0 z-50 border-b border-slate-200/80 bg-[#fffaf8]/95 px-3 py-2 backdrop-blur lg:hidden">
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            <Link
              href={canManage ? "/dashboard" : "/planning"}
              className="mr-1 flex shrink-0 items-center gap-2 px-1"
            >
              <Sparkles className="h-4 w-4 text-violet-700" strokeWidth={1.8} />
              <span className="font-[family-name:var(--font-salonflow-display)] text-xl font-semibold text-violet-900">
                SalonFlow
              </span>
            </Link>
            {visibleItems.map((item) => {
              const Icon = item.icon;
              const active =
                pathname === item.href || pathname.startsWith(`${item.href}/`);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-label={item.label}
                  title={item.label}
                  className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition ${
                    active
                      ? "bg-violet-600 text-white"
                      : "bg-white text-slate-600 ring-1 ring-slate-200"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5" strokeWidth={1.8} />
                </Link>
              );
            })}
            <form action={logoutAction} className="shrink-0">
              <button
                type="submit"
                aria-label="Se déconnecter"
                title="Se déconnecter"
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white text-slate-600 ring-1 ring-slate-200"
              >
                <LogOut className="h-4.5 w-4.5" strokeWidth={1.8} />
              </button>
            </form>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
