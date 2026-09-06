import Link from "next/link";
import { redirect } from "next/navigation";

import { ClientsAdmin } from "@/features/clients/components/clients-admin";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";
import { getClients } from "@/server/services/clients/client-admin";

export default async function ClientsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const currentUser = await getCurrentUser();
  const user = await getAuthoritativeCurrentUser(currentUser);

  if (user.role !== "ADMIN" && !user.canManageSalon) {
    redirect("/planning");
  }

  const { q } = await searchParams;
  const clients = await getClients(user, q);
  const canManage = user.role === "ADMIN" || user.canManageSalon;

  return (
    <main className="min-h-screen bg-[#fcf9f7]">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-6">
          <Link
            href="/planning"
            className="text-sm font-semibold text-slate-600"
          >
            ← Retour au planning
          </Link>
          <p className="mt-4 text-sm font-semibold uppercase tracking-[0.16em] text-violet-600">
            SalonFlow
          </p>
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">
            Clientes
          </h1>
          <p className="mt-2 text-sm text-slate-600">
            Recherche rapide par téléphone ou nom, fiche et historique de
            rendez-vous.
          </p>
        </header>
        <form className="mb-5">
          <input
            name="q"
            defaultValue={q ?? ""}
            className="min-h-11 w-full rounded-xl border border-slate-400 bg-white px-3 text-slate-950 outline-none placeholder:text-slate-500 focus:border-violet-600 focus:ring-2 focus:ring-violet-200"
            placeholder="Téléphone ou nom..."
          />
        </form>
        <ClientsAdmin clients={clients} canManage={canManage} />
      </div>
    </main>
  );
}
