---
paths:
  - "src/database.js"
  - "src/services/**"
  - "src/routes/**"
---

# 資料庫規則

## 連線與模式
- 使用 better-sqlite3 **同步** API（`db.prepare(...).get/all/run`），不要加 `await`
- 只從 `src/database.js` 取得共用 `db` 實例，不可另外 `new Database()`
- 路徑由 `DATABASE_PATH` 決定；測試為 `:memory:`，非記憶體 DB 才啟用 WAL；`foreign_keys = ON`

## Schema 慣例
- 表名 snake_case 複數（`cart_items`、`order_items`），欄位 snake_case
- 主鍵 `id TEXT PRIMARY KEY`，值用 `uuid.v4()` 產生
- 時間欄位 `TEXT NOT NULL DEFAULT (datetime('now'))`（UTC、無時區後綴）
- 金額、庫存、數量一律 `INTEGER`（整數元），並加 `CHECK`（如 `price > 0`、`stock >= 0`、`quantity > 0`）
- 列舉值用 `CHECK(col IN (...))`，關聯欄位加 `FOREIGN KEY`

## 建表與遷移
- 新表加在 `initializeDatabase()` 的 `CREATE TABLE IF NOT EXISTS`
- 既有表加欄位：先用 `PRAGMA table_info(<table>)` 檢查欄位是否存在再 `ALTER TABLE`，必須可重複執行，並明確規劃舊資料回填值
- 種子資料以獨立 seed 函式寫在 `initializeDatabase()` 中，需可重複執行（先檢查是否已存在）

## 查詢安全
- 所有使用者輸入一律以 `?` 參數綁定，禁止字串拼接 SQL
- 動態欄位名（如 `getOwnerCondition()` 回傳的 `user_id` / `session_id`）只能來自程式內白名單，不可來自 request

## Transaction
- 多步寫入必須包在 `db.transaction(() => { ... })()` 中
- 建單順序：建立訂單 → 寫入 `order_items` 快照（名稱、單價）→ 扣庫存 → 清空購物車；任何一步失敗需整體回滾
- 扣庫存前須檢查庫存（現有 `orderService.js` 以 `findInsufficientItems()` 先檢查，不足回 400 `STOCK_INSUFFICIENT`）；`products.stock` 有 `CHECK(stock >= 0)` 作為最後防線，違反時會拋錯並讓 transaction 回滾
- 回補庫存（如取消訂單）同樣須在 transaction 內完成並同步更新訂單狀態
- 刪除資料時依 foreign key 順序處理（`order_items` → `orders` → `cart_items` → `products` → `users`）
