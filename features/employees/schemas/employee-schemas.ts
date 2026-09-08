import { z } from "zod";

import { normalizeLoginPhone } from "@/lib/phone";

const nullableText = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional();

const optionalEmail = z
  .union([
    z.string().trim().toLowerCase().email("Email invalide."),
    z.literal(""),
    z.null(),
  ])
  .optional()
  .transform((value) => value || null);

const loginPhone = z
  .string()
  .trim()
  .min(1, "Le téléphone est obligatoire pour le compte de connexion.")
  .refine(
    (value) => normalizeLoginPhone(value) !== null,
    "Numéro de téléphone invalide.",
  )
  .transform((value) => normalizeLoginPhone(value)!);

export const createEmployeeActionSchema = z.object({
  firstName: z.string().trim().min(1, "Le prénom est obligatoire.").max(100),
  lastName: nullableText(100),
  phone: nullableText(40),
});

export const updateEmployeeActionSchema = z.object({
  employeeId: z.string().uuid(),
  firstName: z.string().trim().min(1, "Le prénom est obligatoire.").max(100),
  lastName: nullableText(100),
  phone: nullableText(40),
});

export const setEmployeeActiveActionSchema = z.object({
  employeeId: z.string().uuid(),
  isActive: z.boolean(),
});

export const saveEmployeeAccessActionSchema = z.object({
  employeeId: z.string().uuid(),
  phone: loginPhone,
  email: optionalEmail,
  temporaryPassword: z
    .string()
    .min(12, "Le mot de passe doit contenir au moins 12 caractères.")
    .optional(),
  canManageSalon: z.boolean(),
  isActive: z.boolean(),
});

export type CreateEmployeeActionInput = z.infer<
  typeof createEmployeeActionSchema
>;
export type UpdateEmployeeActionInput = z.infer<
  typeof updateEmployeeActionSchema
>;
export type SetEmployeeActiveActionInput = z.infer<
  typeof setEmployeeActiveActionSchema
>;
export type SaveEmployeeAccessActionInput = z.infer<
  typeof saveEmployeeAccessActionSchema
>;

export const saveEmployeeSkillsActionSchema = z.object({
  employeeId: z.string().uuid(),
  serviceIds: z.array(z.string().uuid()).max(200),
});

export type SaveEmployeeSkillsActionInput = z.infer<
  typeof saveEmployeeSkillsActionSchema
>;
