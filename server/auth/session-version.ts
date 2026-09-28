export function isSessionCurrent(
  storedVersion: number | undefined,
  sessionVersion: number | undefined,
): boolean {
  // Existing salon sessions issued before this migration start at version zero.
  return (storedVersion ?? 0) === (sessionVersion ?? 0);
}
