import { z } from "zod";

export const updateServiceDefaultsActionSchema = z
  .object({
    serviceId: z.string().trim().uuid("Identifiant de prestation invalide."),
    defaultDurationMinutes: z
      .number()
      .int("La durée doit être un nombre entier.")
      .min(1, "La durée doit être supérieure à 0 minute.")
      .max(24 * 60, "La durée ne peut pas dépasser 24 heures."),
    defaultPrice: z
      .number()
      .finite("Le prix est invalide.")
      .min(0, "Le prix ne peut pas être négatif.")
      .max(1_000_000, "Le prix est trop élevé."),
    isStartingPrice: z.boolean(),
  })
  .strict();

export type UpdateServiceDefaultsActionInput = z.input<
  typeof updateServiceDefaultsActionSchema
>;
