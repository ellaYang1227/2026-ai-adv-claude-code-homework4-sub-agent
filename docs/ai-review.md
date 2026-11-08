# AI Code Review 報告

- 日期：2026-11-08
- 範圍：訂單、付款、運費、購物車與相關測試
- 審查方式：主 Agent 派出 3 個 SubAgent 分工檢查，再合併結果、去除重複，並逐一回到原始碼核對位置
  - `security-reviewer`：權限、身分驗證、金流驗證、輸入驗證（唯讀）
  - `code-reviewer`：業務邏輯與邊界、規格符合度、測試完整性（唯讀）
  - `test-runner`：執行 `test:unit`、`test:integration`
- 本階段只記錄問題，**未修改任何程式碼**

## 測試執行結果

| 指令 | 結果 |
|------|------|
| `npm run test:unit` | 54 passed、**1 skipped**（`tests/shipping.test.js:29`） |
| `npm run test:integration` | 10 passed |

測試全部通過，但下列問題都沒有被測出來：有的測試被 `skip`，有的缺少負面情境。

---

## 主要問題（5 個）

### 1. 運費：免運門檻少算剛好 1,500 元

- **位置**：`src/utils/shipping.js:40` `qualifiesForFreeShipping()`
- **問題**：判斷式是 `subtotal > 1500`，規格是「滿 1,500 元免基本運費」，應為 `>=`。
  - `docs/FEATURES.md` 寫「滿 1,500 元」
  - 前端 `public/js/pages/checkout.js:28` 用 `cartTotal.value >= 1500`
  - `tests/orders.test.js:48` 的期望值也用 `>= 1500`
- **錯誤結果**：`calculateShipping({ subtotal: 1500, method: 'home_delivery' })` 回傳 `shippingFee: 120`、`totalAmount: 1620`，應為 `0`、`1500`。結帳頁顯示免運，但寫入 DB 並送到綠界的金額多了 120 元（超商多 60 元），前後端金額不一致。
- **發現者**：`code-reviewer`、`security-reviewer`
- **修正方向**：改為 `subtotal >= SHIPPING_RATES.FREE_SHIPPING_THRESHOLD`

### 2. 測試：1,500 元邊界測試被跳過

- **位置**：`tests/shipping.test.js:29` `it.skip('商品小計 1,500 元時免基本運費')`
- **問題**：唯一測到免運門檻邊界的測試被 `it.skip` 停用，問題 1 因此在「測試全部通過」的狀態下存在。移除 `.skip` 後此測試會失敗（實際 120、預期 0）。
- **發現者**：`test-runner`（回報 1 skipped）、`code-reviewer`、`security-reviewer`
- **修正方向**：移除 `.skip`，並補上超商取貨的 1,500 元邊界案例

### 3. 訂單查詢：可以查看別人的訂單（IDOR）

- **位置**：`src/routes/orderRoutes.js:350-351` `GET /api/orders/:id`
- **問題**：用 `findOrderById(req.params.id)` 查詢，SQL 只有 `WHERE id = ?`，沒有限制 `user_id`。同檔的 `PATCH /:id/pay`、`POST /:id/check-payment` 都已改用 `findOrderForUser()`，只有這支漏掉。
- **錯誤結果**：會員 B 用自己的 JWT 呼叫 `GET /api/orders/<會員 A 的訂單 id>`，回 200 並取得 A 的收件人姓名、Email、地址與購買品項；應回 404 `NOT_FOUND`、`data: null`。
- **發現者**：`code-reviewer`、`security-reviewer`
- **修正方向**：改用 `findOrderForUser(req.params.id, req.user.userId)`，查不到回 404（不回 403，避免透露訂單存在）

### 4. 購物車數量：PATCH 沒有驗證正整數

- **位置**：`src/routes/cartRoutes.js:296-299` `PATCH /api/cart/:itemId`
- **問題**：只用 `Number(quantity)` 擋 `NaN`，沒有使用 `parsePositiveInteger()`；同檔的 `POST /api/cart` 有用。
- **錯誤結果**：
  - `{ quantity: 1.5 }` → 回 200，DB 存成 1.5。之後建單時 `subtotal = 單價 × 1.5` 變成非整數金額（例如單價 333 → 499.5），庫存也會被扣成小數，違反「金額一律整數元」
  - `{ quantity: true }`、`[5]` → 被轉成 1、5 並接受
  - `{ quantity: 0 }`、`-1`、`""`、`null` → 通過驗證後撞到 DB `CHECK(quantity > 0)`，回 500 `INTERNAL_ERROR`
  - 以上都應回 400 `VALIDATION_ERROR`
- **發現者**：`code-reviewer`、`security-reviewer`
- **修正方向**：`const qty = parsePositiveInteger(quantity); if (qty === null) return 400 VALIDATION_ERROR`

### 5. 付款狀態：缺少 CheckMacValue 時會跳過簽章驗證

- **位置**：`src/services/paymentService.js:15` `isTradePaid()`
- **問題**：判斷式是 `if (tradeInfo.CheckMacValue && !verifyCheckMacValue(...))`，回應沒帶 `CheckMacValue` 時整段驗證被跳過，違反「付款結果必須以 `verifyCheckMacValue()` 驗證」。
- **錯誤結果**：綠界查詢回應（或被竄改、偽造的回應）為 `MerchantTradeNo=<正確>&TradeAmt=<正確>&TradeStatus=1` 且不帶 `CheckMacValue` 時，訂單會被改成 `paid`；應回 500 並維持 `pending`。`MerchantTradeNo` 與金額都是可預期的值，不能單獨當作防線。
- **發現者**：`code-reviewer`、`security-reviewer`
- **修正方向**：改為無條件驗證 `if (!verifyCheckMacValue(tradeInfo, config.hashKey, config.hashIV)) throw ...`（缺值時 `verifyCheckMacValue` 本來就回 false）

---

## 測試缺口（讓主要問題沒被發現）

| # | 位置 | 缺少的情境 | 對應問題 |
|---|------|------------|----------|
| T1 | `tests/orders.test.js` | 會員 B 查詢會員 A 的訂單詳情應回 404、`data: null` | 3 |
| T2 | `tests/cart.test.js:46-56` | PATCH 帶 `0`、`-1`、`1.5`、`"3abc"`、`[5]` 應回 400；超過庫存應回 400 `STOCK_INSUFFICIENT`；並以 SQL 確認數量未變 | 4 |
| T3 | `tests/integration/order-checkout.integration.test.js:421-454` | `forgedResponses` 缺「不帶 CheckMacValue 的已付款回應」與「簽章正確但 MerchantTradeNo 不符」，兩者都應回 500 且訂單維持 `pending` | 5 |
| T4 | `tests/orders.test.js:53、121`、`tests/adminOrders.test.js:72-73`、`tests/cart.test.js:27` | 只用 `toHaveProperty` 確認欄位存在，沒有斷言金額或數量的值 | — |

---

## 其他發現（次要）

| # | 嚴重度 | 位置 | 問題 | 發現者 |
|---|--------|------|------|--------|
| O1 | 中 | `src/routes/pageRoutes.js:61-62` `GET /ecpay/payment/:orderId` | 付款表單頁沒有身分驗證，直接 `findOrderById`；取得訂單 id 的人都能看到 pending 訂單的金額與品項，並替他人發起付款。訂單 id 為 uuid v4，不易猜測，但會與問題 3 互相洩漏 id | `security-reviewer` |
| O2 | 低 | `src/routes/cartRoutes.js:12` `dualAuth` | 只有 `Authorization` 以 `Bearer `（區分大小寫）開頭才驗 JWT；`bearer xxx`、`Basic xxx` 會悄悄降級成用 `X-Session-Id` 的訪客，違反「帶了 Authorization 就只認 JWT」 | `security-reviewer` |
| O3 | 低 | `src/routes/orderRoutes.js:520-528` `check-payment` | 忽略 `markOrderPaid()` 的回傳值；訂單在查詢期間被改成 failed 時，仍回 message「付款成功」，與 `data.status` 不一致 | `code-reviewer` |
| O4 | 低 | `src/database.js:78` `order_items.quantity` | 沒有 `CHECK(quantity > 0)`，配合問題 4，小數數量可寫進訂單快照 | 兩者 |
| O5 | 低 | `src/routes/adminOrderRoutes.js:91-92` | `page`、`limit` 用 `parseInt`，`?page=3abc` 會被當成 3，沒有回 400 | 兩者 |
| O6 | 低 | `src/utils/ecpay.js:4-6` `ECPAY_CONFIG` | 沒有環境變數時使用寫死的 staging 金鑰；正式環境漏設時不會報錯，會靜默改用公開金鑰 | `security-reviewer` |

## 待確認

- **綠界付款通知**：`src/utils/ecpay.js:114` 把 `ReturnURL` 設為 `/ecpay/notify`，但 `src/routes` 沒有對應路由，綠界通知會收到 404，目前只靠會員觸發 `check-payment`。需確認是刻意只用主動查詢，還是缺少 handler。
- **訂單列表排序**：`created_at` 只精確到秒，同一秒建立的訂單順序不固定；Issue B 實作時建議加上 `rowid DESC` 作為次排序。
- ~~訪客 `X-Session-Id` 是否可預測~~：已確認 `public/js/auth.js:37` 使用 `crypto.randomUUID()`，排除。

## 已確認無誤的項目

- 建單 transaction 順序正確（建立訂單 → 品項快照 → 扣庫存 → 清空購物車），失敗整體回滾，庫存不足先回 400
- 金額由 DB 價格重算；附加費一定收取
- 訂單列表帶 `user_id`，依 `created_at DESC` 排序
- `PATCH /api/orders/:id/pay` 只在 test 環境開放，只允許 `pending → paid／failed`，並以 `AND status = 'pending'` 原子更新
- `jwt.verify` 固定 `HS256` 並確認 user 存在；後台路由同時掛 `authMiddleware` 與 `adminMiddleware`
- 註冊時 `role` 寫死為 `'user'`；合併訪客購物車以庫存為上限
- SQL 全部使用 `?` 綁定；`errorHandler` 遇到 500 不外洩 `err.message`；CORS 不是 `*`

---

## 修正紀錄（2026-11-08）

本次只修正 5 個主要問題，並補上測試缺口 T1～T3；T4 與「其他發現」O1～O6 暫不處理。

| 問題 | 修改 |
|------|------|
| 1 運費門檻 | `src/utils/shipping.js`：`>` 改為 `>=` |
| 2 被跳過的測試 | `tests/shipping.test.js`：移除 `it.skip`，改為宅配、超商兩種配送方式各測 1,500 元邊界，並斷言 `totalAmount` |
| 3 訂單 IDOR | `src/routes/orderRoutes.js`：`GET /api/orders/:id` 改用 `findOrderForUser(id, userId)` |
| 4 購物車數量 | `src/routes/cartRoutes.js`：`PATCH /api/cart/:itemId` 改用 `parsePositiveInteger()`，不合法回 400 `VALIDATION_ERROR` |
| 5 付款驗簽 | `src/services/paymentService.js`：`isTradePaid()` 改為無條件 `verifyCheckMacValue()` |
| T1 | `tests/orders.test.js`：他人查詢訂單詳情回 404、`data: null`、`error: NOT_FOUND` |
| T2 | `tests/cart.test.js`：PATCH 帶 `0`、`-1`、`1.5`、`"3abc"`、`""`、`null`、`true`、`[5]` 回 400；超過庫存回 400 `STOCK_INSUFFICIENT`；並以 SQL 確認數量維持不變 |
| T3 | `tests/integration/order-checkout.integration.test.js`：`forgedResponses` 新增「不帶 CheckMacValue」與「MerchantTradeNo 不符」兩種回應 |

### 驗證

| 指令 | 修正前 | 修正後 |
|------|--------|--------|
| `npm run test:unit` | 54 passed、1 skipped | **66 passed** |
| `npm run test:integration` | 10 passed | **10 passed** |

另將 `src/` 暫時還原為修正前版本執行新測試：unit 12 項失敗、integration 1 項失敗，確認新測試能抓到上述問題。
