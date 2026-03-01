/**
 * Retorna la fecha/hora actual ajustada a la zona horaria de Colombia (UTC-5, sin horario de verano).
 * Usar getMonth(), getFullYear(), getDate(), getHours() sobre el Date retornado
 * equivale a obtener los valores en hora local colombiana.
 */
export function getNowBogota(): Date {
  const BOGOTA_OFFSET_MS = -5 * 60 * 60 * 1000;
  return new Date(Date.now() + BOGOTA_OFFSET_MS);
}
