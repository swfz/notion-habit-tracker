import {Client, } from "@notionhq/client";
import { createDatabase, CreateDatabaseParameters,CreateDatabaseResponse, getDatabase } from "@notionhq/client/build/src/api-endpoints";
import * as holidayJp from '@holiday-jp/holiday_jp';
import * as dayjs from 'dayjs';

// ts-node app.ts [startdate] [enddate]

type DayType = 'Weekday'|'Everyday'|'Holiday'|'Sun'|'Mon'|'Thu'|'Wed'|'Thu'|'Fri'|'Sat'
type HabitConfig = {
  identifier: string;
  name: string;
  relation: DayType[]
}

const notion = new Client({
  auth: process.env.NOTION_TOKEN
});

const habits: HabitConfig[] = [
  {identifier: 'stepper', name: '平日ステッパー10分踏む', relation: ['Weekday']},
  {identifier: 'plank',   name: '毎日プランク60秒', relation: ['Everyday']},
];

const createTrackerDatabase = async(pageId: string) => {
  const additionalProperties = habits.reduce((props, habit) => {
    return {...props, ...{[habit.name]: { checkbox: {}, type: 'checkbox'}}}
  }, {});

  const database = await notion.databases.create({
    title: [{text: {content: 'Habit Track'}}],
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
      },
      ...additionalProperties
    }
  });
  console.log(database);

  return database;
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

  const records = [];
  for (const params of recordParams) {
    records.push(notion.pages.create(params));
  }

  return records;
}

const createAchieveDatabase = async(pageId: string, tracker: CreateDatabaseResponse) => {
  // relation
  // count
  // rollup
  // formula
  const calcFields = (habit: HabitConfig) => {
    return {}
  }

  const additionalProperties = habits.reduce((props, habit) => {
    return {...props, ...calcFields(habit)}
  }, {});

  const database = await notion.databases.create({
    title: [{text: {content: 'Habit Track(Achieve)'}}],
    parent: {
      type: "page_id",
      page_id: pageId
    },
    properties: {
      name: {
        title: {}
      },
      achieve: {
        formula: {
          expression: "now()"
        }
      },
      achieveByToday: {
        formula: {
          expression: "now()"
        }
      },
      HabitTracks: {
        relation: {
          database_id: tracker.id
        }
      },
      ...additionalProperties
    }
  });
  console.log(database);

  return database;
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
  const trackerRecords = insertTrackerRecords(notion, tracker, startDate, endDate);

  const achieve = await createAchieveDatabase(pageId, tracker);
  // insertAchieveRecords()
}


(async () => {
  const startDate = process.argv[2];
  const endDate = process.argv[3];

  main(startDate, endDate);
})();
