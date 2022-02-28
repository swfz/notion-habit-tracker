import {Client, LogLevel } from "@notionhq/client";
import {CreateDatabaseResponse, CreatePageResponse} from "@notionhq/client/build/src/api-endpoints";
import * as holidayJp from '@holiday-jp/holiday_jp';
import * as dayjs from 'dayjs';

// ts-node app.ts [startdate] [enddate]

type DayType = 'Weekday'|'Everyday'|'Holiday'|'Sun'|'Mon'|'Thu'|'Wed'|'Thu'|'Fri'|'Sat'
type HabitConfig = {
  identifier: string;
  name: string;
  relationType: DayType[]
}

const notion = new Client({
  logLevel: LogLevel.DEBUG,
  auth: process.env.NOTION_TOKEN
});

const habits: HabitConfig[] = [
  {identifier: 'stepper', name: '平日ステッパー10分踏む', relationType: ['Weekday']},
  {identifier: 'plank',   name: '毎日プランク60秒', relationType: ['Everyday']},
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

const insertTrackerRecords = async(database: CreateDatabaseResponse, start: string, end: string) => {
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
    const record = await notion.pages.create(params);
    records.push(record);
  }

  return records;
}

const createAchieveDatabase = async(pageId: string, tracker: CreateDatabaseResponse) => {
  // relation
  // count
  // rollup
  // formula
  const calcFields = (habit: HabitConfig) => {
    return {
      [`checked-${habit.identifier}`]: {
        rollup: {
          rollup_property_name: habit.name,
          relation_property_name: 'HabitTracks',
          function: 'checked'
        }
      },
      [`result-${habit.identifier}`]: {
        rollup: {
          rollup_property_name: habit.name,
          relation_property_name: 'HabitTracks',
          function: 'percent_checked'
        }
      },
    }
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
      HabitTracks: {
        relation: {
          database_id: tracker.id
        }
      },
      'past-days': {
        rollup: {
          rollup_property_name: 'past',
          relation_property_name: 'HabitTracks',
          function: 'checked'
        }
      },
      ...additionalProperties
    }
  });
  console.log(database);

  return database;
}

const updateAchieveDatabase = async(database: CreateDatabaseResponse) => {
  const calcFields = (habit: HabitConfig) => {
    return {
      [`result-by-day-${habit.identifier}`]: {
        formula: {
          expression: `prop("checked-${habit.identifier}") / prop("past-days")`
        }
      }
    }
  }

  const additionalProperties = habits.reduce((props, habit) => {
    return {...props, ...calcFields(habit)}
  }, {});

  const resultExpression = habits.reduce((exp, habit, i, arr) => {
    if(i === 0) {
      return `prop("result-${habit.identifier}")`
    }
    else {
      return `if(contains(prop("name"), "${habit.name}"), prop("result-${habit.identifier}"), ${exp})`;
    }
  }, '');

  const resultByDayExpression = habits.reduce((exp, habit, i, arr) => {
    if(i === 0) {
      return `prop("result-by-day-${habit.identifier}")`
    }
    else {
      return `if(contains(prop("name"), "${habit.name}"), prop("result-by-day-${habit.identifier}"), ${exp})`;
    }
  }, '');

  await notion.databases.update({
    database_id: database.id,
    properties: {
      Result: {
        formula: {
          expression: resultExpression
        }
      },
      ResultByDay: {
        formula: {
          expression: resultByDayExpression
        }
      },
      ...additionalProperties
    }
  })
}

const insertAchieveRecords = async(database: CreateDatabaseResponse, trackerRecords: CreatePageResponse[]) => {
  console.log('tracker recoreds------------------------------------');
  console.log(trackerRecords);
  console.log('tracker recoreds------------------------------------');

  const recordParams = habits.map(habit => {
    const relationRecords = habit.relationType.includes('Everyday')
      ? trackerRecords
      : trackerRecords.filter(r => {
        console.log(r);
        return habit.relationType.some(dayType => {
          if (['Weekday', 'Holiday'].includes(dayType)) {
            return r.properties.day.select.name === dayType
          }
          else {
            // 暫定
            return false;
          }
        });
    });

    const relationIds = relationRecords.map(r => ({id: r.id}));

    console.log('relation ids ------------------------------------');
    console.log(relationIds);

    return {
      parent: {
        database_id: database.id,
      },
      properties: {
        name: {
          title: [{text: {content: habit.name}}]
        },
        HabitTracks: {
          relation: relationIds
        }
      }
    }
  });

  const records = [];
  for (const params of recordParams) {
    console.log('params -- - - - - - - -- - -');
    console.log(params);
    const record = await notion.pages.create(params);
    records.push(record);
  }

  return records;
}

const main = async(startDate, endDate) => {
  const pageId = process.env.NOTION_PAGE_ID;
  console.log(pageId);

  if (!pageId) {
    return;
  }

  const tracker = await createTrackerDatabase(pageId);
  const trackerRecords = await insertTrackerRecords(tracker, startDate, endDate);

  const achieve = await createAchieveDatabase(pageId, tracker);
  await updateAchieveDatabase(achieve);
  const achieveRecords = await insertAchieveRecords(achieve, trackerRecords);
}


(async () => {
  const startDate = process.argv[2];
  const endDate = process.argv[3];

  main(startDate, endDate);
})();
