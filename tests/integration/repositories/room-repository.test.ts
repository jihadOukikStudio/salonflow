import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { roomRepository } from "@/server/repositories/room-repository";
import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

describe("roomRepository salon isolation", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("returns a room from the requested salon", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const room = await testPrisma.room.create({
      data: {
        salonId: salon.id,
        name: "Hamam individuel",
        type: "HAMAM",
      },
    });

    const result = await roomRepository.findById({
      salonId: salon.id,
      roomId: room.id,
    });

    expect(result?.id).toBe(room.id);
    expect(result?.salonId).toBe(salon.id);
  });

  it("does not return a room from another salon", async () => {
    const salonA = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const salonB = await testPrisma.salon.create({
      data: { name: "Salon B" },
    });

    const roomB = await testPrisma.room.create({
      data: {
        salonId: salonB.id,
        name: "Hamam B",
        type: "HAMAM",
      },
    });

    const result = await roomRepository.findById({
      salonId: salonA.id,
      roomId: roomB.id,
    });

    expect(result).toBeNull();
  });

  it("only lists rooms from the requested salon", async () => {
    const salonA = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const salonB = await testPrisma.salon.create({
      data: { name: "Salon B" },
    });

    await testPrisma.room.create({
      data: {
        salonId: salonA.id,
        name: "Salle A",
        type: "TREATMENT_ROOM",
      },
    });

    await testPrisma.room.create({
      data: {
        salonId: salonB.id,
        name: "Salle B",
        type: "TREATMENT_ROOM",
      },
    });

    const rooms = await roomRepository.list({
      salonId: salonA.id,
    });

    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.salonId).toBe(salonA.id);
  });

  it("filters rooms by type", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    await testPrisma.room.create({
      data: {
        salonId: salon.id,
        name: "Hamam",
        type: "HAMAM",
      },
    });

    await testPrisma.room.create({
      data: {
        salonId: salon.id,
        name: "Salle de soins",
        type: "TREATMENT_ROOM",
      },
    });

    const rooms = await roomRepository.list({
      salonId: salon.id,
      type: "HAMAM",
    });

    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.type).toBe("HAMAM");
  });

  it("does not modify a room from another salon", async () => {
    const salonA = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const salonB = await testPrisma.salon.create({
      data: { name: "Salon B" },
    });

    const roomB = await testPrisma.room.create({
      data: {
        salonId: salonB.id,
        name: "Original",
        type: "HAMAM",
      },
    });

    const result = await roomRepository.update({
      salonId: salonA.id,
      roomId: roomB.id,
      name: "HACKED",
    });

    expect(result.count).toBe(0);

    const unchanged = await testPrisma.room.findUnique({
      where: {
        id: roomB.id,
      },
    });

    expect(unchanged?.name).toBe("Original");
  });

  it("does not deactivate a room from another salon", async () => {
    const salonA = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const salonB = await testPrisma.salon.create({
      data: { name: "Salon B" },
    });

    const roomB = await testPrisma.room.create({
      data: {
        salonId: salonB.id,
        name: "Room B",
        type: "HAMAM",
      },
    });

    const result = await roomRepository.deactivate({
      salonId: salonA.id,
      roomId: roomB.id,
    });

    expect(result.count).toBe(0);

    const unchanged = await testPrisma.room.findUnique({
      where: {
        id: roomB.id,
      },
    });

    expect(unchanged?.isActive).toBe(true);
  });

  it("creates a room", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const room = await roomRepository.create({
      salonId: salon.id,
      name: "Salle de soins 3",
      type: "TREATMENT_ROOM",
      capacity: 1,
    });

    expect(room.salonId).toBe(salon.id);
    expect(room.type).toBe("TREATMENT_ROOM");
    expect(room.capacity).toBe(1);
  });

  it("can deactivate and reactivate its own room", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const room = await testPrisma.room.create({
      data: {
        salonId: salon.id,
        name: "Hamam",
        type: "HAMAM",
      },
    });

    const deactivated = await roomRepository.deactivate({
      salonId: salon.id,
      roomId: room.id,
    });

    expect(deactivated.count).toBe(1);

    const reactivated = await roomRepository.reactivate({
      salonId: salon.id,
      roomId: room.id,
    });

    expect(reactivated.count).toBe(1);
  });

  it("uses capacity 1 by default when creating a room", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const room = await roomRepository.create({
      salonId: salon.id,
      name: "Salle test",
      type: "TREATMENT_ROOM",
    });

    expect(room.capacity).toBe(1);
  });

  it("can explicitly list inactive rooms", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    await testPrisma.room.create({
      data: {
        salonId: salon.id,
        name: "Inactive",
        type: "HAMAM",
        isActive: false,
      },
    });

    const rooms = await roomRepository.list({
      salonId: salon.id,
      includeInactive: true,
    });

    expect(rooms).toHaveLength(1);
    expect(rooms[0]?.isActive).toBe(false);
  });

  it("updates only the provided room fields", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const room = await testPrisma.room.create({
      data: {
        salonId: salon.id,
        name: "Ancien nom",
        type: "HAMAM",
        capacity: 2,
      },
    });

    const result = await roomRepository.update({
      salonId: salon.id,
      roomId: room.id,
      name: "Nouveau nom",
    });

    expect(result.count).toBe(1);

    const updated = await testPrisma.room.findUnique({
      where: { id: room.id },
    });

    expect(updated?.name).toBe("Nouveau nom");
    expect(updated?.type).toBe("HAMAM");
    expect(updated?.capacity).toBe(2);
  });
});
