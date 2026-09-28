import { expect, it } from "vitest";
import {
  auditDetails,
  auditTitle,
  revenueMonth,
  monthKey,
  dueState,
  todayDate,
} from "@/features/platform/lib/presentation";
it("translates new audit events without exposing technical keys", () => {
  expect(auditTitle("SESSIONS_REVOKED")).toBe("Sessions déconnectées");
  expect(auditTitle("UNKNOWN_INTERNAL")).not.toContain("UNKNOWN_INTERNAL");
  expect(
    auditDetails({
      reason: "sécurité",
      password: "secret",
      incidentId: "internal",
      nested: {},
    }),
  ).toEqual([{ label: "Motif", text: "sécurité" }]);
  expect(
    auditDetails({ timezone: "Africa/Casablanca", isActive: false }),
  ).toEqual([
    { label: "Fuseau horaire", text: "Casablanca" },
    { label: "Accès autorisé", text: "Non" },
  ]);
});
it("selects an exclusive month range including leap day and a six-month history", () => {
  const result = revenueMonth("2028-02");
  expect(result.start.toISOString()).toBe("2028-02-01T00:00:00.000Z");
  expect(result.end.toISOString()).toBe("2028-03-01T00:00:00.000Z");
  expect(result.months).toEqual([
    "2027-09",
    "2027-10",
    "2027-11",
    "2027-12",
    "2028-01",
    "2028-02",
  ]);
});
it("rejects malformed months and resolves the current date in Casablanca", () => {
  const now = new Date("2026-09-28T12:30:00Z");
  expect(monthKey(now)).toBe("2026-09");
  expect(revenueMonth("2026-99", now).key).toBe("2026-09");
  expect(todayDate(now).toISOString()).toBe("2026-09-28T00:00:00.000Z");
});
it("keeps due today separate from overdue and prioritizes settled or cancelled", () => {
  const today = new Date("2026-09-28T00:00:00Z");
  const due = { dueAt: today, paymentId: null, cancelledAt: null };
  expect(dueState(due, today)).toBe("À régler aujourd’hui");
  expect(dueState({ ...due, dueAt: new Date("2026-09-27Z") }, today)).toBe(
    "En retard",
  );
  expect(dueState({ ...due, dueAt: new Date("2026-10-01Z") }, today)).toBe(
    "À venir",
  );
  expect(dueState({ ...due, paymentId: "paid" }, today)).toBe("Réglée");
  expect(dueState({ ...due, cancelledAt: today }, today)).toBe("Annulée");
});
