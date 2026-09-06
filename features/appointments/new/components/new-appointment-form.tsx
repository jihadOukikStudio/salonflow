"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition } from "react";

import {
  checkBookingFeasibilityAction,
  createAppointmentWithClientAction,
} from "@/features/appointments/server/actions/appointment-actions";
import { searchClientsAction } from "@/features/clients/server/actions";
import {
  casablancaLocalDateTimeToIso,
  getMinimumBookableCasablancaDateTime,
  isFutureCasablancaLocalDateTime,
  type CasablancaDateTimeFields,
} from "@/features/appointments/lib/casablanca-local-datetime";
import type {
  NewAppointmentClientOption,
  NewAppointmentServiceOption,
} from "@/features/appointments/new/types";

type NewAppointmentFormProps = {
  services: NewAppointmentServiceOption[];
  initialDate: string;
  initialMinimumBooking: CasablancaDateTimeFields;
  canConfigureServices: boolean;
};

const steps = [
  { id: 1, label: "Cliente" },
  { id: 2, label: "Prestations" },
  { id: 3, label: "Détails" },
  { id: 4, label: "Récapitulatif" },
] as const;

const inputClassName =
  "min-h-12 w-full rounded-2xl border border-slate-400 bg-white px-4 text-sm font-medium text-slate-950 placeholder:text-slate-500 shadow-sm outline-none transition [color-scheme:light] focus:border-violet-600 focus:ring-4 focus:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500";

function normalize(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidNewClientPhone(value: string): boolean {
  const compact = value.trim().replace(/[\s().-]/g, "");
  const normalized = compact.startsWith("00")
    ? `+${compact.slice(2)}`
    : compact;
  return /^\+?[0-9]{8,15}$/.test(normalized);
}

function formatMoney(value: number): string {
  return new Intl.NumberFormat("fr-MA", {
    style: "currency",
    currency: "MAD",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDuration(value: number): string {
  if (value < 60) {
    return `${value} min`;
  }

  const hours = Math.floor(value / 60);
  const minutes = value % 60;

  return minutes === 0 ? `${hours} h` : `${hours} h ${minutes} min`;
}

function roomLabel(
  roomType: NewAppointmentServiceOption["requiredRoomType"],
): string | null {
  if (roomType === "HAMAM") {
    return "Salle Hamam requise";
  }

  if (roomType === "TREATMENT_ROOM") {
    return "Salle de soins requise";
  }

  return null;
}

export function NewAppointmentForm({
  services,
  initialDate,
  initialMinimumBooking,
  canConfigureServices,
}: NewAppointmentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isCheckingCapacity, startCapacityTransition] = useTransition();
  const [isSearchingClients, startClientSearchTransition] = useTransition();
  const searchRequestId = useRef(0);

  const [step, setStep] = useState(1);
  const [clientPhoneSearch, setClientPhoneSearch] = useState("");
  const [clientNameSearch, setClientNameSearch] = useState("");
  const [clientResults, setClientResults] = useState<
    NewAppointmentClientOption[]
  >([]);
  const [selectedClient, setSelectedClient] =
    useState<NewAppointmentClientOption | null>(null);
  const [clientSearchError, setClientSearchError] = useState<string | null>(
    null,
  );

  const [serviceSearch, setServiceSearch] = useState("");
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  const [minimumBooking, setMinimumBooking] = useState(initialMinimumBooking);
  const [dateKey, setDateKey] = useState(initialDate);
  const [timeValue, setTimeValue] = useState(
    initialDate === initialMinimumBooking.dateKey
      ? initialMinimumBooking.timeValue
      : "09:00",
  );
  const [internalNote, setInternalNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [capacityMessage, setCapacityMessage] = useState<{
    level: "POSSIBLE" | "WARNING" | "BLOCKED";
    text: string;
  } | null>(null);

  const phoneSearchLength = phoneDigits(clientPhoneSearch).length;
  const canSearchClients = phoneSearchLength >= 4;

  useEffect(() => {
    const updateMinimum = () => {
      setMinimumBooking(getMinimumBookableCasablancaDateTime(new Date()));
    };

    updateMinimum();
    const interval = window.setInterval(updateMinimum, 60_000);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!canSearchClients) {
      return;
    }

    const requestId = searchRequestId.current + 1;
    searchRequestId.current = requestId;

    const timeout = window.setTimeout(() => {
      startClientSearchTransition(async () => {
        const result = await searchClientsAction({
          phone: clientPhoneSearch,
          name: clientNameSearch,
        });

        if (requestId !== searchRequestId.current) {
          return;
        }

        if (!result.ok) {
          setClientResults([]);
          setClientSearchError(result.message);
          return;
        }

        setClientResults(result.data.clients);
        setClientSearchError(null);
      });
    }, 250);

    return () => window.clearTimeout(timeout);
  }, [canSearchClients, clientNameSearch, clientPhoneSearch]);

  const selectedServices = selectedServiceIds
    .map((id) => services.find((service) => service.id === id))
    .filter((service): service is NewAppointmentServiceOption =>
      Boolean(service),
    );

  const filteredServices = useMemo(() => {
    const query = normalize(serviceSearch);

    if (!query) {
      return services;
    }

    return services.filter((service) =>
      normalize(`${service.categoryName} ${service.name}`).includes(query),
    );
  }, [serviceSearch, services]);

  const groupedServices = useMemo(() => {
    const groups = new Map<string, NewAppointmentServiceOption[]>();

    for (const service of filteredServices) {
      const current = groups.get(service.categoryName) ?? [];
      current.push(service);
      groups.set(service.categoryName, current);
    }

    return [...groups.entries()];
  }, [filteredServices]);

  const missingDurationCount = services.filter(
    (service) => service.defaultDurationMinutes === null,
  ).length;

  const totalPrice = selectedServices.reduce(
    (total, service) => total + service.defaultPrice,
    0,
  );

  const totalDuration = selectedServices.reduce(
    (total, service) => total + (service.defaultDurationMinutes ?? 0),
    0,
  );

  const newClientIsComplete =
    clientNameSearch.trim().length > 0 &&
    isValidNewClientPhone(clientPhoneSearch);

  function clearSelectedClient() {
    setSelectedClient(null);
    setError(null);
  }

  function changePhone(value: string) {
    setClientPhoneSearch(value);
    clearSelectedClient();

    if (phoneDigits(value).length < 4) {
      searchRequestId.current += 1;
      setClientResults([]);
      setClientSearchError(null);
    }
  }

  function changeName(value: string) {
    setClientNameSearch(value);
    clearSelectedClient();
  }

  function chooseClient(client: NewAppointmentClientOption) {
    setSelectedClient(client);
    setClientPhoneSearch(client.phone);
    setClientNameSearch(client.name);
    setClientResults([]);
    setClientSearchError(null);
    setError(null);
  }

  function toggleService(service: NewAppointmentServiceOption) {
    if (service.defaultDurationMinutes === null) {
      setError(
        `La durée de « ${service.name} » doit d'abord être configurée par la gérante dans Prestations.`,
      );
      return;
    }

    if (selectedServiceIds.includes(service.id)) {
      setSelectedServiceIds((current) =>
        current.filter((id) => id !== service.id),
      );
      setCapacityMessage(null);
      setError(null);
      return;
    }

    if (!dateKey || !timeValue) {
      setError(
        "Choisissez d'abord la date et l'heure pour vérifier la capacité réelle du salon.",
      );
      return;
    }

    let scheduledStart: string;
    try {
      scheduledStart = casablancaLocalDateTimeToIso(dateKey, timeValue);
    } catch (conversionError) {
      setError(
        conversionError instanceof Error
          ? conversionError.message
          : "La date et l'heure sont invalides.",
      );
      return;
    }

    setError(null);
    setCapacityMessage(null);

    startCapacityTransition(async () => {
      try {
        const result = await checkBookingFeasibilityAction({
          scheduledStart,
          serviceIds: [...selectedServiceIds, service.id],
        });

        if (!result.ok) {
          setError(result.message);
          return;
        }

        const feasibility = result.data;
        const end = new Intl.DateTimeFormat("fr-MA", {
          timeZone: "Africa/Casablanca",
          hour: "2-digit",
          minute: "2-digit",
        }).format(new Date(feasibility.scheduledEnd));

        if (!feasibility.canCreate) {
          setCapacityMessage({
            level: "BLOCKED",
            text: `« ${service.name} » impossible sur ce créneau : ${feasibility.blockers.join(" ")} Fin estimée si ajoutée : ${end}.`,
          });
          return;
        }

        setSelectedServiceIds((current) => [...current, service.id]);
        setCapacityMessage({
          level: feasibility.level,
          text:
            feasibility.level === "WARNING"
              ? `Ajout possible. Fin estimée : ${end}. ${feasibility.warnings.join(" ")}`
              : `Ajout possible. Capacité vérifiée jusqu'à ${end}.`,
        });
      } catch (capacityError) {
        console.error("Booking feasibility check failed", capacityError);
        setError(
          "Impossible de vérifier la capacité du salon. La prestation n'a pas été ajoutée.",
        );
      }
    });
  }

  function validateStep(currentStep: number): boolean {
    setError(null);

    if (currentStep === 1) {
      if (selectedClient) {
        return true;
      }

      if (!newClientIsComplete) {
        if (phoneSearchLength < 8) {
          setError(
            "Saisissez le numéro complet de la nouvelle cliente ou sélectionnez une cliente existante.",
          );
        } else {
          setError(
            "Renseignez le nom de la nouvelle cliente avant de continuer.",
          );
        }
        return false;
      }
    }

    if (currentStep === 2) {
      if (selectedServices.length === 0) {
        setError("Ajoutez au moins une prestation.");
        return false;
      }

      const serviceWithoutDuration = selectedServices.find(
        (service) => service.defaultDurationMinutes === null,
      );

      if (serviceWithoutDuration) {
        setError(
          `La durée de « ${serviceWithoutDuration.name} » doit être configurée dans Prestations.`,
        );
        return false;
      }
    }

    if (currentStep === 3) {
      if (!dateKey || !timeValue) {
        setError("Renseignez la date et l'heure du rendez-vous.");
        return false;
      }

      try {
        if (!isFutureCasablancaLocalDateTime(dateKey, timeValue, new Date())) {
          setError(
            "Ce créneau est déjà passé. Choisissez une date et une heure à venir.",
          );
          return false;
        }
      } catch (conversionError) {
        setError(
          conversionError instanceof Error
            ? conversionError.message
            : "La date et l'heure sont invalides.",
        );
        return false;
      }
    }

    return true;
  }

  function nextStep() {
    if (!validateStep(step)) {
      return;
    }

    setStep((current) => Math.min(4, current + 1));
  }

  function previousStep() {
    setError(null);
    setStep((current) => Math.max(1, current - 1));
  }

  function handleDateChange(value: string) {
    setDateKey(value);
    setError(null);

    if (
      value === minimumBooking.dateKey &&
      timeValue < minimumBooking.timeValue
    ) {
      setTimeValue(minimumBooking.timeValue);
    }
  }

  function submitAppointment() {
    if (!validateStep(1) || !validateStep(2) || !validateStep(3)) {
      return;
    }

    let scheduledStart: string;

    try {
      scheduledStart = casablancaLocalDateTimeToIso(dateKey, timeValue);
    } catch (conversionError) {
      setError(
        conversionError instanceof Error
          ? conversionError.message
          : "La date et l'heure sont invalides.",
      );
      return;
    }

    const client = selectedClient
      ? {
          type: "existing" as const,
          clientId: selectedClient.id,
        }
      : {
          type: "new" as const,
          name: clientNameSearch,
          phone: clientPhoneSearch,
        };

    startTransition(async () => {
      setError(null);

      const result = await createAppointmentWithClientAction({
        client,
        scheduledStart,
        internalNote: internalNote.trim() || null,
        services: selectedServices.map((service) => ({
          serviceId: service.id,
        })),
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      router.push(`/planning?date=${encodeURIComponent(dateKey)}`);
      router.refresh();
    });
  }

  const selectedClientLabel = selectedClient
    ? selectedClient.name
    : clientNameSearch.trim() || "Nouvelle cliente";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-5 py-5 sm:px-7">
          <div className="grid grid-cols-4 gap-2">
            {steps.map((item) => {
              const active = item.id === step;
              const completed = item.id < step;

              return (
                <div key={item.id} className="min-w-0">
                  <div
                    className={`h-1.5 rounded-full ${
                      active || completed ? "bg-violet-600" : "bg-slate-200"
                    }`}
                  />
                  <p
                    className={`mt-2 truncate text-xs font-semibold sm:text-sm ${
                      active ? "text-violet-700" : "text-slate-500"
                    }`}
                  >
                    {item.label}
                  </p>
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-5 sm:p-7">
          {step === 1 ? (
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Trouver la cliente
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Commencez par le téléphone. Les résultats apparaissent après 4
                chiffres. Le nom sert uniquement à affiner la recherche.
              </p>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label>
                  <span className="mb-2 block text-sm font-semibold text-slate-800">
                    Téléphone
                  </span>
                  <input
                    type="tel"
                    value={clientPhoneSearch}
                    onChange={(event) => changePhone(event.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                    placeholder="Ex. 0612…"
                    className={inputClassName}
                    autoFocus
                  />
                  <span className="mt-2 block text-xs font-medium text-slate-600">
                    {phoneSearchLength < 4
                      ? `${4 - phoneSearchLength} chiffre${4 - phoneSearchLength > 1 ? "s" : ""} avant la recherche`
                      : "Recherche automatique activée"}
                  </span>
                </label>

                <label>
                  <span className="mb-2 block text-sm font-semibold text-slate-800">
                    Nom{" "}
                    <span className="font-normal text-slate-500">
                      (pour affiner)
                    </span>
                  </span>
                  <input
                    type="text"
                    value={clientNameSearch}
                    onChange={(event) => changeName(event.target.value)}
                    maxLength={120}
                    autoComplete="name"
                    placeholder="Ex. Sara Amrani"
                    className={inputClassName}
                  />
                </label>
              </div>

              {selectedClient ? (
                <div className="mt-5 flex items-center justify-between gap-4 rounded-2xl border border-emerald-300 bg-emerald-50 p-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                      Cliente sélectionnée
                    </p>
                    <p className="mt-1 font-semibold text-slate-950">
                      {selectedClient.name}
                    </p>
                    <p className="text-sm font-medium text-slate-700">
                      {selectedClient.phone}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={clearSelectedClient}
                    className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                  >
                    Changer
                  </button>
                </div>
              ) : null}

              {canSearchClients && !selectedClient ? (
                <div className="mt-5">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-800">
                      Clientes trouvées
                    </p>
                    {isSearchingClients ? (
                      <span className="text-xs font-medium text-violet-700">
                        Recherche…
                      </span>
                    ) : null}
                  </div>

                  {clientSearchError ? (
                    <div className="mt-3 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-medium text-red-800">
                      {clientSearchError}
                    </div>
                  ) : clientResults.length > 0 ? (
                    <div className="mt-3 space-y-2">
                      {clientResults.map((client) => (
                        <button
                          key={client.id}
                          type="button"
                          onClick={() => chooseClient(client)}
                          className="flex w-full items-center justify-between rounded-2xl border border-slate-300 bg-white p-4 text-left transition hover:border-violet-400 hover:bg-violet-50"
                        >
                          <span>
                            <span className="block font-semibold text-slate-950">
                              {client.name}
                            </span>
                            <span className="mt-1 block text-sm font-medium text-slate-600">
                              {client.phone}
                            </span>
                          </span>
                          <span className="text-sm font-semibold text-violet-700">
                            Choisir
                          </span>
                        </button>
                      ))}
                    </div>
                  ) : !isSearchingClients ? (
                    <div className="mt-3 rounded-2xl border border-dashed border-violet-300 bg-violet-50/60 p-4">
                      <p className="font-semibold text-slate-950">
                        Aucune fiche sélectionnée ? Ce n’est pas bloquant.
                      </p>
                      <p className="mt-1 text-sm leading-6 text-slate-700">
                        Si le numéro n’existe pas, complétez le nom et le
                        numéro. La cliente sera créée automatiquement avec le
                        rendez-vous à la validation finale.
                      </p>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {!selectedClient && newClientIsComplete ? (
                <div className="mt-5 rounded-2xl border border-violet-300 bg-violet-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-violet-700">
                    Nouvelle cliente
                  </p>
                  <p className="mt-1 text-sm font-semibold text-slate-950">
                    {clientNameSearch.trim()} · {clientPhoneSearch.trim()}
                  </p>
                  <p className="mt-1 text-xs font-medium text-slate-600">
                    Sa fiche ne sera créée qu’au moment où le rendez-vous est
                    validé.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 2 ? (
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Choisir les prestations
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Les prix et durées viennent du catalogue configuré par la
                gérante. Ils ne sont pas ressaisis pendant la prise de
                rendez-vous.
              </p>

              <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/60 p-4">
                <p className="text-sm font-bold text-violet-950">
                  Créneau à vérifier
                </p>
                <p className="mt-1 text-xs font-medium leading-5 text-violet-800">
                  SalonFlow vérifie chaque prestation avec celles déjà
                  sélectionnées. Une prestation impossible est refusée sans
                  empêcher d’en essayer une autre plus courte ou utilisant une
                  autre ressource.
                </p>
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input
                    type="date"
                    value={dateKey}
                    min={minimumBooking.dateKey}
                    onChange={(event) => {
                      handleDateChange(event.target.value);
                      setCapacityMessage(null);
                    }}
                    className={inputClassName}
                  />
                  <input
                    type="time"
                    value={timeValue}
                    min={
                      dateKey === minimumBooking.dateKey
                        ? minimumBooking.timeValue
                        : undefined
                    }
                    onChange={(event) => {
                      setTimeValue(event.target.value);
                      setError(null);
                      setCapacityMessage(null);
                    }}
                    className={inputClassName}
                  />
                </div>
              </div>

              {capacityMessage ? (
                <div
                  className={`mt-4 rounded-2xl border p-4 text-sm font-semibold ${
                    capacityMessage.level === "BLOCKED"
                      ? "border-red-300 bg-red-50 text-red-900"
                      : capacityMessage.level === "WARNING"
                        ? "border-amber-300 bg-amber-50 text-amber-900"
                        : "border-emerald-300 bg-emerald-50 text-emerald-900"
                  }`}
                >
                  {capacityMessage.text}
                </div>
              ) : null}

              {missingDurationCount > 0 ? (
                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-amber-300 bg-amber-50 p-4">
                  <p className="text-sm font-semibold text-amber-900">
                    {missingDurationCount} prestation
                    {missingDurationCount > 1 ? "s ont" : " a"} encore une durée
                    à configurer.
                  </p>
                  {canConfigureServices ? (
                    <Link
                      href="/services"
                      className="rounded-xl border border-amber-300 bg-white px-3 py-2 text-sm font-semibold text-amber-900 hover:bg-amber-100"
                    >
                      Configurer les prestations
                    </Link>
                  ) : (
                    <span className="text-xs font-semibold text-amber-800">
                      À compléter par la gérante
                    </span>
                  )}
                </div>
              ) : null}

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  Rechercher une prestation
                </span>
                <input
                  type="search"
                  value={serviceSearch}
                  onChange={(event) => setServiceSearch(event.target.value)}
                  placeholder="Nom ou catégorie…"
                  className={inputClassName}
                />
              </label>

              {selectedServices.length > 0 ? (
                <div className="mt-5 rounded-2xl border border-violet-200 bg-violet-50/70 p-4">
                  <p className="text-sm font-semibold text-slate-950">
                    {selectedServices.length} prestation
                    {selectedServices.length > 1 ? "s" : ""} sélectionnée
                    {selectedServices.length > 1 ? "s" : ""}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {selectedServices.map((service) => (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => toggleService(service)}
                        className="rounded-full border border-violet-200 bg-white px-3 py-1.5 text-xs font-semibold text-violet-800 hover:bg-violet-100"
                      >
                        {service.name} ×
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 space-y-6">
                {groupedServices.map(([categoryName, categoryServices]) => (
                  <section key={categoryName}>
                    <h3 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">
                      {categoryName}
                    </h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {categoryServices.map((service) => {
                        const selected = selectedServiceIds.includes(
                          service.id,
                        );
                        const durationConfigured =
                          service.defaultDurationMinutes !== null;
                        const requiredRoom = roomLabel(
                          service.requiredRoomType,
                        );

                        return (
                          <button
                            key={service.id}
                            type="button"
                            disabled={!durationConfigured || isCheckingCapacity}
                            onClick={() => toggleService(service)}
                            className={`rounded-2xl border p-4 text-left transition ${
                              !durationConfigured
                                ? "cursor-not-allowed border-amber-200 bg-amber-50/70 opacity-80"
                                : selected
                                  ? "border-violet-500 bg-violet-50 ring-2 ring-violet-100"
                                  : "border-slate-300 bg-white hover:border-violet-300 hover:bg-slate-50"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <span className="block font-semibold text-slate-950">
                                  {service.name}
                                </span>
                                <span className="mt-2 block text-sm font-semibold text-slate-700">
                                  {service.isStartingPrice
                                    ? "À partir de "
                                    : ""}
                                  {formatMoney(service.defaultPrice)}
                                </span>
                              </div>
                              {selected ? (
                                <span className="rounded-full bg-violet-600 px-2.5 py-1 text-xs font-bold text-white">
                                  Ajoutée
                                </span>
                              ) : null}
                            </div>

                            <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                              {durationConfigured ? (
                                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-700">
                                  {formatDuration(
                                    service.defaultDurationMinutes!,
                                  )}
                                </span>
                              ) : (
                                <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">
                                  Durée à configurer par la gérante
                                </span>
                              )}
                              {requiredRoom ? (
                                <span className="rounded-full bg-pink-50 px-2.5 py-1 text-pink-800">
                                  {requiredRoom}
                                </span>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Note et détails
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Le créneau a déjà été choisi et contrôlé avec les prestations.
                Vous pouvez ajouter une note interne avant le récapitulatif.
              </p>

              <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm font-semibold text-slate-800">
                Créneau : {dateKey} à {timeValue} · heure de Marrakech
              </div>

              <label className="mt-5 block">
                <span className="mb-2 block text-sm font-semibold text-slate-800">
                  Note interne{" "}
                  <span className="font-normal text-slate-500">
                    (facultatif)
                  </span>
                </span>
                <textarea
                  value={internalNote}
                  onChange={(event) => setInternalNote(event.target.value)}
                  rows={5}
                  maxLength={2000}
                  placeholder="Informations utiles pour l'équipe…"
                  className="w-full rounded-2xl border border-slate-400 bg-white px-4 py-3 text-sm font-medium text-slate-950 placeholder:text-slate-500 shadow-sm outline-none transition focus:border-violet-600 focus:ring-4 focus:ring-violet-100"
                />
              </label>
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <h2 className="text-xl font-semibold text-slate-950">
                Vérifier le rendez-vous
              </h2>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                La validation crée le rendez-vous. Si la cliente est nouvelle,
                sa fiche est créée dans la même transaction.
              </p>

              <div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Cliente
                  </p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {selectedClientLabel}
                  </p>
                  <p className="text-sm font-medium text-slate-700">
                    {selectedClient?.phone ?? clientPhoneSearch}
                  </p>
                  {!selectedClient ? (
                    <p className="mt-2 text-xs font-semibold text-violet-700">
                      Nouvelle fiche créée automatiquement à la validation
                    </p>
                  ) : null}
                </div>

                <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Date et heure
                  </p>
                  <p className="mt-1 font-semibold text-slate-950">
                    {dateKey} à {timeValue} · heure de Marrakech
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                  <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                    Prestations
                  </p>
                  <div className="mt-3 space-y-3">
                    {selectedServices.map((service) => (
                      <div
                        key={service.id}
                        className="flex items-start justify-between gap-4 border-b border-slate-200 pb-3 last:border-0 last:pb-0"
                      >
                        <div>
                          <p className="font-semibold text-slate-950">
                            {service.name}
                          </p>
                          <p className="mt-1 text-xs font-medium text-slate-600">
                            {service.defaultDurationMinutes !== null
                              ? formatDuration(service.defaultDurationMinutes)
                              : "Durée non configurée"}
                          </p>
                        </div>
                        <p className="text-sm font-semibold text-slate-800">
                          {service.isStartingPrice ? "dès " : ""}
                          {formatMoney(service.defaultPrice)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {internalNote.trim() ? (
                  <div className="rounded-2xl border border-slate-300 bg-slate-50 p-4">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-500">
                      Note interne
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm font-medium leading-6 text-slate-800">
                      {internalNote.trim()}
                    </p>
                  </div>
                ) : null}

                <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm leading-6 text-violet-950">
                  Le prix affiché ici vient du catalogue. Le prix réel n’est pas
                  demandé pendant la prise de rendez-vous : il sera géré dans le
                  parcours d’encaissement.
                </div>
              </div>
            </div>
          ) : null}

          {error ? (
            <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-800">
              {error}
            </div>
          ) : null}

          <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-5">
            <div>
              {step > 1 ? (
                <button
                  type="button"
                  onClick={previousStep}
                  disabled={isPending}
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50 disabled:opacity-50"
                >
                  Retour
                </button>
              ) : (
                <Link
                  href="/planning"
                  className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 text-sm font-semibold text-slate-800 transition hover:bg-slate-50"
                >
                  Annuler
                </Link>
              )}
            </div>

            {step < 4 ? (
              <button
                type="button"
                onClick={nextStep}
                disabled={isCheckingCapacity}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-6 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                Continuer
              </button>
            ) : (
              <button
                type="button"
                onClick={submitAppointment}
                disabled={isPending}
                className="inline-flex min-h-11 items-center justify-center rounded-xl bg-violet-600 px-6 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isPending ? "Création…" : "Créer le rendez-vous"}
              </button>
            )}
          </div>
        </div>
      </section>

      <aside className="h-fit rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:sticky lg:top-6">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-600">
          Rendez-vous
        </p>
        <h2 className="mt-2 text-lg font-semibold text-slate-950">
          Récapitulatif rapide
        </h2>

        <dl className="mt-5 space-y-4 text-sm">
          <div>
            <dt className="font-medium text-slate-500">Cliente</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {selectedClient
                ? selectedClient.name
                : newClientIsComplete
                  ? clientNameSearch.trim()
                  : "À renseigner"}
            </dd>
          </div>

          <div>
            <dt className="font-medium text-slate-500">Prestations</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {selectedServices.length || "À choisir"}
            </dd>
          </div>

          <div>
            <dt className="font-medium text-slate-500">Durée estimée</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {totalDuration > 0 ? formatDuration(totalDuration) : "—"}
            </dd>
          </div>

          <div>
            <dt className="font-medium text-slate-500">Montant catalogue</dt>
            <dd className="mt-1 text-lg font-bold text-slate-950">
              {selectedServices.length > 0 ? formatMoney(totalPrice) : "—"}
            </dd>
          </div>

          <div>
            <dt className="font-medium text-slate-500">Créneau</dt>
            <dd className="mt-1 font-semibold text-slate-950">
              {dateKey && timeValue
                ? `${dateKey} · ${timeValue}`
                : "À renseigner"}
            </dd>
          </div>
        </dl>

        <div className="mt-6 rounded-2xl bg-slate-50 p-4 text-xs font-medium leading-5 text-slate-600">
          Les affectations employées et salles restent organisables après la
          création. SalonFlow conserve les contrôles anti-conflit côté serveur.
        </div>
      </aside>
    </div>
  );
}
