export const auditLabels: Record<string, string> = {
  DUE_CREATED: "Échéance planifiée",
  DUE_SETTLED: "Échéance réglée",
  DUE_CANCELLED: "Échéance annulée",
  DUE_REOPENED: "Échéance à nouveau ouverte",
  SUPER_ADMIN_CREATED: "Compte superadmin créé",
  SALON_CREATED: "Salon créé",
  SALON_ACTIVATED: "Salon réactivé",
  SALON_SUSPENDED: "Salon suspendu",
  SALON_STATUS_UPDATED: "État du salon modifié",
  SALON_DETAILS_UPDATED: "Informations du salon modifiées",
  SUBSCRIPTION_UPDATED: "Abonnement mis à jour",
  SUBSCRIPTION_PAYMENT_RECORDED: "Paiement d’abonnement enregistré",
  SUBSCRIPTION_PAYMENT_VOIDED: "Paiement d’abonnement annulé",
  SESSIONS_REVOKED: "Sessions déconnectées",
  INCIDENT_CREATED: "Incident enregistré",
  INCIDENT_UPDATED: "Incident mis à jour",
  INCIDENT_MESSAGE_ADDED: "Message ajouté à un incident",
  SALON_ADMIN_CREATED: "Compte gérante créé",
  SALON_ADMIN_ACCESS_UPDATED: "Accès gérante modifié",
  SUPPORT_REQUEST_CREATED: "Demande d’assistance reçue",
  SUPPORT_REPLY_CREATED: "Réponse de la gérante reçue",
};
const fields: Record<string, string> = {
  dueAt: "Date limite",
  paidAt: "Paiement reçu le",
  reason: "Motif",
  name: "Nom du salon",
  currency: "Devise",
  timezone: "Fuseau horaire",
  email: "Email",
  lifecycle: "Nouvel état",
  previous: "État précédent",
  status: "Statut",
  previousStatus: "Statut précédent",
  planName: "Offre",
  monthlyPrice: "Tarif mensuel",
  periodEnd: "Fin de période",
  periodStart: "Début de période",
  note: "Note",
  amount: "Montant reçu",
  title: "Sujet",
  priority: "Priorité",
  resolution: "Résolution",
  isActive: "Accès autorisé",
  internal: "Note interne",
  source: "Origine",
};
const values: Record<string, string> = {
  ACTIVE: "Actif",
  PREPARING: "En préparation",
  SUSPENDED: "Suspendu",
  ARCHIVED: "Archivé",
  TRIAL: "Essai / pilote",
  PAST_DUE: "En retard",
  CANCELLED: "Résilié",
  OPEN: "Ouvert",
  IN_PROGRESS: "En cours",
  RESOLVED: "Résolu",
  LOW: "Faible",
  NORMAL: "Normale",
  HIGH: "Haute",
  CRITICAL: "Critique",
  "Africa/Casablanca": "Casablanca",
  "Europe/Paris": "Paris",
  UTC: "UTC",
  CLI: "Commande sécurisée",
};
export function auditTitle(action: string) {
  return auditLabels[action] ?? "Action d’administration enregistrée";
}
export function auditDetails(details: unknown) {
  if (!details || typeof details !== "object" || Array.isArray(details))
    return [];
  return Object.entries(details).flatMap(([key, value]) => {
    if (
      !fields[key] ||
      (value !== null &&
        !["string", "number", "boolean"].includes(typeof value))
    )
      return [];
    let text =
      value == null
        ? "Non renseigné"
        : typeof value === "boolean"
          ? value
            ? "Oui"
            : "Non"
          : (values[String(value)] ?? String(value));
    if (
      ["periodStart", "periodEnd", "dueAt", "paidAt"].includes(key) &&
      typeof value === "string" &&
      !Number.isNaN(Date.parse(value))
    )
      text = new Intl.DateTimeFormat("fr-FR", {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(value));
    return [{ label: fields[key], text }];
  });
}
export function money(value: string | number, currency: string) {
  return new Intl.NumberFormat("fr-FR", { style: "currency", currency }).format(
    Number(value),
  );
}
export function monthKey(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  return `${parts.find((p) => p.type === "year")!.value}-${parts.find((p) => p.type === "month")!.value}`;
}
export function revenueMonth(input?: string, now = new Date()) {
  const key =
    input && /^(20\d{2})-(0[1-9]|1[0-2])$/.test(input) ? input : monthKey(now);
  // Payment dates are date-only values stored at midnight UTC by the existing command schema.
  const start = new Date(`${key}-01T00:00:00Z`);
  const end = new Date(
    Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1),
  );
  const months = Array.from({ length: 6 }, (_, i) =>
    new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() - 5 + i, 1))
      .toISOString()
      .slice(0, 7),
  );
  return {
    key,
    start,
    end,
    months,
    historyStart: new Date(`${months[0]}-01T00:00:00Z`),
  };
}
export function monthLabel(key: string) {
  return new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${key}-01T00:00:00Z`));
}

export function dueState(
  due: { cancelledAt: Date | null; paymentId: string | null; dueAt: Date },
  today: Date,
) {
  if (due.cancelledAt) return "Annulée";
  if (due.paymentId) return "Réglée";
  if (due.dueAt < today) return "En retard";
  return due.dueAt.getTime() === today.getTime()
    ? "À régler aujourd’hui"
    : "À venir";
}
export function todayDate(now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Casablanca",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return new Date(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`);
}
