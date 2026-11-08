---
name: e2e-payment-test
description: 用 Playwright MCP 對花漾生活花卉電商（http://localhost:3001）執行綠界金流 E2E 測試：登入、加入購物車、宅配結帳、綠界 staging 網路 ATM 付款，最後確認訂單已付款並截圖。改寫自第二場作業的 E2E Skill。
---

# E2E 測試 Skill — 綠界網路 ATM 付款流程

來源：第二場作業 `2026-ai-adv-claude-code/.claude/skills/e2e-payment-test/SKILL.md`，改寫為本專案的網址、帳號、頁面文字與付款方式。
對應的腳本版測試：`tests/e2e/ecpay-atm-payment.spec.js`（流程相同，可對照選擇器）。

## 前置需求

1. **Playwright MCP**：`e2e-tester` agent 已在 frontmatter 以 `mcpServers` 掛上 `@playwright/mcp`；直接在主對話使用時，需先執行 `claude mcp add playwright -- npx -y @playwright/mcp@latest`
2. **服務已啟動**：`npm run start`，確認 `http://localhost:3001` 回應 200
3. **.env**：已設定 `JWT_SECRET`、`ECPAY_ENV=staging` 與綠界 staging 測試金鑰（見 `.env.example`）

> ⚠️ 會寫入開發用 `database.sqlite`：新增一筆已付款訂單、扣一件庫存。不在 CI 執行。

## 測試帳號

| 角色 | Email | 密碼 |
|------|-------|------|
| 管理員 | `admin@hexschool.com` | `12345678` |

---

## 場景一：完整付款流程（綠界網路 ATM）

1. **開啟登入頁** `http://localhost:3001/login`
   - 瀏覽器停在 `about:blank`，或 `browser_navigate` 回報「Target page, context or browser has been closed」時，改用 `browser_tabs`（action: `new`）開新分頁
   - 用 `browser_snapshot` 確認網址確實是 `/login`
2. **登入**：在「請輸入 Email」填 `admin@hexschool.com`、「請輸入密碼」填 `12345678`，點表單內的「登入」按鈕；確認導回首頁 `/`
3. **清空舊購物車**：前往 `/cart`，若有品項，逐一點移除，在彈出的視窗點「確認移除」，直到顯示「購物車是空的」
4. **加入購物車**：回到首頁 `/`，點第一個「加入購物車」按鈕，確認出現「已加入購物車」提示
5. **前往結帳**：到 `/cart` 確認品項正確，點「前往結帳」，確認網址為 `/checkout`
6. **填寫收件資料**：
   - 「請輸入收件人姓名」：`Playwright 測試收件人`
   - 「請輸入 Email」：`admin@hexschool.com`
   - 「請輸入收件地址」：`台北市信義區測試路 1 號`
   - 配送方式選「宅配」
7. **送出訂單**：點「確認送出訂單」。頁面會自動導向 `/ecpay/payment/<訂單ID>`，再導到綠界 staging（`payment-stage.ecpay.com.tw`）。從網址記下**訂單 ID**
8. **選擇付款方式**：在綠界頁面選「網路 ATM」，銀行下拉選單選「台灣土地銀行」
9. **前往付款**：點「前往付款」
   - 出現原生確認對話框時，用 `browser_handle_dialog`（`accept: true`）接受
   - 出現站內提示視窗時，點「關閉」或「確定」
   - 可能開新分頁（土地銀行測試頁），用 `browser_tabs` 切換過去
10. **銀行測試頁**：點「Save」
11. **確認付款成功**：等待頁面出現「付款成功」或「交易成功」，用 `browser_take_screenshot` 截圖，檔名 `ecpay-payment-success.png`
12. **返回商店**：點「返回商店」，回到訂單詳情頁 `/orders/<訂單ID>?payment=pending`。頁面載入時會自動向綠界查詢一次付款狀態
13. **確認訂單狀態**：頁面顯示「已付款」與「付款成功！感謝您的購買。」，截圖 `payment-return-success.png`
    - 若仍為「待付款」（綠界狀態可能延遲），等幾秒後點「查詢付款狀態」按鈕，最多重試 3 次

**預期結果**：訂單狀態為「已付款」。

**注意**：
- 不要選信用卡，也不要點「測試付款請點此」等其他路徑，本流程只走網路 ATM
- 綠界 staging 偶爾改版，找不到元素時先 `browser_snapshot` 看實際文字，再用語意相近的按鈕；仍找不到就停止並回報

## 場景二：未登入前往結帳

1. 開新的分頁，若仍為登入狀態，用 `browser_evaluate` 清除 `localStorage`（`flower_token`、`flower_user`）
2. 前往 `/cart`，確認顯示「購物車是空的」
3. 前往 `/checkout`，確認被導向登入頁（`/login`）

**預期結果**：未登入無法進入結帳流程。

---

## 頁面狀態對照

| 訂單狀態 | 頁面文字 |
|----------|----------|
| `pending` | 待付款 |
| `paid` | 已付款 |
| `failed` | 付款失敗 |

## 截圖存放位置

`e2e-tester` 的 Playwright MCP 以 `--output-dir test-results/e2e-mcp` 啟動，截圖存到專案的 `test-results/e2e-mcp/`（已列入 `.gitignore`）。未指定時會存到 MCP 的暫存目錄，agent 結束後找不到。

## 環境注意事項（WSL + Windows node）

- 本專案的 node 是 Windows 版，服務只聽在 Windows 的 localhost：WSL 的 `curl` 連不到，要用 `curl.exe` 確認服務
- WSL 的 `sqlite3` 無法讀取執行中的 `database.sqlite`（WAL），驗證訂單狀態請改用 API

## 錄影

Playwright MCP 不支援自動錄影。需要影片時，先用 Windows「剪取工具」（`Win + Shift + S` → 錄製）選取瀏覽器視窗開始錄製，再呼叫本 Skill。
