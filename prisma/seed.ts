import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";
import { hash } from "bcryptjs";

import { PrismaClient } from "../app/generated/prisma/client";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is missing.`);
  }

  return value;
}

const connectionString = requireEnv("DATABASE_URL");
const adminEmail = requireEnv("SEED_ADMIN_EMAIL").toLowerCase();
const adminPassword = requireEnv("SEED_ADMIN_PASSWORD");

if (
  process.env.NODE_ENV === "production" &&
  process.env.PRODUCTION_SEED_CONFIRM !== "SALONFLOW_PRODUCTION_BOOTSTRAP"
) {
  throw new Error(
    "SECURITY: production seed refused. Set PRODUCTION_SEED_CONFIRM=SALONFLOW_PRODUCTION_BOOTSTRAP only for the intentional bootstrap.",
  );
}

if (adminPassword.length < 12) {
  throw new Error("SEED_ADMIN_PASSWORD must contain at least 12 characters.");
}

const adapter = new PrismaPg({
  connectionString,
});

const prisma = new PrismaClient({
  adapter,
});

type SeedService = {
  category: string;
  name: string;
  price: number;
  isStartingPrice?: boolean;
  durationMinutes?: number;
  requiredRoomType?: "HAMAM" | "TREATMENT_ROOM";
};

const employeeFirstNames = [
  "Ahlam",
  "Khawla",
  "Salima",
  "Fatimazahrae",
  "Hasna",
  "Sabah",
  "Atika",
] as const;

const hairCategories = new Set([
  "Coiffure",
  "Soins capillaires",
  "Coloration",
  "Coloration sans ammoniaque",
  "Balayages",
  "Lissages",
]);

const generalCategories = new Set([
  "Cils & Sourcils",
  "Épilation à la cire",
  "Beauté des mains et des pieds",
  "Soins du visage",
]);

function normalizedName(value: string) {
  return value.trim().toLocaleLowerCase("fr");
}

const categories = [
  "Coiffure",
  "Soins capillaires",
  "Coloration",
  "Coloration sans ammoniaque",
  "Balayages",
  "Cils & Sourcils",
  "Épilation à la cire",
  "Beauté des mains et des pieds",
  "Lissages",
  "Soins du visage",
  "Hamam oriental",
  "Massages",
] as const;

const services: SeedService[] = [
  // Coiffure
  {
    category: "Coiffure",
    name: "Brushing",
    price: 60,
    durationMinutes: 30,
    isStartingPrice: true,
  },
  {
    category: "Coiffure",
    name: "Brushing Dyson",
    price: 100,
    durationMinutes: 30,
  },
  {
    category: "Coiffure",
    name: "Touching",
    price: 40,
    durationMinutes: 20,
  },
  {
    category: "Coiffure",
    name: "Coupe",
    price: 200,
    durationMinutes: 45,
  },
  {
    category: "Coiffure",
    name: "Frange pointe",
    price: 50,
    durationMinutes: 15,
  },
  {
    category: "Coiffure",
    name: "Coiffure soirée",
    price: 300,
    durationMinutes: 60,
    isStartingPrice: true,
  },
  {
    category: "Coiffure",
    name: "Bushing wavy",
    price: 80,
    durationMinutes: 45,
  },
  {
    category: "Coiffure",
    name: "Extensions (20 mèches)",
    price: 1400,
    durationMinutes: 120,
  },
  {
    category: "Coiffure",
    name: "Application racines",
    price: 150,
    durationMinutes: 30,
  },

  // Soins capillaires
  {
    category: "Soins capillaires",
    name: "Soin classic",
    price: 100,
    durationMinutes: 30,
  },
  {
    category: "Soins capillaires",
    name: "Soin fusio dose",
    price: 250,
    durationMinutes: 30,
  },
  {
    category: "Soins capillaires",
    name: "Soin chronologiste",
    price: 500,
    durationMinutes: 45,
  },
  {
    category: "Soins capillaires",
    name: "Soin 18 k",
    price: 200,
    durationMinutes: 45,
    isStartingPrice: true,
  },
  {
    category: "Soins capillaires",
    name: "Soin terra coco todo de coco",
    price: 350,
    durationMinutes: 45,
  },

  // Coloration
  {
    category: "Coloration",
    name: "Coloration racines",
    price: 250,
    durationMinutes: 60,
  },
  {
    category: "Coloration",
    name: "Coloration cheveux courts",
    price: 300,
    durationMinutes: 75,
  },
  {
    category: "Coloration",
    name: "Coloration cheveux longs",
    price: 400,
    durationMinutes: 90,
  },

  // Coloration sans ammoniaque
  {
    category: "Coloration sans ammoniaque",
    name: "Coloration racines",
    price: 300,
    durationMinutes: 60,
  },
  {
    category: "Coloration sans ammoniaque",
    name: "Coloration cheveux courts",
    price: 350,
    durationMinutes: 75,
  },
  {
    category: "Coloration sans ammoniaque",
    name: "Coloration cheveux longs",
    price: 450,
    durationMinutes: 90,
  },

  // Balayages
  {
    category: "Balayages",
    name: "Balayage cheveux courts",
    price: 500,
    durationMinutes: 120,
    isStartingPrice: true,
  },
  {
    category: "Balayages",
    name: "Balayage cheveux longs",
    price: 600,
    durationMinutes: 150,
    isStartingPrice: true,
  },
  {
    category: "Balayages",
    name: "Ombré",
    price: 900,
    durationMinutes: 180,
    isStartingPrice: true,
  },

  // Cils & Sourcils
  {
    category: "Cils & Sourcils",
    name: "Faux cils",
    price: 200,
    durationMinutes: 45,
  },
  {
    category: "Cils & Sourcils",
    name: "Extension de cils",
    price: 500,
    durationMinutes: 120,
    isStartingPrice: true,
  },
  {
    category: "Cils & Sourcils",
    name: "Rehaussement des cils",
    price: 300,
    durationMinutes: 60,
  },
  {
    category: "Cils & Sourcils",
    name: "Rehaussement des sourcils",
    price: 400,
    durationMinutes: 60,
  },

  // Épilation à la cire
  {
    category: "Épilation à la cire",
    name: "Sourcils",
    price: 40,
    durationMinutes: 15,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Duvet",
    price: 30,
    durationMinutes: 10,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Visage entier",
    price: 100,
    durationMinutes: 30,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Aisselles",
    price: 50,
    durationMinutes: 15,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Demi-bras",
    price: 50,
    durationMinutes: 20,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Bras entiers",
    price: 90,
    durationMinutes: 30,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Demi-jambes",
    price: 60,
    durationMinutes: 30,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Jambes entières",
    price: 120,
    durationMinutes: 45,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Bords de maillot",
    price: 60,
    durationMinutes: 20,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Maillot intégral",
    price: 110,
    durationMinutes: 30,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Fesses",
    price: 50,
    durationMinutes: 15,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Ventre / Dos",
    price: 50,
    durationMinutes: 30,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Épilation complète",
    price: 350,
    durationMinutes: 90,
    requiredRoomType: "TREATMENT_ROOM",
  },

  // Beauté des mains et des pieds
  {
    category: "Beauté des mains et des pieds",
    name: "Manucure simple",
    price: 100,
    durationMinutes: 30,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Manucure spa",
    price: 150,
    durationMinutes: 45,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Manucure + vernis permanent",
    price: 180,
    durationMinutes: 60,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Pose vernis normal",
    price: 50,
    durationMinutes: 20,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Pose french",
    price: 60,
    durationMinutes: 30,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Pose vernis semi permanent",
    price: 60,
    durationMinutes: 30,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Pose vernis permanent French / Motifs",
    price: 200,
    durationMinutes: 60,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Renforcement (kératine)",
    price: 150,
    durationMinutes: 45,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Peeling des ongles",
    price: 150,
    durationMinutes: 30,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Pédicure simple",
    price: 150,
    durationMinutes: 45,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Pédicure spa",
    price: 200,
    durationMinutes: 60,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Pédicure + vernis permanent",
    price: 180,
    durationMinutes: 60,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Dépose vernis permanent",
    price: 50,
    durationMinutes: 20,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Dépose gel",
    price: 100,
    durationMinutes: 30,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Faux ongles vernis normal",
    price: 150,
    durationMinutes: 60,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Faux ongles vernis permanent",
    price: 250,
    durationMinutes: 75,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Gel",
    price: 400,
    durationMinutes: 90,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Remplissage gel",
    price: 300,
    durationMinutes: 75,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Gel avec babyboomer / Nail art",
    price: 500,
    durationMinutes: 120,
  },

  // Lissages
  {
    category: "Lissages",
    name: "Soin lissage",
    price: 1000,
    durationMinutes: 180,
    isStartingPrice: true,
  },
  {
    category: "Lissages",
    name: "Soin protéine",
    price: 800,
    durationMinutes: 150,
    isStartingPrice: true,
  },

  // Soins du visage
  {
    category: "Soins du visage",
    name: "Soin gold coup d'éclat",
    price: 250,
    durationMinutes: 45,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Soins du visage",
    name: "Soin gold vitamin C boost",
    price: 350,
    durationMinutes: 60,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Soins du visage",
    name: "Soin gold hydra glow treatment",
    price: 500,
    durationMinutes: 75,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Soins du visage",
    name: "Soin gold collagen eyes rescue",
    price: 700,
    durationMinutes: 60,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Soins du visage",
    name: "Soin micro dermabrasion",
    price: 800,
    durationMinutes: 75,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Soins du visage",
    name: "Soin gold booster 100% collagen",
    price: 900,
    durationMinutes: 90,
    requiredRoomType: "TREATMENT_ROOM",
  },

  // Hamam oriental
  {
    category: "Hamam oriental",
    name: "Hamam traditionnel",
    price: 190,
    durationMinutes: 60,
    requiredRoomType: "HAMAM",
  },
  {
    category: "Hamam oriental",
    name: "Hamam tropical",
    price: 290,
    durationMinutes: 60,
    requiredRoomType: "HAMAM",
  },
  {
    category: "Hamam oriental",
    name: "Hamam royal",
    price: 390,
    durationMinutes: 60,
    requiredRoomType: "HAMAM",
  },
  {
    category: "Hamam oriental",
    name: "Hamam enfant",
    price: 90,
    durationMinutes: 60,
    requiredRoomType: "HAMAM",
  },

  // Massages
  {
    category: "Massages",
    name: "Massage relaxant - 30 min",
    price: 200,
    durationMinutes: 30,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Massages",
    name: "Massage relaxant - 1 h",
    price: 350,
    durationMinutes: 60,
    requiredRoomType: "TREATMENT_ROOM",
  },
];

async function upsertService({
  salonId,
  categoryId,
  service,
}: {
  salonId: string;
  categoryId: string;
  service: SeedService;
}) {
  const existingService = await prisma.service.findFirst({
    where: {
      salonId,
      categoryId,
      name: service.name,
    },
  });

  const data = {
    salonId,
    categoryId,
    name: service.name,
    defaultPrice: service.price,
    defaultDurationMinutes: service.durationMinutes ?? null,
    isStartingPrice: service.isStartingPrice ?? false,
    requiredRoomType: service.requiredRoomType ?? null,
    isActive: true,
  };

  if (existingService) {
    return prisma.service.update({
      where: {
        id: existingService.id,
      },
      data,
    });
  }

  return prisma.service.create({
    data,
  });
}

async function main() {
  console.log("🌱 Starting SalonFlow seed...");

  if (process.env.NODE_ENV === "production") {
    const existingSalons = await prisma.salon.findMany({
      select: { id: true, name: true },
    });

    const unexpectedSalons = existingSalons.filter(
      (existingSalon) => existingSalon.name !== "Le 7ème Sens Marrakech",
    );

    if (unexpectedSalons.length > 0) {
      throw new Error(
        "SECURITY: production bootstrap refused because another salon already exists in this database.",
      );
    }
  }

  let salon = await prisma.salon.findFirst({
    where: {
      name: "Le 7ème Sens Marrakech",
    },
  });

  if (!salon) {
    salon = await prisma.salon.create({
      data: {
        name: "Le 7ème Sens Marrakech",
        isActive: true,
      },
    });
  }

  console.log(`✓ Salon: ${salon.name}`);

  if (process.env.NODE_ENV === "production") {
    const [clientCount, appointmentCount] = await Promise.all([
      prisma.client.count({ where: { salonId: salon.id } }),
      prisma.appointment.count({ where: { salonId: salon.id } }),
    ]);

    if (clientCount > 0 || appointmentCount > 0) {
      throw new Error(
        "SECURITY: production bootstrap refused because client/appointment business data already exists.",
      );
    }
  }

  const passwordHash = await hash(adminPassword, 12);

  await prisma.user.upsert({
    where: {
      salonId_email: {
        salonId: salon.id,
        email: adminEmail,
      },
    },
    update: {
      passwordHash,
      role: "ADMIN",
      canManageSalon: true,
      isActive: true,
    },
    create: {
      salonId: salon.id,
      email: adminEmail,
      passwordHash,
      firstName: "Gérante",
      role: "ADMIN",
      canManageSalon: true,
      isActive: true,
    },
  });

  console.log(`✓ Admin: ${adminEmail}`);

  const rooms = [
    {
      name: "Hamam individuel",
      type: "HAMAM" as const,
      capacity: 1,
    },
    {
      name: "Hamam duo",
      type: "HAMAM" as const,
      capacity: 2,
    },
    {
      name: "Salle de soins 1",
      type: "TREATMENT_ROOM" as const,
      capacity: 1,
    },
    {
      name: "Salle de soins 2",
      type: "TREATMENT_ROOM" as const,
      capacity: 1,
    },
  ];

  for (const room of rooms) {
    await prisma.room.upsert({
      where: {
        salonId_name: {
          salonId: salon.id,
          name: room.name,
        },
      },
      update: {
        type: room.type,
        capacity: room.capacity,
        isActive: true,
      },
      create: {
        salonId: salon.id,
        name: room.name,
        type: room.type,
        capacity: room.capacity,
        isActive: true,
      },
    });
  }

  console.log(`✓ ${rooms.length} salles`);

  const categoryByName = new Map<string, string>();

  for (const [index, categoryName] of categories.entries()) {
    const category = await prisma.serviceCategory.upsert({
      where: {
        salonId_name: {
          salonId: salon.id,
          name: categoryName,
        },
      },
      update: {
        displayOrder: index,
        isActive: true,
      },
      create: {
        salonId: salon.id,
        name: categoryName,
        displayOrder: index,
        isActive: true,
      },
    });

    categoryByName.set(categoryName, category.id);
  }

  console.log(`✓ ${categories.length} catégories`);

  for (const service of services) {
    const categoryId = categoryByName.get(service.category);

    if (!categoryId) {
      throw new Error(
        `Category "${service.category}" was not found for service "${service.name}".`,
      );
    }

    await upsertService({
      salonId: salon.id,
      categoryId,
      service,
    });
  }

  console.log(`✓ ${services.length} prestations`);

  const activeServices = await prisma.service.findMany({
    where: { salonId: salon.id, isActive: true },
    include: { category: true },
  });

  const skillProfileByEmployee = new Map<
    string,
    (service: (typeof activeServices)[number]) => boolean
  >([
    ["fatimazahrae", (service) => hairCategories.has(service.category.name)],
    ["hasna", (service) => service.category.name === "Massages"],
    ["sabah", (service) => service.category.name === "Hamam oriental"],
    ["atika", (service) => service.category.name === "Hamam oriental"],
    ["ahlam", (service) => generalCategories.has(service.category.name)],
    ["khawla", (service) => generalCategories.has(service.category.name)],
    ["salima", (service) => generalCategories.has(service.category.name)],
  ]);

  for (const firstName of employeeFirstNames) {
    const existingEmployees = await prisma.employee.findMany({
      where: { salonId: salon.id, firstName },
      orderBy: { createdAt: "asc" },
    });

    if (existingEmployees.length > 1) {
      throw new Error(
        `Bootstrap refused: plusieurs employées portent déjà le prénom ${firstName}.`,
      );
    }

    const employee = existingEmployees[0]
      ? await prisma.employee.update({
          where: { id: existingEmployees[0].id },
          data: { isActive: true },
        })
      : await prisma.employee.create({
          data: {
            salonId: salon.id,
            firstName,
            phone: null,
            isActive: true,
          },
        });

    const profile = skillProfileByEmployee.get(normalizedName(firstName));

    if (!profile) {
      throw new Error(
        `Aucun profil de compétences configuré pour ${firstName}.`,
      );
    }

    const allowedServices = activeServices.filter(profile);

    if (allowedServices.length === 0) {
      throw new Error(
        `Aucune prestation compatible trouvée pour ${firstName}.`,
      );
    }

    await prisma.employeeSkill.deleteMany({
      where: { employeeId: employee.id },
    });

    await prisma.employeeSkill.createMany({
      data: allowedServices.map((service) => ({
        employeeId: employee.id,
        serviceId: service.id,
      })),
      skipDuplicates: true,
    });
  }

  console.log(`✓ ${employeeFirstNames.length} employées réelles`);
  console.log("✓ Compétences employées configurées");
  console.log("✅ SalonFlow seed completed.");
}

main()
  .catch((error: unknown) => {
    console.error("❌ SalonFlow seed failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
