---
paths:
  - "tests/**"
  - "vitest.config.js"
  - "vitest.integration.config.js"
  - "vitest.acceptance.config.js"
  - "playwright.config.js"
---

# 測試規則

## 測試分層
| 類型 | 位置 | 設定檔 | 指令 |
|------|------|--------|------|
| Unit / API | `tests/*.test.js` | `vitest.config.js` | `npm run test:unit` |
| Integration | `tests/integration/*.integration.test.js` | `vitest.integration.config.js` | `npm run test:integration` |
| Acceptance | `tests/acceptance/*.test.js` | `vitest.acceptance.config.js` | `npm run test:acceptance -- <檔名>` |
| E2E | `tests/e2e/*.spec.js` | `playwright.config.js` | `npm run test:e2e`（需先啟動 3001） |

## DB 隔離（最重要）
- 所有 Vitest 設定先載入 `tests/setup/testEnvironment.js`（`NODE_ENV=test`、`DATABASE_PATH=:memory:`）再 import app
- 絕不寫入專案 `database.sqlite`；integration 有 SHA-256 守衛會檢查
- 每個測試檔自建所需資料，不依賴其他檔案或執行順序；integration 使用 `beforeEach/afterEach(resetDatabase)`

## 撰寫慣例
- 測試檔使用 CommonJS；從 `tests/setup.js` 取得 `app`、`request`、`getAdminToken()`、`registerUser()`
- **不要** `require('../app')` 直接交給 supertest，改用 `tests/setup/testServer.js` 已綁定 `127.0.0.1` 的 app
- API 斷言同時檢查 HTTP status 與 `{ data, error, message }` 結構（錯誤時 `data` 為 `null`、`error` 為錯誤碼）
- 重要寫入（訂單、庫存、購物車）要再以 SQL 查詢驗證 DB 最終狀態
- Fixture 價格、庫存、數量使用可預測整數，方便手算期望金額
- 邊界值（運費門檻、數量 0/負數/非整數字串）要各有測試

## 外部服務
- 綠界 QueryTradeInfo 必須 `vi.stubGlobal('fetch', ...)` mock，禁止真實網路請求
- mock「已付款」回應須以 `generateCheckMacValue()` 簽章並帶正確 `MerchantTradeNo`、`TradeAmt`
- `afterEach` 還原 `vi` mocks / spies

## 禁止事項
- **不得修改 `tests/acceptance/**`**（助教提供的驗收測試），只能修改實作讓它通過
- `playwright.config.js` 不得加入 `webServer`；E2E 會寫入開發 DB 並連綠界 staging，不進 CI
- CI 只跑 unit + integration，新測試不可依賴外部網路
