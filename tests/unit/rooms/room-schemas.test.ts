import { describe, expect, it } from "vitest";
import { createRoomActionSchema } from "@/features/rooms/schemas/room-schemas";
describe("room schemas", () => {
  it("requires a positive capacity", () => {
    expect(() =>
      createRoomActionSchema.parse({
        name: "Salle",
        type: "TREATMENT_ROOM",
        capacity: 0,
      }),
    ).toThrow();
  });
});
