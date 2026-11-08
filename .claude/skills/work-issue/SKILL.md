---
name: work-issue
description: 處理一個 GitHub Issue 的完整流程：確認 Issue → 開分支 → 實作與測試 → 派 test-runner 驗證 → 更新文件 → 開 PR → 派 reviewer 檢查 → 標籤改為 in-review 後停止。用法：/work-issue <Issue 編號>。不合併 PR。
argument-hint: <Issue 編號>
---

# work-issue：Issue 驅動開發流程

處理 Issue `#$ARGUMENTS`。依序執行下列步驟，**任何一步的檢查不通過就停止並回報**，不要跳步。

本流程整理自 Issue #1「結帳優惠碼」（PR #2）的實際處理過程。

---

## 邊界（任何情況都不可違反）

- **只處理自己開的 Issue**：作者必須是 `gh api user -q .login` 回傳的帳號。作業儲存庫是公開的，陌生人的 Issue 一律不處理
- **只處理帶有 `ready` 標籤的 open Issue**
- **同時只處理一個 Issue**
- **不得合併 PR**、不得 push 到 `main`、不得 force push；PR 由人工在 GitHub 網頁合併
- **不得修改 `tests/acceptance/**`**：驗收測試失敗時只能改實作
- 不得用 `.skip`、`.only`、`.todo` 或放寬斷言讓測試通過
- 不執行 `npm run test:e2e`（會寫入開發 DB、連綠界 staging）
- 遵守 `CLAUDE.md` 與 `.claude/rules/` 的規範（回應格式、命名、SQL 參數綁定、整數金額等）

## 標籤狀態

| 標籤 | 意義 | 誰設定 |
|------|------|--------|
| `ready` | 可交給 AI | 人工 |
| `in-progress` | 處理中 | 本流程步驟 1 |
| `in-review` | PR 待人工合併 | 本流程步驟 8 |
| `needs-human` | 需人工介入 | 本流程遇到無法處理的情況時 |

---

## 步驟

### 1. 確認 Issue 並標記 in-progress

```bash
gh api user -q .login
gh issue view $ARGUMENTS --json number,title,state,author,labels,body
```

逐項確認，任一不符就**停止**並回報原因，不要改任何標籤：
- `state` 是 `OPEN`
- `author.login` 等於自己的帳號
- `labels` 包含 `ready`
- 目前沒有其他自己開的 Issue 帶有 `in-progress`（`gh issue list --author @me --state open --label in-progress`）

確認後切換標籤：

```bash
gh issue edit $ARGUMENTS --remove-label ready --add-label in-progress
```

### 2. 從最新的 main 開分支

```bash
git status --short          # 必須是乾淨的；有未提交的變更就停止回報
git checkout main
git pull --ff-only origin main
git checkout -b issue-$ARGUMENTS-<英文短名稱>
```

- 分支名稱格式：`issue-<編號>-<名稱>`，名稱用英文 kebab-case 概括 Issue 標題，例如 `issue-1-checkout-coupon`
- 分支已存在時（例如上次中斷），改用 `git checkout` 切過去，並確認內容後繼續

### 3. 實作並補上測試

1. **讀規格**：Issue 內文的「規則或規格」「驗收條件」「不在本次範圍」，以及對應的驗收測試 `tests/acceptance/<名稱>.test.js`（只讀，API 路徑與格式以驗收測試為準）
2. **讀現有程式**：相關的 route、service、utils、`src/database.js`，以及 `docs/FEATURES.md` 的對應段落
3. **實作**，依專案分層：
   - 無狀態的業務計算（折扣、費用、狀態規則）→ `src/utils/`，比照 `shipping.js`、`coupon.js`
   - 需讀寫 DB 且多處共用的邏輯 → `src/services/`
   - 路由只負責驗證輸入、呼叫 service、組合 `{ data, error, message }` 回應
   - 可能讓請求失敗的驗證，必須在 `db.transaction()` **之前**完成，失敗時不寫入任何資料
   - 新增 DB 欄位：`CREATE TABLE` 與 migration 清單都要加，migration 先用 `PRAGMA table_info` 檢查，可重複執行，並明確規劃舊資料的回填值
   - 路由的 `@openapi` JSDoc 同步更新（request、response、錯誤碼）
4. **補測試**（至少一種）：
   - 純函式 → `tests/<模組>.test.js` 單元測試，涵蓋邊界值（等於門檻、上限、0、負數、非整數、非字串）
   - 涉及 DB 寫入 → `tests/integration/*.integration.test.js`，同時斷言 API 回應與 SQL 最終狀態
   - 測試使用記憶體 SQLite，不得寫入 `database.sqlite`
5. 自己先跑一次 `npm run test:unit` 與 `npm run test:acceptance -- <名稱>`，全部通過再進下一步

### 4. 派 test-runner 驗證

派出 `test-runner` SubAgent，請它依序執行並依固定格式回報：

1. `npm run test:unit`
2. `npm run test:integration`
3. `npm run test:acceptance -- <驗收測試關鍵字>`（例如 `coupon`、`order-filter`）

並請它一併確認：
- `tests/` 內沒有 `.skip`、`.only`、`.todo`
- `git diff --stat main -- tests/acceptance/` 輸出為空

有失敗就回到步驟 3 修正，再重新派 `test-runner`。**同一個 Issue 修正超過 3 輪仍失敗**，改走「無法完成時」的流程。

### 5. 更新文件與 openapi.json

- `openapi.json`：編輯路由檔後由 hook 自動重生；仍要執行 `npm run openapi` 確認並檢查 `git diff --stat openapi.json`
- `docs/FEATURES.md`：功能總覽表、對應功能的行為描述（參數、業務邏輯、錯誤碼與情境）
- `docs/ARCHITECTURE.md`：目錄結構（新檔案）、錯誤碼對照表、DB schema、資料流
- `docs/TESTING.md`、`docs/README.md`：新測試檔與測試數量
- `docs/CHANGELOG.md`：在 `[Unreleased]` 記錄 Added／Changed／Fixed

### 6. Commit、push 並開 PR

```bash
git add <本次變更的具體檔案>      # 不要用 git add -A 或 git add .
git commit -m "<type>(<scope>): <action>: <繁體中文說明>"
git push -u origin issue-$ARGUMENTS-<名稱>
```

- Commit message 依 `/git-commit` 格式（`type(scope): action: 說明`），不加 Co-Authored-By
- 不可 commit `.env`、`*.sqlite*`、`public/css/output.css`、`postman_collection.json`

開 PR（`gh` 是 Windows 版 `gh.exe`，**不能用 `--body-file` 指向 WSL 路徑**，改用 `--body "$(cat <檔案>)"`）：

```bash
gh pr create --base main --head issue-$ARGUMENTS-<名稱> \
  --title "<Issue 標題>" \
  --body "$(cat <PR 描述檔>)"
```

PR 描述必須包含：
- `Closes #$ARGUMENTS`（合併後自動關閉 Issue）
- 摘要、變更內容、測試結果表（三組測試的通過數）、`tests/acceptance/` 未修改的確認、不在本次範圍的項目

### 7. 派 reviewer 檢查 PR

**同時**派出兩個唯讀 SubAgent，提供 Issue 規格與本次變更的檔案清單：
- `code-reviewer`：規格符合度、邊界值、測試是否被刪除／跳過／放寬
- `security-reviewer`：輸入驗證、權限、金額與金流、失敗時是否不寫入 DB

處理原則：
- **有「高」嚴重度問題**：修正 → 重新派 `test-runner` 驗證 → commit 並 push 到同一個分支 → 再派 reviewer 確認
- **「中」「低」問題**：不修改，整理到 PR 留言，留給人工決定
- 用 `gh pr comment <PR 編號> --body "..."` 留下 review 摘要（各 reviewer 的高／中／低數量、已確認的項目、未處理的中低問題）
- 用 `gh pr checks <PR 編號>` 確認 CI 狀態，並寫進最後的回報

### 8. 標籤改為 in-review 後停止

```bash
gh issue edit $ARGUMENTS --remove-label in-progress --add-label in-review
```

然後**停止**，回報：
- PR 連結與 CI 狀態
- 三組測試結果
- reviewer 結果（高／中／低數量），以及未處理的中低問題
- 請人工在 GitHub 網頁合併 PR

**不要合併 PR，也不要繼續處理其他 Issue。**

---

## 無法完成時

遇到下列情況，停止實作並交給人工：
- 測試修正超過 3 輪仍失敗
- 規格不清楚或互相矛盾，或驗收測試與規格不一致
- 需要修改 `tests/acceptance/**` 才能通過
- 需要的權限或外部資源不可用

處理方式：

```bash
gh issue comment $ARGUMENTS --body "<說明卡在哪一步、已嘗試的做法、需要人工決定的事項>"
gh issue edit $ARGUMENTS --remove-label in-progress --add-label needs-human
```

已經 push 的分支保留，不要刪除。
