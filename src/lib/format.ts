export const CURRENCIES: { code: string; label: string; decimals: number }[] = [
  { code: "COP", label: "Peso colombiano (COP)", decimals: 0 },
  { code: "USD", label: "Dólar (USD)", decimals: 2 },
  { code: "EUR", label: "Euro (EUR)", decimals: 2 },
  { code: "MXN", label: "Peso mexicano (MXN)", decimals: 2 },
  { code: "PEN", label: "Sol peruano (PEN)", decimals: 2 },
  { code: "CLP", label: "Peso chileno (CLP)", decimals: 0 },
  { code: "ARS", label: "Peso argentino (ARS)", decimals: 2 },
];

export function currencyDecimals(code: string): number {
  return CURRENCIES.find((c) => c.code === code)?.decimals ?? 2;
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatMoney(value: number, currency: string): string {
  let f = formatters.get(currency);
  if (!f) {
    const decimals = currencyDecimals(currency);
    f = new Intl.NumberFormat("es-CO", {
      style: "currency",
      currency,
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    formatters.set(currency, f);
  }
  // Las partes iguales guardan decimales (ver split.ts): se redondea antes de formatear y se
  // evita mostrar "-$ 0" cuando el valor es solo un residuo.
  const rounded = roundMoney(value, currency);
  return f.format(rounded === 0 ? 0 : rounded);
}

export function roundMoney(value: number, currency: string): number {
  const factor = 10 ** currencyDecimals(currency);
  const rounded = Math.round(value * factor) / factor;
  return rounded === 0 ? 0 : rounded;
}

/** Fecha local de hoy en formato YYYY-MM-DD. */
export function today(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-").map(Number);
  if (!y || !m || !d) return iso;
  return new Date(y, m - 1, d).toLocaleDateString("es-CO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
