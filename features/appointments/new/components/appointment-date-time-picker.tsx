"use client";

import {
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

type AppointmentDateTimePickerProps = {
  dateKey: string;
  timeValue: string;
  minimumDateKey: string;
  timeOptions: string[];
  onDateChange: (value: string) => void;
  onTimeChange: (value: string) => void;
};

function parseDateKey(dateKey: string) {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function toDateKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatDateLabel(date: Date) {
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function buildCalendarDays(monthDate: Date) {
  const year = monthDate.getUTCFullYear();
  const month = monthDate.getUTCMonth();
  const firstDay = new Date(Date.UTC(year, month, 1, 12));
  const mondayIndex = (firstDay.getUTCDay() + 6) % 7;
  const gridStart = new Date(firstDay);
  gridStart.setUTCDate(firstDay.getUTCDate() - mondayIndex);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setUTCDate(gridStart.getUTCDate() + index);
    return date;
  });
}

export function AppointmentDateTimePicker({
  dateKey,
  timeValue,
  minimumDateKey,
  timeOptions,
  onDateChange,
  onTimeChange,
}: AppointmentDateTimePickerProps) {
  const dateContainerRef = useRef<HTMLDivElement>(null);
  const timeContainerRef = useRef<HTMLDivElement>(null);
  const selectedDate = useMemo(() => parseDateKey(dateKey), [dateKey]);
  const [dateOpen, setDateOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState(
    () =>
      new Date(
        Date.UTC(
          selectedDate.getUTCFullYear(),
          selectedDate.getUTCMonth(),
          1,
          12,
        ),
      ),
  );

  useEffect(() => {
    if (!dateOpen && !timeOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;

      if (
        dateOpen &&
        dateContainerRef.current &&
        !dateContainerRef.current.contains(target)
      ) {
        setDateOpen(false);
      }

      if (
        timeOpen &&
        timeContainerRef.current &&
        !timeContainerRef.current.contains(target)
      ) {
        setTimeOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setDateOpen(false);
        setTimeOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [dateOpen, timeOpen]);

  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth),
    [visibleMonth],
  );

  const monthLabel = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(visibleMonth);

  const moveMonth = (offset: number) => {
    setVisibleMonth(
      (current) =>
        new Date(
          Date.UTC(
            current.getUTCFullYear(),
            current.getUTCMonth() + offset,
            1,
            12,
          ),
        ),
    );
  };

  const selectDate = (date: Date) => {
    const nextDateKey = toDateKey(date);
    if (nextDateKey < minimumDateKey) return;

    onDateChange(nextDateKey);
    setDateOpen(false);
  };

  const selectedDateLabel = formatDateLabel(selectedDate);
  const hasTimeOptions = timeOptions.length > 0;

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div ref={dateContainerRef} className="relative">
        <input
          type="text"
          readOnly
          tabIndex={-1}
          aria-label="Date du rendez-vous"
          value={dateKey}
          className="sr-only"
        />

        <button
          type="button"
          onClick={() => {
            setTimeOpen(false);
            if (dateOpen) {
              setDateOpen(false);
              return;
            }

            setVisibleMonth(
              new Date(
                Date.UTC(
                  selectedDate.getUTCFullYear(),
                  selectedDate.getUTCMonth(),
                  1,
                  12,
                ),
              ),
            );
            setDateOpen(true);
          }}
          aria-label={`Choisir la date du rendez-vous, ${selectedDateLabel}`}
          aria-expanded={dateOpen}
          aria-haspopup="dialog"
          className="group flex min-h-16 w-full items-center gap-2.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
            <CalendarDays className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Date
            </span>
            <span className="mt-1 block truncate text-sm font-bold capitalize text-slate-950">
              {selectedDateLabel}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition ${dateOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        {dateOpen ? (
          <div
            role="dialog"
            aria-label="Choisir la date du rendez-vous"
            className="fixed inset-x-3 top-1/2 z-[70] mx-auto w-[calc(100%-1.5rem)] max-w-sm -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:left-0 sm:top-[calc(100%+0.5rem)] sm:w-[21rem] sm:translate-y-0"
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <button
                type="button"
                onClick={() => moveMonth(-1)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                aria-label="Mois précédent"
              >
                <ChevronLeft className="h-5 w-5" aria-hidden="true" />
              </button>

              <p className="text-sm font-bold capitalize text-slate-950">
                {monthLabel}
              </p>

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveMonth(1)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                  aria-label="Mois suivant"
                >
                  <ChevronRight className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  onClick={() => setDateOpen(false)}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 sm:hidden"
                  aria-label="Fermer le calendrier"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="grid grid-cols-7 gap-1 pb-1" aria-hidden="true">
              {WEEKDAYS.map((weekday, index) => (
                <div
                  key={`${weekday}-${index}`}
                  className="flex h-8 items-center justify-center text-xs font-semibold text-slate-400"
                >
                  {weekday}
                </div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1">
              {calendarDays.map((date) => {
                const cellKey = toDateKey(date);
                const isSelected = cellKey === dateKey;
                const isCurrentMonth =
                  date.getUTCMonth() === visibleMonth.getUTCMonth();
                const isDisabled = cellKey < minimumDateKey;

                return (
                  <button
                    key={cellKey}
                    type="button"
                    onClick={() => selectDate(date)}
                    aria-label={formatDateLabel(date)}
                    aria-pressed={isSelected}
                    disabled={isDisabled}
                    className={`flex aspect-square min-h-10 items-center justify-center rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 disabled:cursor-not-allowed ${
                      isSelected
                        ? "bg-violet-600 text-white hover:bg-violet-700"
                        : isDisabled
                          ? "text-slate-200"
                          : isCurrentMonth
                            ? "text-slate-800 hover:bg-slate-100"
                            : "text-slate-400 hover:bg-slate-50"
                    }`}
                  >
                    {date.getUTCDate()}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </div>

      <div ref={timeContainerRef} className="relative">
        <input
          type="text"
          readOnly
          tabIndex={-1}
          aria-label="Heure du rendez-vous"
          value={hasTimeOptions ? timeValue : ""}
          className="sr-only"
        />

        <button
          type="button"
          onClick={() => {
            if (!hasTimeOptions) return;
            setDateOpen(false);
            setTimeOpen((current) => !current);
          }}
          disabled={!hasTimeOptions}
          aria-label={`Choisir l’heure du rendez-vous, ${hasTimeOptions ? timeValue : "aucun créneau"}`}
          aria-expanded={timeOpen}
          aria-haspopup="dialog"
          className="group flex min-h-16 w-full items-center gap-2.5 rounded-xl border border-violet-200 bg-white px-3 py-2 text-left shadow-sm transition hover:border-violet-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400"
        >
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
            <Clock3 className="h-5 w-5" aria-hidden="true" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
              Heure
            </span>
            <span className="mt-1 block text-sm font-bold tabular-nums text-slate-950">
              {hasTimeOptions ? timeValue : "Aucun créneau"}
            </span>
          </span>
          <ChevronDown
            className={`h-4 w-4 shrink-0 text-slate-400 transition ${timeOpen ? "rotate-180" : ""}`}
            aria-hidden="true"
          />
        </button>

        {timeOpen && hasTimeOptions ? (
          <div
            role="dialog"
            aria-label="Choisir l'heure du rendez-vous"
            className="fixed inset-x-3 top-1/2 z-[70] mx-auto w-[calc(100%-1.5rem)] max-w-sm -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:right-0 sm:top-[calc(100%+0.5rem)] sm:w-[21rem] sm:translate-y-0"
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-slate-950">
                  Choisir l’heure
                </p>
                <p className="mt-0.5 text-xs font-medium text-slate-500">
                  Créneaux de 15 minutes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTimeOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
                aria-label="Fermer les heures"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="max-h-[19rem] overflow-y-auto pr-1">
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                {timeOptions.map((time) => {
                  const isSelected = time === timeValue;
                  return (
                    <button
                      key={time}
                      type="button"
                      onClick={() => {
                        onTimeChange(time);
                        setTimeOpen(false);
                      }}
                      aria-pressed={isSelected}
                      className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-xl border px-2 text-sm font-bold tabular-nums transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                        isSelected
                          ? "border-violet-600 bg-violet-600 text-white"
                          : "border-slate-200 bg-white text-slate-800 hover:border-violet-300 hover:bg-violet-50 hover:text-violet-800"
                      }`}
                    >
                      {isSelected ? (
                        <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      ) : null}
                      {time}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
