import { z } from "zod";

export function normalizeClientPhone(value: string): string {
  const compact = value.trim().replace(/[\s().-]/g, "");

  if (compact.startsWith("00")) {
    return `+${compact.slice(2)}`;
  }

  return compact;
}

export function phoneDigits(value: string): string {
  return normalizeClientPhone(value).replace(/\D/g, "");
}

export const clientNameSchema = z
  .string()
  .trim()
  .min(1, "Le nom de la cliente est obligatoire.")
  .max(120, "Le nom de la cliente ne peut pas dépasser 120 caractères.");

export const clientPhoneSchema = z
  .string()
  .transform(normalizeClientPhone)
  .pipe(
    z
      .string()
      .regex(/^\+?[0-9]{8,15}$/, "Renseignez un numéro de téléphone valide."),
  );

export const createClientActionSchema = z.object({
  name: clientNameSchema,
  phone: clientPhoneSchema,
});

export const searchClientsActionSchema = z
  .object({
    phone: z.string().trim().max(30),
    name: z.string().trim().max(120).optional().default(""),
  })
  .transform((value) => ({
    phoneDigits: phoneDigits(value.phone),
    name: value.name.trim(),
  }))
  .superRefine((value, context) => {
    if (value.phoneDigits.length < 4) {
      context.addIssue({
        code: "custom",
        path: ["phone"],
        message: "Saisissez au moins 4 chiffres du téléphone.",
      });
    }
  });

export type CreateClientActionInput = z.input<typeof createClientActionSchema>;
export type SearchClientsActionInput = z.input<
  typeof searchClientsActionSchema
>;
export type SearchClientsInput = z.output<typeof searchClientsActionSchema>;
