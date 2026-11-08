#!/usr/bin/env bash
# SessionStart (compact)：context 壓縮後，從 CLAUDE.md 重新注入「關鍵規則」與「必要遵守項目」
# stdout 會被加入 Claude 的 context

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
claude_md="$project_dir/CLAUDE.md"

[ -f "$claude_md" ] || exit 0

echo "📌 Context 已壓縮，重新提醒本專案關鍵規則（摘自 CLAUDE.md）："
echo
# 印出「## 關鍵規則」與「## 必要遵守項目」兩段（到下一個 ## 標題為止）
awk '
  /^## / { show = ($0 ~ /^## (關鍵規則|必要遵守項目)/) }
  show { print }
' "$claude_md"
echo
echo "詳細規範見 docs/ 與 .claude/rules/。"
