"use client";

import { useState, useTransition } from "react";

import { updateServiceDefaultsAction } from "@/features/services/server/actions";

type ServiceItem = {
  id: string;
  name: string;
  defaultDurationMinutes: number | null;
  defaultPrice: number;
  isStartingPrice: boolean;
  requiredRoomType: "HAMAM" | "TREATMENT_ROOM" | null;
};

type CategoryItem = {
  id: string;
  name: string;
  services: ServiceItem[];
};

type Props = {
  categories: CategoryItem[];
};

const inputClassName =
  "min-h-11 w-full rounded-xl border border-slate-400 bg-white px-3 text-sm font-semibold text-slate-950 placeholder:text-slate-500 shadow-sm outline-none transition [color-scheme:light] focus:border-violet-600 focus:ring-4 focus:ring-violet-100";

function roomLabel(roomType: ServiceItem["requiredRoomType"]): string | null {
  if (roomType === "HAMAM") return "Hamam";
  if (roomType === "TREATMENT_ROOM") return "Salle de soins";
  return null;
}

function ServiceRow({ service }: { service: ServiceItem }) {
  const [duration, setDuration] = useState(
    service.defaultDurationMinutes?.toString() ?? "",
  );
  const [price, setPrice] = useState(service.defaultPrice.toString());
  const [isStartingPrice, setIsStartingPrice] = useState(
    service.isStartingPrice,
  );
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function save() {
    const durationNumber = Number(duration);
    const priceNumber = Number(price);

    if (!Number.isInteger(durationNumber) || durationNumber <= 0) {
      setError("Renseignez une durée valide en minutes.");
      setMessage(null);
      return;
    }

    if (!Number.isFinite(priceNumber) || priceNumber < 0) {
      setError("Renseignez un prix valide.");
      setMessage(null);
      return;
    }

    startTransition(async () => {
      setError(null);
      setMessage(null);

      const result = await updateServiceDefaultsAction({
        serviceId: service.id,
        defaultDurationMinutes: durationNumber,
        defaultPrice: priceNumber,
        isStartingPrice,
      });

      if (!result.ok) {
        setError(result.message);
        return;
      }

      setMessage("Enregistré");
    });
  }

  const requiredRoom = roomLabel(service.requiredRoomType);

  return (
    <div className="rounded-2xl border border-slate-300 bg-white p-4 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold text-slate-950">{service.name}</h3>
          <div className="mt-2 flex flex-wrap gap-2 text-xs font-semibold">
            {requiredRoom ? (
              <span className="rounded-full bg-pink-50 px-2.5 py-1 text-pink-800">
                {requiredRoom}
              </span>
            ) : null}
            {service.defaultDurationMinutes === null ? (
              <span className="rounded-full bg-amber-100 px-2.5 py-1 text-amber-900">
                Durée manquante
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-[160px_180px_minmax(0,1fr)_auto] sm:items-end">
        <label>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
            Durée (min)
          </span>
          <input
            type="number"
            min={1}
            max={1440}
            value={duration}
            onChange={(event) => setDuration(event.target.value)}
            placeholder="Ex. 45"
            className={inputClassName}
          />
        </label>

        <label>
          <span className="mb-2 block text-xs font-bold uppercase tracking-wide text-slate-600">
            Prix catalogue (MAD)
          </span>
          <input
            type="number"
            min={0}
            step="0.01"
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className={inputClassName}
          />
        </label>

        <label className="flex min-h-11 items-center gap-3 rounded-xl border border-slate-300 bg-slate-50 px-4">
          <input
            type="checkbox"
            checked={isStartingPrice}
            onChange={(event) => setIsStartingPrice(event.target.checked)}
            className="h-4 w-4 accent-violet-600"
          />
          <span className="text-sm font-semibold text-slate-800">
            Prix « à partir de »
          </span>
        </label>

        <button
          type="button"
          onClick={save}
          disabled={isPending}
          className="min-h-11 rounded-xl bg-violet-600 px-5 text-sm font-semibold text-white transition hover:bg-violet-700 disabled:opacity-60"
        >
          {isPending ? "Enregistrement…" : "Enregistrer"}
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm font-semibold text-red-700">{error}</p>
      ) : message ? (
        <p className="mt-3 text-sm font-semibold text-emerald-700">{message}</p>
      ) : null}
    </div>
  );
}

export function ServiceCatalogForm({ categories }: Props) {
  if (categories.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
        <p className="font-semibold text-slate-900">
          Aucune prestation configurée
        </p>
        <p className="mt-1 text-sm text-slate-600">
          Le catalogue doit contenir les prestations proposées par le salon.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {categories.map((category) => (
        <section key={category.id}>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold text-slate-950">
              {category.name}
            </h2>
            <span className="text-xs font-semibold text-slate-500">
              {category.services.length} prestation
              {category.services.length > 1 ? "s" : ""}
            </span>
          </div>

          <div className="space-y-3">
            {category.services.map((service) => (
              <ServiceRow key={service.id} service={service} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
