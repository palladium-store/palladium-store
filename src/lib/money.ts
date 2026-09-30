// All money is integer centavos. Display uses the Philippine peso sign.
export const toPesos = (c: number) => c / 100;
export const toCentavos = (pesos: number | string) => Math.round(Number(pesos) * 100);

const whole = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 0, maximumFractionDigits: 0 });
const fine = new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP', minimumFractionDigits: 2, maximumFractionDigits: 2 });
export function peso(centavos: number): string {
  const n = centavos / 100;
  return (Number.isInteger(n) ? whole : fine).format(n);
}
export const pesoFixed = (centavos: number) => fine.format(centavos / 100);
export const pct = (n: number) => `${(Math.round(n * 10) / 10).toFixed(1)}%`;
