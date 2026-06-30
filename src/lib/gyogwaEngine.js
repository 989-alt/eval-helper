// 교과 평어 오프라인(AI 없이) 생성 엔진 — 순수 ESM 모듈.
// 평가요소(자유 텍스트 키워드)를 소재로, 수준별 문장 프레임 + 부사/동사/종결 풀을
// 조합해 규칙(허용문자·명사형 종결·중복 금지)을 통과하는 평어를 다량 생성한다.

import { LEVELS, normalizeLevel } from './levels.js';
import { keepValidUnique } from './textRules.js';

// ──────────────────────────────────────────────────────────────────────────
// 한국어 조사 헬퍼 (elementName 마지막 한글 글자의 받침 유무 기준)
// ──────────────────────────────────────────────────────────────────────────
const HANGUL_START = 0xac00, HANGUL_END = 0xd7a3;

// 마지막 '한글 음절'에 받침이 있는지. (숫자·가운뎃점 등으로 끝나면 직전 한글 기준)
export function hasBatchim(word) {
  const s = String(word);
  for (let i = s.length - 1; i >= 0; i--) {
    const o = s.codePointAt(i);
    if (o >= HANGUL_START && o <= HANGUL_END) return (o - HANGUL_START) % 28 !== 0;
  }
  return false; // 한글이 없으면 받침 없음으로 취급
}

function attach(word, withBatchim, withoutBatchim) {
  return String(word) + (hasBatchim(word) ? withBatchim : withoutBatchim);
}
// 을/를, 은/는, 이/가
export const eulReul = (w) => attach(w, '을', '를');
export const eunNeun = (w) => attach(w, '은', '는');
export const iGa = (w) => attach(w, '이', '가');

// ──────────────────────────────────────────────────────────────────────────
// 결정적 시드 & 조합 인덱싱
// ──────────────────────────────────────────────────────────────────────────
function hashSeed(str) {
  let h = 2166136261 >>> 0;
  for (const ch of String(str)) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

// 단일 정수 k를 여러 차원의 인덱스로 분해 (각 k마다 서로 다른 조합)
function idx(k, sizes) {
  const res = [];
  let r = k >>> 0;
  for (const s of sizes) {
    res.push(r % s);
    r = Math.floor(r / s);
  }
  return res;
}

// ──────────────────────────────────────────────────────────────────────────
// 수준별 표현 풀 (부사·이해동사·수행종결 등) — 풀끼리 수준 식별 어휘가 겹치지 않게 구성.
//   각 프레임은 반드시 '그 수준에만 있는 어휘'를 1개 이상 포함하므로 수준 간 완전중복이 불가능하다.
// ──────────────────────────────────────────────────────────────────────────
const POOLS = {
  '매우잘함': {
    adv1: ['정확하게', '깊이 있게', '자세하게', '구체적으로', '명확하게'],
    adv2: ['능숙하게', '논리적으로', '창의적으로', '자신 있게', '빠르고 정확하게'],
    perform: ['나타냄', '해결함', '설명함', '표현함', '적용함', '완성함'],
  },
  '잘함': {
    adv1: ['바르게', '충실히', '꼼꼼하게'],
    adv2: ['적절하게', '알맞게', '무리 없이'],
    perform: ['나타냄', '해결함', '표현함', '정리함', '구분함'],
  },
  '보통': {
    adv1: ['대체로', '기본적으로', '어느 정도'],
    adv2: ['무난하게', '차근차근', '점차'],
    perform: ['나타냄', '해결함', '표현함', '정리함'],
  },
  '노력요함': {
    intro: ['안내와 도움을 받아', '안내를 받아', '선생님의 도움을 받아', '기초부터 차근차근'],
    growth: ['꾸준한 연습을 통한 성장이 기대됨', '점차 나아지고 있음', '조금씩 익숙해지고 있음'],
    mid: ['관심을 가지고 참여함', '꾸준히 노력하고 있음', '차근차근 학습하고 있음'],
  },
};

// ──────────────────────────────────────────────────────────────────────────
// 수준별 문장 프레임 (구조 변주: 이해+적용 / 파악+설명 / 수행+태도 / 이해+적용 …)
//   각 프레임은 (el, P, k) → 한 문장. k로 풀 인덱스를 결정적으로 분해한다.
// ──────────────────────────────────────────────────────────────────────────
const FRAMES = {
  '매우잘함': [
    (el, P, k) => { const [a, b] = idx(k, [P.adv1.length, P.adv2.length]);
      return `${eulReul(el)} ${P.adv1[a]} 이해하고 다양한 상황에 ${P.adv2[b]} 적용함.`; },
    (el, P, k) => { const [a, b, p] = idx(k, [P.adv1.length, P.adv2.length, P.perform.length]);
      return `${el}의 의미를 ${P.adv1[a]} 파악하고 그 특징을 ${P.adv2[b]} ${P.perform[p]}.`; },
    (el, P, k) => { const [a, b] = idx(k, [P.adv1.length, P.adv2.length]);
      return `${eunNeun(el)} ${P.adv2[b]} 수행하며 그 과정과 결과를 ${P.adv1[a]} 설명함.`; },
    (el, P, k) => { const [a, b, p] = idx(k, [P.adv1.length, P.adv2.length, P.perform.length]);
      return `${eulReul(el)} ${P.adv1[a]} 이해하여 스스로 ${P.adv2[b]} ${P.perform[p]}.`; },
    (el, P, k) => { const [b, p] = idx(k, [P.adv2.length, P.perform.length]);
      return `${el}에 대한 깊은 이해를 바탕으로 관련 과제를 ${P.adv2[b]} ${P.perform[p]}.`; },
    (el, P, k) => { const [a, b] = idx(k, [P.adv1.length, P.adv2.length]);
      return `${eulReul(el)} ${P.adv1[a]} 이해하고 친구들에게 ${P.adv2[b]} 설명하며 도와줌.`; },
  ],
  '잘함': [
    (el, P, k) => { const [a, b, p] = idx(k, [P.adv1.length, P.adv2.length, P.perform.length]);
      return `${eulReul(el)} ${P.adv1[a]} 이해하고 주어진 과제를 ${P.adv2[b]} ${P.perform[p]}.`; },
    (el, P, k) => { const [a, b, p] = idx(k, [P.adv1.length, P.adv2.length, P.perform.length]);
      return `${el}의 뜻을 ${P.adv1[a]} 이해하고 ${P.adv2[b]} ${P.perform[p]}.`; },
    (el, P, k) => { const [a, b] = idx(k, [P.adv1.length, P.adv2.length]);
      return `${eunNeun(el)} ${P.adv1[a]} 수행하며 그 내용을 ${P.adv2[b]} 설명함.`; },
    (el, P, k) => { const [a, b, p] = idx(k, [P.adv1.length, P.adv2.length, P.perform.length]);
      return `${eulReul(el)} 스스로 ${P.adv1[a]} 이해하고 ${P.adv2[b]} ${P.perform[p]}.`; },
    (el, P, k) => { const [a] = idx(k, [P.adv1.length]);
      return `${el}에 대한 이해를 바탕으로 관련 활동에 ${P.adv1[a]} 참여함.`; },
  ],
  '보통': [
    (el, P, k) => { const [a, b, p] = idx(k, [P.adv1.length, P.adv2.length, P.perform.length]);
      return `${el}의 기본 개념을 ${P.adv1[a]} 이해하고 익숙한 과제를 ${P.adv2[b]} ${P.perform[p]}.`; },
    (el, P, k) => { const [a, p] = idx(k, [P.adv1.length, P.perform.length]);
      return `${eulReul(el)} ${P.adv1[a]} 이해하고 친숙한 상황에서 ${P.perform[p]}.`; },
    (el, P, k) => { const [a, b] = idx(k, [P.adv1.length, P.adv2.length]);
      return `${eunNeun(el)} ${P.adv1[a]} 파악하며 관련 활동에 ${P.adv2[b]} 참여함.`; },
    (el, P, k) => { const [a, b] = idx(k, [P.adv1.length, P.adv2.length]);
      return `${el}의 기초를 ${P.adv1[a]} 익히고 ${P.adv2[b]} 이해를 넓혀 감.`; },
    (el, P, k) => { const [a, b, p] = idx(k, [P.adv1.length, P.adv2.length, P.perform.length]);
      return `${eulReul(el)} ${P.adv1[a]} 이해하고 꾸준히 노력하여 ${P.adv2[b]} ${P.perform[p]}.`; },
  ],
  '노력요함': [
    (el, P, k) => { const [i, g] = idx(k, [P.intro.length, P.growth.length]);
      return `${P.intro[i]} ${el}의 기초를 익히고 있으며 ${P.growth[g]}.`; },
    (el, P, k) => { const [i, m] = idx(k, [P.intro.length, P.mid.length]);
      return `${eulReul(el)} ${P.intro[i]} 익히고 있으며 ${P.mid[m]}.`; },
    (el, P, k) => { const [i, g] = idx(k, [P.intro.length, P.growth.length]);
      return `${el}에 관심을 가지고 참여하며 ${P.intro[i]} ${P.growth[g]}.`; },
    (el, P, k) => { const [i, g] = idx(k, [P.intro.length, P.growth.length]);
      return `${P.intro[i]} ${eulReul(el)} 이해하려 노력하며 ${P.growth[g]}.`; },
    (el, P, k) => { const [i, m] = idx(k, [P.intro.length, P.mid.length]);
      return `${P.intro[i]} ${el}의 기초 개념을 익히고 있으며 ${P.mid[m]}.`; },
  ],
};

// ──────────────────────────────────────────────────────────────────────────
// 수준별 풀 생성: elementName 시드로 결정적이며 프레임을 섞어 다양하게 채운다.
//   반환은 keepValidUnique 통과(규칙1·3 통과 + 중복 제거)된 평어 배열.
// ──────────────────────────────────────────────────────────────────────────
function buildLevelPool(elementName, level, need) {
  const P = POOLS[level];
  const frames = FRAMES[level];
  if (!P || !frames) return [];
  const want = Math.max(1, need | 0);
  const seed = hashSeed(`${elementName}|${level}`);
  const candidates = [];
  const maxK = 4000;
  for (let k = 0; k < maxK; k++) {
    for (let fi = 0; fi < frames.length; fi++) {
      // 프레임마다 seed/k에 서로 다른 오프셋을 줘 조합이 겹치지 않게 한다.
      candidates.push(frames[fi](elementName, P, seed + k * frames.length + fi * 131));
    }
    if (candidates.length >= want * 5) {
      const filtered = keepValidUnique(candidates);
      if (filtered.length >= want) return filtered;
    }
  }
  return keepValidUnique(candidates);
}

// ──────────────────────────────────────────────────────────────────────────
// export: generateBank(elementName, counts)
//   → { '매우잘함': string[], '잘함': string[], '보통': string[], '노력요함': string[] }
// ──────────────────────────────────────────────────────────────────────────
export function generateBank(elementName, counts) {
  const out = {};
  for (const level of LEVELS) {
    const need = counts && counts[level] ? counts[level] | 0 : 0;
    out[level] = need > 0 ? buildLevelPool(elementName, level, need).slice(0, need) : [];
  }
  return out;
}

// ──────────────────────────────────────────────────────────────────────────
// export: generatePerStudent(evalSet)
//   evalSet: { students:[{id,name}], subjects:[{id,name,elements:[{id,name}]}],
//              scores:{ [studentId]:{ [elementId]: level } } }
//   → [{ studentId, studentName, subjectId, subjectName, elementId, elementName, level, text }]
//   같은 (과목·요소·수준) 그룹 안에서 학생마다 distinct, 전체적으로도 가능한 한 distinct.
// ──────────────────────────────────────────────────────────────────────────
export function generatePerStudent(evalSet) {
  const students = (evalSet && evalSet.students) || [];
  const subjects = (evalSet && evalSet.subjects) || [];
  const scores = (evalSet && evalSet.scores) || {};

  const out = [];
  const globalSeen = new Set();      // 전체 distinct 시도용
  const pools = new Map();           // key → { list, ptr }

  for (const subject of subjects) {
    const elements = (subject && subject.elements) || [];
    for (const element of elements) {
      for (const student of students) {
        const raw = scores[student.id] ? scores[student.id][element.id] : undefined;
        const level = normalizeLevel(raw);
        if (level == null) continue; // 미실시/빈칸은 건너뜀

        const key = `${subject.id}|${element.id}|${level}`;
        let entry = pools.get(key);
        if (!entry) {
          // 같은 그룹의 학생 수만큼(+여유) 필요 → 넉넉히 생성
          entry = { list: buildLevelPool(element.name, level, students.length + 8), ptr: 0 };
          pools.set(key, entry);
        }

        // 그룹 내 다음 후보를 집되, 가능하면 전체적으로도 안 쓴 것을 우선
        let text = null;
        while (entry.ptr < entry.list.length) {
          const cand = entry.list[entry.ptr++];
          const norm = cand.replace(/\s+/g, '');
          if (globalSeen.has(norm)) continue;
          globalSeen.add(norm);
          text = cand;
          break;
        }
        // 전체 distinct를 만족하는 후보가 동나면 그룹 내 distinct만 보장(앞 후보 재사용 안 함)
        if (text == null && entry.ptr < entry.list.length) {
          text = entry.list[entry.ptr++];
        }
        if (text == null) {
          // 극단적 부족 시 그룹 내 남은 후보 중 첫 항목(이론상 도달하지 않음)
          text = entry.list.length ? entry.list[entry.list.length - 1] : eulReul(element.name) + ' 익히고 있음.';
        }

        out.push({
          studentId: student.id,
          studentName: student.name,
          subjectId: subject.id,
          subjectName: subject.name,
          elementId: element.id,
          elementName: element.name,
          level,
          text,
        });
      }
    }
  }
  return out;
}
