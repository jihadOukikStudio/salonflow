import Link from "next/link";
import { redirect } from "next/navigation";

import { getMinimumBookableCasablancaDateTime } from "@/features/appointments/lib/casablanca-local-datetime";
import { NewAppointmentForm } from "@/features/appointments/new/components";
import { getNewAppointmentOptions } from "@/features/appointments/new/server";
import { parsePlanningDate } from "@/features/planning/server/casablanca-day";
import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";
import { getCurrentUser } from "@/server/auth/get-current-user";

export default async function NewAppointmentPage() {
  const currentUser = await getCurrentUser();
  const user = await getAuthoritativeCurrentUser(currentUser);

  if (user.role !== "ADMIN" && !user.canManageSalon) {
    redirect("/planning");
  }

  const options = await getNewAppointmentOptions(user);
  const initialMinimumBooking = getMinimumBookableCasablancaDateTime();
  const requestedDate = parsePlanningDate(undefined);
  const initialDate =
    requestedDate < initialMinimumBooking.dateKey
      ? initialMinimumBooking.dateKey
      : requestedDate;

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
              Nouveau rendez-vous
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
              Recherchez la cliente par téléphone, choisissez les prestations
              puis le créneau. Si la cliente est nouvelle, sa fiche sera créée
              avec le rendez-vous lors de la validation finale.
            </p>
          </div>
        </header>

        <NewAppointmentForm
          services={options.services}
          initialDate={initialDate}
          initialMinimumBooking={initialMinimumBooking}
          canConfigureServices={user.role === "ADMIN"}
        />
      </div>
    </main>
  );
}
