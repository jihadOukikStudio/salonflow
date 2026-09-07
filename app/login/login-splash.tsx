"use client";

import { useEffect, useState, type ReactNode } from "react";

import { SalonFlowLogo } from "@/features/brand/components/salonflow-logo";

export function LoginSplash({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const reduceMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const hold = window.setTimeout(
      () => {
        if (reduceMotion) {
          setVisible(false);
          return;
        }

        setLeaving(true);
        window.setTimeout(() => setVisible(false), 360);
      },
      reduceMotion ? 150 : 900,
    );

    return () => window.clearTimeout(hold);
  }, []);

  return (
    <>
      {children}
      {visible ? (
        <div
          className={`sf-splash fixed inset-0 z-[100] flex min-h-dvh items-center justify-center bg-slate-50 px-6 ${
            leaving ? "sf-splash-leaving" : ""
          }`}
          role="status"
          aria-label="Ouverture de SalonFlow"
        >
          <div className="flex flex-col items-center text-center">
            <div className="sf-splash-logo rounded-[2rem] bg-white p-3 shadow-sm ring-1 ring-slate-200/80">
              <SalonFlowLogo size={92} showName={false} />
            </div>
            <p className="mt-6 font-[family-name:var(--font-salonflow-display)] text-4xl font-semibold tracking-tight text-slate-950">
              SalonFlow
            </p>
            <p className="mt-2 text-xs font-semibold uppercase tracking-[0.25em] text-violet-700">
              Le 7ème Sens Marrakech
            </p>
            <div
              className="mt-8 h-1 w-24 overflow-hidden rounded-full bg-violet-100"
              aria-hidden="true"
            >
              <span className="sf-splash-progress block h-full rounded-full bg-violet-700" />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
