const {Client} = require('@notionhq/client');
const dateService = require('./dateService');

function uncheckAndNextOcurrency(updatedDate) {
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
}

const parseSharedURL = (URL) => URL?.split('?')[0].split('so/')[1];

class notionService {
  #notion;
  constructor() {
    this.#notion = new Client({
      auth: process.env.TOKEN,
      logLevel: 'debug',
    });
  }

  // Creates a page with telling you that you didn't your task the day before.
  async createAlert(card) {
    const alertDate = dateService.addDay(new Date().toISOString(), false, 0);
    await this.#notion.pages.create({
      parent: card.parent,
      properties: JSON.parse(
        `{
          "${process.env.TITLE_FIELD}": {
            "title": [
              {
                "text": {
                  "content": "${
                    card.properties[process.env.TITLE_FIELD].title[0].text
                      .content
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
  }

  async handleImcompleteTask(card, cardDate, hasHours, daysAmount) {
    let updatedDate = dateService.addDay(cardDate, hasHours, daysAmount);
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
      database_id: parseSharedURL(process.env.DATABASE_URL) || process.env.DATABASE_ID,
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
    return response;
  }
}

module.exports = new notionService();
