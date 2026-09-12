#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────
# 학급 홈페이지 — gws CLI 로 시트 + 바인딩 스크립트 만들고 코드 올리기
#
#   사용법:  bash class-homepage/setup.sh "3학년 2반 홈페이지"
#   준비물:  npm i -g @googleworkspace/cli && gws auth login (Sheets, Apps Script 권한)
#            https://script.google.com/home/usersettings 에서 Apps Script API 켜기
#            jq (JSON 파싱용. 없으면 brew install jq / apt install jq)
#
#   이 스크립트가 하는 일 = README 의 2~4단계. 5단계(시트 초기화)부터는 브라우저에서.
# ─────────────────────────────────────────────────────────────
set -euo pipefail

TITLE="${1:-우리 반 홈페이지}"
DIR="$(cd "$(dirname "$0")" && pwd)/src"

command -v gws >/dev/null || { echo "❌ gws 가 없어요: npm install -g @googleworkspace/cli"; exit 1; }
command -v jq  >/dev/null || { echo "❌ jq 가 없어요: brew install jq (맥) / sudo apt install jq (리눅스)"; exit 1; }

echo "1/3 📄 시트 만들기: $TITLE"
SHEET_JSON=$(gws sheets spreadsheets create --json "{\"properties\":{\"title\":\"$TITLE\"}}")
SPREADSHEET_ID=$(echo "$SHEET_JSON" | jq -r '.spreadsheetId')
SHEET_URL=$(echo "$SHEET_JSON" | jq -r '.spreadsheetUrl')
echo "    spreadsheetId = $SPREADSHEET_ID"

echo "2/3 📜 시트에 묶인 Apps Script 프로젝트 만들기"
SCRIPT_JSON=$(gws script projects create --json "{\"title\":\"$TITLE (스크립트)\",\"parentId\":\"$SPREADSHEET_ID\"}")
SCRIPT_ID=$(echo "$SCRIPT_JSON" | jq -r '.scriptId')
echo "    scriptId = $SCRIPT_ID"

echo "3/3 ⬆️  코드 올리기: $DIR"
gws script +push --script "$SCRIPT_ID" --dir "$DIR"

cat <<MSG

✅ 끝! 다음은 브라우저에서:
   1. 시트 열기 → $SHEET_URL
   2. 메뉴 🏫 학급 홈피 > 1) 시트 초기화  (권한 승인 1회)
   3. 설정 시트에 NEIS_KEY 넣고 > 2) NEIS 학교코드 찾기 > 3) 연결 테스트
   4. 확장 프로그램 > Apps Script > 배포 > 새 배포 (웹 앱 / 실행: 나 / 액세스: 모든 사용자)

   터미널로 배포하려면:
   gws script projects versions create --params '{"scriptId":"$SCRIPT_ID"}' --json '{"description":"v1"}'
   gws script projects deployments create --params '{"scriptId":"$SCRIPT_ID"}' --json '{"versionNumber":1,"manifestFileName":"appsscript","description":"v1"}'

   나중에 코드를 고친 뒤:  gws script +push --script $SCRIPT_ID --dir $DIR
MSG
