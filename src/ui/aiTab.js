import { h, mount, css } from './dom.js';
import { getState, setState } from '../lib/store.js';
import { PROVIDERS, listModels, tierFor } from '../lib/providers.js';
import { tierBadge, sectionTitle, notice } from './components.js';
import { toast } from '../lib/clipboard.js';

export function renderAI(root) {
  const s = getState();
  const ai = s.ai;

  const providerSel = h('select', { class: css.input },
    ...PROVIDERS.map((p) => h('option', { value: p.id, selected: p.id === ai.provider }, p.label))
  );
  const keyInput = h('input', { class: css.input + ' w-full', type: 'password', value: ai.apiKey, placeholder: 'API 키 붙여넣기 (브라우저에만 저장)' });
  const modelWrap = h('div', { class: 'mt-3' });
  const loadBtn = h('button', { class: css.btn + ' ' + css.btnPrimary }, '실시간 모델 불러오기');

  function persist(patch) { setState((st) => ({ ...st, ai: { ...st.ai, ...patch } })); }

  providerSel.addEventListener('change', () => persist({ provider: providerSel.value, models: [], model: '' }));
  keyInput.addEventListener('change', () => persist({ apiKey: keyInput.value.trim() }));

  function renderModels(models) {
    if (!models?.length) { mount(modelWrap, notice('키를 넣고 모델을 불러오면 실제 사용 가능한 모델만 표시됩니다.')); return; }
    mount(modelWrap,
      sectionTitle('모델 선택', '비용 티어는 모델명 기준 자동 추천입니다.'),
      h('div', { class: 'flex flex-col gap-1 max-h-80 overflow-auto' },
        ...models.map((m) => {
          const id = m.id;
          const sel = id === getState().ai.model;
          const row = h('label', {
            class: 'flex items-center gap-2 px-3 py-2 rounded-md cursor-pointer border ' + (sel ? 'border-blue-400 bg-blue-50' : 'border-gray-200 hover:bg-gray-50'),
          },
            h('input', { type: 'radio', name: 'model', checked: sel }),
            h('span', { class: 'text-sm font-mono flex-1' }, id),
            tierBadge(m.tier || tierFor(id)),
          );
          row.querySelector('input').addEventListener('change', () => { persist({ model: id }); renderModels(getState().ai.models); });
          return row;
        })
      )
    );
  }

  loadBtn.addEventListener('click', async () => {
    const key = keyInput.value.trim();
    if (!key) { toast('API 키를 먼저 입력하세요'); return; }
    persist({ apiKey: key });
    loadBtn.textContent = '불러오는 중…'; loadBtn.disabled = true;
    try {
      const models = await listModels(providerSel.value, key);
      persist({ models, model: getState().ai.model || (models[0] && models[0].id) || '' });
      renderModels(models);
      toast(models.length + '개 모델 불러옴');
    } catch (e) {
      mount(modelWrap, notice('모델 조회 실패: ' + (e?.message || e), 'warn'));
    } finally { loadBtn.textContent = '실시간 모델 불러오기'; loadBtn.disabled = false; }
  });

  mount(root,
    h('div', { class: css.card + ' max-w-2xl' },
      sectionTitle('AI 설정 (선택)', '키를 넣지 않아도 내장 무료 엔진으로 교과·창체 평어를 만들 수 있습니다. 키를 넣으면 더 자연스러운 AI 생성과 행동발달 생성을 쓸 수 있습니다.'),
      h('div', { class: 'grid gap-3 mt-2' },
        h('div', {}, h('div', { class: css.label }, '제공자'), providerSel),
        h('div', {}, h('div', { class: css.label }, 'API 키'), keyInput),
        h('div', {}, loadBtn),
      ),
      modelWrap,
      h('p', { class: 'text-xs text-gray-400 mt-3' }, 'OpenAI는 브라우저에서 직접 호출이 제한될 수 있습니다. 이 경우 Google 또는 Anthropic 키 사용을 권장합니다.'),
    )
  );
  renderModels(ai.models);
}
