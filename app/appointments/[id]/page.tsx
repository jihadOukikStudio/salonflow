import Link from "next/link";
import { notFound } from "next/navigation";

import { getCurrentUser } from "@/server/auth/get-current-user";
import { AppointmentDetailClient } from "@/features/appointments/detail/components";
import { getAppointmentDetail } from "@/features/appointments/detail/server";

export default async function AppointmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const currentUser = await getCurrentUser();
  const detail = await getAppointmentDetail(currentUser, id);

  if (!detail) notFound();

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
        <header className="mb-6">
          <Link
            href="/planning"
            className="inline-flex min-h-10 items-center text-sm font-semibold text-slate-600 transition hover:text-slate-950"
          >
            ← Retour au planning
          </Link>
          <div className="mt-3">
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-violet-600">
              SalonFlow
            </p>
            <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-950">
              Fiche rendez-vous
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">
              Affectez les prestations, suivez leur exécution, encaissez le
              montant réel puis clôturez le rendez-vous.
            </p>
          </div>
        </header>

        <AppointmentDetailClient detail={detail} />
      </div>
    </main>
  );
}
