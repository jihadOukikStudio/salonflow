import { Prisma } from "@/app/generated/prisma/client";
import { z } from "zod";
import { notFound } from "next/navigation";
import { prisma } from "@/server/db/prisma";
import { requirePlatformAdmin } from "./auth";
import { revenueMonth } from "@/features/platform/lib/presentation";

export async function getPlatformRevenue(month?: string, salonId = "") {
  await requirePlatformAdmin();
  if (salonId && !z.uuid().safeParse(salonId).success) notFound();
  const scope = salonId ? { salonId } : {};
  const period = revenueMonth(month);
  const [received, recurring, bySalon, history] = await Promise.all([
    prisma.subscriptionPayment.groupBy({
      by: ["currency"],
      where: {
        ...scope,
        voidedAt: null,
        paidAt: { gte: period.start, lt: period.end },
      },
      _sum: { amount: true },
    }),
    prisma.salonSubscription.groupBy({
      by: ["currency"],
      where: {
        ...scope,
        status: { in: ["ACTIVE", "PAST_DUE"] },
        salon: { isActive: true },
      },
      _sum: { monthlyPrice: true },
    }),
    prisma.subscriptionPayment.groupBy({
      by: ["salonId", "currency"],
      where: {
        ...scope,
        voidedAt: null,
        paidAt: { gte: period.start, lt: period.end },
      },
      _sum: { amount: true },
    }),
    prisma.$queryRaw<
      Array<{ month: string; currency: string; amount: string }>
    >`
      SELECT to_char("paidAt", 'YYYY-MM') AS month, currency, SUM(amount)::text AS amount
      FROM "subscription_payments"
      WHERE "voidedAt" IS NULL AND "paidAt" >= ${period.historyStart} AND "paidAt" < ${period.end}
      ${salonId ? Prisma.sql`AND "salonId" = ${salonId}::uuid` : Prisma.empty}
      GROUP BY 1, 2 ORDER BY 1, 2
    `,
  ]);
  return { period, received, recurring, bySalon, history };
}

export async function getPlatformRevenueSummary() {
  await requirePlatformAdmin();
  const period = revenueMonth();
  return prisma.subscriptionPayment.groupBy({
    by: ["currency"],
    where: { voidedAt: null, paidAt: { gte: period.start, lt: period.end } },
    _sum: { amount: true },
  });
}

export async function getRevenueDetails(
  month?: string,
  salonId = "",
  page = 1,
  paymentPage = 1,
) {
  await requirePlatformAdmin();
  if (salonId && !z.uuid().safeParse(salonId).success) notFound();
  const period = revenueMonth(month);
  const safePage = Math.max(1, Math.min(100000, Math.floor(page) || 1));
  const safePaymentPage = Math.max(
    1,
    Math.min(100000, Math.floor(paymentPage) || 1),
  );
  const where = salonId ? { id: salonId } : {};
  const paymentWhere = {
    ...(salonId ? { salonId } : {}),
    paidAt: { gte: period.start, lt: period.end },
  };
  const [salons, total, options, payments, paymentTotal] = await Promise.all([
    prisma.salon.findMany({
      where,
      orderBy: [{ name: "asc" }, { id: "asc" }],
      skip: (safePage - 1) * 20,
      take: 20,
      include: {
        subscription: true,
        subscriptionDues: {
          where: { paymentId: null, cancelledAt: null },
          orderBy: [{ dueAt: "asc" }, { id: "asc" }],
          take: 1,
        },
      },
    }),
    prisma.salon.count({ where }),
    prisma.salon.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
      take: 500,
    }),
    prisma.subscriptionPayment.findMany({
      where: paymentWhere,
      orderBy: [{ paidAt: "desc" }, { id: "asc" }],
      skip: (safePaymentPage - 1) * 30,
      take: 30,
      include: { salon: { select: { name: true } } },
    }),
    prisma.subscriptionPayment.count({ where: paymentWhere }),
  ]);
  if (salonId && total === 0) notFound();
  return {
    salons,
    total,
    options,
    payments,
    paymentTotal,
    page: safePage,
    paymentPage: safePaymentPage,
  };
}
