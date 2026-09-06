import { afterAll, beforeEach, describe, expect, it } from "vitest";

import { serviceRepository } from "@/server/repositories/service-repository";
import { cleanDatabase } from "../helpers/database";
import { testPrisma } from "../helpers/prisma";

async function createSalonWithCategory(name: string) {
  const salon = await testPrisma.salon.create({
    data: {
      name,
    },
  });

  const category = await testPrisma.serviceCategory.create({
    data: {
      salonId: salon.id,
      name: "Coiffure",
    },
  });

  return {
    salon,
    category,
  };
}

describe("serviceRepository salon isolation", () => {
  beforeEach(async () => {
    await cleanDatabase();
  });

  afterAll(async () => {
    await cleanDatabase();
    await testPrisma.$disconnect();
  });

  it("returns a service belonging to the requested salon", async () => {
    const { salon, category } = await createSalonWithCategory("Salon A");

    const service = await testPrisma.service.create({
      data: {
        salonId: salon.id,
        categoryId: category.id,
        name: "Brushing",
        defaultPrice: 100,
      },
    });

    const result = await serviceRepository.findById({
      salonId: salon.id,
      serviceId: service.id,
    });

    expect(result?.id).toBe(service.id);
    expect(result?.salonId).toBe(salon.id);
  });

  it("does not return a service from another salon", async () => {
    const salonA = await createSalonWithCategory("Salon A");
    const salonB = await createSalonWithCategory("Salon B");

    const serviceB = await testPrisma.service.create({
      data: {
        salonId: salonB.salon.id,
        categoryId: salonB.category.id,
        name: "Brushing",
        defaultPrice: 100,
      },
    });

    const result = await serviceRepository.findById({
      salonId: salonA.salon.id,
      serviceId: serviceB.id,
    });

    expect(result).toBeNull();
  });

  it("only lists services belonging to the requested salon", async () => {
    const salonA = await createSalonWithCategory("Salon A");
    const salonB = await createSalonWithCategory("Salon B");

    await testPrisma.service.create({
      data: {
        salonId: salonA.salon.id,
        categoryId: salonA.category.id,
        name: "Service A",
        defaultPrice: 100,
      },
    });

    await testPrisma.service.create({
      data: {
        salonId: salonB.salon.id,
        categoryId: salonB.category.id,
        name: "Service B",
        defaultPrice: 200,
      },
    });

    const services = await serviceRepository.list({
      salonId: salonA.salon.id,
    });

    expect(services).toHaveLength(1);
    expect(services[0]?.name).toBe("Service A");
    expect(services[0]?.salonId).toBe(salonA.salon.id);
  });

  it("does not list inactive services by default", async () => {
    const { salon, category } = await createSalonWithCategory("Salon A");

    await testPrisma.service.create({
      data: {
        salonId: salon.id,
        categoryId: category.id,
        name: "Inactive service",
        defaultPrice: 100,
        isActive: false,
      },
    });

    const services = await serviceRepository.list({
      salonId: salon.id,
    });

    expect(services).toHaveLength(0);
  });

  it("can explicitly list inactive services", async () => {
    const { salon, category } = await createSalonWithCategory("Salon A");

    await testPrisma.service.create({
      data: {
        salonId: salon.id,
        categoryId: category.id,
        name: "Inactive service",
        defaultPrice: 100,
        isActive: false,
      },
    });

    const services = await serviceRepository.list({
      salonId: salon.id,
      includeInactive: true,
    });

    expect(services).toHaveLength(1);
    expect(services[0]?.isActive).toBe(false);
  });

  it("does not modify a service belonging to another salon", async () => {
    const salonA = await createSalonWithCategory("Salon A");
    const salonB = await createSalonWithCategory("Salon B");

    const serviceB = await testPrisma.service.create({
      data: {
        salonId: salonB.salon.id,
        categoryId: salonB.category.id,
        name: "Original",
        defaultPrice: 100,
      },
    });

    const result = await serviceRepository.update({
      salonId: salonA.salon.id,
      serviceId: serviceB.id,
      name: "HACKED",
      defaultPrice: 1,
    });

    expect(result.count).toBe(0);

    const unchanged = await testPrisma.service.findUnique({
      where: {
        id: serviceB.id,
      },
    });

    expect(unchanged?.name).toBe("Original");
    expect(unchanged?.defaultPrice.toNumber()).toBe(100);
  });

  it("does not deactivate a service belonging to another salon", async () => {
    const salonA = await createSalonWithCategory("Salon A");
    const salonB = await createSalonWithCategory("Salon B");

    const serviceB = await testPrisma.service.create({
      data: {
        salonId: salonB.salon.id,
        categoryId: salonB.category.id,
        name: "Service B",
        defaultPrice: 100,
      },
    });

    const result = await serviceRepository.deactivate({
      salonId: salonA.salon.id,
      serviceId: serviceB.id,
    });

    expect(result.count).toBe(0);

    const service = await testPrisma.service.findUnique({
      where: {
        id: serviceB.id,
      },
    });

    expect(service?.isActive).toBe(true);
  });

  it("can deactivate and reactivate its own service", async () => {
    const { salon, category } = await createSalonWithCategory("Salon A");

    const service = await testPrisma.service.create({
      data: {
        salonId: salon.id,
        categoryId: category.id,
        name: "Service A",
        defaultPrice: 100,
      },
    });

    const deactivated = await serviceRepository.deactivate({
      salonId: salon.id,
      serviceId: service.id,
    });

    expect(deactivated.count).toBe(1);

    const reactivated = await serviceRepository.reactivate({
      salonId: salon.id,
      serviceId: service.id,
    });

    expect(reactivated.count).toBe(1);

    const finalService = await testPrisma.service.findUnique({
      where: {
        id: service.id,
      },
    });

    expect(finalService?.isActive).toBe(true);
  });
  it("finds a service by name inside its category and salon", async () => {
    const { salon, category } = await createSalonWithCategory("Salon A");

    const service = await testPrisma.service.create({
      data: {
        salonId: salon.id,
        categoryId: category.id,
        name: "Brushing",
        defaultPrice: 100,
      },
    });

    const result = await serviceRepository.findByName({
      salonId: salon.id,
      categoryId: category.id,
      name: "Brushing",
    });

    expect(result?.id).toBe(service.id);
  });

  it("creates a service with optional values", async () => {
    const { salon, category } = await createSalonWithCategory("Salon A");

    const service = await serviceRepository.create({
      salonId: salon.id,
      categoryId: category.id,
      name: "Massage",
      defaultPrice: 350,
      defaultDurationMinutes: 60,
      isStartingPrice: true,
      requiredRoomType: "TREATMENT_ROOM",
    });

    expect(service.salonId).toBe(salon.id);
    expect(service.defaultDurationMinutes).toBe(60);
    expect(service.isStartingPrice).toBe(true);
    expect(service.requiredRoomType).toBe("TREATMENT_ROOM");
  });
  it("creates a service with default optional values", async () => {
    const { salon, category } = await createSalonWithCategory("Salon A");

    const service = await serviceRepository.create({
      salonId: salon.id,
      categoryId: category.id,
      name: "Service minimal",
      defaultPrice: 100,
    });

    expect(service.defaultDurationMinutes).toBeNull();
    expect(service.isStartingPrice).toBe(false);
    expect(service.requiredRoomType).toBeNull();
  });

  it("updates only the provided service fields", async () => {
    const { salon, category } = await createSalonWithCategory("Salon A");

    const service = await testPrisma.service.create({
      data: {
        salonId: salon.id,
        categoryId: category.id,
        name: "Original",
        defaultDurationMinutes: 60,
        defaultPrice: 100,
        isStartingPrice: false,
        requiredRoomType: "TREATMENT_ROOM",
      },
    });

    const result = await serviceRepository.update({
      salonId: salon.id,
      serviceId: service.id,
      name: "Modifié",
    });

    expect(result.count).toBe(1);

    const updated = await testPrisma.service.findUnique({
      where: { id: service.id },
    });

    expect(updated?.name).toBe("Modifié");
    expect(updated?.defaultDurationMinutes).toBe(60);
    expect(updated?.defaultPrice.toNumber()).toBe(100);
    expect(updated?.requiredRoomType).toBe("TREATMENT_ROOM");
  });
});
