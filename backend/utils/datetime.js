const formatInZone = (date, timeZone, options) => {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return { date: '—', time: '—', iso: '' };
  try {
    const dateFmt = new Intl.DateTimeFormat('en-IN', {
      timeZone,
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
    const timeFmt = new Intl.DateTimeFormat('en-IN', {
      timeZone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
    return {
      date: dateFmt.format(d),
      time: timeFmt.format(d),
      iso: d.toISOString(),
      ...(options || {}),
    };
  } catch (e) {
    return { date: d.toISOString().slice(0, 10), time: d.toISOString().slice(11, 16), iso: d.toISOString() };
  }
};

const formatOrderTimestamp = (date, timeZone) => formatInZone(date, timeZone);

const isValidTimezone = (tz) => {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return true;
  } catch (e) {
    return false;
  }
};

module.exports = { formatOrderTimestamp, formatInZone, isValidTimezone };
