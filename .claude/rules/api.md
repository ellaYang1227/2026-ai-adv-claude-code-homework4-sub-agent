---
paths:
  - "src/routes/**"
  - "src/middleware/**"
  - "app.js"
  - "swagger-config.js"
---

# API 設計規則

## 回應格式
- 所有 JSON 回應一律為 `{ data, error, message }` 三個頂層欄位，不可增減
- 成功：`error: null`、`message` 為中文說明；失敗：`data: null`、`error` 為 UPPER_SNAKE_CASE 錯誤碼
- 常用錯誤碼：`VALIDATION_ERROR`(400)、`UNAUTHORIZED`(401)、`FORBIDDEN`(403)、`NOT_FOUND`(404)、`CONFLICT`(409)、`STOCK_INSUFFICIENT`(400)、`INTERNAL_ERROR`(500)
- 驗證失敗用 `return res.status(4xx).json(...)` 提早結束；未預期例外交給 `errorHandler`，不要把 `err.message` 或 stack 直接回給前端

## 命名
- API 路徑 kebab-case（`/api/admin/products`）
- Request body 欄位 camelCase（`productId`、`recipientName`）；Response 欄位 snake_case，直接對應 DB 欄位（`order_no`、`total_amount`）
- 路由檔 camelCase + `Routes.js`，於 `app.js` 以 `app.use('/api/xxx', require(...))` 掛載

## 認證
- 一般會員端點：`authMiddleware`（JWT Bearer，HS256，效期 7d）；後台：`authMiddleware, adminMiddleware`
- 購物車使用 `cartRoutes.js` 內的 `dualAuth`：有 `Authorization` 就只認 JWT（無效即 401，不 fallback），否則用 `X-Session-Id`
- 建立訂單與訂單查詢僅支援 JWT
- 查詢使用者資源時一律帶 `user_id` 條件，避免越權讀取他人訂單

## 輸入驗證
- 使用 `src/utils/validators.js`（`isNonEmptyString`、`isOptionalString`、`parsePositiveInteger`）；新的共用驗證加到此檔
- 數量、頁碼等整數一律經 `parsePositiveInteger`，拒絕 `"3abc"`、`1.9`、陣列
- 金額由後端以 DB 價格重算，不接受前端傳入的總額或運費

## 分層
- 路由只負責驗證輸入、呼叫 service、組合回應
- 多路由共用且需讀寫 DB 的邏輯放 `src/services/`；無狀態業務計算（運費、折扣）放 `src/utils/`

## OpenAPI JSDoc
- 每個端點都要有 `@openapi` 註解，`tags` 使用既有分類（`[Auth]`、`[Products]`、`[Cart]`、`[Orders]`、`[Admin Products]`、`[Admin Orders]`）
- 需認證端點加 `security: - bearerAuth: []`；購物車另加 `- sessionId: []`
- 列出所有可能的狀態碼，schema 必含 `data`、`error`、`message`
- 修改路由後 `openapi.json` 會由 hook 自動重生；不要手改 `openapi.json` 或 `postman_collection.json`
