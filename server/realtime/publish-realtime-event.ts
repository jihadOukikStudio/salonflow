import { randomUUID } from "node:crypto";

import { prisma } from "@/server/db/prisma";
import {
  SALONFLOW_REALTIME_CHANNEL,
  type RealtimeEnvelope,
  type RealtimeEventType,
} from "@/server/realtime/realtime-types";

type PublishRealtimeEventInput = {
  salonId: string;
  type: RealtimeEventType;
  entityId?: string;
};

/**
 * Publication volontairement best-effort.
 *
 * Une panne du canal temps réel ne doit jamais transformer une mutation métier
 * déjà validée/commitée en erreur utilisateur. Les écrans restent utilisables
 * normalement ; seule la synchronisation instantanée est temporairement perdue.
 */
export async function publishRealtimeEvent(
  input: PublishRealtimeEventInput,
): Promise<void> {
  const event: RealtimeEnvelope = {
    version: 1,
    eventId: randomUUID(),
    salonId: input.salonId,
    type: input.type,
    ...(input.entityId ? { entityId: input.entityId } : {}),
    emittedAt: new Date().toISOString(),
  };

  try {
    const payload = JSON.stringify(event);

    await prisma.$executeRaw`
      SELECT pg_notify(${SALONFLOW_REALTIME_CHANNEL}, ${payload})
    `;
  } catch (error) {
    console.error("[realtime] event publication failed", {
      type: input.type,
      entityId: input.entityId,
      error,
    });
  }
}
