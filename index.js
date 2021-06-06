require('dotenv').config();

const {Client} = require('@notionhq/client');
const date = require('date-fns');
const tz = require('date-fns-tz');
const cron = require('node-cron');

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

const addMonth = (ISOdate, hasHours) => {
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
      "${process.env.CHECKED_FIELD}": {
        "checkbox": false
      },
      "${process.env.DATE_FIELD}": {
        "date": {
          "start": "${updatedDate}"
        }
      }
    }`
  );
};

// Creates a page with telling you that you didn't your task the day before
const createAlert = async (card) => {
  const alertDate = addDay(new Date().toISOString(), false, 0);
  await notion.pages.create({
    parent: card.parent,
    properties: JSON.parse(
      `{
        "${process.env.TITLE_FIELD}": {
          "title": [
            {
              "text": {
                "content": "${card.properties.Nome.title[0].text.content} was't done yesterday"
              }
            } 
          ]
        },
        "${process.env.DATE_FIELD}": {
          "date": {
            "start": "${alertDate}"
          }
        }
      }`
    ),
  });
};

const handleImcompleteTask = async (card, hasHours, daysAmount) => {
  let updatedDate = addDay(cardDate, hasHours, daysAmount);
  await notion.pages.update({
    page_id: card.id,
    properties: JSON.parse(
      `{
        "${process.env.DATE_FIELD}": {
          "date": {
            "start": "${updatedDate}"
          }
        }
      }`
    ),
  });
  await createAlert(card);
};

const repetitiveTask = async () => {
  try {
    const databaseID = parseSharedURL(process.env.DATABASE_URL);
    const {results} = await notion.request({
      path: `databases/${databaseID}/query`,
      method: 'POST',
    });
    for (const card of results) {
      if (card.properties[process.env.DATE_FIELD] && card.properties[process.env.REPETITIVE_FIELD]) {
        const cardDate = date.parseISO(card.properties[process.env.DATE_FIELD]?.date.start);
        const repetitive =
          card.properties[process.env.REPETITIVE_FIELD].select.name.toLowerCase();

        const isChecked = card.properties[process.env.CHECKED_FIELD].checkbox;
        const isToday = date.isYesterday(cardDate);
        const hasHours = card.properties.Data.date.start.length > 10;

        if (isToday) {
          switch (repetitive) {
            case 'daily':
              if (isChecked) {
                let updatedDate = addDay(cardDate, hasHours, 1);
                await notion.pages.update({
                  page_id: card.id,
                  properties: uncheckAndNextOcurrency(updatedDate),
                });
                console.log(
                  `Changed ${card.properties[process.env.TITLE_FIELD].title[0].text.content} daily task to next day`
                );
              } else {
                await handleImcompleteTask(card, cardDate, hasHours, 1);
              }
              break;
            case 'weekly':
              if (isChecked) {
                let updatedDate = addDay(cardDate, hasHours, 7);
                await notion.pages.update({
                  page_id: card.id,
                  properties: uncheckAndNextOcurrency(updatedDate),
                });
                console.log(
                  `Changed ${card.properties[process.env.TITLE_FIELD].title[0].text.content} weekly task to next week`
                );
              } else {
                await handleImcompleteTask(card, cardDate, hasHours, 7);
              }
              break;
            case 'monthly':
              let updatedDate = addMonth(cardDate, hasHours);
              if (isChecked) {
                await notion.pages.update({
                  page_id: card.id,
                  properties: uncheckAndNextOcurrency(updatedDate),
                });
                console.log(
                  `Changed ${card.properties[process.env.TITLE_FIELD].title[0].text.content} monthly task to next week`
                );
              } else {
                await notion.pages.update({
                  page_id: card.id,
                  properties: JSON.parse(
                    `{
                      "${process.env.DATE_FIELD}": {
                        "date": {
                          "start": "${updatedDate}"
                        }
                      }
                    }`
                  ),
                });
                await createAlert(card);
              }
              break;
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
