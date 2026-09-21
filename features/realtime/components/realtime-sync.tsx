"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

const REFRESH_DEBOUNCE_MS = 250;

/**
 * Synchronisation multi-appareils SalonFlow.
 *
 * - une seule connexion SSE par onglet authentifié ;
 * - aucun F5 : router.refresh() fusionne les Server Components à jour ;
 * - les événements sont regroupés pendant 250 ms ;
 * - un onglet en arrière-plan ne travaille pas inutilement ;
 * - après une coupure réseau, la reconnexion force une resynchronisation.
 */
export function RealtimeSync() {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource("/api/realtime");
    let refreshTimer: ReturnType<typeof setTimeout> | null = null;
    let disconnected = false;

    const scheduleRefresh = () => {
      if (document.visibilityState !== "visible") {
        return;
      }

      if (refreshTimer) clearTimeout(refreshTimer);
      refreshTimer = setTimeout(() => {
        refreshTimer = null;
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    source.onmessage = (message) => {
      try {
        const event: unknown = JSON.parse(message.data);
        if (!event || typeof event !== "object") return;
        scheduleRefresh();
      } catch {
        // Un événement invalide ne doit jamais casser l'interface.
      }
    };

    source.onerror = () => {
      disconnected = true;
    };

    source.onopen = () => {
      if (!disconnected) return;
      disconnected = false;
      // Un événement peut avoir été manqué pendant la coupure.
      scheduleRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Sur mobile, le navigateur peut suspendre le réseau en arrière-plan
        // sans que EventSource signale forcément une coupure. On resynchronise
        // donc systématiquement au retour dans l'application.
        scheduleRefresh();
      }
    };

    const handleOnline = () => {
      scheduleRefresh();
    };

    const handlePageShow = (event: PageTransitionEvent) => {
      if (event.persisted) scheduleRefresh();
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("online", handleOnline);
    window.addEventListener("pageshow", handlePageShow);

    return () => {
      source.close();
      if (refreshTimer) clearTimeout(refreshTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("pageshow", handlePageShow);
    };
  }, [router]);

  return null;
}
