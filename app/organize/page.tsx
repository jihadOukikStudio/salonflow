import Link from "next/link";

import { OrganizationQueue } from "@/features/organize/components/organization-queue";
import { getOrganizationQueue } from "@/features/organize/server";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";

export default async function OrganizePage() {
  const currentUser = await getCurrentUser();
  const user = await getAuthoritativeCurrentUser(currentUser);
  const queue = await getOrganizationQueue(user);

  return (
    <main className="min-h-screen bg-[#fcf9f7]">
      <div className="mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <Link
              href="/planning"
              className="text-sm font-semibold text-slate-600 hover:text-slate-950"
            >
              ← Retour au planning
            </Link>
            <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-violet-600">
              SalonFlow
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              À organiser
            </h1>
            <p className="mt-2 text-sm leading-6 text-slate-600">
              Prestations sans employée ou sans salle obligatoire. Urgent = dans
              l’heure, Bientôt = dans les 4 heures.
            </p>
          </div>

          {user.role === "ADMIN" ? (
            <Link
              href="/employees"
              className="inline-flex min-h-11 items-center rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
            >
              Équipe
            </Link>
          ) : null}
        </header>
        <OrganizationQueue {...queue} />
      </div>
    </main>
  );
}
