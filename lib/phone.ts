/**
 * Normalise un numéro pour l'authentification.
 *
 * - Maroc local: 06xxxxxxxx / 07xxxxxxxx -> +2126xxxxxxxx / +2127xxxxxxxx
 * - Préfixe international 00 -> +
 * - Tolère espaces, points, tirets et parenthèses
 * - Refuse les valeurs qui ne ressemblent pas à un numéro E.164
 */
export function normalizeLoginPhone(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;

  let compact = trimmed.replace(/[\s().-]/g, "");

  if (compact.startsWith("00")) {
    compact = `+${compact.slice(2)}`;
  }

  if (/^0\d{9}$/.test(compact)) {
    compact = `+212${compact.slice(1)}`;
  }

  if (!/^\+[1-9]\d{7,14}$/.test(compact)) {
    return null;
  }

  return compact;
}
