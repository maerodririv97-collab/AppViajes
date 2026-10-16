/**
 * Divide `total` en `n` partes exactamente iguales. No se redondea a la unidad mínima de la
 * moneda: si el total no es divisible (ej. 1.600.000 / 3), cada parte guarda los decimales y
 * nadie carga con el peso de residuo. Los montos se redondean solo al mostrarlos.
 */
export function splitEqual(total: number, n: number): number[] {
  if (n <= 0) return [];
  return Array.from({ length: n }, () => total / n);
}
