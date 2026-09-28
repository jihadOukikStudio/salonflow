import Link from "next/link";
import type { ReactNode } from "react";
export const inputClass =
  "mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-teal-600 focus:outline-none focus:ring-2 focus:ring-teal-100";
export const buttonClass =
  "inline-flex min-h-11 items-center justify-center rounded-lg bg-[#126c65] px-4 py-2 text-sm font-semibold text-white hover:bg-[#0d554f] disabled:opacity-50";
export const labels: Record<string, string> = {
  PREPARING: "En préparation",
  ARCHIVED: "Archivé",
  TRIAL: "Essai / pilote",
  ACTIVE: "Actif",
  PAST_DUE: "En retard",
  CANCELLED: "Résilié",
  OPEN: "Ouvert",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolu",
  LOW: "Faible",
  NORMAL: "Normale",
  HIGH: "Haute",
  CRITICAL: "Critique",
};
export function Badge({ value }: { value: string }) {
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${["ACTIVE", "RESOLVED"].includes(value) ? "bg-teal-50 text-teal-800" : ["PAST_DUE", "CRITICAL", "SUSPENDED"].includes(value) ? "bg-rose-50 text-rose-800" : "bg-slate-100 text-slate-600"}`}
    >
      {labels[value] ?? (value === "SUSPENDED" ? "Suspendu" : value)}
    </span>
  );
}
export function Section({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
      <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
      {description && (
        <p className="mt-1 text-sm leading-6 text-slate-500">{description}</p>
      )}
      <div className="mt-5">{children}</div>
    </section>
  );
}
export function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block text-sm font-medium text-slate-700">
      {label}
      {children}
    </label>
  );
}
export function PageTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mb-7">
      <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-teal-700">
        SalonFlow · Plateforme
      </p>
      <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
        {title}
      </h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-500">
        {description}
      </p>
    </div>
  );
}
export function Pagination({
  page,
  total,
  size,
  path,
  q,
  filters = {},
  pageParam = "page",
}: {
  page: number;
  total: number;
  size: number;
  path: string;
  q?: string;
  filters?: Record<string, string>;
  pageParam?: string;
}) {
  const pages = Math.max(1, Math.ceil(total / size));
  const href = (p: number) =>
    `${path}?${new URLSearchParams({ ...filters, [pageParam]: String(p), ...(q ? { q } : {}) })}`;
  return (
    <nav
      aria-label="Pagination"
      className="mt-5 flex items-center justify-between gap-3 text-sm"
    >
      <span className="text-slate-500">
        {total} résultat{total > 1 ? "s" : ""} · page {page} / {pages}
      </span>
      <div className="flex gap-4">
        {page > 1 && (
          <Link className="font-semibold text-teal-800" href={href(page - 1)}>
            Précédent
          </Link>
        )}
        {page < pages && (
          <Link className="font-semibold text-teal-800" href={href(page + 1)}>
            Suivant
          </Link>
        )}
      </div>
    </nav>
  );
}
export function dateLabel(date: Date | null) {
  return date
    ? new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(date)
    : "Non définie";
}
