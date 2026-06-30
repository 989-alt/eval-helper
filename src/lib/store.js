// 앱 전역 상태 + localStorage 자동저장 + 간단 구독
const KEY = 'eval-helper-state-v2';

function defaultState() {
  return {
    evalSet: { students: [], subjects: [], scores: {} },
    ai: { provider: 'google', apiKey: '', model: '', models: [] },
    bank: { standard: '', counts: { 매우잘함: 3, 잘함: 3, 보통: 3, 노력요함: 3 } },
  };
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch { return null; }
}

let state = load() || defaultState();
const listeners = new Set();

export function getState() { return state; }

export function setState(patch) {
  state = typeof patch === 'function' ? patch(state) : { ...state, ...patch };
  persist();
  listeners.forEach((fn) => fn(state));
}

// 깊은 경로 일부만 갱신하는 헬퍼 (evalSet 등)
export function update(path, value) {
  const next = structuredClone(state);
  let o = next;
  const parts = path.split('.');
  for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = value;
  setState(next);
}

export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function persist() {
  try {
    // API 키도 로컬에만 저장(서버 전송 없음). 사용자가 원치 않으면 비우면 됨.
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch { /* 용량 초과 등 무시 */ }
}

export function resetEvalSet() {
  setState((s) => ({ ...s, evalSet: { students: [], subjects: [], scores: {} } }));
}

export function uid(prefix = 'id') {
  return prefix + '_' + Math.random().toString(36).slice(2, 9);
}
