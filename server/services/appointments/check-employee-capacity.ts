import type { Prisma } from "@/app/generated/prisma/client";

import {
  getAppointmentEnd,
  intervalsOverlap,
} from "@/server/services/resources/appointment-interval";

type Db = Prisma.TransactionClient;

type CapacityService = {
  serviceId: string | null;
  serviceName: string;
  assignedEmployeeId?: string | null;
  parallelGroupIds?: string[];
};

type CapacityAppointment = {
  id: string;
  scheduledStart: Date;
  estimatedDurationMinutes: number;
  services: CapacityService[];
};

export type ServiceEmployeeCapacity = {
  serviceId: string;
  serviceName: string;
  skillConfigured: boolean;
  qualifiedActive: number;
  qualifiedAvailable: number;
};

export type EmployeeCapacityCheck = {
  feasible: boolean;
  activeEmployees: number;
  unavailableEmployees: number;
  overlappingAppointments: number;
  serviceCapacity: ServiceEmployeeCapacity[];
  blockers: string[];
  warnings: string[];
};

type EmployeeRow = {
  id: string;
  skills: Array<{ serviceId: string }>;
};

type UnavailabilityRow = {
  employeeId: string;
  startAt: Date;
  endAt: Date;
};

type AssignmentOption = {
  employeeIds: string[];
};

function isEmployeeUnavailable(
  employeeId: string,
  interval: { startAt: Date; endAt: Date },
  unavailabilities: UnavailabilityRow[],
) {
  return unavailabilities.some(
    (item) =>
      item.employeeId === employeeId &&
      intervalsOverlap(interval, { startAt: item.startAt, endAt: item.endAt }),
  );
}

function uniqueKey(employeeIds: Iterable<string>) {
  return [...new Set(employeeIds)].sort().join("|");
}

/**
 * Génère les affectations minimales possibles pour un rendez-vous.
 *
 * - une employée peut couvrir plusieurs prestations du même RDV ;
 * - deux prestations d'un même groupe parallèle doivent utiliser deux
 *   employées différentes ;
 * - une affectation déjà enregistrée est considérée comme contrainte fixe ;
 * - lorsque les compétences d'une prestation ne sont pas encore configurées,
 *   on conserve temporairement le mode historique "généraliste".
 */
function buildAppointmentOptions(input: {
  appointment: CapacityAppointment;
  employees: EmployeeRow[];
  unavailabilities: UnavailabilityRow[];
  configuredServiceIds: Set<string>;
  skillsModeEnabled: boolean;
}): AssignmentOption[] {
  const { appointment, employees, unavailabilities, skillsModeEnabled } = input;

  const interval = {
    startAt: appointment.scheduledStart,
    endAt: getAppointmentEnd(
      appointment.scheduledStart,
      appointment.estimatedDurationMinutes,
    ),
  };

  const employeeById = new Map(
    employees.map((employee) => [employee.id, employee]),
  );
  const skillSets = new Map(
    employees.map((employee) => [
      employee.id,
      new Set(employee.skills.map((skill) => skill.serviceId)),
    ]),
  );

  const fixedAssignments = new Map<number, string>();

  for (const [index, service] of appointment.services.entries()) {
    if (!service.assignedEmployeeId) continue;

    const employee = employeeById.get(service.assignedEmployeeId);
    if (!employee) return [];
    if (isEmployeeUnavailable(employee.id, interval, unavailabilities))
      return [];

    fixedAssignments.set(index, employee.id);
  }

  // Une donnée historique incohérente ne doit jamais nous faire promettre une
  // capacité supplémentaire.
  for (let left = 0; left < appointment.services.length; left += 1) {
    const leftEmployee = fixedAssignments.get(left);
    if (!leftEmployee) continue;

    for (
      let right = left + 1;
      right < appointment.services.length;
      right += 1
    ) {
      const rightEmployee = fixedAssignments.get(right);
      if (!rightEmployee || leftEmployee !== rightEmployee) continue;

      const leftGroups = new Set(
        appointment.services[left]?.parallelGroupIds ?? [],
      );
      const sharesParallelGroup = (
        appointment.services[right]?.parallelGroupIds ?? []
      ).some((groupId) => leftGroups.has(groupId));

      if (sharesParallelGroup) return [];
    }
  }

  const assignments = new Map<number, string>(fixedAssignments);
  const options = new Map<string, AssignmentOption>();

  function candidateEmployees(service: CapacityService) {
    return employees.filter((employee) => {
      if (isEmployeeUnavailable(employee.id, interval, unavailabilities)) {
        return false;
      }

      if (!service.serviceId || !skillsModeEnabled) {
        return true;
      }

      return skillSets.get(employee.id)?.has(service.serviceId) ?? false;
    });
  }

  function conflictsWithParallelGroup(
    serviceIndex: number,
    employeeId: string,
  ) {
    const groups = new Set(
      appointment.services[serviceIndex]?.parallelGroupIds ?? [],
    );
    if (groups.size === 0) return false;

    for (const [otherIndex, otherEmployeeId] of assignments.entries()) {
      if (otherIndex === serviceIndex || otherEmployeeId !== employeeId)
        continue;

      const otherGroups =
        appointment.services[otherIndex]?.parallelGroupIds ?? [];
      if (otherGroups.some((groupId) => groups.has(groupId))) return true;
    }

    return false;
  }

  const indexes = appointment.services.map((_, index) => index);

  function visit(position: number) {
    if (position >= indexes.length) {
      const employeeIds = [...new Set(assignments.values())].sort();
      options.set(uniqueKey(employeeIds), { employeeIds });
      return;
    }

    const serviceIndex = indexes[position]!;
    const service = appointment.services[serviceIndex]!;
    const fixedEmployeeId = fixedAssignments.get(serviceIndex);

    if (fixedEmployeeId) {
      visit(position + 1);
      return;
    }

    for (const employee of candidateEmployees(service)) {
      if (conflictsWithParallelGroup(serviceIndex, employee.id)) continue;

      assignments.set(serviceIndex, employee.id);
      visit(position + 1);
      assignments.delete(serviceIndex);
    }
  }

  visit(0);

  if (options.size === 0) return [];

  // Un sous-ensemble plus grand n'apporte jamais de capacité supplémentaire :
  // garder uniquement les solutions minimales réduit fortement le backtracking.
  const values = [...options.values()];
  const minimumSize = Math.min(
    ...values.map((option) => option.employeeIds.length),
  );
  return values.filter((option) => option.employeeIds.length === minimumSize);
}

function hasGlobalSchedule(
  appointments: Array<{
    appointment: CapacityAppointment;
    options: AssignmentOption[];
  }>,
) {
  const ordered = [...appointments].sort(
    (left, right) => left.options.length - right.options.length,
  );

  const bookingsByEmployee = new Map<
    string,
    Array<{ startAt: Date; endAt: Date }>
  >();

  function visit(index: number): boolean {
    if (index >= ordered.length) return true;

    const current = ordered[index]!;
    const interval = {
      startAt: current.appointment.scheduledStart,
      endAt: getAppointmentEnd(
        current.appointment.scheduledStart,
        current.appointment.estimatedDurationMinutes,
      ),
    };

    for (const option of current.options) {
      const conflict = option.employeeIds.some((employeeId) =>
        (bookingsByEmployee.get(employeeId) ?? []).some((existing) =>
          intervalsOverlap(interval, existing),
        ),
      );

      if (conflict) continue;

      for (const employeeId of option.employeeIds) {
        const bookings = bookingsByEmployee.get(employeeId) ?? [];
        bookings.push(interval);
        bookingsByEmployee.set(employeeId, bookings);
      }

      if (visit(index + 1)) return true;

      for (const employeeId of option.employeeIds) {
        const bookings = bookingsByEmployee.get(employeeId);
        bookings?.pop();
        if (bookings?.length === 0) bookingsByEmployee.delete(employeeId);
      }
    }

    return false;
  }

  return visit(0);
}

export async function checkEmployeeCapacityInDb(
  db: Db,
  input: {
    salonId: string;
    scheduledStart: Date;
    estimatedDurationMinutes: number;
    services: CapacityService[];
    excludeAppointmentId?: string;
  },
): Promise<EmployeeCapacityCheck> {
  const scheduledEnd = getAppointmentEnd(
    input.scheduledStart,
    input.estimatedDurationMinutes,
  );

  const [employees, existingAppointments, configuredSkillMarker] =
    await Promise.all([
      db.employee.findMany({
        where: { salonId: input.salonId, isActive: true },
        select: {
          id: true,
          skills: { select: { serviceId: true } },
        },
      }),
      db.appointment.findMany({
        where: {
          salonId: input.salonId,
          ...(input.excludeAppointmentId
            ? { id: { not: input.excludeAppointmentId } }
            : {}),
          status: { notIn: ["CANCELLED", "CLOSED"] },
          scheduledStart: { lt: scheduledEnd },
        },
        select: {
          id: true,
          scheduledStart: true,
          estimatedDurationMinutes: true,
          services: {
            select: {
              serviceId: true,
              serviceNameSnapshot: true,
              assignedEmployeeId: true,
              parallelGroupLinks: {
                select: { parallelGroupId: true },
              },
            },
          },
        },
      }),
      db.employeeSkill.findFirst({
        where: { employee: { salonId: input.salonId } },
        select: { employeeId: true },
      }),
    ]);

  const skillsModeEnabled = configuredSkillMarker !== null;
  const targetInterval = { startAt: input.scheduledStart, endAt: scheduledEnd };
  const overlappingAppointments: CapacityAppointment[] = existingAppointments
    .filter((appointment) =>
      intervalsOverlap(targetInterval, {
        startAt: appointment.scheduledStart,
        endAt: getAppointmentEnd(
          appointment.scheduledStart,
          appointment.estimatedDurationMinutes,
        ),
      }),
    )
    .map((appointment) => ({
      id: appointment.id,
      scheduledStart: appointment.scheduledStart,
      estimatedDurationMinutes: appointment.estimatedDurationMinutes,
      services: appointment.services.map((service) => ({
        serviceId: service.serviceId,
        serviceName: service.serviceNameSnapshot,
        assignedEmployeeId: service.assignedEmployeeId,
        parallelGroupIds: service.parallelGroupLinks.map(
          (link) => link.parallelGroupId,
        ),
      })),
    }));

  const allAppointments: CapacityAppointment[] = [
    ...overlappingAppointments,
    {
      id: "__TARGET__",
      scheduledStart: input.scheduledStart,
      estimatedDurationMinutes: input.estimatedDurationMinutes,
      services: input.services,
    },
  ];

  const rangeStart = new Date(
    Math.min(
      ...allAppointments.map((appointment) =>
        appointment.scheduledStart.getTime(),
      ),
    ),
  );
  const rangeEnd = new Date(
    Math.max(
      ...allAppointments.map((appointment) =>
        getAppointmentEnd(
          appointment.scheduledStart,
          appointment.estimatedDurationMinutes,
        ).getTime(),
      ),
    ),
  );

  const unavailabilities = employees.length
    ? await db.employeeUnavailability.findMany({
        where: {
          employeeId: { in: employees.map((employee) => employee.id) },
          startAt: { lt: rangeEnd },
          endAt: { gt: rangeStart },
        },
        select: { employeeId: true, startAt: true, endAt: true },
      })
    : [];

  const configuredServiceIds = new Set(
    employees.flatMap((employee) =>
      employee.skills.map((skill) => skill.serviceId),
    ),
  );

  const targetUnavailableIds = new Set(
    unavailabilities
      .filter((item) =>
        intervalsOverlap(targetInterval, {
          startAt: item.startAt,
          endAt: item.endAt,
        }),
      )
      .map((item) => item.employeeId),
  );

  const employeeSkillSets = new Map(
    employees.map((employee) => [
      employee.id,
      new Set(employee.skills.map((skill) => skill.serviceId)),
    ]),
  );

  const targetServiceMap = new Map<string, CapacityService>();
  for (const service of input.services) {
    if (service.serviceId) targetServiceMap.set(service.serviceId, service);
  }

  const serviceCapacity: ServiceEmployeeCapacity[] = [
    ...targetServiceMap.entries(),
  ].map(([serviceId, service]) => {
    const configured = skillsModeEnabled && configuredServiceIds.has(serviceId);
    const qualifiedEmployees = skillsModeEnabled
      ? employees.filter((employee) =>
          employeeSkillSets.get(employee.id)?.has(serviceId),
        )
      : employees;

    return {
      serviceId,
      serviceName: service.serviceName,
      skillConfigured: configured,
      qualifiedActive: qualifiedEmployees.length,
      qualifiedAvailable: qualifiedEmployees.filter(
        (employee) => !targetUnavailableIds.has(employee.id),
      ).length,
    };
  });

  const blockers: string[] = [];
  const warnings: string[] = [];

  if (employees.length === 0) {
    blockers.push("Aucune employée active n'est configurée dans le salon.");
  }

  if (!skillsModeEnabled) {
    warnings.push(
      "Les compétences de l’équipe ne sont pas encore configurées : SalonFlow utilise temporairement le mode généraliste.",
    );
  }

  for (const capacity of serviceCapacity) {
    if (skillsModeEnabled && capacity.qualifiedActive === 0) {
      blockers.push(
        `Aucune employée active n'est habilitée à réaliser « ${capacity.serviceName} ».`,
      );
    } else if (skillsModeEnabled && capacity.qualifiedAvailable === 0) {
      blockers.push(
        `Aucune employée compétente pour « ${capacity.serviceName} » n'est disponible sur ce créneau.`,
      );
    }
  }

  if (blockers.length > 0) {
    return {
      feasible: false,
      activeEmployees: employees.length,
      unavailableEmployees: targetUnavailableIds.size,
      overlappingAppointments: overlappingAppointments.length,
      serviceCapacity,
      blockers,
      warnings,
    };
  }

  const appointmentsWithOptions = allAppointments.map((appointment) => ({
    appointment,
    options: buildAppointmentOptions({
      appointment,
      employees,
      unavailabilities,
      configuredServiceIds,
      skillsModeEnabled,
    }),
  }));

  const impossibleAppointment = appointmentsWithOptions.find(
    (item) => item.options.length === 0,
  );

  if (impossibleAppointment) {
    blockers.push(
      impossibleAppointment.appointment.id === "__TARGET__"
        ? "Aucune combinaison d'employées compétentes et disponibles ne permet de réaliser toutes les prestations de ce rendez-vous."
        : "La capacité équipe est déjà saturée par les rendez-vous présents sur ce créneau.",
    );
  } else if (!hasGlobalSchedule(appointmentsWithOptions)) {
    blockers.push(
      "L’équipe disponible ne permet pas de réaliser toutes les prestations pendant toute cette plage horaire.",
    );
  }

  return {
    feasible: blockers.length === 0,
    activeEmployees: employees.length,
    unavailableEmployees: targetUnavailableIds.size,
    overlappingAppointments: overlappingAppointments.length,
    serviceCapacity,
    blockers,
    warnings,
  };
}
