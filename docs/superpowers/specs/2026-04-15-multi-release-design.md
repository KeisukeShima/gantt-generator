# マルチリリース対応 設計ドキュメント

## 概要

WBSプランナーに複数リリースのサポートを追加する。各リリースは独立した開始日・締め切り日を持ち、担当者はプロジェクト全体で共有される。アイテムタブでリリースを追加・管理でき、単一ガントチャート上にリリース見出し行として表示される。

---

## データモデル

### 新しい `DEFAULT_CONFIG` 構造

```js
{
  // プロジェクト共通設定（変更なし）
  projectName: '新規プロジェクト',
  ganttUnit: 'weeks',
  holidays: { national: [...], company: [] },
  phaseTypes: [...],
  people: [...],

  // 新規: リリース配列（旧 items / releaseDate / epicKey などを内包）
  releases: [
    {
      id: 'r1',                          // 一意ID（nanoid風の短い文字列）
      name: 'リリースA',
      color: '#6D28D9',                  // 識別色（ガント見出し・凡例に使用）
      startDate: '2026-04-01',           // このリリースの作業開始日
      releaseDate: '2026-07-31',         // 締め切り日（📦マーク位置）
      evalPeriod: { value: 4, unit: 'weeks' },
      showEvalZone: true,
      evalZone: { label: 'リリース評価', color: '#8B5CF6' },
      epicKey: 'PROJ-1',                 // JIRAエpicキー（任意）
      items: [
        {
          name: '車両テスト',
          category: '',
          note: '',
          phases: [
            { type: '要件定義', days: 5 },
            { type: '設計開発', days: 10 }
          ]
        }
      ]
    }
  ]
}
```

### 削除されるトップレベルフィールド

| 削除フィールド | 移動先 |
| --- | --- |
| `items` | `releases[i].items` |
| `releaseDate` | `releases[i].releaseDate` |
| `evalPeriod` | `releases[i].evalPeriod` |
| `showEvalZone` | `releases[i].showEvalZone` |
| `evalZone` | `releases[i].evalZone` |
| `epicKey` | `releases[i].epicKey` |

`startDate` はプロジェクト共通のデフォルト値として残す（新規リリース追加時のデフォルト開始日として使用）。

### 旧JSONの自動マイグレーション（`loadConfig()` で対応）

旧形式（トップレベルに `items` が存在する）を検出した場合、以下のように自動変換する：

```js
if (c.items && !c.releases) {
  c.releases = [{
    id: genId(),
    name: 'リリース1',
    color: '#6D28D9',
    startDate: c.startDate,
    releaseDate: c.releaseDate ?? '',
    evalPeriod: c.evalPeriod ?? { value: 4, unit: 'weeks' },
    showEvalZone: c.showEvalZone ?? true,
    evalZone: c.evalZone ?? { label: 'リリース評価', color: '#8B5CF6' },
    epicKey: c.epicKey ?? '',
    items: c.items,
  }];
  delete c.items;
  delete c.releaseDate;
  delete c.evalPeriod;
  delete c.showEvalZone;
  delete c.evalZone;
  delete c.epicKey;
}
```

---

## スケジュールエンジン（`runSchedule()`）

### 変更の方針

基本ロジック（日次ループ・担当者割当）はそのまま維持する。変わるのは入出力の構造のみ。

### 入力

```text
C.releases（全リリース）, C.people, C.holidays, C.startDate
```

### 処理

1. 全リリースのアイテムをフラットなタスクリストに展開
   - 各タスクに `releaseId`、そのリリースの `releaseStartDate`、`evalStart` を付与
   - `evalStart` = `releaseDate` から `evalPeriod` を逆算した営業日

2. 現在と同じ日次スケジューリングループで全タスクを一括処理
   - 担当者の空き状況はリリースをまたいで管理（共有プール）
   - タスクの優先順位：リリース配列の順番 → アイテム順 → フェーズ順
   - リリースAのタスクとリリースBのタスクが同一人物に競合した場合、リリース配列の先頭（インデックスが小さい）を優先してスケジュールする
   - タスクの開始制約は `releaseStartDate` または `fixedStart` を使用

3. 警告チェック：タスクの `endDate` が対応するリリースの `evalStart` を超えたら警告

### 出力

```js
{
  tasks,    // 全リリースのタスク（releaseId タグ付き）
  releases, // [{ id, name, color, evalStart, evalEnd(=releaseDate) }]
  warnings,
  hols
}
```

---

## UI変更

### ① アイテムタブ

現在のフラットなアイテムリストを、リリースを親とする階層構造に変更する。

**表示構造：**

```text
[＋ リリース追加]

▼ リリースA  2026/04/01〜07/31  [編集] [削除]
  ├ 1. 車両テスト           [編集] [削除]
  ├ 2. ベンチテスト          [編集] [削除]
  └ [＋ アイテム追加（リリースA）]

▼ リリースB  2026/06/01〜10/31  [編集] [削除]
  ├ 1. レポート作成          [編集] [削除]
  └ [＋ アイテム追加（リリースB）]
```

**リリース追加フォーム（インライン展開）：**

- リリース名
- 識別色（カラーピッカー）
- 開始日
- リリース日（締め切り）
- 評価ゾーン表示（チェックボックス + ラベル + 色）
- 評価期間（数値 + 単位）

**アイテム追加フォーム：** 現在と同じ（所属リリースは文脈から決まるため入力不要）

### ② ガントチャート（`renderGantt()`）

**行レイアウト（上から）：**

1. ヘッダー行（時間軸）
2. リリース見出し行（識別色背景、リリース名と期間を表示）
3. アイテム見出し行（現在と同じ太字グレー行）
4. 工程行（現在と同じ）
5. 次のリリース見出し行
6. …

**評価ゾーン：** 各リリースの `evalStart`〜`releaseDate` の範囲に、そのリリース固有の色でオーバーレイを描画。リリース日に📦アイコンを表示。

**高さ計算：**

```text
totalH = HDR_H + Σ(リリースごとの見出し行高 + アイテム行高の合計)
```

### ③ プロジェクト設定タブ

削除する入力欄：

- 開始日（リリースごとに設定するため不要に → 新規リリースのデフォルトとして `startDate` は残す）
- リリース日
- 評価ゾーン設定（evalPeriod / showEvalZone / evalZone）

`startDate` は「デフォルト開始日」として残し、新規リリース追加時の初期値として使用する。

### ④ JIRAタブ

- 現在の「JIRA Epic キー」入力欄を削除
- 各リリースの編集フォームに `Epic キー` 欄を追加
- 「JIRA に登録」ボタンは全リリースをまとめて処理（リリースごとに対応するEpicに紐付け）
- 必須フィールド設定・課題タイプ設定はプロジェクト共通のまま維持

---

## JIRA登録フロー（`pushToJira()`）

```text
for each release in C.releases:
  epicKey = release.epicKey
  for each item in release.items:
    POST /issue  (issuetype: Task, Epic Link: epicKey)
    taskKey = response.key
    for each phase task in scheduled tasks:
      POST /issue  (issuetype: Sub-task, parent: taskKey)
```

---

## 実装スコープ外（今回は対応しない）

- リリース間の依存関係（あるリリースが終わったら次のリリースを開始、など）
- リリースごとの担当者制限（今回は全リリース共有のみ）
- リリースの並び替え（ドラッグ＆ドロップ）

---

## リリースIDの生成

短い一意IDを生成する軽量関数を追加する：

```js
function genId() {
  return Math.random().toString(36).slice(2, 8);
}
```

---

## 後方互換

- 旧JSONを読み込んだ場合、自動的に「リリース1」として1件のリリースに変換する
- 旧JSONに `items` がある場合のみマイグレーションを実行する
- 変換後は新形式で `localStorage` に保存する
