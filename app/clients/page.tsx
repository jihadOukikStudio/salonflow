import Link from "next/link";
import { redirect } from "next/navigation";

import { ClientsAdmin } from "@/features/clients/components/clients-admin";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";
import { getClients } from "@/server/services/clients/client-admin";

export default async function ClientsPage() {
  const currentUser = await getCurrentUser();
  const user = await getAuthoritativeCurrentUser(currentUser);
  if (user.role !== "ADMIN" && !user.canManageSalon) redirect("/planning");

  const clients = await getClients(user);
  return (
    <main className="min-h-screen bg-[#fbfaf8]">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-6">
          <Link href="/planning" className="text-sm font-semibold text-slate-500 hover:text-slate-950">← Planning</Link>
          <h1 className="mt-3 text-3xl font-bold tracking-tight text-slate-950">Clientes</h1>
          <p className="mt-1 text-sm text-slate-500">Retrouvez une cliente, ses préférences et son historique sans lui reposer les mêmes questions.</p>
        </header>
        <ClientsAdmin clients={clients} canManage />
      </div>
    </main>
  );
}
