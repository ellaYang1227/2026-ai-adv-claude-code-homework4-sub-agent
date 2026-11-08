#!/usr/bin/env bash
# PreToolUse (Edit|Write)：阻止編輯敏感檔、產生檔與助教提供的驗收測試
# exit 2 + stderr → 阻擋該次工具呼叫，並把原因回饋給 Claude

input="$(cat)"
file_path="$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null)"

[ -z "$file_path" ] && exit 0

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
rel="${file_path#"$project_dir"/}"
base="$(basename "$file_path")"

block() {
  echo "⛔ 已阻擋編輯 $rel：$1" >&2
  exit 2
}

case "$base" in
  .env.example) ;;  # 範本檔允許編輯
  .env|.env.*) block "環境變數檔含金鑰，請由開發者手動修改" ;;
  package-lock.json|*.lock) block "lock 檔請透過 npm install 更新，不要手改" ;;
  *.sqlite|*.sqlite-shm|*.sqlite-wal|*.sqlite3|*.db) block "SQLite 資料庫檔不可直接編輯" ;;
esac

case "$rel" in
  openapi.json) block "此檔由 JSDoc 產生，請改路由 @openapi 註解後執行 npm run openapi" ;;
  postman_collection.json) block "此檔由 npm run postman 產生；設定請改 scripts/generate-postman.js" ;;
  public/css/output.css) block "此檔由 Tailwind 編譯產生，請改 public/css/input.css" ;;
  tests/acceptance/*) block "驗收測試由助教提供，不得修改；請修改實作讓測試通過" ;;
esac

exit 0
