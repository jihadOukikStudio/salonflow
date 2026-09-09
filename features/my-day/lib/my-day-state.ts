export type MyDayServiceState = {
  id: string;
  scheduledStart: string;
  status: "TODO" | "IN_PROGRESS" | "DONE";
};

export function selectCurrentAndNextServices(
  services: MyDayServiceState[],
  now = new Date(),
) {
  const sorted = [...services].sort(
    (left, right) =>
      new Date(left.scheduledStart).getTime() -
      new Date(right.scheduledStart).getTime(),
  );

  const current =
    sorted.find((service) => service.status === "IN_PROGRESS") ??
    sorted.find(
      (service) =>
        service.status === "TODO" &&
        new Date(service.scheduledStart).getTime() <= now.getTime(),
    ) ??
    sorted.find((service) => service.status === "TODO") ??
    null;

  const next = current
    ? (sorted.find(
        (service) =>
          service.id !== current.id &&
          service.status === "TODO" &&
          new Date(service.scheduledStart).getTime() >=
            new Date(current.scheduledStart).getTime(),
      ) ?? null)
    : null;

  return { current, next };
}
