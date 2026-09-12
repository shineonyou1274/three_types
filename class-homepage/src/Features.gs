/**
 * 학급 기능 — 1인 1역 / 감정 체크인 / 과제 확인 / 뽑기 기록 / 공지
 * 모든 기능은 "시트 읽기 → 계산 → (필요하면) 시트 쓰기" 세 단계뿐입니다.
 */

/* ───────── 오늘의 1인 1역 ───────── */

/**
 * 규칙
 *  - 고정담당이 적힌 역할은 항상 그 사람.
 *  - 나머지 역할은 학생 명단을 순환. 순환 인덱스 = 시작일부터 센 "수업일 수"(주말 제외)
 *    (역할순환주기가 '매주'면 주 단위로 바뀜)
 *  - 역할이 학생보다 적으면 남는 학생은 "🌿 쉬는 날".
 */
function getTodayRoles(dateStr) {
  const cfg = getConfig();
  const date = parseDate(dateStr || todayStr());
  const students = getStudents();
  const roles = readTable(SHEET.ROLES).filter(r => r['역할']);
  if (!students.length || !roles.length) return { date: fmtDate(date), items: [], rest: [], index: 0 };

  const fixed = roles.filter(r => r['고정담당']);
  const rotating = roles.filter(r => !r['고정담당']);
  const fixedNames = fixed.map(r => String(r['고정담당']).trim());
  const pool = students.filter(s => fixedNames.indexOf(String(s['이름']).trim()) < 0);

  const idx = rotationIndex(cfg, date);
  const n = pool.length;
  const rotated = pool.map((_, i) => pool[(i + idx) % n]);

  const items = fixed.map(r => ({ role: r['역할'], emoji: r['이모지'] || '⭐', desc: r['설명'] || '', name: r['고정담당'], fixed: true }));
  rotating.forEach((r, i) => {
    const s = rotated[i % n];
    items.push({ role: r['역할'], emoji: r['이모지'] || '⭐', desc: r['설명'] || '', name: s['이름'], number: s['번호'], fixed: false });
  });
  const assigned = {};
  items.forEach(it => { assigned[it.name] = true; });
  const rest = students.filter(s => !assigned[s['이름']]).map(s => s['이름']);
  return { date: fmtDate(date), items: items, rest: rest, index: idx, cycle: cfg['역할순환주기'] };
}

/** 시작일 → 대상일 사이의 수업일(월~금) 수. 매주 모드면 주 수. */
function rotationIndex(cfg, date) {
  const start = parseDate(cfg['역할순환시작일'] || '2026-03-02');
  if (date < start) return 0;
  if (cfg['역할순환주기'] === '매주') {
    return Math.floor((date - start) / (7 * 24 * 3600 * 1000));
  }
  let count = 0;
  const d = new Date(start);
  while (d < date) {
    d.setDate(d.getDate() + 1);
    const w = d.getDay();
    if (w !== 0 && w !== 6) count++;
  }
  return count;
}

/* ───────── 감정 체크인 ───────── */

const EMOTIONS = [
  { key: '신나요', emoji: '🤩', color: '#ffb703' },
  { key: '좋아요', emoji: '😊', color: '#ff8fab' },
  { key: '편안해요', emoji: '😌', color: '#8ecae6' },
  { key: '그저그래요', emoji: '😐', color: '#adb5bd' },
  { key: '피곤해요', emoji: '😴', color: '#b8b8ff' },
  { key: '걱정돼요', emoji: '😰', color: '#a2d2ff' },
  { key: '슬퍼요', emoji: '😢', color: '#90a4ae' },
  { key: '화나요', emoji: '😠', color: '#ff6b6b' },
];

/** 체크인 저장. 같은 날 같은 학생이 다시 하면 기존 행을 덮어씁니다. */
function submitEmotion(p) {
  const name = String(p.name || '').trim();
  const emotion = String(p.emotion || '').trim();
  if (!name || !emotion) throw new Error('이름과 감정을 골라 주세요.');
  if (!EMOTIONS.some(e => e.key === emotion)) throw new Error('알 수 없는 감정이에요.');
  const today = todayStr();
  const existing = readTable(SHEET.EMOTION).find(r => r['날짜'] === today && String(r['이름']).trim() === name);
  const row = { '시각': new Date(), '날짜': today, '번호': p.number || '', '이름': name, '감정': emotion, '한마디': String(p.note || '').slice(0, 200) };
  if (existing) updateRow(SHEET.EMOTION, existing._row, row);
  else appendRow(SHEET.EMOTION, row);
  return getEmotionSummary(today);
}

/** 누구나 볼 수 있는 집계 (이름 없음) */
function getEmotionSummary(dateStr) {
  const date = dateStr || todayStr();
  const rows = readTable(SHEET.EMOTION).filter(r => r['날짜'] === date);
  const counts = {};
  EMOTIONS.forEach(e => { counts[e.key] = 0; });
  rows.forEach(r => { if (counts[r['감정']] != null) counts[r['감정']]++; });
  return { date: date, total: rows.length, counts: counts, checked: rows.map(r => r['이름']) };
}

/** 선생님만: 누가 어떤 감정인지 + 한마디 */
function getEmotionDetail(dateStr) {
  const date = dateStr || todayStr();
  return readTable(SHEET.EMOTION).filter(r => r['날짜'] === date)
    .map(r => ({ number: r['번호'], name: r['이름'], emotion: r['감정'], note: r['한마디'], time: String(r['시각'] || '') }));
}

/* ───────── 과제 확인 ───────── */

function getAssignments() {
  const today = parseDate(todayStr());
  const doneRows = readTable(SHEET.ASSIGN_LOG);
  return readTable(SHEET.ASSIGN)
    .filter(a => a['과제'] && String(a['공개'] || 'Y').toUpperCase() !== 'N')
    .map(a => {
      const due = a['마감일'] ? parseDate(a['마감일']) : null;
      const dday = due ? Math.round((due - today) / 86400000) : null;
      const doneNames = {};
      doneRows.filter(r => r['과제'] === a['과제']).forEach(r => { doneNames[r['이름']] = r['상태']; });
      return {
        title: a['과제'], subject: a['과목'] || '', due: a['마감일'] || '', dday: dday,
        desc: a['설명'] || '', link: a['링크'] || '',
        doneCount: Object.keys(doneNames).filter(k => doneNames[k] === '완료').length,
      };
    })
    .filter(a => a.dday == null || a.dday >= -7)
    .sort((a, b) => (a.dday == null ? 999 : a.dday) - (b.dday == null ? 999 : b.dday));
}

/** 학생이 "다 했어요 / 확인했어요" 누르면 기록 */
function checkAssignment(p) {
  const name = String(p.name || '').trim();
  if (!name || !p.title) throw new Error('이름과 과제를 골라 주세요.');
  const status = p.status === '완료' ? '완료' : '확인';
  const existing = readTable(SHEET.ASSIGN_LOG).find(r => r['과제'] === p.title && String(r['이름']).trim() === name);
  const row = { '시각': new Date(), '과제': p.title, '번호': p.number || '', '이름': name, '상태': status };
  if (existing) updateRow(SHEET.ASSIGN_LOG, existing._row, row);
  else appendRow(SHEET.ASSIGN_LOG, row);
  return { title: p.title, name: name, status: status };
}

/** 선생님만: 과제별 학생 상태표 */
function getAssignmentStatus(title) {
  const logs = readTable(SHEET.ASSIGN_LOG).filter(r => !title || r['과제'] === title);
  const map = {};
  logs.forEach(r => { map[r['이름']] = r['상태']; });
  return getStudents().map(s => ({ number: s['번호'], name: s['이름'], status: map[s['이름']] || '' }));
}

/* ───────── 뽑기 기록 / 공지 ───────── */

function logPick(p) {
  if (String(getConfig()['뽑기기록저장'] || 'Y').toUpperCase() === 'N') return { saved: false };
  appendRow(SHEET.PICK_LOG, { '시각': new Date(), '종류': p.type || '', '결과': Array.isArray(p.result) ? p.result.join(', ') : String(p.result || '') });
  return { saved: true };
}

function getNotices() {
  return readTable(SHEET.NOTICE)
    .filter(n => n['제목'])
    .map(n => ({ date: n['날짜'] || '', title: n['제목'], body: n['내용'] || '', pinned: String(n['고정'] || '').toUpperCase() === 'Y' }))
    .sort((a, b) => (b.pinned - a.pinned) || String(b.date).localeCompare(String(a.date)))
    .slice(0, 8);
}
