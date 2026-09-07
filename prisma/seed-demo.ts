import "dotenv/config";

import { PrismaPg } from "@prisma/adapter-pg";

import { PrismaClient } from "../app/generated/prisma/client";

const DEMO_CONFIRMATION = "SALONFLOW_DEMO_ONLY";

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`${name} is missing.`);
  }

  return value;
}

function parseNames(value: string | undefined): string[] {
  const names = (value ?? "")
    .split(",")
    .map((name) => name.trim())
    .filter(Boolean);

  if (names.length > 0) {
    return names;
  }

  return [
    "Ahlam",
    "Khawla",
    "Salima",
    "Fatimazahrae",
    "Hasna",
    "Sabah",
    "Atika",
  ];
}

const connectionString = requireEnv("DATABASE_URL");

if (process.env.NODE_ENV === "production") {
  throw new Error(
    "Refus : le seed de démonstration ne peut pas tourner avec NODE_ENV=production.",
  );
}

if (process.env.DEMO_SEED_CONFIRM !== DEMO_CONFIRMATION) {
  throw new Error(
    `Refus : définissez DEMO_SEED_CONFIRM=${DEMO_CONFIRMATION} pour confirmer qu'il s'agit d'une base de démonstration.`,
  );
}

const demoDatabase = new URL(connectionString);
const demoDatabaseName = demoDatabase.pathname.replace(/^\//, "").toLowerCase();

if (
  !["localhost", "127.0.0.1", "::1"].includes(demoDatabase.hostname) &&
  !demoDatabaseName.includes("demo") &&
  !demoDatabaseName.includes("test")
) {
  throw new Error(
    "SECURITY: le seed de démonstration refuse une base distante qui n'est pas explicitement nommée demo/test.",
  );
}

const adapter = new PrismaPg({ connectionString });
const prisma = new PrismaClient({ adapter });

const employeeNames = parseNames(process.env.DEMO_EMPLOYEE_NAMES);
function casablancaDateKey(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function casablancaLocalToDate(dateKey: string, time: string): Date {
  // Marrakech/Casablanca is UTC+1 for the demo period. This seed is only
  // for local/demo data; application validation remains authoritative.
  return new Date(`${dateKey}T${time}:00+01:00`);
}

async function main() {
  console.log("🎬 Starting SalonFlow DEMO seed...");

  const salon = await prisma.salon.findFirst({
    where: { name: "Le 7ème Sens Marrakech" },
  });

  if (!salon) {
    throw new Error(
      'Salon "Le 7ème Sens Marrakech" introuvable. Lancez d’abord le seed principal.',
    );
  }

  const admin = await prisma.user.findFirst({
    where: {
      salonId: salon.id,
      role: "ADMIN",
      isActive: true,
    },
    orderBy: { createdAt: "asc" },
  });

  if (!admin) {
    throw new Error(
      "Aucun compte Admin actif n'est disponible pour créer la démo.",
    );
  }

  // On capture les identifiants après les gardes de nullabilité.
  // Cela évite que TypeScript considère salon/admin comme potentiellement null
  // dans les fonctions imbriquées définies plus bas.
  const salonId = salon.id;
  const adminId = admin.id;

  const allServices = await prisma.service.findMany({
    where: { salonId, isActive: true },
    include: { category: true },
    orderBy: [{ category: { displayOrder: "asc" } }, { name: "asc" }],
  });

  if (allServices.length === 0) {
    throw new Error(
      "Aucune prestation active. Lancez d’abord le seed principal.",
    );
  }

  const rooms = await prisma.room.findMany({
    where: { salonId, isActive: true },
  });

  const roomByName = new Map(rooms.map((room) => [room.name, room]));

  for (const name of [
    "Hamam individuel",
    "Hamam duo",
    "Salle de soins 1",
    "Salle de soins 2",
  ]) {
    if (!roomByName.has(name)) {
      throw new Error(`Salle requise manquante : ${name}`);
    }
  }

  // Employées : le téléphone est volontairement null. Il n'est pas requis
  // par le modèle ni par le fonctionnement V1.
  type DemoEmployee = Awaited<
    ReturnType<typeof prisma.employee.findMany>
  >[number];
  const employees: DemoEmployee[] = [];
  for (const firstName of employeeNames) {
    const existing = await prisma.employee.findFirst({
      where: { salonId, firstName },
      orderBy: { createdAt: "asc" },
    });

    const employee = existing
      ? await prisma.employee.update({
          where: { id: existing.id },
          data: { isActive: true },
        })
      : await prisma.employee.create({
          data: {
            salonId,
            firstName,
            phone: null,
            isActive: true,
          },
        });

    employees.push(employee);
  }

  // Compétences de démonstration d'après la répartition fournie :
  // - Fatimazahrae : cheveux / coloration / coupe / lissage / soins capillaires ;
  // - Hasna : massages ;
  // - Sabah et Atika : Hamam ;
  // - Ahlam, Khawla et Salima : le reste (cils/sourcils, épilation,
  //   mains/pieds, soins du visage).
  //
  // On attribue par catégories métier, jamais par position dans le tableau.
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

  const skillProfileByEmployee = new Map<
    string,
    (service: (typeof allServices)[number]) => boolean
  >([
    ["fatimazahrae", (service) => hairCategories.has(service.category.name)],
    ["hasna", (service) => service.category.name === "Massages"],
    ["sabah", (service) => service.category.name === "Hamam oriental"],
    ["atika", (service) => service.category.name === "Hamam oriental"],
    ["ahlam", (service) => generalCategories.has(service.category.name)],
    ["khawla", (service) => generalCategories.has(service.category.name)],
    ["salima", (service) => generalCategories.has(service.category.name)],
  ]);

  for (const employee of employees) {
    await prisma.employeeSkill.deleteMany({
      where: { employeeId: employee.id },
    });

    const profile = skillProfileByEmployee.get(
      normalizedName(employee.firstName),
    );

    if (!profile) {
      throw new Error(
        `Aucun profil de compétences démo configuré pour ${employee.firstName}.`,
      );
    }

    const allowedServices = allServices.filter(profile);

    if (allowedServices.length === 0) {
      throw new Error(
        `Aucune prestation trouvée pour le profil de ${employee.firstName}.`,
      );
    }

    await prisma.employeeSkill.createMany({
      data: allowedServices.map((service) => ({
        employeeId: employee.id,
        serviceId: service.id,
      })),
      skipDuplicates: true,
    });
  }

  // Clientes strictement fictives : préfixe réservé à la démo.
  const demoClients = [
    { name: "Cliente Démo 1", phone: "+212600900001" },
    { name: "Cliente Démo 2", phone: "+212600900002" },
    { name: "Cliente Démo 3", phone: "+212600900003" },
    { name: "Cliente Démo 4", phone: "+212600900004" },
    { name: "Cliente Démo 5", phone: "+212600900005" },
    { name: "Cliente Démo 6", phone: "+212600900006" },
    { name: "Cliente Démo 7", phone: "+212600900007" },
    { name: "Cliente Démo 8", phone: "+212600900008" },
  ];

  type DemoClient = Awaited<ReturnType<typeof prisma.client.findMany>>[number];
  const clients: DemoClient[] = [];
  for (const client of demoClients) {
    clients.push(
      await prisma.client.upsert({
        where: {
          salonId_phone: {
            salonId,
            phone: client.phone,
          },
        },
        update: {
          name: client.name,
          isActive: true,
          internalNote: "[DEMO] Cliente fictive",
        },
        create: {
          salonId,
          ...client,
          internalNote: "[DEMO] Cliente fictive",
          isActive: true,
        },
      }),
    );
  }

  // Nettoyage uniquement des anciens RDV de démonstration.
  await prisma.appointment.deleteMany({
    where: {
      salonId,
      internalNote: { startsWith: "[DEMO]" },
    },
  });

  const serviceByName = new Map(
    allServices.map((service) => [service.name, service]),
  );

  function service(name: string) {
    const found = serviceByName.get(name);
    if (!found) throw new Error(`Prestation démo introuvable : ${name}`);
    if (!found.defaultDurationMinutes) {
      throw new Error(`Durée manquante pour la prestation démo : ${name}`);
    }
    return found;
  }

  const today = casablancaDateKey();

  const employeeByName = new Map(
    employees.map((employee) => [normalizedName(employee.firstName), employee]),
  );

  function requiredEmployee(firstName: string) {
    const employee = employeeByName.get(normalizedName(firstName));
    if (!employee) {
      throw new Error(`Employée démo introuvable : ${firstName}`);
    }
    return employee;
  }

  const ahlam = requiredEmployee("Ahlam");
  const khawla = requiredEmployee("Khawla");
  const fatimazahrae = requiredEmployee("Fatimazahrae");
  const hasna = requiredEmployee("Hasna");
  const sabah = requiredEmployee("Sabah");
  const atika = requiredEmployee("Atika");

  async function createDemoAppointment(params: {
    clientIndex: number;
    time: string;
    serviceName: string;
    employeeId?: string;
    roomName?: string;
    status?: "PLANNED" | "IN_PROGRESS" | "COMPLETED" | "CLOSED";
    paid?: boolean;
    note: string;
  }) {
    const selectedService = service(params.serviceName);
    const duration = selectedService.defaultDurationMinutes!;
    const selectedClient = clients[params.clientIndex];

    if (!selectedClient) {
      throw new Error(
        `Cliente démo introuvable à l'index ${params.clientIndex}.`,
      );
    }

    const appointment = await prisma.appointment.create({
      data: {
        salonId,
        clientId: selectedClient.id,
        scheduledStart: casablancaLocalToDate(today, params.time),
        estimatedDurationMinutes: duration,
        status: params.status ?? "PLANNED",
        internalNote: `[DEMO] ${params.note}`,
        createdByUserId: adminId,
        services: {
          create: {
            serviceId: selectedService.id,
            serviceNameSnapshot: selectedService.name,
            durationMinutes: duration,
            price: selectedService.defaultPrice,
            requiredRoomTypeSnapshot: selectedService.requiredRoomType,
            status:
              params.status === "COMPLETED" || params.status === "CLOSED"
                ? "DONE"
                : params.status === "IN_PROGRESS"
                  ? "IN_PROGRESS"
                  : "TODO",
            assignedEmployeeId: params.employeeId ?? null,
            performedByEmployeeId:
              params.status === "COMPLETED" || params.status === "CLOSED"
                ? (params.employeeId ?? null)
                : null,
            roomId: params.roomName
              ? (roomByName.get(params.roomName)?.id ?? null)
              : null,
          },
        },
      },
      include: { services: true },
    });

    if (params.paid) {
      await prisma.payment.create({
        data: {
          appointmentId: appointment.id,
          amount: selectedService.defaultPrice,
          method: "CASH",
          status: "PAID",
          paidAt: new Date(),
          recordedByUserId: adminId,
        },
      });
    }

    return appointment;
  }

  await createDemoAppointment({
    clientIndex: 0,
    time: "10:00",
    serviceName: "Brushing",
    employeeId: fatimazahrae.id,
    status: "CLOSED",
    paid: true,
    note: "Brushing clôturé",
  });

  await createDemoAppointment({
    clientIndex: 1,
    time: "10:00",
    serviceName: "Hamam traditionnel",
    employeeId: sabah.id,
    roomName: "Hamam individuel",
    status: "CLOSED",
    paid: true,
    note: "Hamam clôturé",
  });

  await createDemoAppointment({
    clientIndex: 2,
    time: "11:00",
    serviceName: "Application racines",
    employeeId: fatimazahrae.id,
    status: "IN_PROGRESS",
    note: "Application racines en cours",
  });

  await createDemoAppointment({
    clientIndex: 3,
    time: "11:30",
    serviceName: "Manucure spa",
    employeeId: ahlam.id,
    status: "PLANNED",
    note: "Manucure planifiée",
  });

  await createDemoAppointment({
    clientIndex: 4,
    time: "12:30",
    serviceName: "Soin gold vitamin C boost",
    employeeId: khawla.id,
    roomName: "Salle de soins 1",
    status: "PLANNED",
    note: "Soin visage planifié",
  });

  await createDemoAppointment({
    clientIndex: 5,
    time: "14:00",
    serviceName: "Massage relaxant - 1 h",
    employeeId: hasna.id,
    roomName: "Salle de soins 2",
    status: "PLANNED",
    note: "Massage planifié",
  });

  // Un cas volontairement non affecté pour alimenter « À organiser ».
  await createDemoAppointment({
    clientIndex: 6,
    time: "16:00",
    serviceName: "Brushing",
    status: "PLANNED",
    note: "Brushing à affecter",
  });

  await createDemoAppointment({
    clientIndex: 7,
    time: "17:00",
    serviceName: "Hamam royal",
    employeeId: atika.id,
    roomName: "Hamam duo",
    status: "PLANNED",
    note: "Hamam duo planifié",
  });

  console.log(`✓ ${employees.length} employées démo`);
  console.log("✓ Compétences démo attribuées par profil métier");
  console.log(`✓ ${clients.length} clientes fictives`);
  console.log("✓ 8 rendez-vous de démonstration");
  console.log("✅ SalonFlow DEMO seed completed.");
}

main()
  .catch((error: unknown) => {
    console.error("❌ SalonFlow DEMO seed failed.");
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
