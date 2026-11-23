export function texto(valor: string, etiqueta: string, maxBytes: number): string {
  const limpio = valor.trim();
  if (!limpio) throw new Error(etiqueta + ' es obligatorio.');
  if (new TextEncoder().encode(limpio).length > maxBytes) throw new Error(etiqueta + ' admite hasta ' + maxBytes + ' bytes UTF-8.');
  return limpio;
}
export function u8Rango(valor: number, etiqueta: string, min: number, max: number): number {
  if (!Number.isSafeInteger(valor) || valor < min || valor > max) throw new Error(etiqueta + ' debe estar entre ' + min + ' y ' + max + '.');
  return valor;
}
export function u64Positivo(valor: bigint | number | string, etiqueta: string): bigint {
  const n = typeof valor === 'bigint' ? valor : BigInt(String(valor).trim());
  if (n < 1n || n > 18446744073709551615n) throw new Error(etiqueta + ' debe ser un entero u64 positivo.');
  return n;
}
export const nombreCampingValido = (v: string) => texto(v, 'El nombre del camping', 32);
export const sectorValido = (v: string) => texto(v, 'El sector', 24);
export const capacidadValida = (v: number) => u8Rango(v, 'La capacidad', 1, 10);
export const personasValidas = (v: number) => u8Rango(v, 'La cantidad de personas', 1, 255);
export const nochesValidas = (v: number) => u8Rango(v, 'Las noches', 1, 255);
export const idValido = (v: bigint | number | string) => u64Positivo(v, 'El id');
