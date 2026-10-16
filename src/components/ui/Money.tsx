import { formatMoney, roundMoney } from "../../lib/format";

interface Props {
  value: number;
  currency: string;
  /** Colorea rojo si es negativo. */
  signed?: boolean;
  className?: string;
}

export function Money({ value, currency, signed, className = "" }: Props) {
  const color = signed && roundMoney(value, currency) < 0 ? "text-rose-600" : "";
  return <span className={`tabular-nums ${color} ${className}`}>{formatMoney(value, currency)}</span>;
}
