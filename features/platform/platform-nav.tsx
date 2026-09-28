"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  CalendarDays,
  CreditCard,
  Building2,
  CircleAlert,
  History,
  ShieldCheck,
} from "lucide-react";
const items = [
  { href: "/superadmin", label: "Vue d’ensemble", Icon: LayoutDashboard },
  { href: "/superadmin/salons", label: "Salons", Icon: Building2 },
  { href: "/superadmin/revenus", label: "Revenus", Icon: CreditCard },
  { href: "/superadmin/echeances", label: "Échéances", Icon: CalendarDays },
  { href: "/superadmin/incidents", label: "Incidents", Icon: CircleAlert },
  { href: "/superadmin/journal", label: "Journal des actions", Icon: History },
  { href: "/superadmin/securite", label: "Sécurité", Icon: ShieldCheck },
];
export function PlatformNav() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Administration plateforme"
      className="flex gap-2 overflow-x-auto p-3 lg:mt-5 lg:flex-col lg:p-4"
    >
      {items.map(({ href, label, Icon }) => {
        const active =
          pathname === href ||
          (href !== "/superadmin" && pathname.startsWith(href + "/"));
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium ${active ? "bg-white/15 text-white" : "text-slate-200 hover:bg-white/10 hover:text-white"}`}
          >
            <Icon aria-hidden="true" className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
