import { h, mount, css } from './dom.js';
import { getState } from '../lib/store.js';
import { vary, buildPrompt } from '../lib/changcheEngine.js';
import { generate } from '../lib/providers.js';
import { copyLine, sectionTitle, notice } from './components.js';
import { toast } from '../lib/clipboard.js';

export function renderChangche(root) {
  const input = h('textarea', { class: css.input + ' w-full h-28 focus:ring-purple-500', placeholder: '창의적 체험활동 특기사항 원문을 한 문장 입력하세요.\n예: 여러 체험활동에 적극적으로 참여하고 친구들과 협력하는 모습을 보임.' });
  const countInput = h('input', { class: css.input + ' w-20 text-right focus:ring-purple-500', type: 'number', min: '1', max: '40', value: '10' });
  const out = h('div', { class: 'mt-6' });

  function show(list) {
    if (!list.length) { mount(out, notice('생성 결과가 없습니다. 원문을 확인하세요.', 'warn')); return; }
    mount(out, h('div', { class: css.card + ' animate-fade-in' },
      sectionTitle(list.length + '개 생성', '문장을 클릭하면 복사됩니다.'),
      h('div', { class: 'space-y-1' }, ...list.map((t, i) => copyLine(t, { prefix: (i + 1) + '.', accent: 'purple' })))
    ));
  }

  const builtinBtn = h('button', { class: css.cta + ' bg-purple-600 hover:bg-purple-700' }, '내장 무료 생성');
  builtinBtn.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) { toast('원문을 입력하세요'); return; }
    const n = Math.max(1, Math.min(40, parseInt(countInput.value) || 10));
    show(vary(text, n));
  });

  const aiBtn = h('button', { class: 'px-5 py-3 rounded-lg font-bold border border-purple-200 text-purple-700 hover:bg-purple-50 transition whitespace-nowrap disabled:opacity-50' }, 'AI로 생성');
  aiBtn.addEventListener('click', async () => {
    const ai = getState().ai;
    const text = input.value.trim();
    if (!text) { toast('원문을 입력하세요'); return; }
    if (!ai.apiKey || !ai.model) { toast('AI 설정에서 키와 모델을 먼저 선택하세요'); return; }
    const n = Math.max(1, Math.min(40, parseInt(countInput.value) || 10));
    aiBtn.textContent = '생성 중…'; aiBtn.disabled = true;
    try {
      const prompt = (typeof buildPrompt === 'function' ? buildPrompt(text, n)
        : `다음 창의적 체험활동 특기사항을 의미는 유지하되 표현이 다른 ${n}개의 한 문장으로 변형해줘. 각 문장은 명사형(~함)으로 끝내고 특수문자와 영어를 쓰지 마. 한 줄에 하나씩 번호 없이 출력해.\n원문: ${text}`);
      const res = await generate(ai.provider, ai.apiKey, ai.model, prompt);
      const list = res.split('\n').map((l) => l.replace(/^\s*\d+[.)]\s*/, '').trim()).filter(Boolean).slice(0, n);
      show(list);
    } catch (e) { mount(out, notice('AI 생성 실패: ' + (e?.message || e), 'warn')); }
    finally { aiBtn.textContent = 'AI로 생성'; aiBtn.disabled = false; }
  });

  mount(root,
    h('div', { class: css.card + ' animate-fade-in' },
      sectionTitle('창의적 체험활동 특기사항', '원문 한 문장을 여러 학생에게 조금씩 다르게 쓸 수 있도록 변형합니다.'),
      input,
      h('div', { class: 'flex items-center gap-2 mt-3' },
        h('span', { class: css.label }, '생성 개수'), countInput, h('span', { class: 'text-sm text-gray-500' }, '개'),
      ),
      h('div', { class: 'flex flex-col sm:flex-row gap-2 mt-5' },
        h('div', { class: 'flex-1' }, builtinBtn), aiBtn,
      ),
    ),
    out,
  );
}
