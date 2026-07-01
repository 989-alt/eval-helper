import { h, mount, css } from './dom.js';
import { getState, setState } from '../lib/store.js';
import { PROVIDERS, listModels, labelFor } from '../lib/providers.js';
import { toast } from '../lib/clipboard.js';

// 상단 상시 노출 카드 (레퍼런스의 API/모델 바) — 어느 탭에서도 키·모델을 바로 조작.
export function renderAI(root) {
  const ai = getState().ai;

  function persist(patch) { setState((st) => ({ ...st, ai: { ...st.ai, ...patch } })); }

  const providerSel = h('select', { class: css.input + ' w-full' },
    ...PROVIDERS.map((p) => h('option', { value: p.id, selected: p.id === ai.provider }, p.label)));
  const keyInput = h('input', {
    class: css.input + ' w-full', type: 'password', value: ai.apiKey,
    placeholder: 'API 키 붙여넣기 (브라우저에만 저장)',
  });
  const loadBtn = h('button', { class: css.btn + ' ' + css.btnGhost + ' shrink-0 whitespace-nowrap h-[38px]' }, '🔍 모델 조회');
  const modelSel = h('select', { class: css.input + ' w-full' });

  function renderModelOptions() {
    const models = getState().ai.models || [];
    const cur = getState().ai.model;
    if (!models.length) {
      modelSel.disabled = true;
      mount(modelSel, h('option', { value: '' }, '키 입력 후 모델 조회'));
      return;
    }
    modelSel.disabled = false;
    mount(modelSel, ...models.map((m) => h('option', { value: m.id, selected: m.id === cur }, labelFor(m.id))));
  }

  providerSel.addEventListener('change', () => { persist({ provider: providerSel.value, models: [], model: '' }); renderModelOptions(); });
  keyInput.addEventListener('change', () => persist({ apiKey: keyInput.value.trim() }));
  modelSel.addEventListener('change', () => persist({ model: modelSel.value }));

  loadBtn.addEventListener('click', async () => {
    const key = keyInput.value.trim();
    if (!key) { toast('API 키를 먼저 입력하세요'); return; }
    persist({ apiKey: key });
    loadBtn.textContent = '불러오는 중…'; loadBtn.disabled = true;
    try {
      const models = await listModels(providerSel.value, key);
      persist({ models, model: getState().ai.model || (models[0] && models[0].id) || '' });
      renderModelOptions();
      toast(models.length + '개 모델 불러옴');
    } catch (e) {
      toast('모델 조회 실패: ' + (e?.message || e));
    } finally { loadBtn.textContent = '🔍 모델 조회'; loadBtn.disabled = false; }
  });

  mount(root,
    h('div', { class: css.card },
      h('div', { class: 'flex flex-col md:flex-row md:items-end gap-3' },
        h('div', { class: 'md:w-44' }, h('div', { class: css.label + ' mb-1' }, '제공자'), providerSel),
        h('div', { class: 'flex-1' }, h('div', { class: css.label + ' mb-1' }, 'API Key 입력 (선택)'), keyInput),
        h('div', { class: 'shrink-0' }, loadBtn),
        h('div', { class: 'md:w-72' }, h('div', { class: css.label + ' mb-1' }, 'AI 모델 선택'), modelSel),
      ),
      h('p', { class: 'text-xs text-gray-400 mt-2' },
        '키 없이도 교과·창체는 내장 무료 엔진으로 생성됩니다. 키를 넣으면 AI 생성과 행동발달을 쓸 수 있어요. (OpenAI는 브라우저 직접 호출이 막힐 수 있어 Google·Anthropic 권장)'),
    )
  );
  renderModelOptions();
}
