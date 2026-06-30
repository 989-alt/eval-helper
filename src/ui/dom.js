// 초경량 DOM 헬퍼 (빌드 없이 사용)
export function h(tag, props = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class' || k === 'className') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k === 'html') el.innerHTML = v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'disabled' || k === 'selected') el[k] = !!v;
    else el.setAttribute(k, v);
  }
  for (const c of children.flat()) {
    if (c == null || c === false) continue;
    el.append(c.nodeType ? c : document.createTextNode(String(c)));
  }
  return el;
}

export function clear(node) { while (node.firstChild) node.removeChild(node.firstChild); }
export function mount(node, ...children) { clear(node); for (const c of children.flat()) if (c) node.append(c); }

// 공통 버튼/입력 스타일 (레퍼런스 evaluationapp 디자인 언어)
export const css = {
  btn: 'px-4 py-2 rounded-md text-sm font-bold transition',
  btnPrimary: 'bg-blue-600 hover:bg-blue-700 text-white shadow',
  btnGhost: 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50',
  btnDanger: 'bg-white text-red-500 border border-red-200 hover:bg-red-50',
  input: 'p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 outline-none bg-white',
  card: 'bg-white shadow rounded-lg p-6 border border-gray-200',
  label: 'font-bold text-gray-700 text-sm',
  // 전체폭 메인 액션 버튼 (색상은 호출부에서 지정)
  cta: 'w-full py-3 rounded-lg text-white font-bold text-lg shadow transition disabled:bg-gray-400',
};
