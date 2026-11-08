# Issue Loop

每輪依序判斷，做完一件事就結束本輪。只看自己開的 open Issue（`--author @me --state open`）。

## 本輪開始前

**先確認上一輪是否還在進行。** Loop 每分鐘觸發一次，但 `/work-issue` 會派 SubAgent 在背景執行，一個 Issue 通常會跨好幾輪。以下任一成立，就代表上一輪仍在處理中：
- 本對話中上一輪執行的 `/work-issue` 或 CI 修正還沒走到結束（例如還在等 `test-runner`、`code-reviewer`、`security-reviewer` 回報，或還沒把標籤改成 `in-review`）
- 本對話中有任何還在執行的背景 SubAgent

仍在處理中：**本輪不做事、不留言、不改標籤、不檢查工作目錄**，直接結束，讓上一輪繼續完成。

確認上一輪已結束後，才執行：

```bash
gh issue list --author @me --state open --json number,title,labels,createdAt
git status --short
```

- 工作目錄有未提交的變更：本輪不做事，回報「工作目錄不乾淨」後結束（不要自行 stash、reset 或丟棄變更）
- 依下列順序判斷，**符合一項就只做那一項**，做完結束本輪

## 判斷順序

1. **有 `in-progress`**（而且上面已確認本對話中沒有正在處理它）：可能是上一輪異常中斷，或是在另一個 session 處理到一半
   - 查出標籤改成 `in-progress` 的時間：`gh api repos/{owner}/{repo}/issues/<編號>/events --jq '[.[] | select(.event=="labeled" and .label.name=="in-progress")] | last | .created_at'`
   - **未滿 60 分鐘**：可能還有其他 session 在處理，本輪不做事、不留言
   - **已滿 60 分鐘**：視為中斷。在該 Issue 留言說明（最後停在哪一步、分支與 PR 狀態），標籤改為 `needs-human`：`gh issue edit <編號> --remove-label in-progress --add-label needs-human`

2. **有 `in-review`**：找出對應的 PR，用 `gh pr checks` 查 CI
   - 找 PR：`gh pr list --state open --json number,headRefName` 中 `headRefName` 以 `issue-<編號>-` 開頭的那一個
   - 找不到 open 的 PR（被關閉但沒合併）：留言說明，改為 `needs-human`
   - **CI 失敗**：
     1. `gh run list --branch <分支> --limit 1 --json databaseId,conclusion` 取得 run id
     2. `gh run view <run id> --log-failed` 取得 log，交給 `test-runner` 分析
     3. 先計算修正輪數（見「邊界」），超過 3 輪就改為 `needs-human`，不再修正
     4. `git checkout <分支> && git pull --ff-only`，依分析結果修正，本機跑 `npm run test:unit`、`npm run test:integration` 與該 Issue 的 `test:acceptance` 確認通過
     5. commit 並 push 到同一個分支（不開新 PR），然後 `git checkout main`
   - **CI 執行中或已通過**：等待人工合併，本輪不領新的 Issue

3. **有 `ready`**：取建立時間（`createdAt`）最早的一個，執行 `/work-issue <編號>`

4. **都沒有**：本輪不做事，等待下一輪（作業完成後再手動取消排程）

## 邊界

- 同時只處理一個 Issue，只處理自己開的 Issue
- 修正輪數以 Issue 上的回報留言計算：本輪動作含「修正 CI」的 `Loop 回報` 留言，合計超過 3 輪就改為 `needs-human`
- 不得合併 PR，不得 push 到 `main`，不得 force push
- 不得修改 `tests/acceptance/`，不得用 skip 或放寬斷言讓 CI 通過
- 每輪結束時切回 `main`，工作目錄保持乾淨

## 每輪回報

本輪有動作，就在該 Issue 留言（`gh` 是 Windows 版，用 `--body "..."`，不要用 `--body-file` 指向 WSL 路徑）：

```
Loop 回報｜Issue #<編號>｜第 <N> 輪
- 本輪動作：
- CI 狀態：
- 下一步：
```

- `<N>` 為該 Issue 上既有的 `Loop 回報` 留言數 + 1
- 本輪動作範例：`執行 /work-issue，已開 PR #3`、`修正 CI：<失敗原因摘要>`、`上一輪未正常結束，改為 needs-human`
- CI 狀態填 `gh pr checks` 的結果（pass／fail／pending），尚無 PR 時填「尚未開 PR」
- 本輪沒有動作（只是等待 CI 或人工合併、或沒有任何 Issue）時不留言，避免洗版
