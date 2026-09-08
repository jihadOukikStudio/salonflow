import { normalizeLoginPhone } from "@/lib/phone";

export type NormalizedLoginIdentifier =
  { kind: "email"; value: string } | { kind: "phone"; value: string };

export function normalizeLoginEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizeLoginIdentifier(
  identifier: string,
): NormalizedLoginIdentifier | null {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (trimmed.includes("@")) {
    const email = normalizeLoginEmail(trimmed);
    if (email.length > 320 || !/^\S+@\S+\.\S+$/.test(email)) return null;
    return { kind: "email", value: email };
  }

  const phone = normalizeLoginPhone(trimmed);
  return phone ? { kind: "phone", value: phone } : null;
}
