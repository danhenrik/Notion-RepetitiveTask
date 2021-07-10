require('dotenv').config();

const date = require('date-fns');

const shell = require('shelljs');
const path = require('path');
const os = require('os');
const fs = require('fs');

const dateService = require('./dateService');
const notionAPI = require('./notionAPIServices');

const requirements = [
  'TOKEN',
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

if (
  os.type().toLowerCase().includes('windows') &&
  !fs.existsSync('Notion-repetitive.bat')
) {
  fs.writeFileSync(
    'Notion-repetitive.bat',
    `cd "${path.resolve(__dirname)}"
    node index.js`
  );
  shell.echo(
    "Schedule the .bat file on your task scheduler so you don't have to worry about it."
  );
} else if (
  os.type().toLowerCase().includes('darwin') &&
  !fs.existsSync('Notion-repetitive.sh')
) {
  fs.writeFileSync(
    'Notion-repetitive.sh',
    `cd "${path.resolve(__dirname)}"
    node index.js`
  );
  shell.echo(
    "Schedule the .sh file on your task scheduler so you don't have to worry about it."
  );
}

async function main() {
  try {
    const response = await notionAPI.queryDB();

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
      console.log(card.properties.Nome.title[0].text.content);
      const cardDate = date.parseISO(
        card.properties[process.env.DATE_FIELD].date.start
      );
      const repetitive =
        card.properties[process.env.REPETITIVE_FIELD].select.name.toLowerCase();

      if (card.properties.Nome.title[0].text.content == 'Fazer caminhada') {
        console.log(repetitive);
      }

      const isChecked = card.properties[process.env.CHECKBOX_FIELD].checkbox;
      const isToday = date.isYesterday(cardDate);
      const hasHours =
        card.properties[process.env.DATE_FIELD].date.start.length > 10;

      if (isToday) {
        switch (repetitive) {
          case 'daily':
            if (isChecked) {
              let updatedDate = dateService.addDay(cardDate, hasHours, 1);
              await notionAPI.updateCard(card, updatedDate);
              console.warn(
                `Changed ${
                  card.properties[process.env.TITLE_FIELD].title[0].text.content
                } (daily task) to next occurency`
              );
            } else {
              await notionAPI.handleImcompleteTask(card, cardDate, hasHours, 1);
            }
            break;
          case 'weekly':
            if (isChecked) {
              let updatedDate = dateService.addDay(cardDate, hasHours, 7);
              await notionAPI.updateCard(card, updatedDate);
              console.warn(
                `Changed ${
                  card.properties[process.env.TITLE_FIELD].title[0].text.content
                } (weekly task) to next occurency`
              );
            } else {
              await notionAPI.handleImcompleteTask(card, cardDate, hasHours, 7);
            }
            break;
          case 'every other day':
            if (isChecked) {
              let updatedDate = dateService.addDay(cardDate, hasHours, 2);
              await notionAPI.updateCard(card, updatedDate);
              console.warn(
                `Changed ${
                  card.properties[process.env.TITLE_FIELD].title[0].text.content
                } (Every other day task) to next occurency`
              );
            } else {
              await notionAPI.handleImcompleteTask(card, cardDate, hasHours, 2);
            }
            break;
          case 'monthly':
            (async () => {
              let updatedDate = dateService.addMonth(cardDate, hasHours);
              if (isChecked) {
                await notionAPI.updateCard(card, updatedDate);
                console.warn(
                  `Changed ${
                    card.properties[process.env.TITLE_FIELD].title[0].text
                      .content
                  } (Monthly) task to next week`
                );
              } else {
                await notionAPI.updateCard(card, updatedDate);
                await notionAPI.createAlert(card);
              }
            })();
            break;
          case 'weekdays':
            (async () => {
              let updatedDate;
              if (cardDate.getDay() < 5) {
                updatedDate = dateService.addDay(cardDate, hasHours, 1);
              } else {
                updatedDate = dateService.addDay(cardDate, hasHours, 3);
              }
              console.log(updatedDate);
              if (isChecked) {
                await notionAPI.updateCard(card, updatedDate);
                console.warn(
                  `Changed ${
                    card.properties[process.env.TITLE_FIELD].title[0].text
                      .content
                  } (Weekday) task to next week`
                );
              } else {
                await notionAPI.updateCard(card, updatedDate);
                await notionAPI.createAlert(card);
              }
            })();
        }
      }
    }
  } catch (err) {
    console.warn(err);
  }
}
main();
