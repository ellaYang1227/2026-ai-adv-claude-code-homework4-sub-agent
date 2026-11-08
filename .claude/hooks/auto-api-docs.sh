#!/usr/bin/env bash
# PostToolUse (Edit|Write)：編輯 src/routes/*.js 後自動重生 openapi.json
# 失敗時 exit 2，把錯誤回饋給 Claude（通常是 @openapi YAML 縮排錯誤）

input="$(cat)"
file_path="$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null)"

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
rel="${file_path#"$project_dir"/}"

case "$rel" in
  src/routes/*.js) ;;
  swagger-config.js) ;;
  *) exit 0 ;;
esac

cd "$project_dir" || exit 0

if output="$(npm run openapi --silent 2>&1)"; then
  echo "📄 已重生 openapi.json（來源：$rel）"
  exit 0
else
  echo "❌ npm run openapi 失敗（編輯 $rel 後）：" >&2
  printf '%s\n' "$output" | tail -n 20 >&2
  exit 2
fi
