require('dotenv').config();

const {Client} = require('@notionhq/client');
const date = require('date-fns');
const tz = require('date-fns-tz');
const fs = require('fs');
const path = require('path');
const shell = require('shelljs');
const os = require('os');

if (os.type().toLowerCase().includes('windows')) {
  if (!fs.existsSync('Notion-repetitive.bat')) {
    console.log('criou');
    fs.writeFileSync(
      'Notion-repetitive.bat',
      `cd "${path.resolve(__dirname)}"
  node index.js`
    );
  }
  shell.echo(
    "Schedule the .bat file on your task scheduler so you don't have to worry about it."
  );
} else if (os.type().toLowerCase().includes('darwin')) {
  if (!fs.existsSync('Notion-repetitive.sh')) {
    console.log('criou');
    fs.writeFileSync(
      'Notion-repetitive.sh',
      `cd "${path.resolve(__dirname)}"
    node index.js`
    );
  }
  shell.echo(
    "Schedule the .sh file on your task scheduler so you don't have to worry about it."
  );
}

const requirements = [
  'TOKEN',
  'DATABASE_URL',
  'TITLE_FIELD',
  'DATE_FIELD',
  'CHECKBOX_FIELD',
  'REPETITIVE_FIELD',
  'TZ',
];
requirements.forEach((req) => {
  if (!process.env[req]) {
    console.error(
      `Couldn't find ${req} on .env file, please make sure to fill the .env variables with the right values.`
    );
    process.exit();
  }
});

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
  const timezone = process.env.TZ;
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
      "${process.env.CHECKBOX_FIELD}": {
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
                "content": "${
                  card.properties[process.env.TITLE_FIELD].title[0].text.content
                } was't done yesterday"
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

const handleImcompleteTask = async (card, cardDate, hasHours, daysAmount) => {
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
    const response = await notion.databases.query({
      database_id: databaseID,
      filter: {
        and: [
          {
            property: process.env.REPETITIVE_FIELD,
            select: {
              is_not_empty: true,
            },
          },
          {
            property: process.env.DATE_FIELD,
            date: {
              is_not_empty: true,
            },
          },
        ],
      },
    });

    const results = response.results;
    if (response.has_more) {
      let Res = response;
      while (Res.has_more) {
        Res = await notion.databases.query({
          database_id: databaseID,
          start_cursor: Res.next_cursor,
        });
        results.push(...Res.results);
      }
    }

    for (const card of results) {
      const cardDate = date.parseISO(
        card.properties[process.env.DATE_FIELD].date.start
      );
      const repetitive =
        card.properties[process.env.REPETITIVE_FIELD].select.name.toLowerCase();

      const isChecked = card.properties[process.env.CHECKBOX_FIELD].checkbox;
      const isToday = date.isYesterday(cardDate);
      const hasHours =
        card.properties[process.env.DATE_FIELD].date.start.length > 10;

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
                `Changed ${
                  card.properties[process.env.TITLE_FIELD].title[0].text.content
                } (daily task) to next occurency`
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
                `Changed ${
                  card.properties[process.env.TITLE_FIELD].title[0].text.content
                } (weekly task) to next occurency`
              );
            } else {
              await handleImcompleteTask(card, cardDate, hasHours, 7);
            }
            break;
          case 'every other day':
            if (isChecked) {
              let updatedDate = addDay(cardDate, hasHours, 2);
              await notion.pages.update({
                page_id: card.id,
                properties: uncheckAndNextOcurrency(updatedDate),
              });
              console.log(
                `Changed ${
                  card.properties[process.env.TITLE_FIELD].title[0].text.content
                } (Every other day task) to next occurency`
              );
            } else {
              await handleImcompleteTask(card, cardDate, hasHours, 2);
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
                `Changed ${
                  card.properties[process.env.TITLE_FIELD].title[0].text.content
                } monthly task to next week`
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
  } catch (err) {
    console.log(err);
  }
};
repetitiveTask();
