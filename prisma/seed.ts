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
    isStartingPrice: true,
  },
  {
    category: "Coiffure",
    name: "Brushing Dyson",
    price: 100,
  },
  {
    category: "Coiffure",
    name: "Touching",
    price: 40,
  },
  {
    category: "Coiffure",
    name: "Coupe",
    price: 200,
  },
  {
    category: "Coiffure",
    name: "Frange pointe",
    price: 50,
  },
  {
    category: "Coiffure",
    name: "Coiffure soirée",
    price: 300,
    isStartingPrice: true,
  },
  {
    category: "Coiffure",
    name: "Bushing wavy",
    price: 80,
  },
  {
    category: "Coiffure",
    name: "Extensions (20 mèches)",
    price: 1400,
  },
  {
    category: "Coiffure",
    name: "Application racines",
    price: 150,
  },

  // Soins capillaires
  {
    category: "Soins capillaires",
    name: "Soin classic",
    price: 100,
  },
  {
    category: "Soins capillaires",
    name: "Soin fusio dose",
    price: 250,
  },
  {
    category: "Soins capillaires",
    name: "Soin chronologiste",
    price: 500,
  },
  {
    category: "Soins capillaires",
    name: "Soin 18 k",
    price: 200,
    isStartingPrice: true,
  },
  {
    category: "Soins capillaires",
    name: "Soin terra coco todo de coco",
    price: 350,
  },

  // Coloration
  {
    category: "Coloration",
    name: "Coloration racines",
    price: 250,
  },
  {
    category: "Coloration",
    name: "Coloration cheveux courts",
    price: 300,
  },
  {
    category: "Coloration",
    name: "Coloration cheveux longs",
    price: 400,
  },

  // Coloration sans ammoniaque
  {
    category: "Coloration sans ammoniaque",
    name: "Coloration racines",
    price: 300,
  },
  {
    category: "Coloration sans ammoniaque",
    name: "Coloration cheveux courts",
    price: 350,
  },
  {
    category: "Coloration sans ammoniaque",
    name: "Coloration cheveux longs",
    price: 450,
  },

  // Balayages
  {
    category: "Balayages",
    name: "Balayage cheveux courts",
    price: 500,
    isStartingPrice: true,
  },
  {
    category: "Balayages",
    name: "Balayage cheveux longs",
    price: 600,
    isStartingPrice: true,
  },
  {
    category: "Balayages",
    name: "Ombré",
    price: 900,
    isStartingPrice: true,
  },

  // Cils & Sourcils
  {
    category: "Cils & Sourcils",
    name: "Faux cils",
    price: 200,
  },
  {
    category: "Cils & Sourcils",
    name: "Extension de cils",
    price: 500,
    isStartingPrice: true,
  },
  {
    category: "Cils & Sourcils",
    name: "Rehaussement des cils",
    price: 300,
  },
  {
    category: "Cils & Sourcils",
    name: "Rehaussement des sourcils",
    price: 400,
  },

  // Épilation à la cire
  {
    category: "Épilation à la cire",
    name: "Sourcils",
    price: 40,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Duvet",
    price: 30,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Visage entier",
    price: 100,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Aisselles",
    price: 50,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Demi-bras",
    price: 50,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Bras entiers",
    price: 90,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Demi-jambes",
    price: 60,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Jambes entières",
    price: 120,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Bords de maillot",
    price: 60,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Maillot intégral",
    price: 110,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Fesses",
    price: 50,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Ventre / Dos",
    price: 50,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Épilation à la cire",
    name: "Épilation complète",
    price: 350,
    requiredRoomType: "TREATMENT_ROOM",
  },

  // Beauté des mains et des pieds
  {
    category: "Beauté des mains et des pieds",
    name: "Manucure simple",
    price: 100,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Manucure spa",
    price: 150,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Manucure + vernis permanent",
    price: 180,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Pose vernis normal",
    price: 50,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Pose french",
    price: 60,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Pose vernis semi permanent",
    price: 60,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Pose vernis permanent French / Motifs",
    price: 200,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Renforcement (kératine)",
    price: 150,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Peeling des ongles",
    price: 150,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Pédicure simple",
    price: 150,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Pédicure spa",
    price: 200,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Pédicure + vernis permanent",
    price: 180,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Dépose vernis permanent",
    price: 50,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Dépose gel",
    price: 100,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Faux ongles vernis normal",
    price: 150,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Faux ongles vernis permanent",
    price: 250,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Gel",
    price: 400,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Remplissage gel",
    price: 300,
  },
  {
    category: "Beauté des mains et des pieds",
    name: "Gel avec babyboomer / Nail art",
    price: 500,
  },

  // Lissages
  {
    category: "Lissages",
    name: "Soin lissage",
    price: 1000,
    isStartingPrice: true,
  },
  {
    category: "Lissages",
    name: "Soin protéine",
    price: 800,
    isStartingPrice: true,
  },

  // Soins du visage
  {
    category: "Soins du visage",
    name: "Soin gold coup d'éclat",
    price: 250,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Soins du visage",
    name: "Soin gold vitamin C boost",
    price: 350,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Soins du visage",
    name: "Soin gold hydra glow treatment",
    price: 500,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Soins du visage",
    name: "Soin gold collagen eyes rescue",
    price: 700,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Soins du visage",
    name: "Soin micro dermabrasion",
    price: 800,
    requiredRoomType: "TREATMENT_ROOM",
  },
  {
    category: "Soins du visage",
    name: "Soin gold booster 100% collagen",
    price: 900,
    requiredRoomType: "TREATMENT_ROOM",
  },

  // Hamam oriental
  {
    category: "Hamam oriental",
    name: "Hamam traditionnel",
    price: 190,
    requiredRoomType: "HAMAM",
  },
  {
    category: "Hamam oriental",
    name: "Hamam tropical",
    price: 290,
    requiredRoomType: "HAMAM",
  },
  {
    category: "Hamam oriental",
    name: "Hamam royal",
    price: 390,
    requiredRoomType: "HAMAM",
  },
  {
    category: "Hamam oriental",
    name: "Hamam enfant",
    price: 90,
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
