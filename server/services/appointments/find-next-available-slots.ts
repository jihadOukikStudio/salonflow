import type { Prisma } from "@/app/generated/prisma/client";

import {
  casablancaLocalDateTimeToIso,
  getCasablancaDateTimeFields,
} from "@/features/appointments/lib/casablanca-local-datetime";
import { checkBookingFeasibilityInDb } from "@/server/services/appointments/check-booking-feasibility";

type Db = Prisma.TransactionClient;

export type NextAvailableSlot = {
  scheduledStart: string;
  scheduledEnd: string;
  dateKey: string;
  timeValue: string;
};

type Input = {
  salonId: string;
  scheduledStart: Date;
  serviceIds: string[];
};

const OPENING_MINUTE = 10 * 60;
const CLOSING_MINUTE = 21 * 60;
const STEP_MINUTES = 15;
const MAX_DAYS = 3;
const MAX_RESULTS = 3;

function minuteOfDay(timeValue: string) {
  const [hours, minutes] = timeValue.split(":").map(Number);
  return hours * 60 + minutes;
}

function roundUpToStep(date: Date) {
  const stepMs = STEP_MINUTES * 60_000;
  return new Date(Math.ceil(date.getTime() / stepMs) * stepMs);
}

function hasStructuralBlocker(
  feasibility: Awaited<ReturnType<typeof checkBookingFeasibilityInDb>>,
) {
  if (feasibility.employeeCapacity.active === 0) return true;

  // Une prestation sans aucune employée qualifiée ne deviendra pas disponible
  // en avançant simplement l'heure.
  if (
    feasibility.serviceEmployeeCapacity.some(
      (service) => service.skillConfigured && service.qualifiedActive === 0,
    )
  ) {
    return true;
  }

  // Une ressource inexistante ne peut pas être résolue par un autre horaire.
  if (feasibility.roomCapacity.some((room) => room.active === 0)) {
    return true;
  }

  return false;
}

/**
 * Cherche des alternatives en réutilisant STRICTEMENT le moteur de faisabilité
 * utilisé pour créer le rendez-vous. Aucune "capacité simplifiée" parallèle.
 *
 * Horizon V1 volontairement borné à 3 jours et 3 propositions.
 */
export async function findNextAvailableSlotsInDb(
  db: Db,
  input: Input,
): Promise<NextAvailableSlot[]> {
  const initial = await checkBookingFeasibilityInDb(db, input);

  if (initial.canCreate || hasStructuralBlocker(initial)) {
    return [];
  }

  const results: NextAvailableSlot[] = [];
  const searchLimit = new Date(
    input.scheduledStart.getTime() + MAX_DAYS * 24 * 60 * 60_000,
  );
  let candidate = roundUpToStep(
    new Date(input.scheduledStart.getTime() + STEP_MINUTES * 60_000),
  );

  while (candidate <= searchLimit && results.length < MAX_RESULTS) {
    const local = getCasablancaDateTimeFields(candidate);
    const startMinute = minuteOfDay(local.timeValue);

    if (startMinute >= OPENING_MINUTE && startMinute < CLOSING_MINUTE) {
      const canonicalStart = new Date(
        casablancaLocalDateTimeToIso(local.dateKey, local.timeValue),
      );

      const feasibility = await checkBookingFeasibilityInDb(db, {
        salonId: input.salonId,
        scheduledStart: canonicalStart,
        serviceIds: input.serviceIds,
      });

      if (feasibility.canCreate) {
        const endLocal = getCasablancaDateTimeFields(
          new Date(feasibility.scheduledEnd),
        );

        // Ne jamais proposer un rendez-vous qui déborde après la fermeture
        // ou traverse la journée locale.
        if (
          endLocal.dateKey === local.dateKey &&
          minuteOfDay(endLocal.timeValue) <= CLOSING_MINUTE
        ) {
          results.push({
            scheduledStart: feasibility.scheduledStart,
            scheduledEnd: feasibility.scheduledEnd,
            dateKey: local.dateKey,
            timeValue: local.timeValue,
          });
        }
      }
    }

    candidate = new Date(candidate.getTime() + STEP_MINUTES * 60_000);
  }

  return results;
}
