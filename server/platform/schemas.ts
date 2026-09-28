import { z } from "zod";
const id = z.uuid();
const text = (max: number) => z.string().trim().min(1).max(max);
const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null);
const optionalSalon = z.union([id, z.literal("")]).transform((v) => v || null);
const reason = text(500);
const date = z.iso.date().transform((v) => new Date(`${v}T00:00:00Z`));
export const platformCommandSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("createDue"),
    salonId: id,
    title: text(150),
    dueAt: date,
    amount: z
      .string()
      .regex(/^\d{1,8}(\.\d{1,2})?$/)
      .refine((v) => Number(v) > 0),
    currency: z.enum(["MAD", "EUR", "USD"]),
    note: nullableText(500),
  }),
  z.object({ kind: z.literal("settleDue"), dueId: id, paymentId: id }),
  z.object({ kind: z.literal("cancelDue"), dueId: id, reason }),
  z.object({
    kind: z.literal("salonDetails"),
    salonId: id,
    name: text(150),
    phone: nullableText(40),
    address: nullableText(300),
    timezone: z.enum(["Africa/Casablanca", "Europe/Paris", "UTC"]),
    currency: z.enum(["MAD", "EUR", "USD"]),
  }),
  z
    .object({
      kind: z.literal("recordPayment"),
      salonId: id,
      amount: z
        .string()
        .regex(/^\d{1,8}(\.\d{1,2})?$/)
        .refine((v) => Number(v) > 0),
      currency: z.enum(["MAD", "EUR", "USD"]),
      paidAt: date,
      periodStart: date,
      periodEnd: date,
      method: z.enum(["Virement", "Espèces", "Autre"]),
      reference: nullableText(150),
    })
    .refine((v) => v.periodEnd >= v.periodStart, {
      message: "La fin de période doit suivre le début.",
      path: ["periodEnd"],
    }),
  z.object({ kind: z.literal("voidPayment"), paymentId: id, reason }),
  z.object({
    kind: z.literal("incidentMessage"),
    incidentId: id,
    body: text(3000),
    internal: z.enum(["true", "false"]).transform((v) => v === "true"),
  }),
  z.object({ kind: z.literal("revokeSessions"), userId: id, reason }),
  z.object({
    kind: z.literal("createSalon"),
    name: text(150),
    phone: nullableText(40),
    address: nullableText(300),
  }),
  z.object({
    kind: z.literal("salonStatus"),
    salonId: id,
    lifecycle: z.enum(["PREPARING", "ACTIVE", "SUSPENDED", "ARCHIVED"]),
    reason,
    confirmation: text(150),
  }),
  z.object({
    kind: z.literal("subscription"),
    salonId: id,
    planName: text(80),
    status: z.enum(["TRIAL", "ACTIVE", "PAST_DUE", "CANCELLED"]),
    monthlyPrice: z.string().regex(/^\d{1,8}(\.\d{1,2})?$/),
    currency: z.enum(["MAD", "EUR", "USD"]),
    periodEnd: z
      .union([z.iso.date(), z.literal("")])
      .transform((v) => (v ? new Date(`${v}T00:00:00Z`) : null)),
    note: nullableText(1000),
  }),
  z.object({
    kind: z.literal("createIncident"),
    salonId: optionalSalon,
    title: text(150),
    description: text(3000),
    priority: z.enum(["LOW", "NORMAL", "HIGH", "CRITICAL"]),
  }),
  z
    .object({
      kind: z.literal("incidentStatus"),
      incidentId: id,
      status: z.enum(["OPEN", "IN_PROGRESS", "RESOLVED"]),
      resolution: nullableText(3000),
    })
    .refine((v) => v.status !== "RESOLVED" || v.resolution !== null, {
      message: "Précisez la résolution avant de clôturer.",
      path: ["resolution"],
    }),
  z
    .object({
      kind: z.literal("createManager"),
      salonId: id,
      firstName: text(100),
      lastName: nullableText(100),
      email: z.string().trim().toLowerCase().email().max(320),
      password: z
        .string()
        .min(12)
        .refine(
          (v) => Buffer.byteLength(v, "utf8") <= 72,
          "72 octets UTF-8 maximum.",
        ),
      confirmation: z.string(),
    })
    .refine((v) => v.password === v.confirmation, {
      message: "Les mots de passe diffèrent.",
      path: ["confirmation"],
    }),
  z.object({
    kind: z.literal("managerStatus"),
    salonId: id,
    userId: id,
    isActive: z.enum(["true", "false"]).transform((v) => v === "true"),
    reason,
  }),
]);
