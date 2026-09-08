"use client";

import { CalendarDays, ChevronLeft, ChevronRight, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type PlanningDatePickerProps = {
  dateKey: string;
  formattedDate: string;
  view: "planning" | "employees" | "rooms";
  period: "day" | "week" | "month";
};

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"];

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

export function PlanningDatePicker({
  dateKey,
  formattedDate,
  view,
  period,
}: PlanningDatePickerProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedDate = useMemo(() => parseDateKey(dateKey), [dateKey]);
  const [isOpen, setIsOpen] = useState(false);
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
    if (!isOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [isOpen]);

  const calendarDays = useMemo(
    () => buildCalendarDays(visibleMonth),
    [visibleMonth],
  );

  const monthLabel = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(visibleMonth);

  const todayKey = toDateKey(new Date());

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
    setIsOpen(false);

    if (nextDateKey === dateKey) {
      return;
    }

    router.push(
      `/planning?date=${encodeURIComponent(nextDateKey)}&view=${view}&period=${period}`,
    );
  };

  return (
    <div ref={containerRef} className="relative min-w-0 flex-1">
      <button
        type="button"
        onClick={() => {
          if (isOpen) {
            setIsOpen(false);
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
          setIsOpen(true);
        }}
        className="flex min-h-10 w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-center transition hover:border-slate-300 hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2"
        aria-label={`Choisir une date. Date affichée : ${formattedDate}`}
        aria-expanded={isOpen}
        aria-haspopup="dialog"
      >
        <CalendarDays
          aria-hidden="true"
          className="h-4 w-4 shrink-0 text-slate-500"
          strokeWidth={1.8}
        />
        <span className="truncate text-sm font-semibold capitalize text-slate-950">
          {formattedDate}
        </span>
      </button>

      {isOpen ? (
        <div
          role="dialog"
          aria-label="Choisir une date"
          className="fixed inset-x-3 top-1/2 z-50 mx-auto w-[calc(100%-1.5rem)] max-w-sm -translate-y-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:absolute sm:inset-x-auto sm:left-1/2 sm:top-[calc(100%+0.5rem)] sm:w-[21rem] sm:-translate-x-1/2 sm:translate-y-0"
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
                onClick={() => setIsOpen(false)}
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
              const isToday = cellKey === todayKey;
              const isCurrentMonth =
                date.getUTCMonth() === visibleMonth.getUTCMonth();

              return (
                <button
                  key={cellKey}
                  type="button"
                  onClick={() => selectDate(date)}
                  aria-current={isToday ? "date" : undefined}
                  aria-pressed={isSelected}
                  className={`flex aspect-square min-h-10 items-center justify-center rounded-xl text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 ${
                    isSelected
                      ? "bg-violet-600 text-white hover:bg-violet-700"
                      : isToday
                        ? "border border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100"
                        : isCurrentMonth
                          ? "text-slate-800 hover:bg-slate-100"
                          : "text-slate-300 hover:bg-slate-50"
                  }`}
                >
                  {date.getUTCDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={() => selectDate(parseDateKey(todayKey))}
              className="w-full rounded-xl bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500"
            >
              Aujourd’hui
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
