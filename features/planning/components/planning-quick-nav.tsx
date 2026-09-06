import Link from "next/link";
import { CalendarDays, ClipboardList, DoorOpen, LayoutDashboard, Sparkles, UserRound, UsersRound } from "lucide-react";
import type { LucideIcon } from "lucide-react";

type PlanningQuickNavProps = {
  role: "ADMIN" | "EMPLOYEE";
  canManageSalon: boolean;
  current?: "dashboard" | "planning";
};

type QuickNavLink = { href: string; label: string; visible: boolean; icon: LucideIcon; key: string };

export function PlanningQuickNav({ role, canManageSalon, current }: PlanningQuickNavProps) {
  const isAdmin = role === "ADMIN";
  const canManage = isAdmin || canManageSalon;
  const links: QuickNavLink[] = [
    { href: "/dashboard", label: "Dashboard", visible: canManage, icon: LayoutDashboard, key: "dashboard" },
    { href: "/planning", label: "Planning", visible: true, icon: CalendarDays, key: "planning" },
    { href: "/organize", label: "À organiser", visible: true, icon: ClipboardList, key: "organize" },
    { href: "/clients", label: "Clientes", visible: canManage, icon: UsersRound, key: "clients" },
    { href: "/employees", label: "Équipe", visible: isAdmin, icon: UserRound, key: "employees" },
    { href: "/rooms", label: "Salles", visible: canManage, icon: DoorOpen, key: "rooms" },
    { href: "/services", label: "Prestations", visible: isAdmin, icon: Sparkles, key: "services" },
  ];

  return (
    <nav aria-label="Navigation SalonFlow" className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
      {links.filter((link) => link.visible).map((link) => {
        const Icon = link.icon;
        const active = current === link.key;
        return (
          <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}
            className={`group inline-flex min-h-10 items-center gap-2 whitespace-nowrap rounded-xl border px-3.5 py-2 text-sm font-medium shadow-sm transition ${active ? "border-violet-200 bg-violet-50 text-violet-800" : "border-slate-200 bg-white text-slate-700 hover:border-violet-200 hover:bg-violet-50 hover:text-violet-800"}`}>
            <Icon aria-hidden="true" className={`h-4 w-4 ${active ? "text-violet-700" : "text-slate-500 transition group-hover:text-violet-700"}`} strokeWidth={1.8} />
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
