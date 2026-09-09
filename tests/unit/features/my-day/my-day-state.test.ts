import { describe, expect, it } from "vitest";

import { selectCurrentAndNextServices } from "@/features/my-day/lib/my-day-state";

describe("selectCurrentAndNextServices", () => {
  it("prioritizes an in-progress service, then the next todo service", () => {
    const result = selectCurrentAndNextServices(
      [
        { id: "a", scheduledStart: "2026-09-09T09:00:00.000Z", status: "DONE" },
        {
          id: "b",
          scheduledStart: "2026-09-09T10:00:00.000Z",
          status: "IN_PROGRESS",
        },
        { id: "c", scheduledStart: "2026-09-09T11:00:00.000Z", status: "TODO" },
      ],
      new Date("2026-09-09T10:30:00.000Z"),
    );

    expect(result.current?.id).toBe("b");
    expect(result.next?.id).toBe("c");
  });

  it("uses the first overdue todo service as current when nothing is in progress", () => {
    const result = selectCurrentAndNextServices(
      [
        { id: "a", scheduledStart: "2026-09-09T09:00:00.000Z", status: "TODO" },
        { id: "b", scheduledStart: "2026-09-09T12:00:00.000Z", status: "TODO" },
      ],
      new Date("2026-09-09T10:30:00.000Z"),
    );

    expect(result.current?.id).toBe("a");
    expect(result.next?.id).toBe("b");
  });
});
