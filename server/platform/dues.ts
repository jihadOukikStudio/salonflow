import { prisma } from "@/server/db/prisma";
import { requirePlatformAdmin } from "./auth";
import { todayDate } from "@/features/platform/lib/presentation";
import { z } from "zod";
export async function getPlatformDues(input: {
  salonId?: string;
  state?: string;
  page?: number;
}) {
  await requirePlatformAdmin();
  const today = todayDate();
  const salonId = z.uuid().safeParse(input.salonId).success
    ? input.salonId!
    : "";
  const state = ["open", "late", "paid", "cancelled"].includes(
    input.state ?? "",
  )
    ? input.state!
    : "";
  const page = Math.max(1, Math.min(100000, Math.floor(input.page ?? 1) || 1));
  const where = {
    ...(salonId ? { salonId } : {}),
    ...(state === "paid"
      ? { paymentId: { not: null } }
      : state === "cancelled"
        ? { cancelledAt: { not: null } }
        : state === "open" || state === "late"
          ? {
              paymentId: null,
              cancelledAt: null,
              ...(state === "late" ? { dueAt: { lt: today } } : {}),
            }
          : {}),
  };
  const [dues, total, salons, payments, overdue, upcoming] = await Promise.all([
    prisma.subscriptionDue.findMany({
      where,
      include: {
        salon: { select: { name: true } },
        payment: { select: { paidAt: true, reference: true } },
      },
      orderBy: [{ dueAt: "desc" }, { id: "asc" }],
      skip: (page - 1) * 30,
      take: 30,
    }),
    prisma.subscriptionDue.count({ where }),
    prisma.salon.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 500,
    }),
    salonId
      ? prisma.subscriptionPayment.findMany({
          where: { salonId, voidedAt: null, due: null },
          orderBy: { paidAt: "desc" },
          take: 100,
        })
      : Promise.resolve([]),
    prisma.subscriptionDue.count({
      where: {
        ...(salonId ? { salonId } : {}),
        paymentId: null,
        cancelledAt: null,
        dueAt: { lt: today },
      },
    }),
    prisma.subscriptionDue.count({
      where: {
        ...(salonId ? { salonId } : {}),
        paymentId: null,
        cancelledAt: null,
        dueAt: { gte: today, lte: new Date(today.getTime() + 30 * 86400000) },
      },
    }),
  ]);
  return {
    dues,
    total,
    salons,
    payments,
    overdue,
    upcoming,
    today,
    salonId,
    state,
    page,
  };
}
