import { todayDate } from "@/features/platform/lib/presentation";
import { prisma } from "@/server/db/prisma";
import { requirePlatformAdmin } from "./auth";
import { notFound } from "next/navigation";
import { z } from "zod";

export async function getPlatformDashboard(search = "", page = 1, state = "") {
  await requirePlatformAdmin();
  const today = todayDate();
  const q = search.trim().slice(0, 150);
  const safePage = Math.max(1, Math.min(100000, Math.floor(page) || 1));
  const where = {
    ...(q ? { name: { contains: q, mode: "insensitive" as const } } : {}),
    ...(["PREPARING", "ACTIVE", "SUSPENDED", "ARCHIVED"].includes(state)
      ? {
          lifecycle: state as "PREPARING" | "ACTIVE" | "SUSPENDED" | "ARCHIVED",
        }
      : {}),
  };
  const [
    total,
    active,
    openIncidents,
    overdue,
    salons,
    filteredCount,
    upcoming,
    recent,
    lateDues,
  ] = await Promise.all([
    prisma.salon.count(),
    prisma.salon.count({ where: { isActive: true } }),
    prisma.platformIncident.count({ where: { status: { not: "RESOLVED" } } }),
    prisma.salonSubscription.count({ where: { status: "PAST_DUE" } }),
    prisma.salon.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (safePage - 1) * 20,
      take: 20,
      include: {
        subscription: true,
        _count: { select: { employees: true, users: true } },
      },
    }),
    prisma.salon.count({ where }),
    prisma.subscriptionDue.count({
      where: {
        paymentId: null,
        cancelledAt: null,
        dueAt: { gte: today, lte: new Date(today.getTime() + 7 * 86400000) },
      },
    }),
    prisma.platformAuditLog.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: { salon: { select: { name: true } } },
    }),
    prisma.subscriptionDue.count({
      where: { paymentId: null, cancelledAt: null, dueAt: { lt: today } },
    }),
  ]);
  return {
    total,
    active,
    openIncidents,
    overdue,
    salons,
    filteredCount,
    upcoming,
    recent,
    lateDues,
    state,
    page: safePage,
    q,
  };
}
export async function getPlatformSalon(id: string) {
  await requirePlatformAdmin();
  if (!z.uuid().safeParse(id).success) notFound();
  const salon = await prisma.salon.findUnique({
    where: { id },
    include: {
      subscriptionPayments: { orderBy: { paidAt: "desc" }, take: 100 },
      subscription: true,
      users: {
        where: { role: "ADMIN" },
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          isActive: true,
        },
        orderBy: { firstName: "asc" },
      },
      _count: {
        select: {
          employees: true,
          clients: true,
          appointments: true,
          rooms: true,
          services: true,
        },
      },
    },
  });
  if (!salon) notFound();
  return salon;
}
export async function getPlatformIncidents(page = 1, resolvedPage = 1) {
  await requirePlatformAdmin();
  const safePage = Math.max(1, Math.min(100000, Math.floor(page) || 1));
  const safeResolvedPage = Math.max(
    1,
    Math.min(100000, Math.floor(resolvedPage) || 1),
  );
  const include = {
    salon: { select: { name: true } },
    messages: { orderBy: { createdAt: "asc" as const }, take: 100 },
  };
  const [incidents, total, resolved, resolvedTotal, salons] = await Promise.all(
    [
      prisma.platformIncident.findMany({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
        orderBy: [{ priority: "desc" }, { createdAt: "asc" }, { id: "asc" }],
        skip: (safePage - 1) * 20,
        take: 20,
        include,
      }),
      prisma.platformIncident.count({
        where: { status: { in: ["OPEN", "IN_PROGRESS"] } },
      }),
      prisma.platformIncident.findMany({
        where: { status: "RESOLVED" },
        orderBy: [{ resolvedAt: "desc" }, { id: "asc" }],
        skip: (safeResolvedPage - 1) * 20,
        take: 20,
        include,
      }),
      prisma.platformIncident.count({ where: { status: "RESOLVED" } }),
      prisma.salon.findMany({
        orderBy: { name: "asc" },
        select: { id: true, name: true },
        take: 500,
      }),
    ],
  );
  return {
    incidents,
    total,
    resolved,
    resolvedTotal,
    salons,
    page: safePage,
    resolvedPage: safeResolvedPage,
  };
}
export async function getPlatformAudit(page = 1) {
  await requirePlatformAdmin();
  const safePage = Math.max(1, Math.min(100000, Math.floor(page) || 1));
  const [entries, total] = await Promise.all([
    prisma.platformAuditLog.findMany({
      orderBy: [{ createdAt: "desc" }, { id: "asc" }],
      skip: (safePage - 1) * 30,
      take: 30,
      include: {
        actor: { select: { firstName: true, email: true } },
        salon: { select: { name: true } },
      },
    }),
    prisma.platformAuditLog.count(),
  ]);
  return { entries, total, page: safePage };
}

export async function getPlatformSubscriptions(page = 1) {
  await requirePlatformAdmin();
  const safePage = Math.max(1, Math.min(100000, Math.floor(page) || 1));
  const [salons, total] = await Promise.all([
    prisma.salon.findMany({
      include: { subscription: true },
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (safePage - 1) * 30,
      take: 30,
    }),
    prisma.salon.count(),
  ]);
  return { salons, total, page: safePage };
}
