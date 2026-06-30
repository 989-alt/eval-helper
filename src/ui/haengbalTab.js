import { h, mount, css } from './dom.js';
import { getState } from '../lib/store.js';
import { generate } from '../lib/providers.js';
import { copyLine, sectionTitle, notice } from './components.js';
import { toast } from '../lib/clipboard.js';

const TRAITS = {
  '학습': ['수업에 적극 참여', '과제를 성실히 수행', '탐구심이 강함', '발표를 잘함', '자기주도 학습', '이해가 빠름'],
  '인성·태도': ['배려심이 깊음', '책임감이 강함', '예의 바름', '약속을 잘 지킴', '긍정적', '리더십이 있음', '친구를 잘 도움'],
  '예체능·기타': ['그림에 소질', '음악적 감각', '운동을 좋아함', '손재주가 좋음', '창의적 표현'],
};

export function renderHaengbal(root) {
  const selected = new Set();
  const lenInput = h('input', { class: css.input + ' w-24', type: 'number', min: '80', max: '600', value: '200' });
  const out = h('div', { class: 'mt-4' });

  const chips = Object.entries(TRAITS).map(([cat, items]) =>
    h('div', { class: 'mb-2' },
      h('div', { class: css.label + ' mb-1' }, cat),
      h('div', { class: 'flex flex-wrap gap-1.5' },
        ...items.map((t) => {
          const b = h('button', { class: css.btn + ' ' + css.btnGhost + ' text-xs' }, t);
          b.addEventListener('click', () => {
            if (selected.has(t)) { selected.delete(t); b.className = css.btn + ' ' + css.btnGhost + ' text-xs'; }
            else { selected.add(t); b.className = css.btn + ' text-xs bg-indigo-600 text-white'; }
          });
          return b;
        })
      )
    )
  );

  const genBtn = h('button', { class: css.btn + ' ' + css.btnPrimary }, 'AI로 행동발달 생성');
  genBtn.addEventListener('click', async () => {
    const ai = getState().ai;
    if (!ai.apiKey || !ai.model) { mount(out, notice('행동발달은 AI 생성을 권장합니다. AI 설정에서 키와 모델을 선택하세요.', 'warn')); return; }
    if (!selected.size) { toast('특성을 한 개 이상 선택하세요'); return; }
    const len = Math.max(80, Math.min(600, parseInt(lenInput.value) || 200));
    const prompt = `다음 학생 특성을 바탕으로 학교생활기록부 행동특성 및 종합의견을 작성해줘. ` +
      `약 ${len}자 분량, 학생을 긍정적으로 서술하고 명사형 어미(~함, ~임)로 끝내며, 특수문자와 영어를 쓰지 마. ` +
      `특성: ${[...selected].join(', ')}. 한 단락으로 출력해.`;
    genBtn.textContent = '생성 중…'; genBtn.disabled = true;
    try {
      const res = await generate(ai.provider, ai.apiKey, ai.model, prompt);
      mount(out, h('div', { class: css.card }, sectionTitle('생성 결과'), copyLine(res.trim())));
    } catch (e) { mount(out, notice('AI 생성 실패: ' + (e?.message || e), 'warn')); }
    finally { genBtn.textContent = 'AI로 행동발달 생성'; genBtn.disabled = false; }
  });

  mount(root,
    h('div', { class: css.card },
      sectionTitle('행동발달 (행동특성 및 종합의견)', '특성을 선택해 문장을 생성합니다. 정확하고 자연스러운 서술을 위해 AI 사용을 권장합니다.'),
      ...chips,
      h('div', { class: 'flex items-center gap-2 mt-2' },
        h('span', { class: css.label }, '분량(자)'), lenInput, genBtn),
    ),
    out,
  );
}
