require('dotenv').config();

const {Client} = require('@notionhq/client');
const date = require('date-fns');
const tz = require('date-fns-tz');
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');

// TODO: Escalar a aplicação pra um uso mais generalizado
// TODO: Testar na main

const checkDoneField = 'Ok?';
const dateField = 'Data';
const dailyMarker = 'Daily';
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

const addDay = (ISOdate, hasHours) => {
    const formattedDate = formatTimeZone(ISOdate);
    let updatedDate = date
        .addDays(formattedDate, 1)
        .toISOString()
        .toString()
        .substring(0, 10);

    if (hasHours) {
        const cardHours = formatDateToTwoString(date.getHours(cardDate));
        const cardMinutes = formatDateToTwoString(date.getMinutes(cardDate));
        updatedDate += `T${cardHours}:${cardMinutes}:00.000-03:00`;
    }
    return updatedDate;
};

const uncheckAndNextDay = (updatedDate) => {
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

const nextDay = (updatedDate) => {
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

const dailyTask = async () => {
    try {
        const {results} = await notion.request({
            path: `databases/${databaseID}/query`,
            method: 'POST',
        });
        for (const card of results) {
            if (card.properties[dateField]) {
                const cardDate = date.parseISO(
                    card.properties[dateField]?.date.start
                );

                const isDaily = card.properties[dailyMarker].checkbox;
                const isChecked = card.properties[checkDoneField].checkbox;
                const isToday = date.isToday(cardDate);
                const hasPassed = date.isBefore(cardDate, date.startOfToday());
                const hasHours = card.properties.Data.date.start.length > 10;

                // if (isDaily && isToday) {
                if (isDaily && isToday) {
                    if (isChecked) {
                        let updatedDate = addDay(cardDate, hasHours);
                        await notion.pages.update({
                            page_id: card.id,
                            properties: uncheckAndNextDay(updatedDate),
                        });
                    } else {
                        // Send alert and pass to next day
                        let updatedDate = addDay(cardDate, hasHours);
                        await notion.pages.update({
                            page_id: card.id,
                            properties: nextDay(updatedDate),
                        });
                    }
                }
            }
        }
    } catch (err) {
        console.log(error);
    }
};

cron.schedule('55 23 * * *' ,() => {
    console.log(new Date().toLocaleString());
    dailyTask();
})

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
