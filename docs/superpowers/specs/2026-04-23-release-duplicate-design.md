---
title: リリース単位の複製機能
date: 2026-04-23
status: approved
---

## 概要

リリースタブのリリースヘッダーに「複製」ボタンを追加し、リリース（アイテム・フェーズ含む）を1クリックで複製できるようにする。

---

## UI 変更

### ボタンのアイコン化

リリースヘッダーの操作ボタンをアイコンに統一する。

| 機能 | 変更前 | 変更後 |
|------|--------|--------|
| 上に移動 | `↑`（テキストボタン） | `↑`（ツールチップ追加） |
| 下に移動 | `↓`（テキストボタン） | `↓`（ツールチップ追加） |
| 複製 | なし | `⧉`（紫系スタイル、ツールチップ「複製」） |
| 削除 | `削除`（テキストボタン） | `✕`（赤系スタイル、ツールチップ「削除」） |

- 複製ボタン（`⧉`）: 背景 `#EDE9FE`、ボーダー `#C4B5FD`、文字 `#6D28D9`
- 削除ボタン（`✕`）: 既存の `.btn-danger` スタイルを維持
- 全ボタンに `title` 属性でツールチップを付与

### HTML テンプレートの差分（概略）

```html
<!-- 変更前 -->
<button class="btn btn-secondary btn-sm" data-mv-release="${rIdx}" data-dir="-1" ...>↑</button>
<button class="btn btn-secondary btn-sm" data-mv-release="${rIdx}" data-dir="1"  ...>↓</button>
<button class="btn btn-danger" data-del-release="${rIdx}" ...>削除</button>

<!-- 変更後 -->
<button class="btn btn-secondary btn-sm" data-mv-release="${rIdx}" data-dir="-1" title="上に移動" ...>↑</button>
<button class="btn btn-secondary btn-sm" data-mv-release="${rIdx}" data-dir="1"  title="下に移動" ...>↓</button>
<button class="btn btn-sm"               data-dup-release="${rIdx}" title="複製"  style="...紫系...">⧉</button>
<button class="btn btn-danger"           data-del-release="${rIdx}" title="削除"  ...>✕</button>
```

---

## 複製ロジック

### 動作仕様

1. `⧉` ボタンクリックで対象リリース（`C.releases[rIdx]`）をディープコピー（`JSON.parse(JSON.stringify(...))`）
2. コピーに以下の変更を適用：
   - `id`: `genId()` で新規生成
   - `name`: `元の名前 のコピー`
   - `epicKey`: `''`（空にリセット）
   - その他すべてのフィールド（`color`, `startDate`, `releaseDate`, `evalPeriod`, `showEvalZone`, `evalZone`, `items`）: そのまま
3. コピーを元のリリースの**直後**（`rIdx + 1`）に挿入
4. Undo バッファを更新（`_undoSnapshot = JSON.stringify(C)`、`updateUndoBtn()` 呼び出し）
5. `render()` + `renderReleasesList()` で UI を再描画

### イベントハンドラーの追加箇所

既存の `data-del-release` ハンドラーと同様のパターンで、`renderReleasesList()` 内に追加する：

```js
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

## テスト

既存の E2E テスト `tests/e2e/release-crud.spec.js` に以下のケースを追加する：

1. **基本複製**: リリースを複製すると元のリリースの直後に新しいリリースが追加される
2. **名前のコピー**: 複製後のリリース名が `元の名前 のコピー` になっている
3. **Epic キーのリセット**: 複製後の Epic キーが空になっている
4. **アイテムの引き継ぎ**: 元のリリースのアイテム・フェーズが複製先にも存在する

---

## スコープ外

- 複製ダイアログ（名前・日付の事前入力）: 不要
- アイテム単位での複製: 今回は対象外
- フェーズ単位での複製: 今回は対象外
