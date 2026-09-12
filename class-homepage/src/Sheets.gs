/**
 * 시트 구조 정의 + 초기화 + 읽기/쓰기 도우미 + 커스텀 메뉴
 *
 * "시트가 데이터베이스" 입니다. 코드는 시트를 읽고 쓰기만 합니다.
 * 시트 이름·열 이름을 바꾸고 싶으면 아래 SHEET / SCHEMA 만 고치면 됩니다.
 */

const SHEET = {
  CONFIG: '설정',
  STUDENTS: '학생명단',
  ROLES: '역할',
  EMOTION: '감정체크인',
  ASSIGN: '과제',
  ASSIGN_LOG: '과제확인',
  NOTICE: '공지',
  PICK_LOG: '뽑기기록',
};

/** 각 시트의 헤더와 예시 데이터 (함수로 감싼 이유: 다른 파일의 함수를 쓰므로 실행 시점에 평가) */
function getSchema() { return [
  {
    name: SHEET.CONFIG,
    headers: ['항목', '값', '설명'],
    rows: [
      ['학급이름', '3학년 2반 햇살반', '홈페이지 제목에 쓰여요'],
      ['담임', '홍길동', ''],
      ['환영문구', '오늘도 반가워요! 🌞', '제목 아래 한 줄'],
      ['학교이름', '', '메뉴 > 🏫 학급 홈피 > NEIS 학교코드 찾기 로 자동 입력'],
      ['시도교육청코드', '', '예: B10(서울) C10(부산) J10(경기) — 학교코드 찾기가 채워줘요'],
      ['학교코드', '', '7자리 숫자 — 학교코드 찾기가 채워줘요'],
      ['학교급', '초', '초 / 중 / 고 (시간표 API가 달라요)'],
      ['학년', '3', ''],
      ['반', '2', ''],
      ['NEIS_KEY', '', 'open.neis.go.kr 에서 무료 발급. 비워두면 하루 5건 샘플만 나와요'],
      ['테마색', '#ff7a59', '홈페이지 포인트 색 (16진수)'],
      ['교사PIN', '1234', '선생님 모드 비밀번호 — 꼭 바꾸세요'],
      ['역할순환주기', '매일', '매일 / 매주'],
      ['역할순환시작일', '2026-03-02', '이 날을 0번째로 역할이 돌아가요'],
      ['뽑기기록저장', 'Y', 'Y면 뽑기 결과를 뽑기기록 시트에 남겨요'],
    ],
    widths: [140, 260, 420],
  },
  {
    name: SHEET.STUDENTS,
    headers: ['번호', '이름', '모둠', '활성'],
    rows: [
      [1, '강하늘', 1, 'Y'], [2, '김도윤', 1, 'Y'], [3, '김서아', 1, 'Y'], [4, '김시우', 1, 'Y'],
      [5, '박지호', 2, 'Y'], [6, '박하린', 2, 'Y'], [7, '서준우', 2, 'Y'], [8, '송예린', 2, 'Y'],
      [9, '오수아', 3, 'Y'], [10, '윤재민', 3, 'Y'], [11, '이도현', 3, 'Y'], [12, '이서윤', 3, 'Y'],
      [13, '임하준', 4, 'Y'], [14, '장유나', 4, 'Y'], [15, '정민재', 4, 'Y'], [16, '조아인', 4, 'Y'],
      [17, '최은우', 5, 'Y'], [18, '한지우', 5, 'Y'], [19, '허다은', 5, 'Y'], [20, '홍시온', 5, 'Y'],
    ],
    widths: [60, 120, 60, 60],
  },
  {
    name: SHEET.ROLES,
    headers: ['역할', '설명', '고정담당', '이모지'],
    rows: [
      ['칠판 지킴이', '쉬는 시간마다 칠판 정리', '', '🧽'],
      ['우유 배달', '우유 가져오고 빈 곽 정리', '', '🥛'],
      ['창문 요정', '아침·점심 환기', '', '🪟'],
      ['식물 돌보미', '화분에 물 주기 (월·수·금)', '', '🌱'],
      ['책 정리', '학급문고 정리', '', '📚'],
      ['전기 절약', '이동 수업 때 불·에어컨 끄기', '', '💡'],
      ['급식 도우미', '급식 줄 안내', '', '🍚'],
      ['분리수거', '재활용 통 확인', '', '♻️'],
      ['알림 전달', '교무실 전달 사항 알리기', '', '📣'],
      ['사물함 점검', '하교 전 사물함 문 확인', '', '🔒'],
      ['오늘의 응원', '아침 조회 때 응원 한마디', '', '📢'],
      ['청소 반장', '청소 시간 진행', '', '🧹'],
    ],
    widths: [120, 260, 100, 60],
  },
  {
    name: SHEET.EMOTION,
    headers: ['시각', '날짜', '번호', '이름', '감정', '한마디'],
    rows: [],
    widths: [160, 100, 60, 100, 100, 300],
  },
  {
    name: SHEET.ASSIGN,
    headers: ['과제', '과목', '마감일', '설명', '링크', '공개'],
    rows: [
      ['수학 익힘책 42~43쪽', '수학', nextDate(2), '3단원 나눗셈 복습', '', 'Y'],
      ['독서록 1편', '국어', nextDate(5), '이번 주 읽은 책 한 권', '', 'Y'],
      ['식물 관찰 일지', '과학', nextDate(9), '강낭콩 사진 + 한 줄 기록', '', 'Y'],
    ],
    widths: [200, 80, 110, 300, 200, 60],
  },
  {
    name: SHEET.ASSIGN_LOG,
    headers: ['시각', '과제', '번호', '이름', '상태'],
    rows: [],
    widths: [160, 200, 60, 100, 100],
  },
  {
    name: SHEET.NOTICE,
    headers: ['날짜', '제목', '내용', '고정'],
    rows: [
      [todayStr(), '홈페이지가 열렸어요', '우리 반 홈페이지에 오신 것을 환영해요. 아침에 감정 체크인부터!', 'Y'],
      [todayStr(), '체육복 챙기기', '이번 주 목요일은 체육 두 시간이에요.', 'N'],
    ],
    widths: [110, 200, 400, 60],
  },
  {
    name: SHEET.PICK_LOG,
    headers: ['시각', '종류', '결과'],
    rows: [],
    widths: [160, 100, 400],
  },
]; }

function nextDate(days) {
  const d = new Date(); d.setDate(d.getDate() + days); return fmtDate(d);
}

/**
 * 시트 초기화 — 없는 시트만 만들고 헤더·예시를 채웁니다. 이미 있는 시트는 건드리지 않아요.
 * 실행: 스프레드시트 메뉴 > 🏫 학급 홈피 > 시트 초기화  (또는 편집기에서 setupSheets 실행)
 */
function setupSheets() {
  const ss = SpreadsheetApp.getActive();
  const created = [];
  getSchema().forEach(spec => {
    if (ss.getSheetByName(spec.name)) return;
    const sh = ss.insertSheet(spec.name);
    sh.getRange(1, 1, 1, spec.headers.length).setValues([spec.headers])
      .setFontWeight('bold').setBackground('#fff1eb').setFontColor('#c2410c');
    if (spec.rows.length) sh.getRange(2, 1, spec.rows.length, spec.headers.length).setValues(spec.rows);
    sh.setFrozenRows(1);
    (spec.widths || []).forEach((w, i) => sh.setColumnWidth(i + 1, w));
    created.push(spec.name);
  });
  // 기본 'Sheet1'/'시트1' 이 비어 있으면 제거
  ['Sheet1', '시트1'].forEach(n => {
    const s = ss.getSheetByName(n);
    if (s && ss.getSheets().length > 1 && s.getLastRow() === 0) ss.deleteSheet(s);
  });
  CacheService.getScriptCache().remove('config');
  const msg = created.length ? '만든 시트: ' + created.join(', ') : '모든 시트가 이미 있어요.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) { console.log(msg); }
  return created;
}

/** 시트 → 객체 배열 [{헤더: 값}] */
function readTable(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh || sh.getLastRow() < 2) return [];
  const values = sh.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  return values.slice(1)
    .filter(r => r.some(c => c !== '' && c != null))
    .map((r, i) => {
      const o = { _row: i + 2 };
      headers.forEach((h, j) => {
        // 날짜 셀은 'yyyy-MM-dd' 문자열로, '시각' 열만 'HH:mm' 으로 바꿔서 돌려줘요
        o[h] = r[j] instanceof Date ? (h === '시각' ? Utilities.formatDate(r[j], TZ, 'HH:mm') : fmtDate(r[j])) : r[j];
      });
      return o;
    });
}

/** 객체를 헤더 순서에 맞춰 한 줄 추가 */
function appendRow(name, obj) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  if (!sh) throw new Error('시트가 없어요: ' + name + ' (메뉴 > 시트 초기화)');
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  sh.appendRow(headers.map(h => obj[h] == null ? '' : obj[h]));
}

/** 특정 행의 일부 열 값 바꾸기 */
function updateRow(name, rowIndex, obj) {
  const sh = SpreadsheetApp.getActive().getSheetByName(name);
  const headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(h => String(h).trim());
  Object.keys(obj).forEach(k => {
    const col = headers.indexOf(k) + 1;
    if (col > 0) sh.getRange(rowIndex, col).setValue(obj[k]);
  });
}

function getStudents() {
  return readTable(SHEET.STUDENTS)
    .filter(s => String(s['활성'] || 'Y').toUpperCase() !== 'N' && s['이름'])
    .sort((a, b) => Number(a['번호']) - Number(b['번호']));
}

/* ───────── 커스텀 메뉴 (스프레드시트 열 때) ───────── */

function onOpen() {
  SpreadsheetApp.getUi().createMenu('🏫 학급 홈피')
    .addItem('1) 시트 초기화 (없는 시트 만들기)', 'setupSheets')
    .addItem('2) NEIS 학교코드 찾기', 'menuFindSchool')
    .addItem('3) 나이스 연결 테스트 (오늘 급식)', 'menuTestNeis')
    .addSeparator()
    .addItem('캐시 비우기', 'clearCache')
    .addItem('웹앱 만드는 법', 'menuHowToDeploy')
    .addToUi();
}

function menuFindSchool() {
  const ui = SpreadsheetApp.getUi();
  const res = ui.prompt('학교 이름을 입력하세요', '예) 서울행복초등학교', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  const list = searchSchool(res.getResponseText());
  if (!list.length) { ui.alert('찾지 못했어요. 이름을 더 정확히 써 보세요.'); return; }
  const first = list[0];
  const msg = list.slice(0, 5).map((s, i) => (i + 1) + '. ' + s.name + ' (' + s.region + ', ' + s.kind + ') ' + s.officeCode + ' / ' + s.schoolCode).join('\n');
  const ok = ui.alert('검색 결과', msg + '\n\n1번 학교로 설정 시트를 채울까요?', ui.ButtonSet.YES_NO);
  if (ok !== ui.Button.YES) return;
  setConfigValue('학교이름', first.name);
  setConfigValue('시도교육청코드', first.officeCode);
  setConfigValue('학교코드', first.schoolCode);
  setConfigValue('학교급', first.kind.indexOf('초') === 0 ? '초' : first.kind.indexOf('중') === 0 ? '중' : '고');
  ui.alert('설정 완료! 이제 "나이스 연결 테스트"를 눌러 보세요.');
}

function menuTestNeis() {
  const ui = SpreadsheetApp.getUi();
  try {
    clearCache();
    const meal = getMeal(todayStr());
    ui.alert(meal.meals.length
      ? '오늘 급식\n\n' + meal.meals.map(m => m.type + ': ' + m.dishes.join(', ')).join('\n')
      : '연결은 됐지만 오늘 급식 데이터가 없어요 (주말/방학이면 정상).');
  } catch (e) { ui.alert('실패: ' + e.message); }
}

function menuHowToDeploy() {
  SpreadsheetApp.getUi().alert(
    '웹앱 배포\n\n' +
    '확장 프로그램 > Apps Script > 배포 > 새 배포\n' +
    '유형: 웹 앱 / 실행: 나 / 액세스: 모든 사용자\n\n' +
    '나온 URL을 학생들에게 공유하면 끝!\n' +
    '(터미널파: gws script projects deployments create — README 참고)');
}

function setConfigValue(key, value) {
  const sh = SpreadsheetApp.getActive().getSheetByName(SHEET.CONFIG);
  const keys = sh.getRange(1, 1, sh.getLastRow(), 1).getValues().map(r => String(r[0]).trim());
  const idx = keys.indexOf(key);
  if (idx >= 0) sh.getRange(idx + 1, 2).setValue(value);
  else sh.appendRow([key, value, '']);
  CacheService.getScriptCache().remove('config');
}

function clearCache() {
  CacheService.getScriptCache().removeAll(['config']);
  PropertiesService.getScriptProperties().setProperty('neisCacheSalt', String(Date.now()));
}
