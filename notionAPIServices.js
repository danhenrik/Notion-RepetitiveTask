const {Client} = require('@notionhq/client');
const DateService = require('./DateService');

const notionCheckbox = process.env.CHECKBOX_FIELD;
const notionDate = process.env.DATE_FIELD;
const notionTitle = process.env.TITLE_FIELD;
const notionRepetitive = process.env.REPETITIVE_FIELD;
const notionDatabaseURL = process.env.DATABASE_URL;
const notionDatabaseID = process.env.DATABASE_ID;

const parseSharedURL = (URL) => URL?.split('?')[0].split('so/')[1];

function uncheckAndNextOcurrency(updatedDate) {
  return JSON.parse(
    `{
      "${notionCheckbox}": {
        "checkbox": false
      },
      "${notionDate}": {
        "date": {
          "start": "${updatedDate}"
        }
      }
    }`
  );
}
class NotionService {
  #notion;
  constructor() {
    this.#notion = new Client({
      auth: process.env.TOKEN,
    });
  }

  // Creates a page with telling you that you didn't your task the day before.
  async createAlert(card) {
    const alertDate = DateService.addDay(new Date().toISOString(), false, 0);
    await this.#notion.pages.create({
      parent: card.parent,
      properties: JSON.parse(
        `{
          "${notionTitle}": {
            "title": [
              {
                "text": {
                  "content": "${card.properties[notionTitle].title[0].text.content} was't done yesterday"
                }
              } 
            ]
          },
          "${notionDate}": {
            "date": {
              "start": "${alertDate}"
            }
          }
        }`
      ),
    });
  }

  async handleImcompleteTask(card, cardDate, hasHours, daysAmount) {
    let updatedDate = DateService.addDay(cardDate, hasHours, daysAmount);
    await this.updateCard(card, updatedDate);
    await this.createAlert(card);
  }

  async updateCard(card, updatedDate) {
    await this.#notion.pages.update({
      page_id: card.id,
      properties: uncheckAndNextOcurrency(updatedDate),
    });
  }

  async queryDB() {
    const response = await this.#notion.databases.query({
      database_id: parseSharedURL(notionDatabaseURL) || notionDatabaseID,
      filter: {
        and: [
          {
            property: notionRepetitive,
            select: {
              is_not_empty: true,
            },
          },
          {
            property: notionDate,
            date: {
              is_not_empty: true,
            },
          },
        ],
      },
    });
    return response;
  }
}

module.exports = new NotionService();
