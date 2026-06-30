// 성취수준 상수 및 정규화 유틸 (교과 평어용)

export const LEVELS = ['매우잘함', '잘함', '보통', '노력요함'];

// 엑셀/표 입력에서 들어올 수 있는 약어·변형 → 표준 수준
const ALIASES = {
  '매잘': '매우잘함', '매우잘함': '매우잘함', '매우 잘함': '매우잘함', '아주잘함': '매우잘함',
  '잘함': '잘함', '잘': '잘함',
  '보통': '보통', '보': '보통',
  '노력': '노력요함', '노력요함': '노력요함', '노력 요함': '노력요함', '노요': '노력요함',
};

// 평어를 만들지 않고 건너뛰는 토큰
const SKIP = new Set(['', '미실시', '미응시', '미평가', '결시', '면제']);

// 원시 성적 텍스트 → 표준 수준 or null(건너뜀)
export function normalizeLevel(raw) {
  const s = (raw == null ? '' : String(raw)).trim();
  if (SKIP.has(s)) return null;
  if (ALIASES[s]) return ALIASES[s];
  // 공백 제거 후 재시도
  const k = s.replace(/\s+/g, '');
  if (ALIASES[k]) return ALIASES[k];
  // 부분 일치(예: "매우잘함(A)")
  for (const key of Object.keys(ALIASES)) {
    if (s.includes(key)) return ALIASES[key];
  }
  return null;
}

export function isSkip(raw) {
  return normalizeLevel(raw) === null;
}
