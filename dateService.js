const date = require('date-fns');
const tz = require('date-fns-tz');

function parseInput(ISOdate) {
  const TZ = process.env.TZ;
  return tz.utcToZonedTime(ISOdate, TZ);
}

function formatDateToTwoString(date) {
  if (date.toString().length == 1) return '0' + date;
  return date;
}

function formatHours(ISOdate) {
  const TZ = process.env.TZ;
  const cardHours = formatDateToTwoString(date.getHours(ISOdate));
  const cardMinutes = formatDateToTwoString(date.getMinutes(ISOdate));
  let TZOffset = (tz.getTimezoneOffset(TZ) / 3600000).toString();
  const TZSymbol = TZOffset.toString()[0] == '-' ? '-' : '+';
  if (TZSymbol == '-')
    TZOffset = TZOffset.substring(1);
  const TZString = `${TZSymbol}${formatDateToTwoString(TZOffset)}:00`;
  return `T${cardHours}:${cardMinutes}:00.000${TZString}`;
}
class DateService {
  addMonth(ISOdate, hasHours) {
    let updatedDate = date
      .addMonths(parseInput(ISOdate), 1)
      .toISOString()
      .toString()
      .substring(0, 10);

    if (hasHours) {
      updatedDate += formatHours(ISOdate);
    }
    return updatedDate;
  }

  addDay(ISOdate, hasHours, daysAmount) {
    let updatedDate = date
      .addDays(parseInput(ISOdate), daysAmount)
      .toISOString()
      .toString()
      .substring(0, 10);

    if (hasHours) {
      updatedDate += formatHours(ISOdate);
    }
    return updatedDate;
  }
}

module.exports = new DateService();
