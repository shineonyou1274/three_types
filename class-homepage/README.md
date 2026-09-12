# 🏫 학급 홈페이지 — 구글 시트 1개 + Apps Script

> 서버 없음, 비용 없음, 코드는 클로드가 씀. 선생님은 **시트만 고치면** 됩니다.

**👉 데모 보기:** `https://shineonyou1274.github.io/three_types/class-homepage/` (샘플 데이터로 움직이는 화면)
**👉 만드는 법:** 데모 오른쪽 위 **🛠 이거 어떻게 만들었어요?** 를 누르면 카드마다 "어떤 시트를 읽는지 · 어떤 코드가 움직이는지 · 클로드에게 뭐라고 요청했는지"가 나옵니다.

| 카드 | 데이터 출처 | 저장 |
|---|---|---|
| 🍱 오늘의 급식 | 나이스 오픈API `mealServiceDietInfo` | 안 함 (6시간 캐시) |
| 📅 시간표 | 나이스 `elsTimetable` / `misTimetable` / `hisTimetable` | 안 함 |
| 🗓️ 학사일정 | 나이스 `SchoolSchedule` | 안 함 |
| 🧹 오늘의 1인 1역 | `학생명단` + `역할` 시트 → 날짜로 계산 | 안 함 |
| 💗 감정 체크인 | 학생 입력 | `감정체크인` 시트 |
| 🎲 랜덤 뽑기 | `학생명단` 시트 → 브라우저에서 계산 | `뽑기기록` 시트 (선택) |
| 📝 과제 확인 | `과제` 시트 | `과제확인` 시트 |
| 📣 알림장 | `공지` 시트 | 안 함 |

## 폴더 구조

```
class-homepage/
├── README.md        ← 이 문서 (만드는 순서)
├── PROMPTS.md       ← 클로드에게 요청하는 문장 모음
├── setup.sh         ← gws CLI로 시트+스크립트 만들고 코드 올리는 스크립트
├── index.html       ← 깃허브 페이지용 리다이렉트 (src/index.html 데모로)
└── src/             ← Apps Script 프로젝트 (이 폴더를 통째로 push)
    ├── appsscript.json  매니페스트 (웹앱 설정, 권한)
    ├── Code.gs          doGet + api() 디스패처 + 설정 읽기
    ├── Sheets.gs        시트 구조 정의, 시트 초기화, 읽기/쓰기, 커스텀 메뉴
    ├── Neis.gs          나이스 API (급식/시간표/학사일정/학교검색)
    ├── Features.gs      1인1역, 감정, 과제, 뽑기기록, 공지
    └── index.html       화면 전체 (+ 만드는 법 모드 + 데모 데이터)
```

**설계 원칙 세 가지** (이것만 알면 어떤 기능이든 추가할 수 있어요)

1. **시트가 데이터베이스.** 코드는 시트를 읽고 쓰기만 해요. 시트 이름·열 이름은 `Sheets.gs`의 `SHEET`/`getSchema()`에 다 있어요.
2. **프론트 → 서버 창구는 `api(action, payload)` 하나.** 기능을 더할 땐 `Code.gs`의 `ACTIONS` 표에 한 줄, `Features.gs`에 함수 하나, `index.html`에 카드 하나.
3. **비밀은 서버에만.** 나이스 인증키와 교사 PIN은 시트에만 있고, 학생 화면에는 절대 내려가지 않아요.

---

## 처음부터 만드는 순서 (약 30분)

### 0. 준비물
- 구글 계정 (학교 워크스페이스 계정도 됨. 단, 관리자가 Apps Script를 막아 두었으면 개인 계정으로)
- 터미널 (맥: 터미널 / 윈도우: PowerShell), [Node.js](https://nodejs.org)
- 클로드 — [Claude Code](https://claude.ai/code) 또는 claude.ai. **코드는 직접 안 써도 됩니다.**

### 1. gws CLI 설치 + 로그인
[gws](https://github.com/googleworkspace/cli)는 구글 워크스페이스 공식 CLI예요. 시트·드라이브·Apps Script를 터미널에서 다룹니다.

```bash
npm install -g @googleworkspace/cli
gws auth setup     # 처음 한 번: 구글 클라우드 프로젝트 만들고 API 켜고 로그인까지
gws auth login     # 다음부터는 이걸로. 권한 고를 때 Sheets, Drive, Apps Script 체크
```

> Apps Script API 를 써야 하므로 https://script.google.com/home/usersettings 에서 **Google Apps Script API: 사용** 으로 켜 두세요.

### 2. 시트 만들기
```bash
gws sheets spreadsheets create --json '{"properties":{"title":"3학년 2반 홈페이지"}}'
```
응답의 `spreadsheetId` 를 복사해 두세요.

### 3. 시트에 묶인(bound) 스크립트 만들기
```bash
gws script projects create --json '{"title":"학급 홈페이지","parentId":"<SPREADSHEET_ID>"}'
```
`parentId` 덕분에 시트를 열면 메뉴가 생기는 "시트 바인딩" 스크립트가 됩니다. 응답의 `scriptId` 복사.

### 4. 코드 올리기
```bash
git clone https://github.com/shineonyou1274/three_types.git
cd three_types
gws script +push --script <SCRIPT_ID> --dir class-homepage/src
```
`+push` 는 폴더 안의 `.gs` / `.html` / `appsscript.json` 을 전부 올립니다(프로젝트의 기존 파일은 교체됨).

> 2~4번을 한 번에: `bash class-homepage/setup.sh "3학년 2반 홈페이지"` — 아래 setup.sh 참고.

### 5. 시트 초기화 + 권한 승인
브라우저에서 시트를 열면(이미 열려 있으면 새로고침) 상단 메뉴에 **🏫 학급 홈피** 가 생겨요.
**1) 시트 초기화** → 처음 한 번 구글 권한 승인 창 → `설정 · 학생명단 · 역할 · 감정체크인 · 과제 · 과제확인 · 공지 · 뽑기기록` 시트가 예시와 함께 만들어집니다.

이제 **학생명단 · 역할 · 설정** 시트를 우리 반에 맞게 고치세요. 특히 `교사PIN`!

### 6. 나이스 연결
1. https://open.neis.go.kr → 회원가입 → **인증키 발급** (무료, 즉시)
2. `설정` 시트의 `NEIS_KEY` 칸에 붙여넣기
3. 메뉴 **2) NEIS 학교코드 찾기** → 학교 이름 입력 → 시도교육청코드·학교코드·학교급이 자동으로 채워짐
4. 메뉴 **3) 나이스 연결 테스트** → 오늘 급식이 뜨면 성공 (주말이면 "데이터 없음"이 정상)

### 7. 웹앱으로 배포 (URL 만들기)
**쉬운 길 (GUI):** 시트 메뉴 `확장 프로그램 > Apps Script` → 오른쪽 위 **배포 > 새 배포** → 유형 **웹 앱** / 실행 **나** / 액세스 **모든 사용자** → 배포 → URL 복사.

**터미널 길:**
```bash
gws script projects versions create --params '{"scriptId":"<SCRIPT_ID>"}' --json '{"description":"v1"}'
gws script projects deployments create --params '{"scriptId":"<SCRIPT_ID>"}' \
  --json '{"versionNumber":1,"manifestFileName":"appsscript","description":"학급 홈피 v1"}'
```
응답의 `entryPoints[].webApp.url` 이 홈페이지 주소입니다. (웹앱 설정은 `appsscript.json`의 `webapp` 항목 — 실행: 배포자, 액세스: 누구나)

코드를 고친 뒤에는 `+push` → `versions create` → `deployments update`(또는 GUI에서 "새 버전") 순서로 갱신해요.

### 8. 학생에게 공유
URL을 QR로 만들어 교실에 붙이세요. 학생은 로그인 없이 열 수 있고, 처음에 **👤 이름 선택**만 하면 됩니다(브라우저에 기억됨).

---

## 내 것으로 만들기

| 바꾸고 싶은 것 | 어디서 |
|---|---|
| 학급 이름, 환영 문구, 포인트 색 | `설정` 시트 (바로 반영, 새로고침) |
| 학생 추가/전학 | `학생명단` 시트. 전학은 `활성`을 N으로 |
| 역할 이름·설명·이모지, 고정 담당 | `역할` 시트 |
| 역할이 매일/매주 바뀌게 | `설정`의 `역할순환주기` |
| 과제 올리기 | `과제` 시트에 한 줄 (공개=Y) |
| 공지 | `공지` 시트에 한 줄 (고정=Y면 📌) |
| 감정 종류 | `src/Features.gs` 의 `EMOTIONS` 배열 |
| 화면 색·글꼴 | `src/index.html` 맨 위 `:root` 변수 |
| 새 카드 추가 | `PROMPTS.md`의 "기능 추가" 문장을 클로드에게 |

## 자주 막히는 곳

- **"Apps Script API has not been used"** → https://script.google.com/home/usersettings 에서 켜기.
- **급식 카드에 `NEIS ERROR-290`** → 인증키 오류. `설정`의 `NEIS_KEY` 확인.
- **급식은 되는데 시간표가 비어요** → 중·고등학교는 반 이름이 `01`처럼 두 자리일 수 있어요. `설정`의 `반` 값을 바꿔 보세요. 학교급(초/중/고)도 확인.
- **학생이 열면 "권한이 필요합니다"** → 배포 액세스가 "모든 사용자"인지, 실행이 "나"인지 확인. 코드를 고쳤다면 새 버전으로 다시 배포.
- **시트 메뉴가 안 보여요** → 시트를 새로고침. 그래도 없으면 편집기에서 `onOpen` 을 한 번 실행.
- **학교 워크스페이스 계정이라 배포가 안 돼요** → 관리자가 외부 공유를 막은 경우. 개인 계정으로 만드는 게 빠릅니다.

## 개인정보 메모
- 학생 화면에는 감정 **집계만** 보이고, 누가 어떤 기분인지는 선생님 PIN을 넣어야 보여요. PIN 검사는 서버(Apps Script)에서만 합니다.
- 그래도 URL을 아는 사람은 명단(이름)을 볼 수 있어요. 학생 이름 대신 번호만 쓰고 싶으면 `학생명단`의 이름을 "1번"처럼 적으면 됩니다.
- 시트에는 이름·감정·한마디가 남습니다. 학년이 끝나면 `감정체크인` 시트를 비워 주세요.
