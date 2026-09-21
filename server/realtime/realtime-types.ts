export const SALONFLOW_REALTIME_CHANNEL = "salonflow_realtime_v1";

export const REALTIME_EVENT_TYPES = [
  "appointment.changed",
  "employee.changed",
  "room.changed",
  "availability.changed",
  "service.changed",
  "client.changed",
  "access.changed",
] as const;

export type RealtimeEventType = (typeof REALTIME_EVENT_TYPES)[number];

export type RealtimeEnvelope = {
  version: 1;
  eventId: string;
  salonId: string;
  type: RealtimeEventType;
  entityId?: string;
  emittedAt: string;
};

export type RealtimeClientEvent = Omit<RealtimeEnvelope, "salonId">;

const eventTypeSet = new Set<string>(REALTIME_EVENT_TYPES);

export function parseRealtimeEnvelope(raw: string): RealtimeEnvelope | null {
  try {
    const value: unknown = JSON.parse(raw);

    if (!value || typeof value !== "object") return null;

    const event = value as Record<string, unknown>;

    if (event.version !== 1) return null;
    if (typeof event.eventId !== "string" || event.eventId.length === 0) {
      return null;
    }
    if (typeof event.salonId !== "string" || event.salonId.length === 0) {
      return null;
    }
    if (typeof event.type !== "string" || !eventTypeSet.has(event.type)) {
      return null;
    }
    if (
      event.entityId !== undefined &&
      (typeof event.entityId !== "string" || event.entityId.length === 0)
    ) {
      return null;
    }
    if (
      typeof event.emittedAt !== "string" ||
      Number.isNaN(Date.parse(event.emittedAt))
    ) {
      return null;
    }

    return {
      version: 1,
      eventId: event.eventId,
      salonId: event.salonId,
      type: event.type as RealtimeEventType,
      ...(typeof event.entityId === "string"
        ? { entityId: event.entityId }
        : {}),
      emittedAt: event.emittedAt,
    };
  } catch {
    return null;
  }
}

export function toRealtimeClientEvent(
  event: RealtimeEnvelope,
): RealtimeClientEvent {
  return {
    version: event.version,
    eventId: event.eventId,
    type: event.type,
    ...(event.entityId ? { entityId: event.entityId } : {}),
    emittedAt: event.emittedAt,
  };
}
