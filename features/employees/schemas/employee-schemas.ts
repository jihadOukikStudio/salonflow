import { z } from "zod";

const nullableText = (max: number) =>
  z.union([z.string().trim().max(max), z.null()]).optional();

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
  email: z.string().trim().toLowerCase().email("Email invalide."),
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
