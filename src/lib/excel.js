// src/lib/excel.js
// SheetJS 기반 모드 B 엑셀 양식 생성 / 파싱 (ESM, 빌드리스)
//
// XLSX 접근 전략:
//   브라우저 : CDN 스크립트가 window.XLSX = XLSX_object 로 세팅
//   Node 테스트 : 호출 전에 globalThis.XLSX = await import('xlsx') 로 세팅
//
// export:
//   buildWorkbook(evalSet)              → XLSX workbook 객체
//   downloadTemplate(evalSet, filename) → 브라우저 파일 다운로드 트리거
//   parseWorkbook(arrayBuffer)          → EvalSet 복원

import { LEVELS, normalizeLevel } from './levels.js';

// ─── XLSX 런타임 접근 ─────────────────────────────────────────────────────────

/**
 * globalThis.XLSX 를 반환한다.
 * ESM import 네임스페이스(default 프로퍼티) vs CDN 직접 객체 양쪽을 처리.
 * @returns {Object} SheetJS XLSX 객체
 */
function getXLSX() {
  const x = globalThis.XLSX;
  if (!x) {
    throw new Error(
      'XLSX가 로드되지 않았습니다.\n' +
      '  브라우저: CDN <script> 태그를 먼저 삽입하세요.\n' +
      '  Node 테스트: globalThis.XLSX = await import("xlsx") 를 먼저 실행하세요.'
    );
  }
  // ESM import() 네임스페이스인 경우 .default 에 실제 객체가 있을 수 있음
  return x.default ?? x;
}

// ─── 상수 ─────────────────────────────────────────────────────────────────────

/** 드롭다운 허용 토큰 */
const VALID_TOKENS = [...LEVELS, '미실시'];

/** 안내 시트 이름 (과목 시트와 충돌 시 대체) */
const GUIDE_SHEET = '안내';

/** parseWorkbook에서 건너뛸 안내 시트 이름 집합 */
const GUIDE_SHEET_NAMES = new Set([GUIDE_SHEET, '입력안내']);

// ─── 내부 유틸 ────────────────────────────────────────────────────────────────

/**
 * 과목명 → Excel 시트명 (31자 제한 + 중복 방지).
 * @param {string} name
 * @param {Set<string>} used  이미 사용된 이름 집합 (in-place 갱신)
 */
function toSheetName(name, used) {
  let base = name.slice(0, 28);
  let candidate = base;
  let n = 1;
  while (used.has(candidate)) {
    const suffix = `_${n++}`;
    candidate = base.slice(0, 31 - suffix.length) + suffix;
  }
  used.add(candidate);
  return candidate;
}

/**
 * 0-based 열 인덱스 → Excel 열 문자 ('A', 'B', ..., 'Z', 'AA', ...)
 * @param {number} idx  0-based
 */
function colLetter(idx) {
  let s = '';
  let n = idx;
  while (n >= 0) {
    s = String.fromCharCode(65 + (n % 26)) + s;
    n = Math.floor(n / 26) - 1;
  }
  return s;
}

/**
 * 수준 셀 범위 sqref (B2 시작, 학생/요소 수에 따라 결정)
 * A열 = 학생, B열~ = 요소
 * @param {number} numElements  평가요소 수
 * @param {number} numStudents  학생 수
 */
function levelSqref(numElements, numStudents) {
  const lastCol = colLetter(numElements); // 0:A(학생), 1:B(요소1), ..., numElements:마지막요소
  const lastRow = 1 + numStudents;        // 헤더=1행, 학생은 2행~
  return `B2:${lastCol}${lastRow}`;
}

// ─── buildSkeletonEvalSet ────────────────────────────────────────────────────

/**
 * 카운트만으로 EvalSet 스켈레톤을 만든다. (엑셀 간편 양식 생성용)
 * @param {number} numStudents       학생 수 (>=1)
 * @param {number[]} criteriaCounts  과목별 평가기준 수 배열. length = 과목 수, 각 원소 = 그 과목의 기준 수(>=1)
 * @returns {{ students: Array<{id,name}>, subjects: Array<{id,name,elements:Array<{id,name}>}>, scores: Object }}
 */
export function buildSkeletonEvalSet(numStudents, criteriaCounts) {
  // numStudents: 정수 강제, 최소 1
  const n = Math.max(1, numStudents | 0);

  // criteriaCounts: 배열 여부 확인, 비어있으면 빈 배열로 취급
  const counts = Array.isArray(criteriaCounts) ? criteriaCounts : [];

  // students
  const students = [];
  for (let i = 0; i < n; i++) {
    students.push({
      id: `st${i}`,
      name: `학생${i + 1}`,
    });
  }

  // subjects
  const subjects = [];
  for (let i = 0; i < counts.length; i++) {
    const k = Math.max(1, counts[i] | 0); // 각 과목 기준 수도 강제, 최소 1
    const elements = [];
    for (let j = 0; j < k; j++) {
      elements.push({
        id: `s${i}_e${j}`,
        name: `평가기준${j + 1}`,
      });
    }
    subjects.push({
      id: `s${i}`,
      name: `과목${i + 1}`,
      elements,
    });
  }

  // scores: 빈 객체
  const scores = {};

  return { students, subjects, scores };
}

// ─── buildWorkbook ────────────────────────────────────────────────────────────

/**
 * EvalSet → XLSX workbook.
 * 과목별 시트 1개 (시트명 = 과목명, 31자·중복 처리).
 * 1행: ['학생', ...elements.name]
 * 2행~: [student.name, ...빈셀]
 * 수준 셀에 dataValidation 첨부 시도 (SheetJS 커뮤니티판에선 무시될 수 있음).
 * 별도 '안내' 시트에 유효 토큰 목록을 기재해 대체 안내.
 *
 * @param {{ students: Array, subjects: Array, scores?: Object }} evalSet
 * @returns {Object} XLSX workbook 객체
 */
export function buildWorkbook(evalSet) {
  const XLSX = getXLSX();
  const { students = [], subjects = [] } = evalSet;
  const wb = XLSX.utils.book_new();
  const usedNames = new Set();

  // 안내 시트를 맨 앞에 둔다 (파일을 열면 작성 방법이 가장 먼저 보이도록).
  _appendGuideSheet(wb, usedNames);

  for (const subj of subjects) {
    const elements = subj.elements ?? [];
    const header = ['학생 이름', ...elements.map(e => e.name)];
    const dataRows = students.map(st => [st.name, ...elements.map(() => '')]);
    const ws = XLSX.utils.aoa_to_sheet([header, ...dataRows]);

    // 열 너비 힌트
    ws['!cols'] = [
      { wch: 12 },                            // 학생 열
      ...elements.map(() => ({ wch: 10 })),   // 수준 열
    ];

    // dataValidation 첨부 시도
    // SheetJS Pro(상용)에서만 실제 xlsx에 드롭다운이 포함되지만, 무해하게 첨부.
    // 실제 드롭다운이 필요하면 '안내' 시트의 값 목록을 활용하거나 Pro 버전 필요.
    if (elements.length > 0 && students.length > 0) {
      ws['!dataValidations'] = [
        {
          sqref: levelSqref(elements.length, students.length),
          type: 'list',
          formula1: `"${VALID_TOKENS.join(',')}"`,
          showDropDown: false,
          showErrorMessage: true,
          error: '목록에서 선택하거나 직접 입력하세요.',
          errorTitle: '입력값 오류',
        },
      ];
    }

    const sheetName = toSheetName(subj.name, usedNames);
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
  }

  return wb;
}

/** 안내 시트 추가 */
function _appendGuideSheet(wb, usedNames) {
  const XLSX = getXLSX();
  const aoa = [
    ['📋 작성 방법 — 아래 순서대로 채운 뒤 앱에 업로드하세요'],
    [''],
    ['① 과목', '아래쪽 시트 탭(과목1, 과목2 …)의 이름을 실제 과목명으로 바꾸세요.'],
    ['', '   (탭 이름을 더블클릭 → 예: "과목1" → "국어")'],
    ['② 평가기준', '각 과목 시트의 1행(맨 윗줄)에 있는 "평가기준1, 평가기준2 …"를'],
    ['', '   실제 평가기준으로 바꿔 쓰세요.  ← 평가기준은 바로 여기(1행 헤더)에 입력합니다.'],
    ['③ 성취수준', '2행부터 학생 이름 옆 칸에 학생별 성취수준을 입력하세요.'],
    [''],
    ['성취수준 입력값 (셀에 아래 중 하나를 직접 입력)'],
    ...VALID_TOKENS.map(t => ['', t]),
    [''],
    ['빈 칸 또는 "미실시"', '해당 평어를 생성하지 않고 건너뜁니다.'],
    ['④ 저장 후', '앱의 "엑셀 양식 업로드" 버튼을 누르면 학생별 평어가 만들어집니다.'],
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws['!cols'] = [{ wch: 16 }, { wch: 62 }];

  const guideName = usedNames.has(GUIDE_SHEET) ? '입력안내' : GUIDE_SHEET;
  usedNames.add(guideName);
  XLSX.utils.book_append_sheet(wb, ws, guideName);
}

// ─── downloadTemplate ─────────────────────────────────────────────────────────

/**
 * 브라우저에서 엑셀 양식 파일을 다운로드.
 * @param {{ students: Array, subjects: Array }} evalSet
 * @param {string} [filename]
 */
export function downloadTemplate(evalSet, filename = '교과평어_양식.xlsx') {
  const XLSX = getXLSX();
  const wb = buildWorkbook(evalSet);
  try {
    // Electron / Node 등 파일 시스템 직접 접근 환경
    XLSX.writeFile(wb, filename);
  } catch {
    // 순수 브라우저 → Blob + 임시 링크
    const arr = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob(
      [arr],
      { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 15_000);
  }
}

// ─── parseWorkbook ────────────────────────────────────────────────────────────

/**
 * 업로드된 엑셀(ArrayBuffer 또는 Uint8Array) → EvalSet 복원.
 *
 * 각 시트 = 과목, 헤더 첫 행 첫 칸 다음 = 평가요소, 행 = 학생, 셀 = 수준.
 * '안내'/'입력안내' 시트는 건너뜀.
 * 수준 값은 normalizeLevel로 표준화; 빈칸/미실시 등 skip 토큰은 원본 raw 값 보존.
 * 빈 시트·빈 행·빈 이름 행은 안전하게 무시.
 *
 * @param {ArrayBuffer|Uint8Array} arrayBuffer
 * @returns {{ students: Array<{id,name}>, subjects: Array<{id,name,elements}>, scores: Object }}
 */
export function parseWorkbook(arrayBuffer) {
  const XLSX = getXLSX();

  // SheetJS type:'array' 는 Uint8Array 기대; ArrayBuffer 이면 변환
  const data = arrayBuffer instanceof ArrayBuffer
    ? new Uint8Array(arrayBuffer)
    : arrayBuffer;

  const wb = XLSX.read(data, { type: 'array' });
  const subjectSheets = wb.SheetNames.filter(n => !GUIDE_SHEET_NAMES.has(n));

  // 학생 등장 순서 보존
  const studentOrder = [];                    // 등장 순서대로 이름
  const studentIdx = Object.create(null);     // name → 0-based 인덱스
  let stCounter = 0;

  const subjects = [];
  const scores = {};
  let eCounter = 0;
  let sCounter = 0;

  for (const sheetName of subjectSheets) {
    const ws = wb.Sheets[sheetName];
    if (!ws || !ws['!ref']) continue;  // 완전히 빈 시트

    const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
    if (!aoa.length) continue;

    const headerRow = aoa[0];
    if (!Array.isArray(headerRow) || headerRow.length < 2) continue;

    // 첫 칸(레이블) 제외, 나머지 = 평가요소명
    const elNames = headerRow.slice(1).map(v => String(v).trim()).filter(Boolean);
    if (!elNames.length) continue;

    const elements = elNames.map(name => ({ id: `e${eCounter++}`, name }));
    const subjId = `s${sCounter++}`;
    subjects.push({ id: subjId, name: sheetName, elements });

    // 데이터 행
    for (let r = 1; r < aoa.length; r++) {
      const row = aoa[r];
      if (!row || !row.length) continue;
      const rawName = String(row[0] ?? '').trim();
      if (!rawName) continue;  // 빈 이름 행 무시

      // 학생 등록 (첫 등장 기준)
      if (!(rawName in studentIdx)) {
        studentIdx[rawName] = stCounter++;
        studentOrder.push(rawName);
      }
      const stId = `st${studentIdx[rawName]}`;
      if (!scores[stId]) scores[stId] = {};

      // 수준 파싱
      for (let c = 0; c < elements.length; c++) {
        const raw = String(row[c + 1] ?? '').trim();
        const level = normalizeLevel(raw);
        // 정규화된 수준이 있으면 사용, skip 토큰은 원본 raw 보존(빈칸 포함)
        scores[stId][elements[c].id] = level !== null ? level : raw;
      }
    }
  }

  const students = studentOrder.map(name => ({
    id: `st${studentIdx[name]}`,
    name,
  }));

  return { students, subjects, scores };
}
