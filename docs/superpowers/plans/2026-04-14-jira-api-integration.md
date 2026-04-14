# JIRA REST API 連携 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** JIRA CSV エクスポートを削除し、Atlassian Cloud REST API を使って JIRA 課題を直接作成できる JIRA タブを実装する。

**Architecture:** 単一ファイル `wbs-planner.html` のみを変更する。JIRA 接続情報（URL・メール・API トークン・プロジェクトキー）はセキュリティ上の理由からプロジェクト設定 `C` とは別の localStorage キー `'wbs-jira-cfg'` に保存し、JSON エクスポートに混入しない。課題作成は Task → Sub-task の 2 パスで逐次実行し、各 Task の issue key を取得してから Sub-task の parent に指定する。

**Tech Stack:** Vanilla JS / Fetch API / Atlassian Cloud REST API v3 / ADF（Atlassian Document Format）

---

## ファイル変更マップ

変更対象は `wbs-planner.html` のみ。

| セクション | 行（概算） | 変更内容 |
| ---- | ---- | ---- |
| CSS | 88–90 | JIRA タブ用スタイル追加 |
| HTML tabs | 98–101 | JIRA タブボタン追加 |
| HTML tab-project | 160–163 | epicKey フィールド削除（JIRA タブへ移動） |
| HTML footer | 194 | `btn-jira-csv` ボタン削除 |
| HTML sb-body | 187の直前 | JIRA タブパネル追加 |
| renderPeopleList | 925 | jiraUser テキスト入力を削除 |
| initProjectForm + event | 765, 774 | epicKey 初期化・イベント削除 |
| EXPORT section | 1168–1245 | generateJiraCSV 関数・btn-jira-csv ハンドラ削除 |
| STATE section | 284の直後 | JC グローバル・JIRA config 関数追加 |
| 新規: jiraApi ヘルパー | PNG の直前 | API 呼び出しヘルパー追加 |
| 新規: initJiraTab | jiraApi の直後 | タブ初期化・イベントハンドラ |
| 新規: JIRA API 機能群 | initJiraTab の直後 | テスト・ユーザー取得・登録関数 |
| initAll | 1281 | initJiraTab() 呼び出し追加 |

---

## Task 1: 旧 JIRA CSV 機能の削除

**Files:**
- Modify: `wbs-planner.html`（CSS・HTML・JS の複数箇所）

- [ ] **Step 1: footer の `btn-jira-csv` ボタンを削除**

変更前:
```html
    <button class="btn btn-primary" id="btn-html">HTML 出力</button>
    <button class="btn btn-secondary" id="btn-png">PNG 出力</button>
    <button class="btn btn-secondary" id="btn-jira-csv">JIRA CSV</button>
    <button class="btn btn-secondary" id="btn-json-save">JSON 保存</button>
```

変更後:
```html
    <button class="btn btn-primary" id="btn-html">HTML 出力</button>
    <button class="btn btn-secondary" id="btn-png">PNG 出力</button>
    <button class="btn btn-secondary" id="btn-json-save">JSON 保存</button>
```

- [ ] **Step 2: プロジェクト設定タブの epicKey フィールドを削除**

変更前:
```html
      <div class="fg">
        <label>JIRA Epic キー</label>
        <input type="text" id="f-epic-key" placeholder="例: PROJ-1">
      </div>

      <hr class="divider">

      <div class="sec-title">
        <span>祝日（国民の祝日）</span>
```

変更後:
```html
      <hr class="divider">

      <div class="sec-title">
        <span>祝日（国民の祝日）</span>
```

- [ ] **Step 3: `initProjectForm` 内の epicKey 初期化行を削除**

変更前:
```javascript
  document.querySelector(`input[name="ganttUnit"][value="${C.ganttUnit}"]`).checked = true;
  document.getElementById('f-epic-key').value = C.epicKey || '';
}
```

変更後:
```javascript
  document.querySelector(`input[name="ganttUnit"][value="${C.ganttUnit}"]`).checked = true;
}
```

- [ ] **Step 4: epicKey イベントリスナーを削除**

変更前:
```javascript
document.querySelectorAll('input[name="ganttUnit"]').forEach(r =>
  r.addEventListener('change', e => { if(e.target.checked){ C.ganttUnit = e.target.value; render(); } }));
document.getElementById('f-epic-key').addEventListener('input', e => { C.epicKey = e.target.value; saveConfig(); });
```

変更後:
```javascript
document.querySelectorAll('input[name="ganttUnit"]').forEach(r =>
  r.addEventListener('change', e => { if(e.target.checked){ C.ganttUnit = e.target.value; render(); } }));
```

- [ ] **Step 5: `renderPeopleList` の jiraUser テキスト入力を削除**

変更前:
```javascript
        <div class="fg"><label>備考</label><input type="text" value="${esc(p.note||'')}" data-pi="${i}" data-pf="note"></div>
        <div class="fg"><label>JIRA ユーザー名</label><input type="text" value="${esc(p.jiraUser||'')}" data-pi="${i}" data-pf="jiraUser" placeholder="例: alice@example.com"></div>
      </div>
    </div>
  `).join('');
```

変更後:
```javascript
        <div class="fg"><label>備考</label><input type="text" value="${esc(p.note||'')}" data-pi="${i}" data-pf="note"></div>
      </div>
    </div>
  `).join('');
```

- [ ] **Step 6: `generateJiraCSV` 関数と `btn-jira-csv` ハンドラを削除**

`// ── JIRA CSV エクスポート ──` から始まり `generateJiraCSV();` `});` で終わるブロック全体（`// ── PNG エクスポート ──` の直前まで）を削除する。

変更前:
```javascript
// ── JIRA CSV エクスポート ──
function generateJiraCSV() {
  ...（中略）...
  dl(new Blob(['\uFEFF' + csvStr], { type:'text/csv;charset=utf-8;' }),
     `${C.projectName||'gantt'}.csv`, 'text/csv');
}

document.getElementById('btn-jira-csv').addEventListener('click', () => {
  if (!C.epicKey) {
    if (!confirm('Epic キーが未設定です。このまま続行しますか？\n（Epic Link 列が空になります）')) return;
  }
  generateJiraCSV();
});

// ── PNG エクスポート ──
```

変更後:
```javascript
// ── PNG エクスポート ──
```

- [ ] **Step 7: ブラウザで確認**

`wbs-planner.html` を開き、フッターに「JIRA CSV」ボタンが無いこと、プロジェクト設定タブに「JIRA Epic キー」フィールドが無いこと、担当者フォームに「JIRA ユーザー名」入力欄が無いことを確認する。コンソールにエラーが出ていないことも確認する。

- [ ] **Step 8: コミット**

```bash
git add wbs-planner.html
git commit -m "refactor: remove JIRA CSV export feature"
```

---

## Task 2: JIRA タブの HTML + CSS 追加

**Files:**
- Modify: `wbs-planner.html`

- [ ] **Step 1: CSS に JIRA タブ用スタイルを追加**

`/* ── Warn / Hint ── */` セクションの直前に追加する。

変更前:
```css
/* ── Warn / Hint ── */
.warn-box{...}
```

変更後:
```css
/* ── JIRA tab ── */
.jira-msg{padding:7px 10px;border-radius:6px;font-size:.82rem;margin-top:8px}
.jira-msg.ok{background:#F0FDF4;border:1px solid #BBF7D0;color:#166534}
.jira-msg.err{background:#FEF2F2;border:1px solid #FECACA;color:#991B1B}
.jira-log{margin-top:10px;max-height:220px;overflow-y:auto;border:1px solid #E5E7EB;border-radius:6px;padding:6px 8px}
.jira-log-line{padding:3px 0;border-bottom:1px solid #F3F4F6;font-size:.78rem;word-break:break-all}
.jira-log-line:last-child{border-bottom:none}
.jira-log-line.ok{color:#166534}
.jira-log-line.err{color:#991B1B}
.jira-map-row{display:flex;align-items:center;gap:8px;margin-bottom:8px}
.jira-map-row .jm-name{flex:1;font-size:.84rem;font-weight:600;color:#111827;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.jira-map-row select{flex:2;padding:5px 8px;border:1px solid #D1D5DB;border-radius:6px;font-size:.8rem;font-family:inherit}

/* ── Warn / Hint ── */
.warn-box{...}
```

- [ ] **Step 2: タブボタンに「JIRA」を追加**

変更前:
```html
      <button class="tab-btn" data-tab="project">プロジェクト設定</button>
    </div>
  </div>
```

変更後:
```html
      <button class="tab-btn" data-tab="project">プロジェクト設定</button>
      <button class="tab-btn" data-tab="jira">JIRA</button>
    </div>
  </div>
```

- [ ] **Step 3: JIRA タブパネルを追加**

`</div><!-- /sb-body -->` の直前（tab-project の `</div>` の直後）に追加する。

変更前:
```html
    </div>

  </div><!-- /sb-body -->
```

変更後:
```html
    </div>

    <!-- ▸ JIRA -->
    <div class="tab-pane" id="tab-jira">

      <div class="sec-title">接続設定</div>
      <div class="fg"><label>JIRA サイト URL</label><input type="text" id="j-site" placeholder="https://mycompany.atlassian.net"></div>
      <div class="fr">
        <div class="fg"><label>メールアドレス</label><input type="text" id="j-email" placeholder="user@example.com"></div>
        <div class="fg"><label>プロジェクトキー</label><input type="text" id="j-pkey" placeholder="PROJ"></div>
      </div>
      <div class="fg">
        <label>API トークン</label>
        <input type="password" id="j-token" placeholder="Atlassian API トークンを入力">
      </div>
      <p style="font-size:.72rem;color:#9CA3AF;margin-bottom:10px">API トークンは Atlassian アカウント設定（Security → API tokens）で発行できます。このブラウザのみに保存されます。</p>
      <button class="btn btn-secondary" id="btn-jira-test">接続テスト</button>
      <div id="jira-test-result"></div>

      <hr class="divider">

      <div class="sec-title">
        <span>担当者マッピング</span>
        <button class="btn btn-secondary btn-sm" id="btn-jira-users">JIRA ユーザー取得</button>
      </div>
      <p style="font-size:.72rem;color:#9CA3AF;margin-bottom:8px">プロジェクトキーを設定して「JIRA ユーザー取得」を押すと、担当者と JIRA アカウントを紐付けられます。</p>
      <div id="jira-people-map"></div>

      <hr class="divider">

      <div class="sec-title">課題登録</div>
      <div class="fg"><label>JIRA Epic キー</label><input type="text" id="f-epic-key" placeholder="例: PROJ-1"></div>
      <button class="btn btn-primary" id="btn-jira-push">JIRA に登録</button>
      <div id="jira-push-result"></div>

    </div>

  </div><!-- /sb-body -->
```

- [ ] **Step 4: ブラウザで確認**

`wbs-planner.html` を開き、「JIRA」タブが表示されてクリックで切り替わること、3つのセクション（接続設定・担当者マッピング・課題登録）が表示されることを確認する。

- [ ] **Step 5: コミット**

```bash
git add wbs-planner.html
git commit -m "feat: add JIRA tab HTML and CSS"
```

---

## Task 3: JIRA config 状態管理 + `jiraApi()` ヘルパー + `initJiraTab()`

**Files:**
- Modify: `wbs-planner.html`

- [ ] **Step 1: JIRA config のグローバル状態を追加**

`// ═══ STATE ═══` セクション内の `let C = loadConfig();` の直後に追加する。

変更前:
```javascript
let C = loadConfig();

function loadConfig() {
```

変更後:
```javascript
let C = loadConfig();

// ── JIRA 接続設定（プロジェクト設定 C とは別に保管）──
const DEFAULT_JIRA_CONFIG = { siteUrl: '', email: '', apiToken: '', projectKey: '' };
let JC = loadJiraConfig();
function loadJiraConfig() {
  try {
    const s = localStorage.getItem('wbs-jira-cfg');
    return s ? { ...DEFAULT_JIRA_CONFIG, ...JSON.parse(s) } : { ...DEFAULT_JIRA_CONFIG };
  } catch { return { ...DEFAULT_JIRA_CONFIG }; }
}
function saveJiraConfig() {
  try { localStorage.setItem('wbs-jira-cfg', JSON.stringify(JC)); } catch {}
}

function loadConfig() {
```

- [ ] **Step 2: `jiraApi()` ヘルパーを追加**

`// ── PNG エクスポート ──` の直前（HELPERS セクションの前）に追加する。

変更前:
```javascript
// ── PNG エクスポート ──
```

変更後:
```javascript
// ── JIRA API ──
async function jiraApi(path, opts = {}) {
  if (!JC.siteUrl || !JC.email || !JC.apiToken) throw new Error('接続設定が未入力です');
  const base = JC.siteUrl.replace(/\/$/, '');
  const auth = btoa(`${JC.email}:${JC.apiToken}`);
  const res = await fetch(`${base}/rest/api/3${path}`, {
    ...opts,
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      ...(opts.headers || {}),
    },
  });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.errorMessages?.join(', ') || j.message || msg; } catch {}
    throw new Error(msg);
  }
  return res.json();
}

// ── PNG エクスポート ──
```

- [ ] **Step 3: `initJiraTab()` と接続フォームのイベントを追加**

`jiraApi()` の直後（`// ── PNG エクスポート ──` の直前）に追加する。

変更前:
```javascript
// ── PNG エクスポート ──
```

変更後:
```javascript
function initJiraTab() {
  document.getElementById('j-site').value  = JC.siteUrl;
  document.getElementById('j-email').value = JC.email;
  document.getElementById('j-token').value = JC.apiToken;
  document.getElementById('j-pkey').value  = JC.projectKey;
  document.getElementById('f-epic-key').value = C.epicKey || '';
  // renderJiraPeopleMap は Task 5 で定義されるため、存在確認してから呼ぶ
  if (typeof renderJiraPeopleMap === 'function') renderJiraPeopleMap();
}

document.getElementById('j-site').addEventListener('input',  e => { JC.siteUrl    = e.target.value.trim(); saveJiraConfig(); });
document.getElementById('j-email').addEventListener('input', e => { JC.email      = e.target.value.trim(); saveJiraConfig(); });
document.getElementById('j-token').addEventListener('input', e => { JC.apiToken   = e.target.value.trim(); saveJiraConfig(); });
document.getElementById('j-pkey').addEventListener('input',  e => { JC.projectKey = e.target.value.trim().toUpperCase(); saveJiraConfig(); });
document.getElementById('f-epic-key').addEventListener('input', e => { C.epicKey  = e.target.value.trim(); saveConfig(); });

// ── PNG エクスポート ──
```

- [ ] **Step 4: `initAll()` から `initJiraTab()` を呼ぶ**

変更前:
```javascript
function initAll() {
  initProjectForm();
  renderHolTags();
  renderPhaseTypesList();
  renderPeopleList();
  renderItemsList();
}
```

変更後:
```javascript
function initAll() {
  initProjectForm();
  renderHolTags();
  renderPhaseTypesList();
  renderPeopleList();
  renderItemsList();
  initJiraTab();
}
```

- [ ] **Step 5: ブラウザで確認**

JIRA タブを開き、各フォームに値を入力して別のタブに切り替え → JIRA タブに戻ったとき値が保持されていること（localStorage に保存されている）を確認する。コンソールで `JC` を入力して入力値が入っていることを確認する。また `C.epicKey` が Epic キーフィールドの入力値と一致していることも確認する。

- [ ] **Step 6: コミット**

```bash
git add wbs-planner.html
git commit -m "feat: add JIRA config state and jiraApi helper"
```

---

## Task 4: 接続テスト機能

**Files:**
- Modify: `wbs-planner.html`

- [ ] **Step 1: 接続テスト関数と btn-jira-test ハンドラを追加**

`initJiraTab()` の定義の直後に追加する。

変更前:
```javascript
document.getElementById('j-site').addEventListener('input',  e => { JC.siteUrl    = e.target.value.trim(); saveJiraConfig(); });
```

変更後:
```javascript
async function testJiraConnection() {
  const btn = document.getElementById('btn-jira-test');
  const out = document.getElementById('jira-test-result');
  btn.textContent = 'テスト中…'; btn.disabled = true; out.innerHTML = '';
  try {
    const me = await jiraApi('/myself');
    out.innerHTML = `<div class="jira-msg ok">✓ 接続成功: ${esc(me.displayName)} (${esc(me.emailAddress)})</div>`;
  } catch(e) {
    out.innerHTML = `<div class="jira-msg err">✗ ${esc(e.message)}<br><small>CORS エラーの場合はローカルサーバーから開いてください（python3 -m http.server）</small></div>`;
  }
  btn.textContent = '接続テスト'; btn.disabled = false;
}

document.getElementById('btn-jira-test').addEventListener('click', testJiraConnection);

document.getElementById('j-site').addEventListener('input',  e => { JC.siteUrl    = e.target.value.trim(); saveJiraConfig(); });
```

- [ ] **Step 2: ブラウザで確認**

JIRA タブで接続情報（サイト URL・メール・API トークン）を入力し「接続テスト」をクリックする。正しい情報なら `✓ 接続成功: 名前 (メール)` が緑で表示されること、誤った情報なら `✗ HTTP 401` などが赤で表示されることを確認する。

- [ ] **Step 3: コミット**

```bash
git add wbs-planner.html
git commit -m "feat: add JIRA connection test"
```

---

## Task 5: JIRA ユーザー取得と担当者マッピング

**Files:**
- Modify: `wbs-planner.html`

- [ ] **Step 1: `jiraUsers` グローバルと `fetchJiraAssignableUsers` を追加**

`testJiraConnection` の直前に追加する。

変更前:
```javascript
async function testJiraConnection() {
```

変更後:
```javascript
let jiraUsers = []; // 取得した JIRA ユーザー一覧（セッション中のみ保持）

async function fetchJiraAssignableUsers() {
  if (!JC.projectKey) throw new Error('プロジェクトキーが未設定です');
  // Atlassian Cloud は maxResults を 200 まで受け付ける
  const data = await jiraApi(`/user/assignable/search?projectKeys=${encodeURIComponent(JC.projectKey)}&maxResults=200`);
  return Array.isArray(data) ? data : [];
}

async function testJiraConnection() {
```

- [ ] **Step 2: `renderJiraPeopleMap` を追加**

`fetchJiraAssignableUsers` の直後に追加する。

変更前:
```javascript
async function testJiraConnection() {
```

変更後:
```javascript
function renderJiraPeopleMap() {
  const el = document.getElementById('jira-people-map');
  if (!el) return;
  if (!C.people.length) {
    el.innerHTML = '<p style="font-size:.82rem;color:#9CA3AF">担当者タブで担当者を追加してください。</p>';
    return;
  }
  el.innerHTML = C.people.map((p, i) => `
    <div class="jira-map-row">
      <span class="jm-name">${esc(p.name)}</span>
      <select data-pm="${i}">
        <option value="">-- 未マッピング --</option>
        ${jiraUsers.map(u => `<option value="${esc(u.accountId)}" ${p.jiraUser===u.accountId?'selected':''}>${esc(u.displayName)}${u.emailAddress?' ('+esc(u.emailAddress)+')':''}</option>`).join('')}
      </select>
    </div>
  `).join('');
  el.querySelectorAll('[data-pm]').forEach(sel => sel.addEventListener('change', e => {
    C.people[parseInt(e.target.dataset.pm)].jiraUser = e.target.value;
    saveConfig();
  }));
}

async function testJiraConnection() {
```

- [ ] **Step 3: `btn-jira-users` ハンドラを追加**

`document.getElementById('btn-jira-test').addEventListener(...)` の直後に追加する。

変更前:
```javascript
document.getElementById('btn-jira-test').addEventListener('click', testJiraConnection);

document.getElementById('j-site').addEventListener('input',
```

変更後:
```javascript
document.getElementById('btn-jira-test').addEventListener('click', testJiraConnection);

document.getElementById('btn-jira-users').addEventListener('click', async () => {
  const btn = document.getElementById('btn-jira-users');
  btn.textContent = '取得中…'; btn.disabled = true;
  try {
    jiraUsers = await fetchJiraAssignableUsers();
    renderJiraPeopleMap();
    btn.textContent = `${jiraUsers.length} 名取得 ✓`;
    setTimeout(() => { btn.textContent = 'JIRA ユーザー取得'; btn.disabled = false; }, 2000);
  } catch(e) {
    alert('ユーザー取得に失敗しました: ' + e.message);
    btn.textContent = 'JIRA ユーザー取得'; btn.disabled = false;
  }
});

document.getElementById('j-site').addEventListener('input',
```

- [ ] **Step 4: ブラウザで確認**

JIRA タブで接続設定とプロジェクトキーを入力し「JIRA ユーザー取得」をクリックする。プロジェクトの担当可能ユーザー一覧がドロップダウンに表示され、各担当者に対して JIRA アカウントを選択できることを確認する。選択後にコンソールで `C.people[0].jiraUser` がアカウント ID（長い英数字）になっていることを確認する。

- [ ] **Step 5: コミット**

```bash
git add wbs-planner.html
git commit -m "feat: add JIRA user fetch and people mapping"
```

---

## Task 6: JIRA への課題登録

**Files:**
- Modify: `wbs-planner.html`

- [ ] **Step 1: `makeADF` と `getAccountId` ヘルパーを追加**

`renderJiraPeopleMap` の直前に追加する。

変更前:
```javascript
function renderJiraPeopleMap() {
```

変更後:
```javascript
function makeADF(text) {
  if (!text) return undefined;
  return { type: 'doc', version: 1, content: [{ type: 'paragraph', content: [{ type: 'text', text: String(text) }] }] };
}

function getAccountId(personName) {
  const p = C.people.find(x => x.name === personName);
  return (p && p.jiraUser) ? p.jiraUser : null;
}

function renderJiraPeopleMap() {
```

- [ ] **Step 2: `pushToJira` 関数を追加**

`getAccountId` の直後に追加する。

変更前:
```javascript
function renderJiraPeopleMap() {
```

変更後:
```javascript
async function pushToJira() {
  const btn    = document.getElementById('btn-jira-push');
  const logEl  = document.getElementById('jira-push-result');

  if (!JC.siteUrl || !JC.email || !JC.apiToken || !JC.projectKey) {
    alert('JIRA タブの接続設定（URL・メール・API トークン・プロジェクトキー）を入力してください');
    return;
  }

  let scheduled;
  try { scheduled = runSchedule(); } catch(e) { alert('スケジューリングエラー: ' + e.message); return; }
  const { tasks } = scheduled;

  if (!tasks.length) { alert('登録するタスクがありません'); return; }

  btn.disabled = true; btn.textContent = '登録中…';
  logEl.innerHTML = '<div class="jira-log" id="jira-log"></div>';
  const log = document.getElementById('jira-log');

  const addLog = (text, isErr = false) => {
    const d = document.createElement('div');
    d.className = 'jira-log-line' + (isErr ? ' err' : ' ok');
    d.textContent = text;
    log.prepend(d);
  };

  // itemIdx → phaseTasks のマップ
  const itemGroups = {};
  tasks.forEach(t => { if (!itemGroups[t.itemIdx]) itemGroups[t.itemIdx] = []; itemGroups[t.itemIdx].push(t); });

  let taskCount = 0, subCount = 0, errCount = 0;

  for (let iIdx = 0; iIdx < C.items.length; iIdx++) {
    const item      = C.items[iIdx];
    const phaseTasks = itemGroups[iIdx] || [];
    if (!phaseTasks.length) continue;

    const taskSummary = `${iIdx + 1} ${item.name}`;
    const totalDays   = phaseTasks.filter(t => !t.isBackground).reduce((s, t) => s + t.totalDays, 0);
    const firstPhase  = phaseTasks.find(t => !t.isBackground && t.assignedPeople.length > 0);
    const taskAccountId = firstPhase ? getAccountId(firstPhase.assignedPeople[0]) : null;
    const taskDesc = [
      item.category ? `カテゴリ: ${item.category}` : '',
      item.note     ? `メモ: ${item.note}`         : '',
      `稼働日数（合計）: ${totalDays}日`,
    ].filter(Boolean).join('\n');

    const taskBody = { fields: {
      project:   { key: JC.projectKey },
      summary:   taskSummary,
      issuetype: { name: 'Task' },
      description: makeADF(taskDesc),
      ...(C.epicKey      ? { customfield_10014: C.epicKey }                 : {}),
      ...(taskAccountId  ? { assignee: { accountId: taskAccountId } }       : {}),
    }};

    let taskKey;
    try {
      const res = await jiraApi('/issue', { method: 'POST', body: JSON.stringify(taskBody) });
      taskKey = res.key;
      taskCount++;
      addLog(`✓ Task ${taskKey}: ${taskSummary}`);
    } catch(e) {
      errCount++;
      addLog(`✗ Task "${taskSummary}": ${e.message}`, true);
      continue; // Sub-task はスキップ
    }

    for (const t of phaseTasks) {
      const pt = C.phaseTypes.find(x => x.name === t.phaseType);
      const subSummary = `${t.wbsNo} ${t.phaseType} — ${t.itemName}`;

      let subAccountId = null;
      if (!t.isBackground && t.assignedPeople.length > 0) {
        subAccountId = getAccountId(t.assignedPeople[0]);
      }

      const subDesc = [
        pt ? `担当チーム: ${pt.team}` : '',
        `稼働日数: ${t.totalDays}日`,
        t.isBackground ? '（バックグラウンドタスク）' : '',
        (t.requireAll && t.assignedPeople.length > 1)
          ? `全担当者: ${t.assignedPeople.join(', ')}` : '',
      ].filter(Boolean).join('\n');

      const subBody = { fields: {
        project:     { key: JC.projectKey },
        summary:     subSummary,
        issuetype:   { name: 'Sub-task' },
        parent:      { key: taskKey },
        description: makeADF(subDesc),
        ...(subAccountId ? { assignee: { accountId: subAccountId } } : {}),
      }};

      try {
        const res = await jiraApi('/issue', { method: 'POST', body: JSON.stringify(subBody) });
        subCount++;
        addLog(`  ✓ Sub-task ${res.key}: ${subSummary}`);
      } catch(e) {
        errCount++;
        addLog(`  ✗ Sub-task "${subSummary}": ${e.message}`, true);
      }
    }
  }

  const summary = `登録完了: Task ${taskCount} 件, Sub-task ${subCount} 件${errCount ? `（エラー ${errCount} 件）` : ''}`;
  addLog(summary, errCount > 0);
  btn.disabled = false; btn.textContent = 'JIRA に登録';
}

function renderJiraPeopleMap() {
```

- [ ] **Step 3: `btn-jira-push` ハンドラを追加**

`btn-jira-users` ハンドラの直後に追加する。

変更前:
```javascript
document.getElementById('j-site').addEventListener('input',
```

変更後:
```javascript
document.getElementById('btn-jira-push').addEventListener('click', pushToJira);

document.getElementById('j-site').addEventListener('input',
```

- [ ] **Step 4: ブラウザで確認（テスト環境）**

接続設定・担当者マッピング・Epic キーを入力した状態で「JIRA に登録」をクリックし、以下を確認する。

1. ログエリアが表示され、`✓ Task PROJ-XX: 1 コア機能A` のような行が順番に表示されること
2. Sub-task が `  ✓ Sub-task PROJ-XX: 1.1 要件定義 — コア機能A` の形式で表示されること
3. JIRA 上で Task → Sub-task の親子関係が正しく作成されていること
4. Epic キーを設定した Task の「Epic Link」フィールドに設定されていること
5. 担当者マッピングを設定した場合、Assignee が正しくセットされていること

- [ ] **Step 5: エラーケースの確認**

1. 接続設定が未入力の状態で「JIRA に登録」をクリック → `alert` でエラーメッセージが表示されること
2. API トークンを意図的に誤って設定し「JIRA に登録」をクリック → ログに `✗ HTTP 401` が表示されること

- [ ] **Step 6: コミット**

```bash
git add wbs-planner.html
git commit -m "feat: add JIRA issue creation via REST API"
```
