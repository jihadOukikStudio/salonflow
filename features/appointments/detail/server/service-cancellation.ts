export function serializeServiceCancellation(value: Date | null) {
  return value?.toISOString() ?? null;
}

export function activeServiceAmount(cancelledAt: string | null, price: number) {
  return cancelledAt === null ? price : 0;
}
