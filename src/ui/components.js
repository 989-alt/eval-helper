import { h, css } from './dom.js';
import { copyText, toast } from '../lib/clipboard.js';

// 수준별 색상 (레퍼런스: 매우잘함=파랑 / 잘함=초록 / 보통=노랑 / 노력요함=주황)
export const LEVEL_COLORS = {
  '매우잘함': { bg: 'bg-blue-50',   border: 'border-blue-200',   text: 'text-blue-600' },
  '잘함':     { bg: 'bg-green-50',  border: 'border-green-200',  text: 'text-green-600' },
  '보통':     { bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-600' },
  '노력요함': { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-600' },
};

// 클릭하면 복사되는 한 줄(행 전체 클릭). 복사 시 텍스트가 rose-600 으로 바뀌고 '복사됨' 유지.
// opts.prefix: 좌측 라벨, opts.accent: hover 배경 색 키('blue'|'purple'|'green'|'teal'|'gray')
export function copyLine(text, { prefix = '', accent = 'gray' } = {}) {
  let copied = false;
  const hint = h('span', { class: 'hidden group-hover:block text-xs text-gray-400 ml-2 shrink-0 mt-0.5' }, '복사');
  const body = h('span', { class: 'flex-1 leading-relaxed' }, text);
  const row = h('div', {
    class: `text-sm p-2 rounded cursor-pointer group flex items-start gap-2 transition-colors duration-200 hover:bg-${accent}-50 text-gray-700`,
    title: '클릭하여 복사',
  },
    prefix ? h('span', { class: 'text-xs font-bold text-gray-400 shrink-0 mt-0.5 min-w-[3rem]' }, prefix) : null,
    body,
    hint,
  );
  row.addEventListener('click', async () => {
    const ok = await copyText(text);
    toast(ok ? '복사되었습니다' : '복사 실패');
    if (ok && !copied) {
      copied = true;
      body.className = 'flex-1 leading-relaxed text-rose-600 font-semibold';
      hint.className = 'block text-xs text-rose-500 ml-2 shrink-0 mt-0.5 font-bold';
      hint.textContent = '복사됨';
    }
  });
  return row;
}

// 수준별 결과 카드 (색상 헤더 + 카운트 pill + 복사 리스트)
export function levelCard(level, items) {
  const c = LEVEL_COLORS[level] || { bg: 'bg-gray-50', border: 'border-gray-200' };
  return h('div', { class: `border ${c.border} rounded-lg overflow-hidden` },
    h('div', { class: `${c.bg} px-3 py-2 font-bold text-gray-700 text-sm border-b ${c.border} flex justify-between items-center` },
      h('span', {}, level),
      h('span', { class: 'bg-white px-2 rounded-full border text-xs flex items-center' }, String(items.length)),
    ),
    h('ul', { class: 'p-3 space-y-1 max-h-72 overflow-y-auto custom-scrollbar' },
      ...items.map((t) => copyLine(t, { accent: 'blue' })),
    ),
  );
}

// 비용 티어 뱃지
export function tierBadge(tier) {
  const map = {
    '무료': 'bg-emerald-50 text-emerald-700 border-emerald-200',
    '$20': 'bg-sky-50 text-sky-700 border-sky-200',
    '$100': 'bg-amber-50 text-amber-700 border-amber-200',
  };
  const labelMap = { '무료': '무료 추천', '$20': '$20 라이트', '$100': '$100 헤비' };
  return h('span', { class: 'text-[11px] px-2 py-0.5 rounded-full border ' + (map[tier] || 'bg-gray-50 text-gray-600 border-gray-200') }, labelMap[tier] || tier);
}

// 섹션 제목 (레퍼런스: font-bold text-lg text-gray-800)
export function sectionTitle(text, sub) {
  return h('div', { class: 'mb-4' },
    h('h3', { class: 'font-bold text-lg text-gray-800' }, text),
    sub ? h('p', { class: 'text-xs text-gray-400 mt-0.5' }, sub) : null,
  );
}

// 안내/경고 박스
export function notice(text, kind = 'info') {
  if (kind === 'warn') {
    return h('div', { class: 'bg-red-50 border-l-4 border-red-500 text-red-700 p-4 rounded shadow-sm text-sm whitespace-pre-line' }, text);
  }
  return h('div', { class: 'text-sm bg-blue-50 border border-blue-100 text-blue-900 rounded-lg px-3 py-2' }, text);
}
