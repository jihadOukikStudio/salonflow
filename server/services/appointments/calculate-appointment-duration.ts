export type AppointmentDurationService = {
  id: string;
  durationMinutes: number;

  parallelGroupLinks: Array<{
    parallelGroupId: string;
  }>;
};

/**
 * Calcule la durée estimée totale d'un rendez-vous.
 *
 * Règles :
 * - prestation hors groupe => durée ajoutée normalement ;
 * - prestations dans un même groupe parallèle =>
 *   seule la durée la plus longue du groupe est comptée.
 *
 * Exemple :
 * - brushing : 60 min
 * - manucure : 45 min
 * - pédicure : 30 min
 *
 * Manucure + pédicure en parallèle :
 * 60 + max(45, 30) = 105 minutes.
 */
export function calculateAppointmentDuration(
  services: AppointmentDurationService[],
): number {
  if (services.length === 0) {
    return 0;
  }

  let total = 0;

  const parallelGroups = new Map<string, number[]>();

  for (const service of services) {
    if (
      !Number.isInteger(service.durationMinutes) ||
      service.durationMinutes <= 0
    ) {
      throw new Error(
        "La durée d'une prestation doit être un entier strictement positif.",
      );
    }

    /*
     * Le schéma BDD garantit normalement qu'une prestation
     * ne peut appartenir qu'à un seul groupe grâce au
     * @unique sur appointmentServiceId.
     *
     * Cette vérification protège également le domaine métier
     * contre un état incohérent.
     */
    if (service.parallelGroupLinks.length > 1) {
      throw new Error(
        "Une prestation ne peut appartenir qu'à un seul groupe parallèle.",
      );
    }

    const parallelGroupLink = service.parallelGroupLinks[0];

    if (!parallelGroupLink) {
      total += service.durationMinutes;
      continue;
    }

    const durations =
      parallelGroups.get(parallelGroupLink.parallelGroupId) ?? [];

    durations.push(service.durationMinutes);

    parallelGroups.set(parallelGroupLink.parallelGroupId, durations);
  }

  for (const durations of parallelGroups.values()) {
    total += Math.max(...durations);
  }

  return total;
}
