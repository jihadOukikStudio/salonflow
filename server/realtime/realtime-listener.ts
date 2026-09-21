import { Client } from "pg";

import { SalonRealtimeHub } from "@/server/realtime/realtime-hub";
import {
  parseRealtimeEnvelope,
  SALONFLOW_REALTIME_CHANNEL,
  type RealtimeEnvelope,
} from "@/server/realtime/realtime-types";

type RealtimeGlobalState = {
  hub: SalonRealtimeHub;
  client: Client | null;
  connecting: Promise<void> | null;
  reconnectTimer: ReturnType<typeof setTimeout> | null;
};

const globalForRealtime = globalThis as typeof globalThis & {
  __salonflowRealtime?: RealtimeGlobalState;
};

const state: RealtimeGlobalState = globalForRealtime.__salonflowRealtime ?? {
  hub: new SalonRealtimeHub(),
  client: null,
  connecting: null,
  reconnectTimer: null,
};

if (!globalForRealtime.__salonflowRealtime) {
  globalForRealtime.__salonflowRealtime = state;
}

function scheduleReconnect() {
  if (state.reconnectTimer || state.hub.subscriberCount === 0) return;

  state.reconnectTimer = setTimeout(() => {
    state.reconnectTimer = null;
    void ensureRealtimeListener().catch((error) => {
      console.error("[realtime] PostgreSQL reconnect failed", error);
      scheduleReconnect();
    });
  }, 2_000);
}

async function connectRealtimeListener() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not configured.");
  }

  const client = new Client({
    connectionString,
    application_name: "salonflow-realtime-listener",
    keepAlive: true,
  });

  client.on("notification", (message) => {
    if (message.channel !== SALONFLOW_REALTIME_CHANNEL || !message.payload) {
      return;
    }

    const event = parseRealtimeEnvelope(message.payload);
    if (!event) {
      console.warn("[realtime] ignored malformed PostgreSQL notification");
      return;
    }

    state.hub.dispatch(event);
  });

  const handleDisconnect = () => {
    if (state.client === client) state.client = null;
    scheduleReconnect();
  };

  client.on("error", (error) => {
    console.error("[realtime] PostgreSQL listener error", error);
    handleDisconnect();
  });
  client.on("end", handleDisconnect);

  try {
    await client.connect();
    await client.query(`LISTEN ${SALONFLOW_REALTIME_CHANNEL}`);
    state.client = client;
  } catch (error) {
    await client.end().catch(() => undefined);
    throw error;
  }
}

export async function ensureRealtimeListener() {
  if (state.client) return;
  if (state.connecting) return state.connecting;

  state.connecting = connectRealtimeListener().finally(() => {
    state.connecting = null;
  });

  return state.connecting;
}

export function subscribeToSalonRealtime(
  salonId: string,
  subscriber: (event: RealtimeEnvelope) => void,
) {
  const unsubscribe = state.hub.subscribe(salonId, subscriber);

  void ensureRealtimeListener().catch((error) => {
    console.error("[realtime] unable to start PostgreSQL listener", error);
    scheduleReconnect();
  });

  return unsubscribe;
}
