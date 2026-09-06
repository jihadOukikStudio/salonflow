import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { clientRepository } from "@/server/repositories/client-repository";
import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

describe("clientRepository salon isolation", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("does not return a client from another salon", async () => {
    const salonA = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const salonB = await testPrisma.salon.create({
      data: { name: "Salon B" },
    });

    const clientB = await testPrisma.client.create({
      data: {
        salonId: salonB.id,
        phone: "+212600000010",
      },
    });

    const result = await clientRepository.findById({
      salonId: salonA.id,
      clientId: clientB.id,
    });

    expect(result).toBeNull();
  });

  it("does not update a client from another salon", async () => {
    const salonA = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const salonB = await testPrisma.salon.create({
      data: { name: "Salon B" },
    });

    const clientB = await testPrisma.client.create({
      data: {
        salonId: salonB.id,
        phone: "+212600000011",
        name: "Client B",
      },
    });

    const result = await clientRepository.update({
      salonId: salonA.id,
      clientId: clientB.id,
      name: "HACKED",
    });

    expect(result.count).toBe(0);

    const unchangedClient = await testPrisma.client.findUnique({
      where: {
        id: clientB.id,
      },
    });

    expect(unchangedClient?.name).toBe("Client B");
  });

  it("does not deactivate a client from another salon", async () => {
    const salonA = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const salonB = await testPrisma.salon.create({
      data: { name: "Salon B" },
    });

    const clientB = await testPrisma.client.create({
      data: {
        salonId: salonB.id,
        phone: "+212600000012",
      },
    });

    const result = await clientRepository.deactivate({
      salonId: salonA.id,
      clientId: clientB.id,
    });

    expect(result.count).toBe(0);

    const unchangedClient = await testPrisma.client.findUnique({
      where: {
        id: clientB.id,
      },
    });

    expect(unchangedClient?.isActive).toBe(true);
  });

  it("only lists clients belonging to the requested salon", async () => {
    const salonA = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const salonB = await testPrisma.salon.create({
      data: { name: "Salon B" },
    });

    await testPrisma.client.create({
      data: {
        salonId: salonA.id,
        phone: "+212600000013",
      },
    });

    await testPrisma.client.create({
      data: {
        salonId: salonB.id,
        phone: "+212600000014",
      },
    });

    const clients = await clientRepository.list({
      salonId: salonA.id,
    });

    expect(clients).toHaveLength(1);
    expect(clients[0]?.salonId).toBe(salonA.id);
  });

  it("finds a client by phone inside the requested salon only", async () => {
    const salonA = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const salonB = await testPrisma.salon.create({
      data: { name: "Salon B" },
    });

    await testPrisma.client.create({
      data: {
        salonId: salonB.id,
        phone: "+212600000020",
        name: "Client B",
      },
    });

    const clientA = await testPrisma.client.create({
      data: {
        salonId: salonA.id,
        phone: "+212600000020",
        name: "Client A",
      },
    });

    const result = await clientRepository.findByPhone({
      salonId: salonA.id,
      phone: "+212600000020",
    });

    expect(result?.id).toBe(clientA.id);
    expect(result?.salonId).toBe(salonA.id);
  });

  it("creates a client inside the requested salon", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const client = await clientRepository.create({
      salonId: salon.id,
      name: "Nadia",
      phone: "+212600000021",
      internalNote: "Cliente fidèle",
    });

    expect(client.salonId).toBe(salon.id);
    expect(client.name).toBe("Nadia");
    expect(client.phone).toBe("+212600000021");
  });
  it("creates a client with optional fields omitted", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const client = await clientRepository.create({
      salonId: salon.id,
      phone: "+212600000022",
    });

    expect(client.name).toBeNull();
    expect(client.internalNote).toBeNull();
  });

  it("updates only the provided client fields", async () => {
    const salon = await testPrisma.salon.create({
      data: { name: "Salon A" },
    });

    const client = await testPrisma.client.create({
      data: {
        salonId: salon.id,
        phone: "+212600000023",
        name: "Original",
        internalNote: "Note originale",
      },
    });

    const result = await clientRepository.update({
      salonId: salon.id,
      clientId: client.id,
      name: "Modifié",
    });

    expect(result.count).toBe(1);

    const updated = await testPrisma.client.findUnique({
      where: { id: client.id },
    });

    expect(updated?.name).toBe("Modifié");
    expect(updated?.phone).toBe("+212600000023");
    expect(updated?.internalNote).toBe("Note originale");
  });
});
