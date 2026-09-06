import { z } from "zod";

export const uuidSchema = z.string().trim().uuid("Identifiant invalide.");

export const positiveDurationSchema = z
  .number()
  .int("La durée doit être un nombre entier.")
  .min(1, "La durée doit être supérieure à 0.")
  .max(24 * 60, "La durée ne peut pas dépasser 24 heures.");

export const moneySchema = z
  .number()
  .finite("Le prix est invalide.")
  .min(0, "Le prix ne peut pas être négatif.")
  .max(1_000_000, "Le prix renseigné est trop élevé.");

export const internalNoteSchema = z
  .string()
  .trim()
  .max(2_000, "La note interne ne peut pas dépasser 2000 caractères.")
  .nullable();

export const dateTimeSchema = z
  .union([
    z.date(),
    z
      .string()
      .datetime({
        offset: true,
        message: "La date et l'heure sont invalides.",
      })
      .transform((value) => new Date(value)),
  ])
  .refine(
    (value) => !Number.isNaN(value.getTime()),
    "La date et l'heure sont invalides.",
  );
