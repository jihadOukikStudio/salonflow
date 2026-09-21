import type { RealtimeEnvelope } from "@/server/realtime/realtime-types";

type RealtimeSubscriber = (event: RealtimeEnvelope) => void;

/**
 * Hub strictement local au processus Node.
 *
 * PostgreSQL LISTEN/NOTIFY assure la diffusion entre les différentes instances
 * applicatives. Ce hub ne fait que distribuer, dans UNE instance, l'événement
 * aux connexions SSE du bon salon.
 */
export class SalonRealtimeHub {
  private readonly subscribers = new Map<string, Set<RealtimeSubscriber>>();

  subscribe(salonId: string, subscriber: RealtimeSubscriber) {
    const salonSubscribers =
      this.subscribers.get(salonId) ?? new Set<RealtimeSubscriber>();

    salonSubscribers.add(subscriber);
    this.subscribers.set(salonId, salonSubscribers);

    return () => {
      const current = this.subscribers.get(salonId);
      if (!current) return;

      current.delete(subscriber);
      if (current.size === 0) this.subscribers.delete(salonId);
    };
  }

  dispatch(event: RealtimeEnvelope) {
    const salonSubscribers = this.subscribers.get(event.salonId);
    if (!salonSubscribers) return;

    for (const subscriber of salonSubscribers) {
      try {
        subscriber(event);
      } catch (error) {
        console.error("[realtime] subscriber failed", error);
      }
    }
  }

  get subscriberCount() {
    let count = 0;
    for (const subscribers of this.subscribers.values()) {
      count += subscribers.size;
    }
    return count;
  }
}
