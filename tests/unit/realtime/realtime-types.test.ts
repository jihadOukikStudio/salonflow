import { describe, expect, it } from "vitest";

import { SalonRealtimeHub } from "@/server/realtime/realtime-hub";
import {
  parseRealtimeEnvelope,
  toRealtimeClientEvent,
  type RealtimeEnvelope,
} from "@/server/realtime/realtime-types";

function event(overrides: Partial<RealtimeEnvelope> = {}): RealtimeEnvelope {
  return {
    version: 1,
    eventId: "evt-1",
    salonId: "salon-a",
    type: "appointment.changed",
    emittedAt: "2026-09-11T10:00:00.000Z",
    ...overrides,
  };
}

describe("realtime security boundary", () => {
  it("ne distribue jamais un événement d'un salon à un autre", () => {
    const hub = new SalonRealtimeHub();
    const salonA: RealtimeEnvelope[] = [];
    const salonB: RealtimeEnvelope[] = [];

    hub.subscribe("salon-a", (value) => salonA.push(value));
    hub.subscribe("salon-b", (value) => salonB.push(value));

    hub.dispatch(event({ salonId: "salon-a" }));

    expect(salonA).toHaveLength(1);
    expect(salonB).toHaveLength(0);
  });

  it("ne transmet pas salonId au navigateur", () => {
    expect(toRealtimeClientEvent(event())).toEqual({
      version: 1,
      eventId: "evt-1",
      type: "appointment.changed",
      emittedAt: "2026-09-11T10:00:00.000Z",
    });
  });

  it("rejette les notifications PostgreSQL malformées", () => {
    expect(parseRealtimeEnvelope("not-json")).toBeNull();
    expect(
      parseRealtimeEnvelope(
        JSON.stringify({
          version: 1,
          eventId: "evt-1",
          salonId: "salon-a",
          type: "unknown.event",
          emittedAt: "2026-09-11T10:00:00.000Z",
        }),
      ),
    ).toBeNull();
  });
});
