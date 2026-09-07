import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../app/generated/prisma/client";
import { assertProductionRuntimeSecurity } from "../server/config/security-env";

assertProductionRuntimeSecurity();

if (process.env.NODE_ENV !== "production") {
  throw new Error(
    "SECURITY: production bootstrap verification requires NODE_ENV=production.",
  );
}

const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) {
  throw new Error("DATABASE_URL is missing.");
}

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});

const expectedEmployees = [
  "Ahlam",
  "Khawla",
  "Salima",
  "Fatimazahrae",
  "Hasna",
  "Sabah",
  "Atika",
] as const;

const expectedRooms = [
  "Hamam individuel",
  "Hamam duo",
  "Salle de soins 1",
  "Salle de soins 2",
] as const;

const expectedSkillCounts = new Map([
  ["Fatimazahrae", 25],
  ["Hasna", 2],
  ["Sabah", 4],
  ["Atika", 4],
  ["Ahlam", 42],
  ["Khawla", 42],
  ["Salima", 42],
]);

async function main() {
  const salons = await prisma.salon.findMany({
    include: {
      users: true,
      employees: { include: { skills: true } },
      rooms: true,
      serviceCategories: true,
      services: true,
      _count: { select: { clients: true, appointments: true } },
    },
  });

  if (salons.length !== 1 || salons[0].name !== "Le 7ème Sens Marrakech") {
    throw new Error(
      "Production bootstrap verification failed: unexpected salon state.",
    );
  }

  const salon = salons[0];
  const admins = salon.users.filter(
    (user) => user.role === "ADMIN" && user.isActive && user.canManageSalon,
  );

  if (admins.length !== 1) {
    throw new Error(
      "Production bootstrap verification failed: expected exactly one active admin.",
    );
  }

  const activeEmployeeNames = salon.employees
    .filter((employee) => employee.isActive)
    .map((employee) => employee.firstName)
    .sort();
  const expectedEmployeeNames = [...expectedEmployees].sort();

  if (
    JSON.stringify(activeEmployeeNames) !==
    JSON.stringify(expectedEmployeeNames)
  ) {
    throw new Error(
      "Production bootstrap verification failed: employee list mismatch.",
    );
  }

  for (const employee of salon.employees) {
    const expected = expectedSkillCounts.get(employee.firstName);
    if (expected === undefined || employee.skills.length !== expected) {
      throw new Error(
        `Production bootstrap verification failed: invalid skill count for ${employee.firstName}.`,
      );
    }
  }

  const activeRoomNames = salon.rooms
    .filter((room) => room.isActive)
    .map((room) => room.name)
    .sort();

  if (
    JSON.stringify(activeRoomNames) !==
    JSON.stringify([...expectedRooms].sort())
  ) {
    throw new Error(
      "Production bootstrap verification failed: room list mismatch.",
    );
  }

  if (
    salon.serviceCategories.filter((category) => category.isActive).length !==
    12
  ) {
    throw new Error(
      "Production bootstrap verification failed: expected 12 active categories.",
    );
  }

  if (salon.services.filter((service) => service.isActive).length !== 73) {
    throw new Error(
      "Production bootstrap verification failed: expected 73 active services.",
    );
  }

  if (salon._count.clients !== 0 || salon._count.appointments !== 0) {
    throw new Error(
      "Production bootstrap verification failed: clients/appointments must still be empty after structural bootstrap.",
    );
  }

  console.log("✓ Production bootstrap verified.");
  console.log("✓ 1 salon / 1 active admin / 7 employees.");
  console.log("✓ 4 rooms / 12 categories / 73 services.");
  console.log("✓ Employee skills match the approved SalonFlow V1 profiles.");
  console.log("✓ 0 clients / 0 appointments.");
}

main()
  .catch((error: unknown) => {
    console.error("❌ Production bootstrap verification failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
