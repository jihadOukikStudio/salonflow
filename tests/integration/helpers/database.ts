import { testPrisma } from "./prisma";

export async function cleanDatabase(): Promise<void> {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "SECURITY: DATABASE_URL is required before database cleanup.",
    );
  }

  const database = new URL(connectionString);
  const databaseName = database.pathname.replace(/^\//, "");

  if (databaseName !== "salonflow_test") {
    throw new Error(
      `SECURITY: Refusing to clean database "${databaseName || "<empty>"}".`,
    );
  }

  await testPrisma.$transaction([
    // Tables enfants / dépendances les plus profondes
    testPrisma.parallelGroupService.deleteMany(),
    testPrisma.parallelGroup.deleteMany(),

    testPrisma.payment.deleteMany(),

    testPrisma.appointmentService.deleteMany(),
    testPrisma.appointment.deleteMany(),

    testPrisma.employeeUnavailability.deleteMany(),
    testPrisma.roomUnavailability.deleteMany(),

    testPrisma.employeeSkill.deleteMany(),

    // ActivityLog référence User + Salon
    testPrisma.activityLog.deleteMany(),

    // Employee peut référencer User
    testPrisma.employee.deleteMany(),

    // User référence Salon
    testPrisma.user.deleteMany(),

    // Catalogue
    testPrisma.service.deleteMany(),
    testPrisma.serviceCategory.deleteMany(),

    // Autres données du salon
    testPrisma.room.deleteMany(),
    testPrisma.client.deleteMany(),

    // Salon doit impérativement être supprimé en dernier
    testPrisma.salon.deleteMany(),
  ]);
}
