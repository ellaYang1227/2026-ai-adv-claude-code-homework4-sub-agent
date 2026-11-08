---
paths:
  - "views/**"
  - "public/js/**"
  - "public/css/input.css"
  - "src/routes/pageRoutes.js"
---

# 前端／模板規則

## 結構
- EJS 版型：前台 `views/layouts/front.ejs`、後台 `views/layouts/admin.ejs`；頁面放 `views/pages/`，共用片段放 `views/partials/`
- 頁面邏輯放 `public/js/pages/<page>.js`（kebab-case），以 `<script>` 載入，使用 Vue 3 全域建置（`const { createApp, ref } = Vue`）
- 共用工具：`public/js/api.js`（`apiFetch`、`formatDate`）、`public/js/auth.js`（`Auth`、JWT 存 localStorage）、`notification.js`
- 前端 JS 不使用 `import` / `require`，透過全域變數共用

## API 呼叫
- 一律使用 `apiFetch()`，它會自動帶 JWT 與處理 401 導回登入頁；不要直接 `fetch` API
- 回應取 `res.data`；錯誤時讀 `err.data.message` 顯示給使用者
- 金額、運費以 API 回傳值顯示，前端不自行計算後送出
- SQLite 時間為 UTC 無時區字串，顯示時用 `formatDate()`

## XSS 防護
- EJS 輸出動態資料一律用 `<%= %>`（自動跳脫）；`<%- %>` 只用於 `include(...)` 與 `body`
- Vue 使用 `{{ }}` / `v-bind` 渲染，禁止對使用者或 API 資料使用 `v-html`
- 避免 `innerHTML` 插入動態資料；必要時只插入靜態字串，動態內容用 `textContent`

## Tailwind CSS v4
- 只修改 `public/css/input.css`（含 `@theme` 自訂色，如 `rose-primary`、`rose-dark`）
- `public/css/output.css` 為產生檔，不可手改；開發用 `npm run dev:css`，交付前 `npm run css:build`
- 優先使用 utility class 與既有主題色，避免行內 style

## 命名
- EJS 與前端 JS 檔名 kebab-case（`product-detail.ejs`、`admin-products.js`）
- 新增頁面時同步在 `src/routes/pageRoutes.js` 註冊路由
