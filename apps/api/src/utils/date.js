function startOfDay(value = new Date()) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfDay(value = new Date()) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  d.setHours(23, 59, 59, 999);
  return d;
}

function parseDateOrToday(value) {
  return startOfDay(value ? new Date(value) : new Date());
}

function combineDateAndTime(dateValue, timeString) {
  const base = startOfDay(dateValue);
  const [hours, minutes] = String(timeString || '00:00').split(':').map(Number);
  base.setHours(hours || 0, minutes || 0, 0, 0);
  return base;
}

function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

module.exports = { startOfDay, endOfDay, parseDateOrToday, combineDateAndTime, addDays };
