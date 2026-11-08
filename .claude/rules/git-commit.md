# Git Commit 規則

## Message 格式
```
<type>: <繁體中文簡述，50 字內>

- 變更細節 1（選填）
- 變更細節 2
```

## Type 類型
| type | 用途 |
|------|------|
| `feat` | 新功能（如優惠碼、取消訂單） |
| `fix` | 修正 bug |
| `refactor` | 重構，不改變行為 |
| `test` | 新增或修改測試 |
| `docs` | 文件（docs/、CLAUDE.md、JSDoc） |
| `style` | 格式、樣式（含 Tailwind class 調整） |
| `chore` | 建置、套件、設定（package.json、.claude/、CI） |
| `perf` | 效能改善 |

## 原則
- 一個 commit 只做一件事；功能程式、測試、文件可同一 commit，但不要混入無關變更
- 功能完成時一併更新 `docs/FEATURES.md`、`docs/CHANGELOG.md`，並將計畫移至 `docs/plans/archive/`
- commit 前確認 `npm run test:unit` 與 `npm run test:integration` 通過
- 不使用 `git push`、`git reset --hard`（已在 settings.json deny）；push 由開發者手動執行

## 禁止 commit 的檔案
- `.env`、`.env.*`（`.env.example` 除外）
- `database.sqlite`、`*.sqlite-shm`、`*.sqlite-wal`
- `public/css/output.css`、`postman_collection.json`
- `node_modules/`、`test-results/`、`playwright-report/`、`coverage/`
- `.claude/*.local.json`
