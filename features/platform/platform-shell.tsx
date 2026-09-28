import { PlatformNav } from "./platform-nav";
import "./platform.css";
import Link from "next/link";
import type { ReactNode } from "react";
import { Building2, ShieldCheck, LogOut } from "lucide-react";
import { logoutAction } from "@/app/logout/actions";

export function PlatformShell({
  name,
  children,
}: {
  name: string;
  children: ReactNode;
}) {
  return (
    <div className="sf-platform min-h-screen bg-[#f5f6fa] text-slate-900 lg:grid lg:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="border-b border-slate-200 bg-[#121c30] text-slate-200 lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:border-b-0">
        <Link
          href="/superadmin"
          className="flex items-center gap-3 px-6 py-4 lg:py-7 text-xl font-semibold tracking-tight text-white"
        >
          <span className="rounded-xl bg-teal-400/15 p-2 text-teal-300">
            <Building2 className="h-6 w-6" />
          </span>
          SalonFlow
        </Link>
        <p className="px-6 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Administration plateforme
        </p>
        <PlatformNav />
        <div className="mt-auto flex items-center justify-between gap-3 border-t border-white/10 px-5 py-3 lg:block lg:p-5">
          <div className="flex items-center gap-2 text-sm text-white">
            <ShieldCheck className="h-4 w-4 text-teal-300" />
            {name}
          </div>
          <p className="mt-1 hidden text-xs text-slate-400 lg:block">
            Super administrateur
          </p>
          <form action={logoutAction}>
            <button className="flex min-h-10 lg:mt-4 items-center gap-2 text-sm text-slate-300 hover:text-white">
              <LogOut className="h-4 w-4" />
              Se déconnecter
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-5 py-4 sm:px-8">
          <span className="text-sm text-slate-500">Espace de pilotage</span>
          <span className="rounded-full bg-teal-50 px-3 py-1 text-xs font-semibold text-teal-800">
            Accès plateforme
          </span>
        </header>
        <main className="mx-auto max-w-7xl p-5 sm:p-8">{children}</main>
      </div>
    </div>
  );
}
