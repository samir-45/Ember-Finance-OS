// Financial calendar dates are Dhaka calendar values; timestamps remain UTC.
export const FINANCE_TIMEZONE = 'Asia/Dhaka';
export function localDate(date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: FINANCE_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const part = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${part('year')}-${part('month')}-${part('day')}`;
}
export const localMonth = (date = new Date()) => localDate(date).slice(0, 7);
export function shiftMonth(month: string, offset: number): string {
  const [year, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(year, m - 1 + offset, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
}
export function addBillingCycle(
  date: string,
  cycle: string,
  anchorDay = Number(date.slice(8, 10)),
): string {
  if (cycle === 'weekly')
    return new Date(Date.parse(`${date}T12:00:00Z`) + 7 * 86400000).toISOString().slice(0, 10);
  const month = shiftMonth(
    date.slice(0, 7),
    cycle === 'yearly' ? 12 : cycle === 'quarterly' ? 3 : 1,
  );
  const [year, m] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, m, 0)).getUTCDate();
  return `${month}-${String(Math.min(anchorDay, lastDay)).padStart(2, '0')}`;
}
export function daysBetween(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000);
}
