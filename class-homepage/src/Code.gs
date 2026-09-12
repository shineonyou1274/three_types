/**
 * 학급 홈페이지 — 진입점 & API 디스패처
 *
 * 구조 한눈에 보기
 *  - Code.gs     : doGet(웹앱 화면), api(프론트가 부르는 단일 창구), 설정 읽기
 *  - Sheets.gs   : 시트 만들기(setupSheets), 시트 읽기/쓰기 도우미, 커스텀 메뉴
 *  - Neis.gs     : 나이스(NEIS) 오픈API — 급식 / 시간표 / 학사일정 / 학교 검색
 *  - Features.gs : 1인 1역, 감정 체크인, 과제 확인, 뽑기 기록, 공지
 *  - index.html  : 화면 전체 (디자인 + "만드는 법 보기" 모드 포함)
 *
 * 프론트(index.html)는 google.script.run.api(action, payload) 하나만 호출합니다.
 * 기능을 추가할 때는 아래 ACTIONS 표에 한 줄만 더하면 됩니다.
 */

const APP_VERSION = '1.0.0';

/** 웹앱 화면 */
function doGet(e) {
  const cfg = getConfig();
  return HtmlService.createHtmlOutputFromFile('index')
    .setTitle((cfg['학급이름'] || '우리 학급') + ' 홈페이지')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/** 프론트가 부르는 유일한 함수. action 이름으로 분기합니다. */
function api(action, payload) {
  payload = payload || {};
  const ACTIONS = {
    // 화면 첫 로딩에 필요한 모든 것
    bootstrap: () => getBootstrap(),
    // 나이스
    meal: () => getMeal(payload.date),
    timetable: () => getTimetable(payload.date),
    schedule: () => getSchedule(payload.from, payload.to),
    searchSchool: () => searchSchool(payload.name),
    // 학급 기능
    todayRoles: () => getTodayRoles(payload.date),
    submitEmotion: () => submitEmotion(payload),
    emotionSummary: () => getEmotionSummary(payload.date),
    emotionDetail: () => requireTeacher(payload.pin, () => getEmotionDetail(payload.date)),
    assignments: () => getAssignments(),
    checkAssignment: () => checkAssignment(payload),
    assignmentStatus: () => requireTeacher(payload.pin, () => getAssignmentStatus(payload.title)),
    logPick: () => logPick(payload),
    teacherLogin: () => ({ ok: isTeacherPin(payload.pin) }),
  };
  try {
    if (!ACTIONS[action]) throw new Error('알 수 없는 action: ' + action);
    return { ok: true, data: ACTIONS[action]() };
  } catch (err) {
    console.error(action, err);
    return { ok: false, error: String(err && err.message || err) };
  }
}

/** 첫 화면에 필요한 데이터를 한 번에 */
function getBootstrap() {
  const cfg = getConfig();
  const today = todayStr();
  return {
    version: APP_VERSION,
    today: today,
    config: publicConfig(cfg),
    students: getStudents().map(s => ({ number: s['번호'], name: s['이름'], group: s['모둠'] })),
    roles: getTodayRoles(today),
    notices: getNotices(),
    assignments: getAssignments(),
    emotionSummary: getEmotionSummary(today),
    emotions: EMOTIONS,
    neisReady: !!(cfg['시도교육청코드'] && cfg['학교코드']),
  };
}

/* ───────── 설정 ───────── */

const CONFIG_DEFAULTS = {
  '학급이름': '3학년 2반 햇살반',
  '담임': '',
  '환영문구': '오늘도 반가워요! 🌞',
  '학교이름': '',
  '시도교육청코드': '',
  '학교코드': '',
  '학교급': '초',
  '학년': '3',
  '반': '2',
  'NEIS_KEY': '',
  '테마색': '#ff7a59',
  '교사PIN': '1234',
  '역할순환주기': '매일',
  '역할순환시작일': '2026-03-02',
  '뽑기기록저장': 'Y',
};

/** 설정 시트를 { 키: 값 } 객체로 (30초 캐시) */
function getConfig() {
  const cache = CacheService.getScriptCache();
  const hit = cache.get('config');
  if (hit) return JSON.parse(hit);
  const cfg = Object.assign({}, CONFIG_DEFAULTS);
  const sheet = SpreadsheetApp.getActive().getSheetByName(SHEET.CONFIG);
  if (sheet) {
    sheet.getDataRange().getValues().slice(1).forEach(row => {
      const key = String(row[0] || '').trim();
      if (key) cfg[key] = row[1] instanceof Date ? fmtDate(row[1]) : String(row[1] == null ? '' : row[1]).trim();
    });
  }
  cache.put('config', JSON.stringify(cfg), 30);
  return cfg;
}

/** 프론트에 내려보내도 되는 설정만 (키·PIN 제외) */
function publicConfig(cfg) {
  const hide = ['NEIS_KEY', '교사PIN'];
  const out = {};
  Object.keys(cfg).forEach(k => { if (hide.indexOf(k) < 0) out[k] = cfg[k]; });
  return out;
}

function isTeacherPin(pin) {
  const real = String(getConfig()['교사PIN'] || '');
  return real !== '' && String(pin || '') === real;
}

function requireTeacher(pin, fn) {
  if (!isTeacherPin(pin)) throw new Error('선생님 PIN이 맞지 않아요.');
  return fn();
}

/* ───────── 날짜 도우미 ───────── */

const TZ = 'Asia/Seoul';
function todayStr() { return fmtDate(new Date()); }
function fmtDate(d) { return Utilities.formatDate(d, TZ, 'yyyy-MM-dd'); }
function toYmd(dateStr) { return String(dateStr || todayStr()).replace(/-/g, ''); }
function parseDate(dateStr) {
  const m = String(dateStr).match(/(\d{4})-?(\d{2})-?(\d{2})/);
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
}
