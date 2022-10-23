# Notion Habit Tracker

https://swfz.notion.site/2e74942314234651bc3a5eb53cac6b47

上記をスクリプトで生成する

- config.json(例)

```json
{
    "habits": [
        {"identifier": "stepper", "name": "ステッパー15分踏む", "relationType":["Weekday"]}
        .....
        .....
    ]
}
```

- 環境変数

| environment | description |
|:-|:-|
| NOTION_TOKEN | NotionのAPIトークン |
| NOTION_PAGE_ID | 生成したテーブルなどを追加するページのID |


```shell
yarn ts-node app.ts 2022-01-01 2022-01-31
```

※2022-02-02時点ではNotionのAPIの仕様上rollupの設定を再度GUIから行わないと結果が反映されない
