const months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
export function formatProjectDate(value, language = 'en', short = false) {
  const match = /^(\w+)\s+(\d+),\s+(\d{4})$/.exec(value || '');
  if (!match || !months.includes(match[1])) return value || '';
  const date = new Date(Date.UTC(Number(match[3]), months.indexOf(match[1]), Number(match[2])));
  return new Intl.DateTimeFormat(language === 'vi' ? 'vi-VN' : 'en-GB', { year:'numeric', month: short ? 'short' : 'long', ...(short ? {} : {day:'numeric'}), timeZone:'UTC' }).format(date);
}
export function demoTimestamp(seconds) {
  const duration = Math.max(0, Math.floor(Number(seconds) || 0));
  return `${String(Math.floor(duration / 60)).padStart(2,'0')}:${String(duration % 60).padStart(2,'0')}`;
}
