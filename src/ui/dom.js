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

// 공통 버튼/입력 스타일
export const css = {
  btn: 'px-3 py-1.5 rounded-md text-sm font-medium transition',
  btnPrimary: 'bg-indigo-600 hover:bg-indigo-700 text-white',
  btnGhost: 'bg-slate-100 hover:bg-slate-200 text-slate-700',
  btnDanger: 'bg-rose-50 hover:bg-rose-100 text-rose-600',
  input: 'border border-slate-300 rounded-md px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300',
  card: 'bg-white rounded-xl border border-slate-200 p-4 shadow-sm',
  label: 'text-xs font-semibold text-slate-500',
};
