# JIRA 開始日フィールド選択機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** JIRA登録時に使用する開始日フィールドを、「フィールド取得」ボタンで取得した日付型フィールドから選択できるようにする。

**Architecture:** `jc.startDateFieldId` を動的キーとして使いフィールド名を可変にする。`tests/lib/jira.js` のビルダー関数を先にTDDで更新し、続けて `wbs-planner.html` の UI・設定・送信ロジックを更新する。

**Tech Stack:** Vanilla JS (ES modules), Vitest (unit tests)

---

## File Map

| ファイル | 変更内容 |
|---|---|
| `tests/lib/jira.js` | `buildTaskBody` / `buildSubTaskBody` で `startDate` 固定キーを `jc.startDateFieldId` 動的キーに変更 |
| `tests/unit/jira.test.js` | `baseJC` に `startDateFieldId: 'startDate'` を追加、新テストを追加 |
| `wbs-planner.html` | `DEFAULT_JIRA_CONFIG` 拡張、開始日フィールド選択UI追加、`loadFieldsForSelected()` 拡張、`pushToJira()` の動的キー対応 |

---

## Task 1: `buildTaskBody` / `buildSubTaskBody` を動的キー対応にする（TDD）

**Files:**
- Modify: `tests/unit/jira.test.js:181`
- Modify: `tests/lib/jira.js:90` and `tests/lib/jira.js:120`
- Modify: `tests/unit/jira.test.js` （新テスト追加）

- [ ] **Step 1: `baseJC` に `startDateFieldId` を追加する**

`tests/unit/jira.test.js` の 181 行目を以下に変更する（`startDateFieldId: 'startDate'` を追加することで既存テストが引き続きパスするようにする）：

```js
const baseJC = { projectKey: 'PROJ', issueTypeName: 'Task', customFields: [], startDateFieldId: 'startDate' };
```

- [ ] **Step 2: 失敗するテストを `describe('buildTaskBody', ...)` の末尾に追加する**

```js
  it('uses startDateFieldId as the JIRA field key for start date', () => {
    const jc    = { ...baseJC, startDateFieldId: 'customfield_10015' };
    const tasks = [{ ...basePhaseTask, startDate: new Date(2026, 3, 1), endDate: new Date(2026, 3, 10) }];
    const body  = buildTaskBody(baseItem, 0, tasks, baseRelease, jc, basePeople);
    expect(body.fields['customfield_10015']).toBe('2026-04-01');
    expect(body.fields).not.toHaveProperty('startDate');
  });

  it('omits start date field when startDateFieldId is empty', () => {
    const jc    = { ...baseJC, startDateFieldId: '' };
    const tasks = [{ ...basePhaseTask, startDate: new Date(2026, 3, 1), endDate: new Date(2026, 3, 10) }];
    const body  = buildTaskBody(baseItem, 0, tasks, baseRelease, jc, basePeople);
    expect(body.fields).not.toHaveProperty('customfield_10015');
    expect(body.fields).not.toHaveProperty('startDate');
    expect(body.fields.duedate).toBe('2026-04-10');
  });
```

- [ ] **Step 3: 失敗するテストを `describe('buildSubTaskBody', ...)` の末尾に追加する**

```js
  it('uses startDateFieldId as the JIRA field key for start date', () => {
    const jc   = { ...baseJC, startDateFieldId: 'customfield_10015' };
    const task = { ...baseSubTask, startDate: new Date(2026, 3, 1), endDate: new Date(2026, 3, 10) };
    const body = buildSubTaskBody(task, 'PROJ-1', basePhaseTypeObj, jc, basePeople);
    expect(body.fields['customfield_10015']).toBe('2026-04-01');
    expect(body.fields).not.toHaveProperty('startDate');
  });

  it('omits start date field when startDateFieldId is empty', () => {
    const jc   = { ...baseJC, startDateFieldId: '' };
    const task = { ...baseSubTask, startDate: new Date(2026, 3, 1), endDate: new Date(2026, 3, 10) };
    const body = buildSubTaskBody(task, 'PROJ-1', basePhaseTypeObj, jc, basePeople);
    expect(body.fields).not.toHaveProperty('customfield_10015');
    expect(body.fields).not.toHaveProperty('startDate');
    expect(body.fields.duedate).toBe('2026-04-10');
  });
```

- [ ] **Step 4: テストが失敗することを確認する**

```bash
cd /home/keisukeshima/Documents/wbs-planner-dev
npm test -- --reporter=verbose 2>&1 | grep -E "FAIL|startDateFieldId" | head -20
```

期待: 4件 FAIL

- [ ] **Step 5: `buildTaskBody` の `startDate` 固定キーを動的キーに変更する**

`tests/lib/jira.js` の 90 行目を以下に変更する（`startDate` → `[jc.startDateFieldId]`、条件に `jc.startDateFieldId` を追加）：

変更前:
```js
    ...(taskStart       ? { startDate: toJiraDate(taskStart) }            : {}),
```

変更後:
```js
    ...(taskStart && jc.startDateFieldId ? { [jc.startDateFieldId]: toJiraDate(taskStart) } : {}),
```

- [ ] **Step 6: `buildSubTaskBody` の `startDate` 固定キーを動的キーに変更する**

`tests/lib/jira.js` の 120 行目を以下に変更する：

変更前:
```js
    ...(task.startDate ? { startDate: toJiraDate(task.startDate) } : {}),
```

変更後:
```js
    ...(task.startDate && jc.startDateFieldId ? { [jc.startDateFieldId]: toJiraDate(task.startDate) } : {}),
```

- [ ] **Step 7: 全テストがパスすることを確認する**

```bash
npm test -- --reporter=verbose 2>&1 | tail -15
```

期待: 全テスト PASS（132件）

- [ ] **Step 8: コミット**

```bash
git add tests/lib/jira.js tests/unit/jira.test.js
git commit -m "feat: use startDateFieldId as dynamic key in buildTaskBody/buildSubTaskBody"
```

---

## Task 2: `wbs-planner.html` に設定・UI・ドロップダウン生成を追加する

`wbs-planner.html` は単一 HTML ファイル。この Task では「設定の保存先追加」「HTMLセレクタ追加」「フィールド取得後のドロップダウン更新」「イベントリスナー登録」を行う。

**Files:**
- Modify: `wbs-planner.html`

- [ ] **Step 1: `DEFAULT_JIRA_CONFIG` に `startDateFieldId` を追加する**

`wbs-planner.html` の 370 行目を以下に変更する：

変更前:
```js
const DEFAULT_JIRA_CONFIG = { siteUrl: '', email: '', apiToken: '', projectKey: '', proxyUrl: '', customFields: [] };
```

変更後:
```js
const DEFAULT_JIRA_CONFIG = { siteUrl: '', email: '', apiToken: '', projectKey: '', proxyUrl: '', customFields: [], startDateFieldId: '' };
```

- [ ] **Step 2: 開始日フィールド選択 UI を HTML に追加する**

`wbs-planner.html` の 245〜247 行目（`#jira-custom-fields` div と `btn-jira-push` ボタンの間）を以下に変更する：

変更前:
```html
      <div id="jira-custom-fields"></div>

      <button class="btn btn-primary" id="btn-jira-push" style="margin-top:8px">JIRA に登録</button>
```

変更後:
```html
      <div id="jira-custom-fields"></div>

      <div class="fg" id="j-startdate-wrap" style="display:none;margin-top:10px">
        <label>開始日フィールド <span style="font-weight:400;color:#9CA3AF">（任意）</span></label>
        <select id="j-startdate-field" style="width:100%;padding:7px 9px;border:1px solid #D1D5DB;border-radius:6px;font-size:.84rem">
          <option value="">(設定しない)</option>
        </select>
      </div>

      <button class="btn btn-primary" id="btn-jira-push" style="margin-top:8px">JIRA に登録</button>
```

- [ ] **Step 3: `renderStartDateFieldDropdown` ヘルパー関数を追加する**

`wbs-planner.html` の `loadFieldsForSelected` 関数（2077 行目）の直前に以下を追加する：

```js
function renderStartDateFieldDropdown(allFields) {
  const dateFields = allFields.filter(f =>
    f.schema?.type === 'date' && (f.fieldId ?? f.key) !== 'duedate'
  );
  const wrap = document.getElementById('j-startdate-wrap');
  const sel  = document.getElementById('j-startdate-field');
  sel.innerHTML = '<option value="">(設定しない)</option>' +
    dateFields.map(f => {
      const id = f.fieldId ?? f.key;
      return `<option value="${id}"${JC.startDateFieldId === id ? ' selected' : ''}>${esc(f.name)} (${id})</option>`;
    }).join('');
  wrap.style.display = 'block';
}

```

- [ ] **Step 4: `loadFieldsForSelected` の早期 return の前にドロップダウンを更新する**

`wbs-planner.html` の 2091〜2093 行目（必須フィールドなし時の早期 return）を以下に変更する：

変更前:
```js
    if (required.length === 0) {
      container.innerHTML = '<p style="font-size:.8rem;color:#6B7280;padding:6px 0">必須カスタムフィールドはありません。</p>';
      JC.customFields = []; saveJiraConfig(); return;
    }
```

変更後:
```js
    if (required.length === 0) {
      container.innerHTML = '<p style="font-size:.8rem;color:#6B7280;padding:6px 0">必須カスタムフィールドはありません。</p>';
      JC.customFields = []; saveJiraConfig();
      renderStartDateFieldDropdown(allFields);
      return;
    }
```

- [ ] **Step 5: `loadFieldsForSelected` の通常終了パスにもドロップダウンを更新する**

`wbs-planner.html` の 2123〜2124 行目（`saveJiraConfig(); renderCustomFields();`）を以下に変更する：

変更前:
```js
    saveJiraConfig();
    renderCustomFields();
```

変更後:
```js
    saveJiraConfig();
    renderCustomFields();
    renderStartDateFieldDropdown(allFields);
```

- [ ] **Step 6: `initJiraTab()` に `#j-startdate-field` のイベントリスナーを追加する**

`wbs-planner.html` の `initJiraTab()` 関数内の末尾（`saveJiraConfig()` 呼び出しが並んでいる付近、`j-proxy` のリスナーの直後）に追加する。

まず `initJiraTab()` 内の末尾近くにあるイベントリスナー群を探す（`j-proxy` の次行）。`wbs-planner.html` で `j-proxy` の addEventListener を検索すると約 2359 行目にある：

```js
document.getElementById('j-proxy').addEventListener('input', e => { JC.proxyUrl   = e.target.value.trim(); saveJiraConfig(); });
```

その直後に以下を追加する：

```js
document.getElementById('j-startdate-field').addEventListener('change', e => { JC.startDateFieldId = e.target.value; saveJiraConfig(); });
```

- [ ] **Step 7: テストが全件パスすることを確認する**

```bash
npm test -- --reporter=verbose 2>&1 | tail -10
```

期待: 全テスト PASS

- [ ] **Step 8: コミット**

```bash
git add wbs-planner.html
git commit -m "feat: add start date field selector UI populated from JIRA field metadata"
```

---

## Task 3: `pushToJira()` の inline コードを動的キー対応にする

`pushToJira()` 内の `taskBody` / `subBody` 組み立て部分を `JC.startDateFieldId` を使った動的キーに変更する。Task 1 の `buildTaskBody` / `buildSubTaskBody` と同じパターン。

**Files:**
- Modify: `wbs-planner.html:2233` and `wbs-planner.html:2272`

- [ ] **Step 1: `taskBody` の startDate 行を動的キーに変更する**

`wbs-planner.html` の 2233 行目を変更する：

変更前:
```js
        ...(taskStart       ? { startDate: fmt(taskStart) }              : {}),
```

変更後:
```js
        ...(taskStart && JC.startDateFieldId ? { [JC.startDateFieldId]: fmt(taskStart) } : {}),
```

- [ ] **Step 2: `subBody` の startDate 行を動的キーに変更する**

`wbs-planner.html` の 2272 行目を変更する：

変更前:
```js
          ...(t.startDate  ? { startDate: fmt(t.startDate) }            : {}),
```

変更後:
```js
          ...(t.startDate && JC.startDateFieldId ? { [JC.startDateFieldId]: fmt(t.startDate) } : {}),
```

- [ ] **Step 3: 全テストがパスすることを確認する**

```bash
npm test -- --reporter=verbose 2>&1 | tail -10
```

期待: 全テスト PASS

- [ ] **Step 4: コミット**

```bash
git add wbs-planner.html
git commit -m "feat: use startDateFieldId as dynamic key in pushToJira inline code"
```
