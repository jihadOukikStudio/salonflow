import Link from "next/link";
import { redirect } from "next/navigation";

import { RoomsAdmin } from "@/features/rooms/components/rooms-admin";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";
import { getRooms } from "@/server/services/rooms";

export default async function RoomsPage() {
  const currentUser = await getCurrentUser();
  const user = await getAuthoritativeCurrentUser(currentUser);

  if (user.role !== "ADMIN" && !user.canManageSalon) {
    redirect("/planning");
  }

  const rooms = await getRooms(user);

  return (
    <main className="min-h-screen bg-slate-50">
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
          <h1 className="mt-1 text-3xl font-semibold text-slate-950">Salles</h1>
          <p className="mt-2 text-sm text-slate-600">
            Hamam, salles de soins et périodes d’indisponibilité.
          </p>
        </header>
        <RoomsAdmin
          rooms={rooms}
          isAdmin={user.role === "ADMIN"}
          canManage={user.role === "ADMIN" || user.canManageSalon}
        />
      </div>
    </main>
  );
}
