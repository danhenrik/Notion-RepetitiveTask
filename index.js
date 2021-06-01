require('dotenv').config();

const {Client} = require('@notionhq/client');
const date = require('date-fns');
const tz = require('date-fns-tz');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// TODO: Escalar a aplicação pra um uso mais generalizado
// TODO: Testar na main

const nameField = 'Nome';
const checkDoneField = 'Ok?';
const dateField = 'Data';
const dailyMarker = 'Daily';
const weeklyMarker = 'Weekly';
const databaseID = parseSharedURL(
  'https://www.notion.so/3a98859e43344645856d1bc88b9ac926?v=657a2cad38ef4b63b2ef279a7e6bb57c'
);

const notion = new Client({
  auth: process.env.TOKEN,
  logLevel: 'debug',
});

function parseSharedURL(URL) {
  return URL.split('?')[0].split('so/')[1];
}

const formatDateToTwoString = (date) => {
  if (date.toString().length == 1) return '0' + date;
  return date;
};

const formatTimeZone = (ISOdate) => {
  const timezone = 'America/Sao_Paulo';
  return tz.utcToZonedTime(ISOdate, timezone);
};

const addDay = (ISOdate, hasHours, daysAmount) => {
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
};

const uncheckAndNextOcurrency = (updatedDate) => {
  return JSON.parse(
    `{
      "${checkDoneField}": {
        "checkbox": false
      },
      "${dateField}": {
        "date": {
          "start": "${updatedDate}"
        }
      }
    }`
  );
};

const nextOcurrency = (updatedDate) => {
  return JSON.parse(
    `{
      "${dateField}": {
        "date": {
          "start": "${updatedDate}"
        }
      }
    }`
  );
};

const repetitiveTask = async () => {
  try {
    const {results} = await notion.request({
      path: `databases/${databaseID}/query`,
      method: 'POST',
    });
    for (const card of results) {
      if (card.properties[dateField]) {
        const cardDate = date.parseISO(card.properties[dateField]?.date.start);

        const isDaily = card.properties[dailyMarker].checkbox;
        const isWeekly = card.properties[weeklyMarker].checkbox;
        const isChecked = card.properties[checkDoneField].checkbox;
        const isToday = date.isYesterday(cardDate);
        const hasPassed = date.isBefore(cardDate, date.startOfToday());
        const hasHours = card.properties.Data.date.start.length > 10;

        if (isDaily && isToday) {
          if (isChecked) {
            let updatedDate = addDay(cardDate, hasHours, 1);
            await notion.pages.update({
              page_id: card.id,
              properties: uncheckAndNextOcurrency(updatedDate),
            });
            console.log(
              `Changed ${card.properties[nameField].title[0].text.content} daily task to next day`
            );
          } else {
            // Send alert and pass to next day
            let updatedDate = addDay(cardDate, hasHours, 1);
            await notion.pages.update({
              page_id: card.id,
              properties: nextOcurrency(updatedDate),
            });
          }
        }

        if (isWeekly && isToday) {
          if (isChecked) {
            let updatedDate = addDay(cardDate, hasHours, 7);
            await notion.pages.update({
              page_id: card.id,
              properties: uncheckAndNextOcurrency(updatedDate),
            });
            console.log(
              `Changed ${card.properties[nameField].title[0].text.content} weekly task to next week`
            );
          } else {
            let updatedDate = addDay(cardDate, hasHours, 7);
            await notion.pages.update({
              page_id: card.id,
              properties: nextOcurrency(updatedDate),
            });
          }
        }
      }
    }
  } catch (err) {
    console.log(err);
  }
};

cron.schedule('30 3 * * *', () => {
  console.log(new Date().toLocaleString());
  repetitiveTask();
});

console.log('Up and running!');

//* Timezones: http://1min.in/content/international/time-zones

/*
//* Update 1
const changeRes = await notion.request({
  path: `pages/${card.id}`,
  method: 'PATCH',
  body: {
    properties: {
      'Ok?': {
        checkbox: false,
      },
    },
  },
});
*/

/*
//* Update 2
const changeDirect = await notion.pages.update({
  page_id: card.id,
  properties: {'Ok?': {checkbox: false}},
});
*/
