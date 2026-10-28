// Indian time (IST, Asia/Kolkata): the business runs in IST, so "now" in forms is IST
// even when the phone is set to another time zone.
const pad = (n) => String(n).padStart(2, '0');

// "Now" (optionally some minutes earlier) as YYYY-MM-DDTHH:mm in IST.
export const istNow = (minusMinutes = 0) => {
  const d = new Date(Date.now() - minusMinutes * 60000);
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(d).reduce((o, p) => ({ ...o, [p.type]: p.value }), {});
  return `${parts.year}-${pad(parts.month)}-${pad(parts.day)}T${pad(parts.hour)}:${pad(parts.minute)}`;
};
