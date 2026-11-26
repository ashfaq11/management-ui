/** Today's date (YYYY-MM-DD) in the browser's local zone. */
export function today(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}
export const thisMonth = () => today().slice(0, 7);
