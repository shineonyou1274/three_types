/**
 * 나이스(NEIS) 교육정보 개방 포털 오픈API
 * https://open.neis.go.kr  — 회원가입 후 "인증키 발급" (무료)
 *
 * 프론트에서 직접 부르지 않고 Apps Script(서버)가 대신 부릅니다.
 *  → 인증키가 화면에 노출되지 않고, CORS 문제도 없어요.
 * 같은 요청은 6시간 캐시합니다 (하루 호출량 절약).
 */

const NEIS_BASE = 'https://open.neis.go.kr/hub/';

/** 공통 호출: endpoint + 파라미터 → row 배열 (데이터 없으면 []) */
function neisFetch(endpoint, params) {
  const cfg = getConfig();
  const q = Object.assign({ Type: 'json', pIndex: 1, pSize: 100 }, params);
  if (cfg['NEIS_KEY']) q.KEY = cfg['NEIS_KEY'];
  const url = NEIS_BASE + endpoint + '?' + Object.keys(q)
    .map(k => encodeURIComponent(k) + '=' + encodeURIComponent(q[k])).join('&');

  const cache = CacheService.getScriptCache();
  const salt = PropertiesService.getScriptProperties().getProperty('neisCacheSalt') || '';
  const cacheKey = 'neis:' + Utilities.base64EncodeWebSafe(Utilities.computeDigest(
    Utilities.DigestAlgorithm.MD5, salt + url)).slice(0, 40);
  const hit = cache.get(cacheKey);
  if (hit) return JSON.parse(hit);

  const res = UrlFetchApp.fetch(url, { muteHttpExceptions: true });
  const json = JSON.parse(res.getContentText());

  let rows = [];
  if (json[endpoint]) {
    rows = json[endpoint][1].row || [];
  } else if (json.RESULT) {
    // INFO-200: 데이터 없음 → 빈 배열. 그 외(키 오류 등)는 에러로.
    if (json.RESULT.CODE !== 'INFO-200') throw new Error('NEIS ' + json.RESULT.CODE + ': ' + json.RESULT.MESSAGE);
  }
  cache.put(cacheKey, JSON.stringify(rows), 6 * 60 * 60);
  return rows;
}

function schoolParams() {
  const cfg = getConfig();
  if (!cfg['시도교육청코드'] || !cfg['학교코드']) throw new Error('설정 시트에 학교코드가 없어요. 메뉴 > NEIS 학교코드 찾기');
  return { ATPT_OFCDC_SC_CODE: cfg['시도교육청코드'], SD_SCHUL_CODE: cfg['학교코드'] };
}

/** 급식 — { date, meals: [{ type, dishes[], allergens[], cal }] } */
function getMeal(dateStr) {
  const ymd = toYmd(dateStr);
  const rows = neisFetch('mealServiceDietInfo', Object.assign(schoolParams(), { MLSV_YMD: ymd }));
  return {
    date: dateStr || todayStr(),
    meals: rows.map(r => {
      const items = String(r.DDISH_NM || '').split(/<br\s*\/?>/i).map(s => s.trim()).filter(Boolean);
      return {
        type: r.MMEAL_SC_NM,            // 조식/중식/석식
        dishes: items.map(s => s.replace(/\s*\([\d.\s]*\)\s*$/, '').replace(/\d+\./g, '').trim()),
        allergens: items.map(s => (s.match(/\(([\d.\s]+)\)/) || [, ''])[1].trim()),
        cal: r.CAL_INFO || '',
        origin: r.ORPLC_INFO || '',
      };
    }),
  };
}

/** 시간표 — [{ period, subject }] (학교급에 따라 API가 달라요) */
function getTimetable(dateStr) {
  const cfg = getConfig();
  const endpoint = { '초': 'elsTimetable', '중': 'misTimetable', '고': 'hisTimetable' }[cfg['학교급']] || 'elsTimetable';
  const rows = neisFetch(endpoint, Object.assign(schoolParams(), {
    ALL_TI_YMD: toYmd(dateStr), GRADE: cfg['학년'], CLASS_NM: cfg['반'],
  }));
  const seen = {};
  return rows
    .map(r => ({ period: Number(r.PERIO), subject: String(r.ITRT_CNTNT || '').replace(/^-/, '').trim() }))
    .filter(p => { if (seen[p.period]) return false; seen[p.period] = true; return true; })
    .sort((a, b) => a.period - b.period);
}

/** 학사일정 — [{ date, name, content }] (우리 학년 해당 행사에 mine=true) */
function getSchedule(fromStr, toStr) {
  const cfg = getConfig();
  const rows = neisFetch('SchoolSchedule', Object.assign(schoolParams(), {
    AA_FROM_YMD: toYmd(fromStr), AA_TO_YMD: toYmd(toStr),
  }));
  const gradeFlag = ['', 'ONE', 'TW', 'THREE', 'FR', 'FIV', 'SIX'][Number(cfg['학년'])] ;
  return rows
    .filter(r => r.EVENT_NM && r.EVENT_NM !== '토요휴업일')
    .map(r => ({
      date: String(r.AA_YMD).replace(/(\d{4})(\d{2})(\d{2})/, '$1-$2-$3'),
      name: r.EVENT_NM,
      content: r.EVENT_CNTNT || '',
      mine: gradeFlag ? r[gradeFlag + '_GRADE_EVENT_YN'] === 'Y' : true,
    }));
}

/** 학교 이름으로 코드 찾기 */
function searchSchool(name) {
  if (!name) return [];
  return neisFetch('schoolInfo', { SCHUL_NM: name }).map(r => ({
    name: r.SCHUL_NM, kind: r.SCHUL_KND_SC_NM, region: r.LCTN_SC_NM,
    officeCode: r.ATPT_OFCDC_SC_CODE, schoolCode: r.SD_SCHUL_CODE,
  }));
}
