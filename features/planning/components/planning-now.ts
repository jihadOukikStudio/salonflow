export const PLANNING_START_MINUTE = 10 * 60;
export const PLANNING_END_MINUTE = 21 * 60 + 30;
export const PLANNING_HOUR_HEIGHT = 112;

export function planningNowTop(minutes: number) {
  const clamped = Math.min(
    PLANNING_END_MINUTE,
    Math.max(PLANNING_START_MINUTE, minutes),
  );

  return ((clamped - PLANNING_START_MINUTE) / 60) * PLANNING_HOUR_HEIGHT;
}

export function isInsidePlanningWindow(minutes: number) {
  return minutes >= PLANNING_START_MINUTE && minutes <= PLANNING_END_MINUTE;
}
