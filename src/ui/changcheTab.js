import { h, mount, css } from './dom.js';
import { getState } from '../lib/store.js';
import { vary } from '../lib/changcheEngine.js';
import { generate } from '../lib/providers.js';
import { buildChangchePrompt } from '../lib/pyeoeoRules.js';
import { copyLine, notice, btnLoading } from './components.js';
import { toast } from '../lib/clipboard.js';

export function renderChangche(root) {
  // 여러 문장 + 문장별 생성 개수 (레퍼런스 방식)
  let items = [{ text: '', count: 10 }];
  const inWrap = h('div', { class: 'space-y-3' });
  const out = h('div', { class: 'mt-6' });

  function syncFromDOM() {
    inWrap.querySelectorAll('[data-row]').forEach((row, i) => {
      if (!items[i]) return;
      items[i].text = row.querySelector('input[type=text]').value;
      items[i].count = Math.max(1, Math.min(40, parseInt(row.querySelector('input[type=number]').value) || 10));
    });
  }
  function renderInputs() {
    mount(inWrap, ...items.map((it, i) => {
      const textInp = h('input', { class: css.input + ' flex-1 focus:ring-purple-500', type: 'text', value: it.text, placeholder: '예: 여러 체험활동에 적극적으로 참여하고 친구들과 협력하는 모습을 보임.' });
      textInp.addEventListener('input', () => { items[i].text = textInp.value; });
      const numInp = h('input', { class: css.input + ' w-16 text-right focus:ring-purple-500', type: 'number', min: '1', max: '40', value: String(it.count) });
      numInp.addEventListener('input', () => { items[i].count = Math.max(1, Math.min(40, parseInt(numInp.value) || 10)); });
      const row = h('div', { class: 'flex flex-col sm:flex-row sm:items-center gap-2 bg-gray-50 p-3 rounded border border-gray-200', 'data-row': '1' },
        textInp,
        h('div', { class: 'flex items-center gap-1 shrink-0' },
          h('span', { class: 'text-sm text-gray-500' }, '생성 개수'), numInp, h('span', { class: 'text-sm text-gray-400' }, '개')));
      if (items.length > 1) {
        const del = h('button', { class: 'text-red-500 hover:text-red-700 px-2 font-bold shrink-0' }, '×');
        del.addEventListener('click', () => { syncFromDOM(); items.splice(i, 1); renderInputs(); });
        row.append(del);
      }
      return row;
    }));
  }

  const addBtn = h('button', { class: 'text-sm bg-purple-100 text-purple-700 px-3 py-1 rounded hover:bg-purple-200 font-bold transition' }, '+ 문장 추가');
  addBtn.addEventListener('click', () => { syncFromDOM(); items.push({ text: '', count: 10 }); renderInputs(); });

  function show(results) {
    const valid = results.filter((r) => r.variations.length);
    if (!valid.length) { mount(out, notice('생성 결과가 없습니다. 원문을 확인하세요.', 'warn')); return; }
    mount(out, h('div', { class: 'space-y-6 animate-fade-in' },
      ...valid.map((r) => h('div', { class: 'bg-white shadow rounded-lg border border-gray-200 overflow-hidden' },
        h('div', { class: 'bg-purple-50 px-4 py-3 border-b border-purple-100' },
          h('h4', { class: 'font-bold text-purple-900 text-sm mb-1' }, '[원문]'),
          h('p', { class: 'text-gray-700 text-sm' }, r.original)),
        h('div', { class: 'p-2' },
          h('div', { class: 'px-2 py-1 text-xs text-gray-400 font-bold' }, `변형 ${r.variations.length}개 · 클릭하여 복사`),
          ...r.variations.map((v) => copyLine(v, { accent: 'purple' })))))));
  }

  const builtinBtn = h('button', { class: css.cta + ' bg-purple-600 hover:bg-purple-700' }, '내장 무료 생성');
  builtinBtn.addEventListener('click', () => {
    syncFromDOM();
    const valid = items.filter((it) => it.text.trim());
    if (!valid.length) { toast('원문을 입력하세요'); return; }
    show(valid.map((it) => ({ original: it.text.trim(), variations: vary(it.text.trim(), it.count) })));
  });

  const aiBtn = h('button', { class: 'px-5 py-3 rounded-lg font-bold border border-purple-200 text-purple-700 hover:bg-purple-50 transition whitespace-nowrap disabled:opacity-50' }, 'AI로 생성');
  aiBtn.addEventListener('click', async () => {
    const ai = getState().ai;
    if (!ai.apiKey || !ai.model) { toast('상단 카드에서 API 키와 모델을 선택하세요'); return; }
    syncFromDOM();
    const valid = items.filter((it) => it.text.trim());
    if (!valid.length) { toast('원문을 입력하세요'); return; }
    const restore = btnLoading(aiBtn, '생성 중…');
    try {
      const results = [];
      for (const it of valid) {
        const res = await generate(ai.provider, ai.apiKey, ai.model, buildChangchePrompt(it.text.trim(), it.count));
        const variations = res.split('\n').map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean).slice(0, it.count);
        results.push({ original: it.text.trim(), variations });
      }
      show(results);
    } catch (e) { mount(out, notice('AI 생성 실패: ' + (e?.message || e), 'warn')); }
    finally { restore(); }
  });

  renderInputs();
  mount(root,
    h('div', { class: css.card + ' animate-fade-in' },
      h('div', { class: 'flex items-start justify-between gap-2 mb-3' },
        h('div', {},
          h('h3', { class: 'font-bold text-lg text-gray-800' }, '창의적 체험활동 특기사항'),
          h('p', { class: 'text-xs text-gray-400 mt-0.5' }, '여러 문장을 넣고 문장마다 몇 개씩 변형할지 정할 수 있습니다. 결과를 클릭하면 복사됩니다.')),
        addBtn),
      inWrap,
      h('div', { class: 'flex flex-col sm:flex-row gap-2 mt-5' }, h('div', { class: 'flex-1' }, builtinBtn), aiBtn)),
    out,
  );
}
