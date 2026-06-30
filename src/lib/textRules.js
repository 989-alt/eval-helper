// 교과/창체 평어 규칙 검증 (check_pyeoeo.py 포팅)
// 규칙1: 허용 문자(한글, 공백, 마침표, 쉼표, 가운뎃점, 숫자) 외 금지
// 규칙3: 명사형 종결(마지막 한글 글자 받침 ㅁ)
// 규칙5: 완전 중복 금지

const HANGUL_START = 0xac00, HANGUL_END = 0xd7a3;
const MIDDLE_DOTS = new Set(['·', '•', '∙', '‧', '・', 'ㆍ']);

export function isAllowedChar(ch) {
  if (ch === ' ' || ch === '.' || ch === ',' || ch === '\t' || ch === '\n') return true;
  if (MIDDLE_DOTS.has(ch)) return true;
  if (ch >= '0' && ch <= '9') return true;
  const o = ch.codePointAt(0);
  if (o >= HANGUL_START && o <= HANGUL_END) return true;
  if (o >= 0x3130 && o < 0x3190) return true; // 호환 자모
  return false;
}

// 허용 외 문자 목록(중복 제거) 반환. 없으면 빈 배열.
export function forbiddenChars(text) {
  const bad = new Set();
  for (const ch of text) if (!isAllowedChar(ch)) bad.add(ch);
  return [...bad];
}

// 마지막 한글 글자의 받침이 ㅁ(종성코드 16)이면 명사형으로 본다.
export function endsNominal(text) {
  const s = text.replace(/[\s.\t]+$/u, '');
  if (!s) return false;
  const ch = s[s.length - 1];
  const o = ch.codePointAt(0);
  if (o < HANGUL_START || o > HANGUL_END) return false;
  return (o - HANGUL_START) % 28 === 16; // ㅁ
}

// 한 평어가 모든 규칙(1,3)을 통과하는지
export function isValidPyeoeo(text) {
  return forbiddenChars(text).length === 0 && endsNominal(text);
}

// 목록 전체 검증. { ok, violations: [{index, text, reasons:[]}], duplicates:[...] }
export function validateList(list) {
  const violations = [];
  const seen = new Map();
  list.forEach((text, i) => {
    const reasons = [];
    const fb = forbiddenChars(text);
    if (fb.length) reasons.push('허용 외 문자: ' + fb.join(' '));
    if (!endsNominal(text)) reasons.push('명사형 종결 아님');
    const key = text.replace(/\s+/g, '');
    if (seen.has(key)) reasons.push('중복 (' + (seen.get(key) + 1) + '행과 동일)');
    else seen.set(key, i);
    if (reasons.length) violations.push({ index: i, text, reasons });
  });
  return { ok: violations.length === 0, violations };
}

// 목록에서 규칙 통과 + 중복 제거한 것만 추림(엔진 출력 후처리용)
export function keepValidUnique(list) {
  const out = [], seen = new Set();
  for (const t of list) {
    if (!isValidPyeoeo(t)) continue;
    const k = t.replace(/\s+/g, '');
    if (seen.has(k)) continue;
    seen.add(k); out.push(t);
  }
  return out;
}
