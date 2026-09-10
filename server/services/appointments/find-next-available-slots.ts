import type { Prisma } from "@/app/generated/prisma/client";

import {
  casablancaLocalDateTimeToIso,
  getCasablancaDateTimeFields,
} from "@/features/appointments/lib/casablanca-local-datetime";
import { checkBookingFeasibilityInDb } from "@/server/services/appointments/check-booking-feasibility";
import { BusinessRuleError } from "@/server/services/errors";

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
const LAST_START_MINUTE = 21 * 60;
const MAX_END_MINUTE = 21 * 60 + 30;
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

  /**
   * Si aucune employée active ne peut réaliser une prestation, avancer
   * simplement l'heure ne changera jamais la faisabilité.
   *
   * Important :
   * `skillConfigured` signifie qu'au moins une compétence existe pour CETTE
   * prestation. Quand le salon est déjà en mode compétences mais que personne
   * ne maîtrise la prestation demandée, `skillConfigured` vaut justement
   * `false` et `qualifiedActive` vaut `0`.
   *
   * Le test précédent sur `skillConfigured && qualifiedActive === 0`
   * laissait donc passer ce cas structurel et SalonFlow parcourait inutilement
   * jusqu'à 3 jours de créneaux dans la même transaction Prisma.
   */
  if (
    feasibility.serviceEmployeeCapacity.some(
      (service) => service.qualifiedActive === 0,
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
  let initial: Awaited<ReturnType<typeof checkBookingFeasibilityInDb>> | null =
    null;

  try {
    initial = await checkBookingFeasibilityInDb(db, input);
  } catch (error) {
    if (!(error instanceof BusinessRuleError)) throw error;

    // Un créneau hors horaires / déjà passé peut tout de même avoir des
    // alternatives valides plus tard : on poursuit la recherche.
  }

  /**
   * - Si le créneau demandé est déjà faisable, aucune alternative n'est utile.
   * - Si le blocage est structurel (aucune employée active/compétente ou
   *   aucune salle requise configurée), aucun autre horaire ne pourra le
   *   résoudre : on sort immédiatement.
   *
   * Cette sortie rapide évite aussi de maintenir une transaction Prisma
   * interactive pendant le scan de dizaines/centaines de créneaux.
   */
  if (initial && (initial.canCreate || hasStructuralBlocker(initial))) {
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

    if (startMinute >= OPENING_MINUTE && startMinute <= LAST_START_MINUTE) {
      const canonicalStart = new Date(
        casablancaLocalDateTimeToIso(local.dateKey, local.timeValue),
      );

      let feasibility: Awaited<ReturnType<typeof checkBookingFeasibilityInDb>>;

      try {
        feasibility = await checkBookingFeasibilityInDb(db, {
          salonId: input.salonId,
          scheduledStart: canonicalStart,
          serviceIds: input.serviceIds,
        });
      } catch (error) {
        if (error instanceof BusinessRuleError) {
          candidate = new Date(
            candidate.getTime() + STEP_MINUTES * 60_000,
          );
          continue;
        }

        throw error;
      }

      /**
       * Ce cas ne devrait normalement être rencontré qu'après le premier
       * créneau, mais si une vérification révèle finalement un blocage
       * structurel, il est inutile de continuer les jours suivants.
       */
      if (hasStructuralBlocker(feasibility)) {
        return results;
      }

      if (feasibility.canCreate) {
        const endLocal = getCasablancaDateTimeFields(
          new Date(feasibility.scheduledEnd),
        );

        // Ne jamais proposer un rendez-vous qui déborde après la fermeture
        // ou traverse la journée locale.
        if (
          endLocal.dateKey === local.dateKey &&
          minuteOfDay(endLocal.timeValue) <= MAX_END_MINUTE
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
