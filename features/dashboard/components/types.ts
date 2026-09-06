import type { getDashboard } from "@/features/dashboard/server";
export type AwaitedReturn = Awaited<ReturnType<typeof getDashboard>>;
