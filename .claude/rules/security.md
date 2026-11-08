# 安全性規則

## 輸入驗證
- 所有 request body / query / params 先驗型別再使用：字串用 `isNonEmptyString`，整數用 `parsePositiveInteger`
- 拒絕非預期型別（物件、陣列）以免繞過驗證；錯誤回 400 `VALIDATION_ERROR`
- 列舉值（訂單狀態、配送方式）以白名單比對

## SQL Injection
- 一律使用 better-sqlite3 prepared statement 與 `?` 參數綁定
- 禁止以樣板字串或 `+` 拼接使用者輸入到 SQL；動態欄位/排序只能來自程式內白名單

## 認證與授權
- JWT 驗證固定 `algorithms: ['HS256']`，並確認 user 仍存在於 DB
- `JWT_SECRET` 只從環境變數讀取，不可寫死或有預設值
- 後台端點必須同時掛 `authMiddleware` 與 `adminMiddleware`
- 存取訂單等個人資源時，SQL 條件必須包含 `user_id = req.user.userId`（防 IDOR）
- `role` 不可由註冊或更新 API 的 request body 指定

## 密碼
- 使用 bcrypt 雜湊（`NODE_ENV=test` 為 1 round，其餘 10 rounds），只存 `password_hash`
- 任何回應都不可包含 `password_hash`；登入失敗訊息不區分「帳號不存在」或「密碼錯誤」

## 金流（綠界）
- 付款結果必須以 `verifyCheckMacValue()` 驗證簽章，並比對 `MerchantTradeNo` 與金額，任一不符不得改為 `paid`
- 訂單金額由後端計算，前端傳入值不可信
- `PATCH /api/orders/:id/pay` 模擬付款只在 `NODE_ENV=test` 開放
- HashKey/HashIV 從環境變數讀取，不可輸出到 log 或回應

## 錯誤處理與資訊外洩
- 500 錯誤只回 `INTERNAL_ERROR` 與通用訊息，不回傳 stack、SQL 或 `err.message`
- log 中不印出 token、密碼、金鑰

## XSS / CORS
- EJS 動態內容用 `<%= %>`；Vue 禁用 `v-html` 渲染使用者資料
- CORS 只允許 `FRONTEND_URL`，不可設為 `*`
- 不可 commit `.env`；新增環境變數時同步更新 `.env.example`（只放範例值）
