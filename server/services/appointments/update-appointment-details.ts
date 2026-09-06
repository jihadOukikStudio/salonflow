import type { CurrentUser } from "@/server/permissions";
import { requirePermission } from "@/server/permissions";

import { getAuthoritativeCurrentUser } from "@/server/auth/get-authoritative-current-user";

import { prisma } from "@/server/db/prisma";
import { lockResource } from "@/server/db/resource-lock";

import {
  BusinessRuleError,
  ResourceNotFoundError,
} from "@/server/services/errors";

type UpdateAppointmentDetailsInput = {
  appointmentId: string;

  /**
   * undefined = ne pas modifier la cliente
   */
  clientId?: string;

  /**
   * undefined = ne pas modifier la note
   * null / chaîne vide = supprimer la note
   */
  internalNote?: string | null;
};

export async function updateAppointmentDetails(
  currentUser: CurrentUser,
  input: UpdateAppointmentDetailsInput,
) {
  const authoritativeUser = await getAuthoritativeCurrentUser(currentUser);

  requirePermission(authoritativeUser, "appointments:update");

  const salonId = authoritativeUser.salonId;

  const wantsToUpdateClient = input.clientId !== undefined;

  const wantsToUpdateNote = input.internalNote !== undefined;

  if (!wantsToUpdateClient && !wantsToUpdateNote) {
    throw new BusinessRuleError("Aucune modification n'a été demandée.");
  }

  return prisma.$transaction(async (tx) => {
    /*
     * Première lecture strictement isolée par salon.
     *
     * Cela évite de révéler l'existence d'un rendez-vous
     * appartenant à un autre salon.
     */
    const initialAppointment = await tx.appointment.findFirst({
      where: {
        id: input.appointmentId,
        salonId,
      },

      select: {
        id: true,
      },
    });

    if (!initialAppointment) {
      throw new ResourceNotFoundError(
        "Le rendez-vous demandé est introuvable.",
      );
    }

    /*
     * Même protocole de verrouillage que les autres
     * mutations du rendez-vous.
     */
    await lockResource(
      tx,
      `salonflow:appointment:${salonId}:${initialAppointment.id}`,
    );

    /*
     * Toujours relire après acquisition du verrou.
     */
    const appointment = await tx.appointment.findFirst({
      where: {
        id: initialAppointment.id,
        salonId,
      },

      select: {
        id: true,
        clientId: true,
        internalNote: true,
        status: true,
      },
    });

    if (!appointment) {
      throw new ResourceNotFoundError(
        "Le rendez-vous demandé est introuvable.",
      );
    }

    /*
     * Un RDV terminé, clôturé ou annulé devient
     * un historique et n'est plus modifiable.
     */
    if (
      appointment.status === "COMPLETED" ||
      appointment.status === "CLOSED" ||
      appointment.status === "CANCELLED"
    ) {
      throw new BusinessRuleError("Ce rendez-vous ne peut plus être modifié.");
    }

    /*
     * Changer la cliente est une modification structurelle
     * importante.
     *
     * Une fois le RDV commencé, on ne change plus son identité.
     */
    if (wantsToUpdateClient && appointment.status !== "PLANNED") {
      throw new BusinessRuleError(
        "La cliente d'un rendez-vous déjà commencé ne peut plus être modifiée.",
      );
    }

    let nextClientId = appointment.clientId;

    /*
     * Vérification de la nouvelle cliente.
     */
    if (wantsToUpdateClient) {
      const requestedClientId = input.clientId;

      if (!requestedClientId) {
        throw new BusinessRuleError("Une cliente valide doit être renseignée.");
      }

      const client = await tx.client.findFirst({
        where: {
          id: requestedClientId,
          salonId,
          isActive: true,
        },

        select: {
          id: true,
        },
      });

      if (!client) {
        throw new ResourceNotFoundError(
          "La cliente demandée est introuvable ou inactive.",
        );
      }

      nextClientId = client.id;
    }

    /*
     * Normalisation de la note :
     *
     * undefined -> inchangée
     * null      -> supprimée
     * ""        -> supprimée
     * " texte " -> "texte"
     */
    let nextInternalNote = appointment.internalNote;

    if (input.internalNote !== undefined) {
      if (input.internalNote === null) {
        nextInternalNote = null;
      } else {
        const normalized = input.internalNote.trim();

        nextInternalNote = normalized.length > 0 ? normalized : null;
      }
    }

    /*
     * On détecte les appels sans changement réel.
     *
     * Ils ne produisent ni update inutile ni ActivityLog.
     */
    const clientChanged = nextClientId !== appointment.clientId;

    const noteChanged = nextInternalNote !== appointment.internalNote;

    if (!clientChanged && !noteChanged) {
      throw new BusinessRuleError(
        "Les informations renseignées sont identiques aux informations actuelles du rendez-vous.",
      );
    }

    /*
     * Modification conditionnelle.
     *
     * - client modifiable uniquement en PLANNED ;
     * - note modifiable en PLANNED ou IN_PROGRESS.
     */
    const allowedStatuses = clientChanged
      ? (["PLANNED"] as const)
      : (["PLANNED", "IN_PROGRESS"] as const);

    const updateResult = await tx.appointment.updateMany({
      where: {
        id: appointment.id,
        salonId,

        status: {
          in: [...allowedStatuses],
        },
      },

      data: {
        ...(clientChanged
          ? {
              clientId: nextClientId,
            }
          : {}),

        ...(noteChanged
          ? {
              internalNote: nextInternalNote,
            }
          : {}),
      },
    });

    if (updateResult.count !== 1) {
      throw new BusinessRuleError("Le rendez-vous ne peut plus être modifié.");
    }

    /*
     * Traçabilité légère mais exploitable.
     *
     * On stocke les anciennes et nouvelles valeurs
     * pour savoir exactement ce qui a changé.
     */
    await tx.activityLog.create({
      data: {
        salonId,
        userId: authoritativeUser.id,

        action: "APPOINTMENT_DETAILS_UPDATED",

        entityType: "APPOINTMENT",
        entityId: appointment.id,

        metadata: {
          clientChanged,
          noteChanged,

          previousClientId: appointment.clientId,

          clientId: nextClientId,

          previousInternalNote: appointment.internalNote,

          internalNote: nextInternalNote,
        },
      },
    });

    const result = await tx.appointment.findFirst({
      where: {
        id: appointment.id,
        salonId,
      },

      include: {
        client: true,
        services: true,
        payment: true,
      },
    });

    if (!result) {
      throw new ResourceNotFoundError(
        "Le rendez-vous modifié est introuvable.",
      );
    }

    return result;
  });
}
