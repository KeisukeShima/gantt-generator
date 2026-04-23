# リリース複製機能 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** リリースタブのヘッダーに「複製」ボタン（⧉）を追加し、リリース（アイテム・フェーズ含む）を1クリックで元のリリースの直後に複製できるようにする。

**Architecture:** `wbs-planner.html` の `renderReleasesList()` 内のHTML文字列テンプレートにボタンを追加し、同関数内にイベントハンドラーを追加する。既存の `data-del-release` パターンをそのまま踏襲する。削除ボタンのラベルも `削除` → `✕` アイコンに変更する。

**Tech Stack:** Vanilla JS / HTML (single-file app)、Playwright (E2E テスト)

---

### Task 1: E2E テストを追加（失敗状態で確認）

**Files:**
- Modify: `tests/e2e/release-crud.spec.js`

- [ ] **Step 1: テストケースをファイル末尾に追記する**

`tests/e2e/release-crud.spec.js` の末尾（`});` の後）に以下を追加する：

```js
// ── リリース複製 ───────────────────────────────────────────────────────────────

test.describe('リリース複製', () => {
  test('複製すると元のリリースの直後に新しいリリースが追加される', async ({ page }) => {
    await page.click('#btn-add-release');
    await expect(page.locator('.release-wrap')).toHaveCount(2);

    // リリース1（index 0）を複製
    await page.locator('[data-dup-release="0"]').click();

    await expect(page.locator('.release-wrap')).toHaveCount(3);
    // 複製は元の直後（index 1）に挿入される
    const names = page.locator('.release-wrap > .li-head > .li-name');
    await expect(names.nth(0)).toHaveText('リリース1');
    await expect(names.nth(1)).toHaveText('リリース1 のコピー');
    await expect(names.nth(2)).toHaveText('リリース2');
  });

  test('複製後のリリース名が「元の名前 のコピー」になっている', async ({ page }) => {
    await page.locator('[data-dup-release="0"]').click();

    const names = page.locator('.release-wrap > .li-head > .li-name');
    await expect(names.nth(1)).toHaveText('リリース1 のコピー');
  });

  test('複製後の Epic キーが空になっている', async ({ page }) => {
    // まず元リリースに epicKey を設定
    await expandRelease(page, 0);
    await page.locator('[data-rf="epicKey"][data-ri="0"]').fill('PROJ-100');

    // 複製
    await page.locator('[data-dup-release="0"]').click();

    // 複製先（index 1）の epicKey が空であることを確認
    await expandRelease(page, 1);
    await expect(page.locator('[data-rf="epicKey"][data-ri="1"]')).toHaveValue('');
  });

  test('複製後のアイテムが元のリリースのアイテムと同じである', async ({ page }) => {
    // デフォルト設定には「サンプルタスク」が1件含まれている
    await page.locator('[data-dup-release="0"]').click();

    // 複製先（index 1）にもアイテムが存在する
    await expandRelease(page, 1);
    await expect(page.locator('.item-wrap[data-ri="1"]')).toHaveCount(1);
    await expect(
      page.locator('.item-wrap[data-ri="1"][data-ii="0"] > .li-head > .li-name')
    ).toHaveText('サンプルタスク');
  });
});
```

- [ ] **Step 2: テストが失敗することを確認する**

```bash
npm run test:e2e -- --grep "リリース複製"
```

期待: 全4件が FAIL（`data-dup-release` ボタンが存在しないため）

---

### Task 2: リリースヘッダーのボタンを更新する

**Files:**
- Modify: `wbs-planner.html:1300-1304`

- [ ] **Step 1: ヘッダーのボタン HTML を置き換える**

`wbs-planner.html` の1300〜1304行目を以下に置き換える：

```html
        <button class="btn btn-secondary btn-sm" data-mv-release="${rIdx}" data-dir="-1"
          onclick="event.stopPropagation()" title="上に移動" ${rIdx === 0 ? 'disabled' : ''} style="padding:2px 7px">↑</button>
        <button class="btn btn-secondary btn-sm" data-mv-release="${rIdx}" data-dir="1"
          onclick="event.stopPropagation()" title="下に移動" ${rIdx === (C.releases.length - 1) ? 'disabled' : ''} style="padding:2px 7px">↓</button>
        <button class="btn btn-sm" data-dup-release="${rIdx}" onclick="event.stopPropagation()" title="複製"
          style="padding:2px 7px;background:#EDE9FE;border:1px solid #C4B5FD;color:#6D28D9;border-radius:6px;cursor:pointer;font-size:.78rem">⧉</button>
        <button class="btn btn-danger" data-del-release="${rIdx}" onclick="event.stopPropagation()" title="削除" style="padding:2px 7px">✕</button>
```

---

### Task 3: 複製イベントハンドラーを追加する

**Files:**
- Modify: `wbs-planner.html`（`data-del-release` ハンドラーの直後）

- [ ] **Step 1: イベントハンドラーを追加する**

`wbs-planner.html` の1547行目（`// ── リリース削除 ──` ブロックの `}));` の直後）に以下を追加する：

```js
  // ── リリース複製 ──
  el.querySelectorAll('[data-dup-release]').forEach(btn => btn.addEventListener('click', () => {
    const ri = parseInt(btn.dataset.dupRelease);
    _undoSnapshot = JSON.stringify(C);
    updateUndoBtn();
    const copy = JSON.parse(JSON.stringify(C.releases[ri]));
    copy.id = genId();
    copy.name = copy.name + ' のコピー';
    copy.epicKey = '';
    C.releases.splice(ri + 1, 0, copy);
    render(); renderReleasesList();
  }));
```

---

### Task 4: テストをすべて実行して確認する

**Files:** なし（実行のみ）

- [ ] **Step 1: E2E テストを実行する**

```bash
npm run test:e2e
```

期待: 全件 PASS（新規4件 + 既存13件 = 17件）

- [ ] **Step 2: ユニットテストも念のため実行する**

```bash
npm test
```

期待: 全件 PASS（既存テストへの影響がないことを確認）

- [ ] **Step 3: コミットする**

```bash
git add wbs-planner.html tests/e2e/release-crud.spec.js
git commit -m "feat: add release duplicate button with icon-style header buttons"
```
