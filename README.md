# 花卉電商網站｜第四場作業起始儲存庫

Node.js + Express + SQLite + EJS + Tailwind CSS 全端電商專案，為第三場結束後的範例專案，另外加上第四場作業所需的素材。專案介紹與完整文件請見 [docs/README.md](./docs/README.md)。

## [作業4] SubAgent 小隊、Issue 驅動開發與 Loop 自動化

| 挑戰 | 說明 |
|------|------|
| 挑戰一：SubAgent 小隊與 AI Code Review | 定義 4 個 SubAgent：`security-reviewer`、`code-reviewer`（唯讀工具）、`test-runner`（sonnet、不得編輯）、`e2e-tester`（以 `skills` 預載 E2E Skill、以 `mcpServers` 掛上 Playwright MCP）。派出 SubAgent 審查訂單、付款、運費、購物車與測試，找出並修正 5 個埋藏問題（免運門檻、被跳過的測試、訂單越權查詢、購物車數量驗證、綠界驗簽），報告見 `docs/ai-review.md` |
| 挑戰二：Issue 驅動開發（手動觸發） | 建立 `ready`／`in-progress`／`in-review`／`needs-human` 標籤，以 `permissions.deny` 鎖定驗收測試；用白話帶 AI 走完「讀 Issue → 實作 → 測試 → 開 PR → Review」完成 Issue #1 結帳優惠碼（PR #2），再將流程整理成 `/work-issue` Skill |
| 挑戰三：Loop 自動觸發與 CI 回饋 | 撰寫 `.claude/loop.md`，以 `/loop` 每分鐘領取自己開的 `ready` Issue；Loop 自動執行 `/work-issue` 完成 Issue #3 我的訂單篩選與分頁（PR #4），讀取 GitHub Actions 結果並在 Issue 留下每輪回報 |

儲存庫：[2026-ai-adv-claude-code-homework4-sub-agent](https://github.com/ellaYang1227/2026-ai-adv-claude-code-homework4-sub-agent)

> 📋 Issue：[#1 結帳優惠碼](https://github.com/ellaYang1227/2026-ai-adv-claude-code-homework4-sub-agent/issues/1)（[PR #2](https://github.com/ellaYang1227/2026-ai-adv-claude-code-homework4-sub-agent/pull/2)）、[#3 我的訂單篩選與分頁](https://github.com/ellaYang1227/2026-ai-adv-claude-code-homework4-sub-agent/issues/3)（[PR #4](https://github.com/ellaYang1227/2026-ai-adv-claude-code-homework4-sub-agent/pull/4)）
>
> 🎬 Loop 自動處理 Issue 錄影：[YouTube](https://youtu.be/zLcYT6b8yY4)

---

## 第四場作業前置準備

### 1. 用 Template 建立自己的儲存庫

1. 在本儲存庫頁面點選 **Use this template** → **Create a new repository**
2. 之後所有的 Issue、標籤、PR 與 Loop 都在你自己的儲存庫中進行，不要對本儲存庫開 Issue 或 PR

建立完成後，把自己的儲存庫 clone 到本機：

```bash
git clone <你的儲存庫網址>
cd <專案資料夾>
```

### 2. 安裝並登入 GitHub CLI

| 環境 | 安裝方式 |
|------|----------|
| macOS | `brew install gh` |
| Windows（PowerShell） | `winget install --id GitHub.cli` |
| Windows（WSL2）／Linux | 依 [官方安裝說明](https://github.com/cli/cli/blob/trunk/docs/install_linux.md) 安裝 |

```bash
gh auth login        # 依提示登入 GitHub
gh issue list        # 在專案資料夾中執行，沒有錯誤即代表設定完成
```

Windows 同學請在實際要使用的終端機環境（PowerShell 或 WSL2）中完成安裝與登入。

### 3. 安裝與啟動專案

```bash
npm install
cp .env.example .env    # 至少設定 JWT_SECRET
npm run start           # http://localhost:3001
```

要用 Postman 測試 API 時，執行 `npm run postman` 產生 `postman_collection.json` 再匯入（此檔不進版控），步驟見 [docs/TESTING.md](./docs/TESTING.md#postman-collection)。

## 第四場作業素材

| 位置 | 用途 |
|------|------|
| `tests/acceptance/` | 3 個 Issue 的驗收測試（**不得修改**） |

3 個 Issue 的標題與內容請見第四場作業說明的附錄，直接複製貼到你自己儲存庫的 GitHub Issue。

## 測試指令

| 指令 | 說明 |
|------|------|
| `npm run test:unit` | Unit／API 測試 |
| `npm run test:integration` | 結帳、DB、庫存、回滾與綠界整合測試 |
| `npm run test:acceptance` | 3 個 Issue 的驗收測試（在 `main` 上預期失敗，完成 Issue 後才會通過） |
| `npm run test:acceptance -- coupon` | 只執行指定檔名的驗收測試（`coupon`、`cancel-order`、`order-filter`） |

GitHub Actions（`.github/workflows/test.yml`）只執行 `test:unit` 與 `test:integration`，不執行驗收測試與 E2E。
