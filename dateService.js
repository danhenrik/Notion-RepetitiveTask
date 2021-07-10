const date = require('date-fns');
const tz = require('date-fns-tz');

function formatTimeZone(ISOdate) {
  const timezone = process.env.TZ;
  return tz.utcToZonedTime(ISOdate, timezone);
}

function formatDateToTwoString(date) {
  if (date.toString().length == 1) return '0' + date;
  return date;
}

class dateService {
  addMonth(ISOdate, hasHours) {
    const formattedDate = formatTimeZone(ISOdate);
    let updatedDate = date
      .addMonths(formattedDate, 1)
      .toISOString()
      .toString()
      .substring(0, 10);
    if (hasHours) {
      const cardHours = formatDateToTwoString(date.getHours(ISOdate));
      const cardMinutes = formatDateToTwoString(date.getMinutes(ISOdate));
      updatedDate += `T${cardHours}:${cardMinutes}:00.000-03:00`;
    }
    return updatedDate;
  }

  addDay(ISOdate, hasHours, daysAmount) {
    const formattedDate = formatTimeZone(ISOdate);
    let updatedDate = date
      .addDays(formattedDate, daysAmount)
      .toISOString()
      .toString()
      .substring(0, 10);

    if (hasHours) {
      const cardHours = formatDateToTwoString(date.getHours(ISOdate));
      const cardMinutes = formatDateToTwoString(date.getMinutes(ISOdate));
      updatedDate += `T${cardHours}:${cardMinutes}:00.000-03:00`;
    }
    return updatedDate;
  }
}

module.exports = new dateService();
