#!/usr/bin/env bash
# PostToolUse (Edit|Write)：編輯原始碼或測試後，自動跑對應的 Vitest 單元/API 測試
# 測試失敗時 exit 2，把失敗摘要回饋給 Claude
# 注意：不跑 tests/acceptance（Issue 完成前預期失敗）與 tests/e2e（需已啟動服務與綠界）

input="$(cat)"
file_path="$(printf '%s' "$input" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null)"

project_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"
rel="${file_path#"$project_dir"/}"

config="vitest.config.js"
targets=""

case "$rel" in
  tests/acceptance/*|tests/e2e/*|tests/setup/*) exit 0 ;;
  tests/integration/*.integration.test.js)
    config="vitest.integration.config.js"; targets="$rel" ;;
  tests/*.test.js) targets="$rel" ;;
  src/routes/authRoutes.js)         targets="tests/auth.test.js" ;;
  src/routes/productRoutes.js)      targets="tests/products.test.js" ;;
  src/routes/cartRoutes.js)         targets="tests/cart.test.js" ;;
  src/routes/orderRoutes.js)        targets="tests/orders.test.js" ;;
  src/routes/adminProductRoutes.js) targets="tests/adminProducts.test.js" ;;
  src/routes/adminOrderRoutes.js)   targets="tests/adminOrders.test.js" ;;
  src/utils/shipping.js)            targets="tests/shipping.test.js" ;;
  src/services/*|src/utils/ecpay.js)
    config="vitest.integration.config.js"; targets="tests/integration" ;;
  src/*|app.js) targets="" ;;  # 共用模組（database、middleware、validators）→ 跑全部 unit
  *) exit 0 ;;
esac

cd "$project_dir" || exit 0

export NO_COLOR=1 FORCE_COLOR=0
if output="$(npx vitest run --config "$config" $targets 2>&1)"; then
  summary="$(printf '%s\n' "$output" | grep -E 'Tests|Test Files' | tr -s ' ' | head -n 2)"
  echo "✅ 測試通過（$config ${targets:-全部}）$summary"
  exit 0
else
  echo "❌ 編輯 $rel 後測試失敗（$config ${targets:-全部}）：" >&2
  printf '%s\n' "$output" | grep -vE '^\s*$' | tail -n 40 >&2
  exit 2
fi
