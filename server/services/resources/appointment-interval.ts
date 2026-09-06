export type AppointmentInterval = {
  startAt: Date;
  endAt: Date;
};

export function getAppointmentEnd(
  scheduledStart: Date,
  durationMinutes: number,
): Date {
  if (
    !(scheduledStart instanceof Date) ||
    Number.isNaN(scheduledStart.getTime())
  ) {
    throw new Error("La date de début du rendez-vous est invalide.");
  }

  if (!Number.isInteger(durationMinutes) || durationMinutes <= 0) {
    throw new Error(
      "La durée du rendez-vous doit être un entier strictement positif.",
    );
  }

  return new Date(scheduledStart.getTime() + durationMinutes * 60_000);
}

export function getAppointmentInterval(
  scheduledStart: Date,
  durationMinutes: number,
): AppointmentInterval {
  return {
    startAt: scheduledStart,
    endAt: getAppointmentEnd(scheduledStart, durationMinutes),
  };
}

export function intervalsOverlap(
  first: AppointmentInterval,
  second: AppointmentInterval,
): boolean {
  return first.startAt < second.endAt && first.endAt > second.startAt;
}
