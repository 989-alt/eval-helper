import { h, css } from './dom.js';
import { copyText, toast } from '../lib/clipboard.js';

// 한 줄 평어 + 클릭복사 (복사하면 표시 변경)
export function copyLine(text, { prefix = '' } = {}) {
  const btn = h('button', {
    class: css.btn + ' ' + css.btnGhost + ' shrink-0',
    title: '클릭하여 복사',
  }, '복사');
  const row = h('div', {
    class: 'flex items-start gap-2 py-1.5 px-2 rounded-md hover:bg-slate-50 group',
  },
    prefix ? h('span', { class: 'text-xs font-semibold text-slate-400 shrink-0 mt-1 w-10' }, prefix) : null,
    h('span', { class: 'flex-1 text-sm leading-relaxed' }, text),
    btn,
  );
  btn.addEventListener('click', async () => {
    const ok = await copyText(text);
    toast(ok ? '복사되었습니다' : '복사 실패');
    if (ok) { btn.textContent = '복사됨'; btn.classList.add('bg-emerald-100', 'text-emerald-700'); }
  });
  return row;
}

export function tierBadge(tier) {
  const map = {
    '무료': 'bg-emerald-100 text-emerald-700',
    '$20': 'bg-sky-100 text-sky-700',
    '$100': 'bg-amber-100 text-amber-700',
  };
  const labelMap = { '무료': '무료 추천', '$20': '$20 라이트', '$100': '$100 헤비' };
  return h('span', { class: 'text-[11px] px-1.5 py-0.5 rounded ' + (map[tier] || 'bg-slate-100 text-slate-600') }, labelMap[tier] || tier);
}

export function sectionTitle(text, sub) {
  return h('div', { class: 'mb-2' },
    h('h3', { class: 'font-semibold text-slate-700' }, text),
    sub ? h('p', { class: 'text-xs text-slate-400' }, sub) : null,
  );
}

export function notice(text, kind = 'info') {
  const c = kind === 'warn' ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200';
  return h('div', { class: 'text-sm border rounded-lg px-3 py-2 ' + c }, text);
}
