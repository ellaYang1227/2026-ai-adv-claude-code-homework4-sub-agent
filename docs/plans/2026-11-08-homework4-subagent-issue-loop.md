# 2026-11-08 第四場作業：SubAgent 小隊、Issue 驅動開發與 Loop 自動化

## User Story

- 作為開發者，我希望定義分工明確的 SubAgent 來審查專案程式碼，以便找出 `main` 中埋藏的 5 個問題並修正。
- 作為開發者，我希望用 GitHub Issue 承接需求，走完「讀 Issue → 實作 → 測試 → 開 PR → Review」，並把流程整理成可重複使用的 `work-issue` Skill。
- 作為開發者，我希望用 `/loop` 定時領取並處理標記為 `ready` 的 Issue，PR 開出後讀取 GitHub Actions 結果並在失敗時自動修正，直到 Issue A、Issue B 都關閉。
- 作為會員，我希望結帳時能輸入優惠碼折抵商品金額（Issue A）。
- 作為會員，我希望查詢我的訂單時能依狀態篩選並分頁（Issue B）。

---

## Spec

### 0. 前置條件與現況差異

| 項目 | 現況 | 需要處理 |
|------|------|----------|
| GitHub CLI | 已安裝 Windows 版 `gh.exe` 2.103.3，已登入 `ellaYang1227`（ssh，scope 含 `repo`）；WSL 內已建立連結 `/usr/local/bin/gh` → `gh.exe`，`gh` 可直接使用 | 無 |
| Remote | `origin` = `git@github.com:ellaYang1227/2026-ai-adv-claude-code-homework4-sub-agent.git` | 確認 SSH key 可 push |
| `git push` | 已加入 `permissions.allow`，自動執行不詢問；force push 仍為 deny | 無；挑戰三 Loop 可自動推送修正 |
| Node 執行環境 | 使用 Windows 版 node（nvm4w），sandbox 已關閉 | 無 |
| 現有 SubAgent | 已全部移除（`.claude/agents/` 不存在） | 挑戰一重新建立 |
| 驗收測試 | `tests/acceptance/` 有 coupon、order-filter、cancel-order 三份 | 本次作業只需 coupon（Issue A）、order-filter（Issue B）；cancel-order 不在範圍 |

### 1. 挑戰一：SubAgent 小隊與 AI Code Review

#### 1.1 SubAgent 定義（`.claude/agents/`）

| SubAgent | 職責 | 必要設定 |
|----------|------|----------|
| `security-reviewer` | 權限、身分驗證、金流驗證與輸入驗證 | `tools` 只給唯讀工具（Read、Grep、Glob），Review 時不會順手改程式 |
| `code-reviewer` | 業務邏輯與邊界、是否符合規格、測試是否被刪除／跳過／放寬 | `tools` 只給唯讀工具 |
| `test-runner` | 執行測試，只回報失敗項目、位置與可能原因 | `model` 為較低規模模型（sonnet／haiku）；不得有 Edit、Write |
| `e2e-tester` | 用 Playwright MCP 操作瀏覽器，跑結帳到綠界付款的 E2E 流程並截圖 | 以 `skills` 預載第二場的 E2E Skill、以 `mcpServers` 掛上 Playwright MCP |

- 每個 agent 的 `description` 寫清楚**何時派出**，內文定義**固定的輸出格式**。
- `e2e-tester`（必作）：
  - E2E Skill 來源：第二場作業 `../2026-ai-adv-claude-code/.claude/skills/e2e-payment-test/SKILL.md`，複製到本專案 `.claude/skills/e2e-payment-test/`。
  - Skill 原本針對第二場的網站（Bloom & Co.），需改成本專案：`http://localhost:3001`、帳號 `admin@hexschool.com`、宅配欄位、綠界 staging 的網路 ATM 流程，可參考 `tests/e2e/ecpay-atm-payment.spec.js`。
  - frontmatter 範例：`skills: [e2e-payment-test]`；`mcpServers` 掛 Playwright MCP（`npx @playwright/mcp@latest`）。
  - 會寫入開發 DB、扣庫存、連綠界 staging，執行前須先啟動 3001 服務；不進 CI。

#### 1.2 派出 SubAgent 檢查

- 請主 Agent 派 `security-reviewer` 與 `code-reviewer` 檢查訂單、付款、運費、購物車與相關測試，再派 `test-runner` 跑 `test:unit`、`test:integration`。
- 結果整理到 `docs/ai-review.md`，**這一步不修改程式碼**。
- 問題分布範圍：訂單查詢、付款狀態、運費計算、購物車數量、測試。
- 每個問題需寫出位置（檔案與行數或函式名稱）與說明；只寫「建議加強驗證」不算找到。
- 已觀察到的候選：`src/utils/shipping.js` 的 `qualifiesForFreeShipping()` 使用 `subtotal > 1500`。Issue A 驗收條件為「折扣後剛好 1,500 元免基本運費」，代表門檻應為 `>=`。實際是否列入，以 SubAgent 審查結果為準。

#### 1.3 修正問題

- 確認 `docs/ai-review.md` 後修正問題，跑過 `test:unit` 與 `test:integration`。
- 連同 `docs/ai-review.md` 一起 commit 並推上 `main`。
- 共 5 個問題，沒修到的會在挑戰二的驗收測試中顯現。

### 2. 挑戰二：Issue 驅動開發（手動觸發）

#### 2.1 開立 Issue 與鎖定驗收測試

1. 在 GitHub 儲存庫建立 4 個標籤：`ready`（可交給 AI）、`in-progress`（處理中）、`in-review`（PR 待人工合併）、`needs-human`（需人工介入）。
2. 在 GitHub 網頁新增 Issue A（標題「結帳優惠碼」，內容見附錄），加上 `ready`。
3. 在 `.claude/settings.json` 的 `permissions.deny` 加入 `"Edit(./tests/acceptance/**)"`，commit 並推上 `main`。
   - 終端機指令仍可能改到檔案，所以 reviewer 也要檢查。
   - 現有 `protect-files.sh` hook 也已擋下 Edit/Write，兩者並存。

#### 2.2 用白話帶 AI 完成 Issue A（此步不建立 Skill）

1. 讀 Issue，確認帶有 `ready` 且是自己開的，把標籤改為 `in-progress`。
2. 從最新的 `main` 開分支 `issue-<編號>-<名稱>`（例如 `issue-1-checkout-coupon`）。
3. 實作，並補上 Unit 或 Integration Test。
4. 派 `test-runner` 跑 unit、integration 與 `npm run test:acceptance -- coupon`。
5. 更新 `docs` 與 `openapi.json`。
6. 開 PR，描述寫上 `Closes #<編號>`。
7. 派 reviewer 檢查 PR，有「高」嚴重度的問題就修正。
8. 把標籤改為 `in-review` 後停下來。

GitHub Actions 通過後，由本人在 GitHub 網頁合併 PR，Issue 會自動關閉。

#### 2.3 把流程整理成 Skill

- 在同一個對話中，依剛才的流程建立 `.claude/skills/work-issue/SKILL.md`，用 `/work-issue <編號>` 呼叫。
- 步驟與邊界都要寫進去，**不包含合併 PR**。
- 確認 Skill 包含 2.2 的步驟與邊界後，commit 並推上 `main`。

### 3. 挑戰三：Loop 自動觸發與 CI 回饋

#### 3.1 撰寫 `.claude/loop.md`

`/loop` 不帶 prompt 時會使用此檔。依以下精簡格式建立，再依自己的流程調整：

```markdown
# Issue Loop

每輪依序判斷，做完一件事就結束本輪。只看自己開的 open Issue（--author @me --state open）。

1. 有 in-progress：上一輪沒有正常結束，在 Issue 留言說明，改為 needs-human
2. 有 in-review：用 gh pr checks 查 PR 的 CI
   - 失敗：用 gh run view <run id> --log-failed 取得 log，交給 test-runner 分析，修正後推送
   - 執行中或已通過：等待人工合併，本輪不領新的 Issue
3. 有 ready：取建立時間最早的一個，執行 /work-issue <編號>
4. 都沒有：本輪不做事，等待下一輪（作業完成後再手動取消排程）

## 邊界
- 同時只處理一個 Issue，只處理自己開的 Issue
- 修正輪數以 Issue 上的回報留言計算，合計超過 3 輪就改為 needs-human
- 不得合併 PR，不得修改 tests/acceptance/

## 每輪回報
本輪有動作，就在該 Issue 留言：
Loop 回報｜Issue #<編號>｜第 <N> 輪
- 本輪動作：
- CI 狀態：
- 下一步：
```

使用 `--author @me` 的原因：作業儲存庫是公開的，不過濾就等於讓陌生人寫的 Issue 指揮你電腦上的 AI。

#### 3.2 啟動 Loop 並加入第二個 Issue

1. 在 Claude Code 執行 `/loop`，設定間隔 1 分鐘（實務上建議 10 分鐘以上）。排程只存在於目前的 session，作業期間請保持開啟。
2. 開啟錄影。
3. Loop 啟動後，到 GitHub 網頁貼上 Issue B（標題「我的訂單篩選與分頁」）並加上 `ready`。
4. 錄下 Loop 自動讀取 Issue 的過程。
5. 完成後確認：兩個 Issue 全部關閉、每輪都有回報留言；截下排程任務清單，並取消排程。

如果沒有正確錄到，可以隨意開一個 Issue 觸發 Loop。

### 4. Issue A：結帳優惠碼

#### 功能規則

| 優惠碼 | 折扣內容 | 使用條件 |
|--------|----------|----------|
| `FLOWER100` | 折抵 100 元 | 商品小計滿 800 元 |
| `SPRING10` | 商品小計打 9 折，最多折抵 300 元 | 無門檻 |
| `SUMMER50` | 折抵 50 元 | 已失效，不可使用 |

- 每張訂單最多使用 1 組優惠碼，優惠碼不分大小寫。
- 優惠只折抵商品小計，不折抵運費。
- 免運門檻（1,500 元）以**折扣後**的商品小計判斷。
- 折扣金額四捨五入至整數。
- 訂單總額 = 商品小計 − 折扣 + 運費。
- 無效、已失效或未達門檻：回傳 400 與錯誤訊息，不建立訂單、不扣庫存、不清空購物車。

#### API 變更

- `POST /api/orders`：body 新增選填 `couponCode`（string）。
- 建單成功回應的 `data` 需包含 `subtotal`、`discount`、`shipping_fee`、`total_amount`、`coupon_code`。
  - 未使用優惠碼時 `discount` 為 `0`。
  - `coupon_code` 以大寫記錄。
- `GET /api/orders/:id`：回傳 `coupon_code` 與 `discount`。
- 錯誤回應遵守 `{ data: null, error, message }`，驗收測試只檢查 400、`error` 為非空字串、`message` 為字串。錯誤碼可用 `INVALID_COUPON`（無效／失效）與 `COUPON_NOT_APPLICABLE`（未達門檻），或統一用 `VALIDATION_ERROR`。

#### 實作設計

- **`src/utils/coupon.js`（新增）**：比照 `shipping.js` 的無狀態純函式模組。
  - 定義三組優惠碼（含失效狀態）。
  - 匯出 `applyCoupon({ code, subtotal })`，回傳 `{ couponCode, discount, discountedSubtotal }`；不合法時拋出帶錯誤碼的錯誤或回傳錯誤物件。
- **`src/database.js`**：`orders` 表以可重複執行的 migration 新增欄位。
  - 先用 `PRAGMA table_info(orders)` 檢查欄位是否已存在。
  - `coupon_code TEXT`（可為 NULL）。
  - `discount INTEGER NOT NULL DEFAULT 0 CHECK(discount >= 0)`；舊資料回填 0。
- **`src/routes/orderRoutes.js`**：
  - 驗證 `couponCode` 型別。
  - 計算小計後先套用優惠碼，**優惠碼驗證必須在 transaction 之前完成**。
  - 以折扣後小計呼叫 `calculateShipping()`。
  - 總額 = 小計 − 折扣 + 運費。
- **`src/services/orderService.js`**：`createOrderFromCart()` 寫入 `coupon_code`、`discount`；`serializeOrder()`、詳情查詢帶出兩欄。
- **ECPay**：付款金額使用新的 `total_amount`。確認 `src/utils/ecpay.js` 與 `paymentService.isTradePaid()` 比對的是折扣後總額。
- **`@openapi` JSDoc**：更新 `POST /api/orders` 的 request 與 response、`GET /api/orders/:id` 的 response。

#### 驗收條件（`tests/acceptance/coupon.test.js`，不得修改）

| 情境 | 期望 |
|------|------|
| `FLOWER100`，小計 800 | 可使用，折抵 100 |
| `FLOWER100`，小計 799 | 400 |
| `SPRING10`，小計 1,000／1,234／3,500 | 折 100／123／300（上限） |
| `SUMMER50` | 400 |
| `FLOWER100`，小計 1,550 | 折扣後 1,450，宅配收 120 運費 |
| `FLOWER100`，小計 1,600 | 折扣後剛好 1,500，免基本運費（需門檻為 `>=`） |
| 小寫 `flower100` | 可正常使用 |
| 未使用優惠碼 | `discount` 為 0，其餘金額與原本相同 |
| `GET /api/orders/:id` | 回傳使用的優惠碼與折扣金額 |
| 使用無效優惠碼 | 訂單數量、庫存與購物車皆不變 |

#### 不在範圍

- 後台管理優惠碼（新增、停用、修改）。
- 使用次數上限、每人限用次數。
- 前端結帳頁的優惠碼輸入欄位（選做）。

### 5. Issue B：我的訂單篩選與分頁

#### 功能規則

- `GET /api/orders` 支援以下查詢參數：
  - `status`：`pending`、`paid`、`failed`。
  - `page`：預設 1。
  - `limit`：預設 10，最大 50，超過以 50 計。
- 只回傳自己的訂單，依建立時間由新到舊排序。
- 回應格式比照 `GET /api/admin/orders`：

  ```
  { data: { orders: [...], pagination: { page, limit, total, totalPages } }, error, message }
  ```

- `status` 不在允許值內，或 `page`、`limit` 不是正整數：回傳 400。
- 既有前端訂單頁（`public/js/pages/orders.js`）需配合新格式正常顯示。目前它讀取 `res.data.orders`，新格式保留此欄位，應可相容，仍需確認。

#### 實作設計

- **`src/services/orderService.js`**：`listOrdersForUser(userId)` 擴充為 `listOrdersForUser(userId, { status, page, limit })`，回傳 `{ orders, total }`。
  - SQL 一律使用 `?` 綁定；`status` 只接受白名單值。
  - 加上 `COUNT(*)` 查詢與 `LIMIT ? OFFSET ?`。
  - 排序使用 `ORDER BY created_at DESC, rowid DESC`：`created_at` 只精確到秒，需要穩定的次排序。
- **`src/routes/orderRoutes.js`**：
  - 驗證查詢參數：`page`、`limit` 使用 `parsePositiveInteger()`，有帶但不合法就回 400；`limit` 上限 50。
  - 回傳 `pagination`，其中 `totalPages = Math.ceil(total / limit)`。
- 與 admin 版的差異：`adminOrderRoutes.js` 用 `parseInt` 寬鬆解析、`limit` 上限 100；Issue B 要求嚴格驗證、上限 50，**不修改 admin 版**。
- **`@openapi` JSDoc**：新增 `status`、`page`、`limit` 參數、400 回應與 `pagination` schema。

#### 驗收條件（`tests/acceptance/order-filter.test.js`，不得修改）

| 情境 | 期望 |
|------|------|
| 不帶參數 | 第 1 頁、每頁 10 筆，依建立時間由新到舊；12 筆時 `pagination` 為 `{ page: 1, limit: 10, total: 12, totalPages: 2 }` |
| 不同時間建立的訂單 | 較新的排在前面 |
| `status=paid` | 只回傳已付款訂單 |
| 12 筆訂單、`limit=5` | 第 3 頁有 2 筆，`totalPages` 為 3 |
| `limit=100` | 以 50 計 |
| `status=unknown`、`page=0`、`limit=-1` | 400 |
| 其他會員的訂單 | 不會回傳 |

#### 不在範圍

- 後台訂單列表（`GET /api/admin/orders`）的調整。
- 依日期區間或關鍵字搜尋。
- 前端訂單頁的篩選與分頁 UI（選做）。

---

## Tasks

### 前置

- [x] 安裝 GitHub CLI 並 `gh auth login`，確認 `gh repo view` 可用（Windows 版 `gh.exe`）
- [x] 讓 WSL 可用 `gh` 指令（`/usr/local/bin/gh` → `gh.exe`）
- [x] 確認 `main` 與 `origin/main` 同步

### 挑戰一

- [x] 建立 `security-reviewer`（tools：Read、Grep、Glob）
- [x] 建立 `code-reviewer`（tools：Read、Grep、Glob；含測試刪除／跳過／放寬檢查）
- [x] 建立 `test-runner`（model：sonnet 或 haiku；不得有 Edit、Write；只回報失敗項目、位置與可能原因）
- [x] 複製第二場 `e2e-payment-test` Skill 到 `.claude/skills/`，改成本專案的網址、帳號與結帳流程
- [x] 建立 `e2e-tester`（`skills` 預載 `e2e-payment-test`、`mcpServers` 掛 Playwright MCP）
- [x] 啟動 3001 服務，派 `e2e-tester` 實跑一次，確認能完成付款並截圖（2026-11-08：兩次實跑皆通過；第二次訂單 ORD-20261108-29250 已付款，截圖存於 `test-results/e2e-mcp/`）
- [x] 確認四個 agent 的 `description` 寫清楚派出時機、內文有固定輸出格式
- [x] commit 並推上 `main`
- [x] 派 `security-reviewer`、`code-reviewer` 審查，派 `test-runner` 跑 unit 與 integration
- [x] 整理 `docs/ai-review.md`（至少 3 個問題，每個附位置與說明），此步不改程式碼
- [x] 修正問題，跑過 `test:unit`、`test:integration`
- [x] 連同 `docs/ai-review.md` commit 並推上 `main`

### 挑戰二

- [x] 用 `gh label create` 建立 `ready`、`in-progress`、`in-review`、`needs-human`
- [x] 在 GitHub 網頁建立 Issue A 並加上 `ready`
- [x] `.claude/settings.json` 的 `permissions.deny` 加入 `"Edit(./tests/acceptance/**)"`，commit 並推上 `main`
- [x] Issue A：標籤改為 `in-progress`
- [x] Issue A：開分支 `issue-<編號>-checkout-coupon`
- [x] Issue A：新增 `src/utils/coupon.js` 與單元測試 `tests/coupon.test.js`
- [x] Issue A：`orders` 表 migration 新增 `coupon_code`、`discount`
- [x] Issue A：`POST /api/orders` 套用優惠碼，運費以折扣後小計計算
- [x] Issue A：`GET /api/orders/:id` 回傳兩欄，確認 ECPay 金額使用新總額
- [x] Issue A：補 integration test（無效優惠碼時訂單、庫存、購物車不變）
- [x] Issue A：派 `test-runner` 跑 unit、integration、`test:acceptance -- coupon`
- [x] Issue A：更新 JSDoc、`openapi.json`、`docs/FEATURES.md`、`docs/ARCHITECTURE.md`（schema）、`docs/CHANGELOG.md`
- [x] Issue A：開 PR（`Closes #<編號>`），派 reviewer 檢查，修正「高」嚴重度問題
- [x] Issue A：標籤改為 `in-review`，等待 CI 通過後由本人合併
- [x] 建立 `.claude/skills/work-issue/SKILL.md`（`/work-issue <編號>`，含步驟與邊界，不含合併 PR）
- [x] commit 並推上 `main`

### 挑戰三

- [ ] 建立 `.claude/loop.md`（依 3.1 格式）
- [ ] commit 並推上 `main`
- [ ] 執行 `/loop`（間隔 1 分鐘），開始錄影
- [ ] 在 GitHub 網頁建立 Issue B 並加上 `ready`
- [ ] Loop 自動處理 Issue B：實作 `GET /api/orders` 篩選與分頁、補測試、跑 `test:acceptance -- order-filter`、更新文件、開 PR
- [ ] 確認前端訂單頁仍正常顯示
- [ ] CI 失敗時 Loop 自動修正；通過後由本人合併
- [ ] 確認兩個 Issue 皆關閉、每輪都有回報留言
- [ ] 截下排程任務清單，取消排程

### 收尾

- [ ] `npm run test:unit`、`npm run test:integration`、`npm run test:acceptance -- coupon`、`npm run test:acceptance -- order-filter` 全數通過
- [ ] 更新 `docs/FEATURES.md`、`docs/CHANGELOG.md`
- [ ] 本計畫移至 `docs/plans/archive/`
