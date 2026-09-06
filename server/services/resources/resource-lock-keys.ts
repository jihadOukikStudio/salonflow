export function appointmentLockKey(
  salonId: string,
  appointmentId: string,
): string {
  return `salonflow:appointment:${salonId}:${appointmentId}`;
}

export function appointmentServiceLockKey(
  salonId: string,
  appointmentServiceId: string,
): string {
  return `salonflow:appointment-service:${salonId}:${appointmentServiceId}`;
}

export function employeeLockKey(salonId: string, employeeId: string): string {
  return `salonflow:employee:${salonId}:${employeeId}`;
}

export function roomLockKey(salonId: string, roomId: string): string {
  return `salonflow:room:${salonId}:${roomId}`;
}
