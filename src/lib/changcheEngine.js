/**
 * changcheEngine.js
 * 창의적 체험활동 특기사항 문장 오프라인 변형 엔진 (AI 미사용)
 * 동의어·유의표현 치환 + 조합 생성 → textRules 후처리
 */
import { keepValidUnique, endsNominal } from './textRules.js';

// ── 동의어·유의표현 사전 ──────────────────────────────────────────
// 길이 내림차순 정렬 → findMatches에서 긴 패턴이 먼저 선점
const SUBST_TABLE = [
  // 복합 표현 (다어절, 긴 것 우선)
  { pat: '친구들과 함께', alts: ['친구들과', '급우들과', '동료들과'] },
  { pat: '모습을 보임',   alts: ['태도를 보임', '자세를 나타냄', '면모를 드러냄', '모습을 나타냄'] },
  { pat: '모습이 돋보임', alts: ['태도가 돋보임', '자세가 돋보임', '면모가 두드러짐'] },
  { pat: '태도를 보임',   alts: ['모습을 보임', '자세를 나타냄', '면모를 드러냄'] },
  { pat: '자세를 나타냄', alts: ['모습을 보임', '태도를 보임', '면모를 드러냄'] },
  { pat: '협력하는',      alts: ['협동하는', '협업하는'] },
  { pat: '협동하는',      alts: ['협력하는', '협업하는'] },
  { pat: '협업하는',      alts: ['협력하는', '협동하는'] },
  { pat: '참여하고',      alts: ['참여하며'] },
  { pat: '참여하며',      alts: ['참여하고'] },
  { pat: '활동하고',      alts: ['활동하며'] },
  { pat: '활동하며',      alts: ['활동하고'] },
  // 부사류
  { pat: '적극적으로', alts: ['능동적으로', '열심히', '자발적으로', '주도적으로', '성실하게'] },
  { pat: '능동적으로', alts: ['적극적으로', '열심히', '자발적으로', '주도적으로'] },
  { pat: '자발적으로', alts: ['적극적으로', '능동적으로', '열심히', '주도적으로'] },
  { pat: '주도적으로', alts: ['적극적으로', '능동적으로', '자발적으로', '열심히'] },
  { pat: '성실하게',   alts: ['적극적으로', '열심히', '꾸준히'] },
  { pat: '꾸준히',     alts: ['성실하게', '지속적으로', '열심히'] },
  { pat: '열심히',     alts: ['적극적으로', '능동적으로', '자발적으로', '성실하게'] },
  { pat: '즐겁게',     alts: ['유쾌하게', '흥미롭게'] },
  { pat: '바르게',     alts: ['올바르게', '바람직하게'] },
  { pat: '올바르게',   alts: ['바르게', '바람직하게'] },
  { pat: '창의적으로', alts: ['독창적으로'] },
  { pat: '독창적으로', alts: ['창의적으로'] },
  { pat: '지속적으로', alts: ['꾸준히', '성실하게'] },
  // 관형사
  { pat: '체험활동', alts: ['활동', '프로그램'] },
  { pat: '여러',     alts: ['다양한', '다채로운'] },
  { pat: '다양한',   alts: ['여러', '다채로운'] },
  { pat: '다채로운', alts: ['여러', '다양한'] },
  { pat: '활동',     alts: ['체험활동', '프로그램'] },
  // 주체·대상
  { pat: '친구들과', alts: ['친구들과 함께', '급우들과', '동료들과'] },
  { pat: '급우들과', alts: ['친구들과', '동료들과', '친구들과 함께'] },
  { pat: '동료들과', alts: ['친구들과', '급우들과', '친구들과 함께'] },
  // 협력 계열 단독 종결
  { pat: '협력함',   alts: ['협동함', '협업함'] },
  { pat: '협동함',   alts: ['협력함', '협업함'] },
  { pat: '협업함',   alts: ['협력함', '협동함'] },
  { pat: '협력하며', alts: ['협동하며', '협업하며'] },
  { pat: '협동하며', alts: ['협력하며', '협업하며'] },
  { pat: '협력하여', alts: ['협동하여', '협업하여'] },
  // 동사 종결 (단독)
  { pat: '참여함',   alts: ['참여하는 모습을 보임', '참여하는 자세를 나타냄'] },
  { pat: '발표함',   alts: ['이야기를 나눔', '의견을 밝힘'] },
  { pat: '이해함',   alts: ['파악함', '인식함', '습득함'] },
  { pat: '완성함',   alts: ['마무리함', '이루어냄'] },
  { pat: '노력함',   alts: ['애씀', '힘씀', '정진함'] },
  { pat: '표현함',   alts: ['나타냄', '드러냄', '전달함'] },
  { pat: '실천함',   alts: ['행동함', '수행함', '이행함'] },
  { pat: '탐구함',   alts: ['탐색함', '조사함', '살펴봄'] },
  { pat: '생각함',   alts: ['고민함', '숙고함'] },
  { pat: '발전함',   alts: ['성장함', '향상됨'] },
  { pat: '성장함',   alts: ['발전함', '향상됨'] },
  { pat: '발견함',   alts: ['찾아냄', '파악함'] },
  { pat: '경험함',   alts: ['체험함', '겪음'] },
  { pat: '체험함',   alts: ['경험함', '겪음'] },
  { pat: '탐색함',   alts: ['탐구함', '조사함'] },
].sort((a, b) => b.pat.length - a.pat.length); // 길이 내림차순 정렬 (불변 보장)

// ── 유틸 ────────────────────────────────────────────────────────

/**
 * 흔한 비명사형 종결을 명사형으로 변환 (휴리스틱).
 */
function tryNominalize(text) {
  return text
    .replace(/보였다\.?$/, '보임.')
    .replace(/보인다\.?$/, '보임.')
    .replace(/하였다\.?$/, '함.')
    .replace(/했다\.?$/, '함.')
    .replace(/한다\.?$/, '함.')
    .replace(/이었다\.?$/, '임.')
    .replace(/였다\.?$/, '임.')
    .replace(/이다\.?$/, '임.');
}

/**
 * text에서 SUBST_TABLE 패턴을 찾아 겹치지 않는 매치 목록 반환.
 * 긴 패턴이 우선 선점 → 짧은 패턴은 이미 커버된 위치엔 매치 안 함.
 * @returns {{ pat:string, alts:string[], start:number, end:number }[]}
 */
function findMatches(text) {
  const covered = new Set();
  const result = [];

  for (const { pat, alts } of SUBST_TABLE) {
    let idx = text.indexOf(pat);
    while (idx !== -1) {
      const end = idx + pat.length;
      let overlap = false;
      for (let i = idx; i < end; i++) {
        if (covered.has(i)) { overlap = true; break; }
      }
      if (!overlap) {
        result.push({ pat, alts, start: idx, end });
        for (let i = idx; i < end; i++) covered.add(i);
        break; // 동일 패턴 첫 번째 발생만
      }
      idx = text.indexOf(pat, idx + 1);
    }
  }

  return result.sort((a, b) => a.start - b.start);
}

/**
 * 위치 기반 치환 목록을 역순(뒤→앞)으로 적용해 인덱스 흔들림 방지.
 * @param {string} text
 * @param {{ start:number, end:number, alt:string }[]} picks - null alt은 무시
 */
function applyPicks(text, picks) {
  const toApply = picks
    .filter(p => p.alt !== null)
    .sort((a, b) => b.start - a.start);
  let result = text;
  for (const { start, end, alt } of toApply) {
    result = result.slice(0, start) + alt + result.slice(end);
  }
  return result;
}

// ── 변형 생성 ────────────────────────────────────────────────────

/**
 * 1·2·3-치환 조합으로 후보 문장 풀 생성.
 * @param {string} base 정규화된 원문
 * @param {{ pat, alts, start, end }[]} matches
 * @returns {string[]}
 */
function generatePool(base, matches) {
  const pool = new Set();

  // 1-치환
  for (const m of matches) {
    for (const alt of m.alts) {
      pool.add(applyPicks(base, [{ start: m.start, end: m.end, alt }]));
    }
  }

  // 2-치환 (모든 쌍)
  for (let i = 0; i < matches.length; i++) {
    for (let j = i + 1; j < matches.length; j++) {
      for (const a1 of matches[i].alts) {
        for (const a2 of matches[j].alts) {
          pool.add(applyPicks(base, [
            { start: matches[i].start, end: matches[i].end, alt: a1 },
            { start: matches[j].start, end: matches[j].end, alt: a2 },
          ]));
        }
      }
    }
  }

  // 3-치환 (처음 4매치 × 각 3개 alt 상한 → 최대 C(4,3)×3³=108 후보)
  const lim = Math.min(matches.length, 4);
  for (let i = 0; i < lim; i++) {
    for (let j = i + 1; j < lim; j++) {
      for (let k = j + 1; k < lim; k++) {
        for (const a1 of matches[i].alts.slice(0, 3)) {
          for (const a2 of matches[j].alts.slice(0, 3)) {
            for (const a3 of matches[k].alts.slice(0, 3)) {
              pool.add(applyPicks(base, [
                { start: matches[i].start, end: matches[i].end, alt: a1 },
                { start: matches[j].start, end: matches[j].end, alt: a2 },
                { start: matches[k].start, end: matches[k].end, alt: a3 },
              ]));
            }
          }
        }
      }
    }
  }

  return [...pool];
}

// ── Public API ───────────────────────────────────────────────────

/**
 * 창체 특기사항 문장을 오프라인으로 N개 변형한다.
 *
 * @param {string} text 원문 (한 문장)
 * @param {number} n    원하는 변형 개수
 * @returns {string[]}  길이 ≤ n, 전부 규칙 통과(허용 문자·명사형 종결)·상호 distinct
 */
export function vary(text, n) {
  if (!text || !text.trim()) return [];

  // 정규화: 마침표 보장, 비명사형이면 명사형으로 시도
  let base = text.trim();
  if (!base.endsWith('.')) base += '.';
  if (!endsNominal(base)) base = tryNominalize(base);

  const matches = findMatches(base);
  const poolAll = generatePool(base, matches);

  // 원문 제외 → keepValidUnique 후처리
  const candidates = poolAll.filter(v => v !== base && v !== text.trim());
  const valid = keepValidUnique(candidates);

  // 부족할 경우 원문(정규화 버전)도 포함
  if (valid.length < n) {
    const baseValid = keepValidUnique([base]);
    for (const v of baseValid) {
      if (!valid.includes(v)) valid.push(v);
    }
  }

  return valid.slice(0, n);
}

/**
 * AI 경로용 프롬프트 문자열 생성 (선택적 사용).
 *
 * @param {string} text 원문
 * @param {number} n    요청 개수
 * @returns {string}
 */
export function buildPrompt(text, n) {
  return [
    `다음 창의적 체험활동 특기사항 문장을 의미를 유지하되 표현을 바꾸어 ${n}개 생성하시오.`,
    ``,
    `[원문]`,
    text,
    ``,
    `[규칙]`,
    `1. 허용 문자: 한글, 공백, 마침표, 쉼표, 숫자, 가운뎃점만 사용`,
    `2. 명사형 종결(~함/~음/~됨/~임 등 받침 ㅁ)로 끝낼 것`,
    `3. 생성된 ${n}개 문장은 서로 완전히 달라야 함(중복 금지)`,
    `4. 과장·왜곡 금지, 원문 핵심 의미와 키워드 보존`,
    ``,
    `[출력 형식]`,
    `번호 없이 한 줄에 한 문장씩 ${n}개만 출력.`,
  ].join('\n');
}
