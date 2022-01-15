import {Client, } from "@notionhq/client";
import { createDatabase, CreateDatabaseParameters,CreateDatabaseResponse, getDatabase } from "@notionhq/client/build/src/api-endpoints";
import * as holidayJp from '@holiday-jp/holiday_jp';
import * as dayjs from 'dayjs';

// ts-node app.ts [startdate] [enddate]

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});


// const habits = [
//   {name: '平日ステッパー', relation: 'Weekday'},
//   {name: 'プランク60秒', relation: 'Everyday'},
// ];

const trackerPropertiesBase = {
      name: {
        title: {}
      },
      date: {
        date: {}
      },
      dayOfTheWeek: {
        select: {
          options: [
            {name: 'Sun', color: "red"},
            {name: 'Mon', color: "green"},
            {name: 'Thu', color: "yellow"},
            {name: 'Wed', color: "brown"},
            {name: 'Thu', color: "purple"},
            {name: 'Fri', color: "pink"},
            {name: 'Sat', color: "blue"}
          ]
        }
      },
      day: {
        select: {
          options: [
            {name: 'Weekday', color: "orange"},
            {name: 'Holiday', color: "blue"}
          ]
        }
      }
    };
// const trackerDatabaseParameter = (args: any):CreateDatabaseParameters => {
  // base
  // オプショナルを設定
// }

const createTrackerDatabase = async(pageId: string) => {
  const database = await notion.databases.create({
    title: [{text: {content: 'sample database From Notion JavaScript Client'}}],
    parent: {
      type: "page_id",
      page_id: pageId
    },
    properties: {
      name: {
        title: {}
      },
      date: {
        date: {}
      },
      dayOfTheWeek: {
        select: {
          options: [
            {name: 'Sun', color: "red"},
            {name: 'Mon', color: "green"},
            {name: 'Thu', color: "yellow"},
            {name: 'Wed', color: "brown"},
            {name: 'Thu', color: "purple"},
            {name: 'Fri', color: "pink"},
            {name: 'Sat', color: "blue"}
          ]
        }
      },
      day: {
        select: {
          options: [
            {name: 'Weekday', color: "orange"},
            {name: 'Holiday', color: "blue"}
          ]
        }
      },
      past: {
        formula: {
          expression: "prop(\"date\") < now()"
        }
      }
    }
  });
  console.log(database);

  return database;
}

const trackerRecordsParams = () => {

}

const insertTrackerRecords = (notion: Client, database: CreateDatabaseResponse, start: string, end: string) => {

  const startDate = dayjs(start)
  const endDate = dayjs(end)
  const days = endDate.diff(start, 'day');
  const holidays = holidayJp.between(new Date(start), new Date(end));

  const isHoliday = (holidays, date): boolean => {

    if (['Sun', 'Sat'].includes(date.format('ddd'))) {
      return true;
    }

    if (holidays.map(h => dayjs(h.date)).some(h => h.isSame(date, 'day'))){
      return true;
    }

    return false;
  }

  const recordParams = [...Array(days)].map((_, i) => {
    const targetDate = startDate.add(i, 'day');
    const dayOfTheWeek = targetDate.format('ddd');
    const day = isHoliday(holidays, targetDate) ? 'Holiday' : 'Weekday';

    return {
      parent: {
        database_id: database.id,
      },
      properties: {
        name: {
          title: [{text: {content: targetDate.format('YYYYMMDD')}}]
        },
        date: {
          date: {
            start: targetDate.format('YYYY-MM-DD')
          }
        },
        dayOfTheWeek: {
          select: {
            name: dayOfTheWeek
          }
        },
        day: {
          select: {
            name: day
          }
        }
      }
    }
  });

  for (const params of recordParams) {
    notion.pages.create(params)
  }

  console.log(recordParams);

  console.log(holidays);
}

const achieveDatabaseParameter = () => {
  //base
  // オプショナルを設定
}


const insertAchieveRecords = () => {

}

const main = async(startDate, endDate) => {
  const pageId = process.env.NOTION_PAGE_ID;
  console.log(pageId);

  if (!pageId) {
    return;
  }

  const tracker = await createTrackerDatabase(pageId);
  insertTrackerRecords(notion, tracker, startDate, endDate);
}


(async () => {
  const startDate = process.argv[2];
  const endDate = process.argv[3];

  main(startDate, endDate);
})();
