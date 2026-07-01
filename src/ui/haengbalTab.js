import { h, mount, css } from './dom.js';
import { getState } from '../lib/store.js';
import { generate } from '../lib/providers.js';
import { copyLine, sectionTitle, notice } from './components.js';
import { toast } from '../lib/clipboard.js';

// 레퍼런스(evaluationapp)와 동일한 특성 분류
const BEHAVIOR_CATEGORIES = {
  '학습': ['학습(우수)', '학습(발전가능)', '학습(제안)'],
  '성격·인성': ['끈기', '예의', '배려', '독서', '교우관계', '규칙준수', '소신', '봉사', '갈등관리', '책임감', '발표', '협력', '유머'],
  '예체능': ['음악', '미술', '체육'],
};

const BOX_BASE = 'trait-box cursor-pointer text-sm px-2 py-2 rounded border border-gray-200 text-center select-none';
function boxClass(state) {
  if (state === 1) return BOX_BASE + ' state-1';
  if (state === 2) return BOX_BASE + ' state-2';
  return BOX_BASE + ' text-gray-600 hover:bg-gray-50';
}

// 공백 포함 바이트 계산 (한글 3, 그 외 1) — 레퍼런스와 동일
function calcBytes(str) {
  let b = 0;
  for (let i = 0; i < str.length; i++) b += str.charCodeAt(i) > 127 ? 3 : 1;
  return b;
}

export function renderHaengbal(root) {
  // 학생 상태: [{ id, name, checks: Map<trait, 1|2> }]
  let students = [{ id: 1, name: '', checks: new Map() }];
  const studentsWrap = h('div', { class: 'space-y-4' });
  const out = h('div', { class: 'mt-6' });

  function syncNamesFromDOM() {
    const inputs = studentsWrap.querySelectorAll('input[data-name]');
    inputs.forEach((inp) => {
      const idx = parseInt(inp.dataset.name);
      if (students[idx]) students[idx].name = inp.value;
    });
  }

  const studentCountInp = h('input', {
    class: css.input + ' w-24', type: 'number', min: '1', max: '50', value: '1',
  });
  studentCountInp.addEventListener('change', () => {
    syncNamesFromDOM();
    const count = Math.max(1, Math.min(50, parseInt(studentCountInp.value) || 1));
    studentCountInp.value = String(count);
    if (count > students.length) {
      for (let i = students.length; i < count; i++) students.push({ id: i + 1, name: '', checks: new Map() });
    } else {
      students = students.slice(0, count);
    }
    renderStudents();
  });

  const targetBytesInp = h('input', {
    class: css.input + ' w-28', type: 'number', min: '100', max: '2000', step: '100', value: '700',
  });

  // 학생 카드 하나 렌더 (특성 클릭은 in-place로 박스 색·카운트만 갱신)
  function studentCard(student, sIdx) {
    const countSpan = h('span', {}, `선택됨: ${student.checks.size}개`);

    function column(catLabel, traits, colClass) {
      return h('div', { class: colClass },
        h('h4', { class: 'font-bold text-sm text-gray-800 mb-2 border-b pb-1' }, catLabel),
        h('div', { class: 'flex flex-wrap gap-2' },
          ...traits.map((trait) => {
            const box = h('div', { class: boxClass(student.checks.get(trait) || 0) }, trait.replace('학습(', '').replace(')', ''));
            box.addEventListener('click', () => {
              const cur = student.checks.get(trait) || 0;
              const next = (cur + 1) % 3;      // 0 → 1(긍정) → 2(지도필요) → 0
              if (next === 0) student.checks.delete(trait);
              else student.checks.set(trait, next);
              box.className = boxClass(next);
              countSpan.textContent = `선택됨: ${student.checks.size}개`;
            });
            return box;
          }),
        ),
      );
    }

    const nameInp = h('input', {
      class: 'p-1 px-2 border border-gray-300 rounded text-sm w-32 focus:border-green-500 outline-none',
      placeholder: '학생 이름', value: student.name,
    });
    nameInp.dataset.name = String(sIdx);
    nameInp.addEventListener('input', () => { student.name = nameInp.value; });

    return h('div', { class: 'bg-white shadow-sm border border-gray-200 rounded-lg overflow-hidden' },
      h('div', { class: 'bg-gray-50 px-4 py-3 border-b border-gray-200 flex flex-wrap items-center gap-3' },
        h('span', { class: 'font-bold text-green-900' }, 'No.' + student.id),
        nameInp,
        h('div', { class: 'flex-1 text-right text-xs text-green-700 font-medium' }, countSpan),
      ),
      h('div', { class: 'p-4 grid grid-cols-1 md:grid-cols-12 gap-4' },
        column('📚 학습', BEHAVIOR_CATEGORIES['학습'], 'md:col-span-3'),
        column('😊 성격·인성', BEHAVIOR_CATEGORIES['성격·인성'], 'md:col-span-7'),
        column('🎨 예체능', BEHAVIOR_CATEGORIES['예체능'], 'md:col-span-2'),
      ),
    );
  }

  function renderStudents() {
    mount(studentsWrap, ...students.map((s, i) => studentCard(s, i)));
  }

  function resultCard(name, text) {
    return h('div', { class: 'bg-white shadow rounded-lg border border-gray-200 overflow-hidden' },
      h('div', { class: 'bg-green-50 px-4 py-3 border-b border-green-100 flex justify-between items-center' },
        h('span', { class: 'font-bold text-green-900' }, name),
        h('span', { class: 'text-xs font-normal text-green-700' }, '약 ' + calcBytes(text) + ' Bytes · 클릭하여 복사'),
      ),
      h('div', { class: 'p-2' }, copyLine(text, { accent: 'green' })),
    );
  }

  const genBtn = h('button', { class: css.cta + ' bg-green-600 hover:bg-green-700' }, 'AI로 행동발달 생성');
  genBtn.addEventListener('click', async () => {
    const ai = getState().ai;
    if (!ai.apiKey || !ai.model) {
      mount(out, notice('행동발달은 AI 생성이 필요합니다. AI 설정에서 키와 모델을 선택하세요.', 'warn'));
      return;
    }
    syncNamesFromDOM();
    const targets = students.filter((s) => [...s.checks.values()].some((v) => v > 0));
    if (!targets.length) { toast('학생마다 특성을 한 개 이상 선택하세요'); return; }

    const tb = Math.max(100, Math.min(2000, parseInt(targetBytesInp.value) || 700));
    const minChars = Math.floor((tb - 50) / 3);
    const maxChars = Math.floor((tb + 100) / 3);

    const resultsWrap = h('div', { class: 'grid gap-4' });
    mount(out, h('div', { class: css.card + ' animate-fade-in' },
      h('div', { class: 'flex items-center justify-between mb-4' },
        h('h3', { class: 'font-bold text-lg text-gray-800' }, '행동발달 결과'),
        h('p', { class: 'text-xs text-gray-400' }, '문장을 클릭하면 복사됩니다.'),
      ),
      resultsWrap,
    ));

    genBtn.disabled = true;
    let done = 0;
    for (const s of targets) {
      done++;
      genBtn.textContent = `생성 중… (${done}/${targets.length})`;
      const name = s.name || ('학생' + s.id);
      const traits = [...s.checks.entries()]
        .map(([t, st]) => `${t}(${st === 1 ? '긍정' : '지도필요'})`).join(', ');
      const prompt =
        `당신은 담임 교사입니다. 아래 학생 특성을 바탕으로 학교생활기록부 행동특성 및 종합의견을 작성하세요.\n` +
        `학생: ${name}\n특성: ${traits}\n` +
        `규칙:\n1. 분량: 공백 포함 약 ${minChars}~${maxChars}자.\n` +
        `2. 어미: "~함.", "~임." 명사형으로 끝내고 주어는 생략.\n` +
        `3. 특수문자(마침표·쉼표 제외)와 영어 사용 금지.\n` +
        `4. 긍정 특성은 강점으로, 지도필요 특성은 성장 방향으로 자연스럽게 서술.\n` +
        `한 단락으로만 출력하세요.`;
      try {
        const res = await generate(ai.provider, ai.apiKey, ai.model, prompt);
        resultsWrap.append(resultCard(name, res.trim()));
      } catch (e) {
        resultsWrap.append(notice(`${name} 생성 실패: ${e?.message || e}`, 'warn'));
      }
    }
    genBtn.textContent = 'AI로 행동발달 생성';
    genBtn.disabled = false;
  });

  renderStudents();
  mount(root,
    h('div', { class: css.card + ' animate-fade-in' },
      sectionTitle('행동발달 (행동특성 및 종합의견)', '학생 수를 정하고, 학생마다 특성을 눌러 선택하세요. 한 번 누르면 파랑(긍정), 다시 누르면 주황(지도필요), 한 번 더 누르면 해제됩니다.'),
      h('div', { class: 'flex flex-wrap items-end justify-between gap-4 mb-2' },
        h('div', { class: 'flex flex-wrap gap-3' },
          h('label', { class: 'flex flex-col gap-1' }, h('span', { class: css.label }, '학생 수'), studentCountInp),
          h('label', { class: 'flex flex-col gap-1' }, h('span', { class: css.label }, '목표 바이트'), targetBytesInp),
        ),
        h('div', { class: 'text-xs text-gray-500 leading-relaxed' },
          h('p', {}, '· ', h('span', { class: 'text-blue-600 font-bold' }, '파랑'), ' = 긍정'),
          h('p', {}, '· ', h('span', { class: 'text-orange-600 font-bold' }, '주황'), ' = 지도필요'),
        ),
      ),
    ),
    h('div', { class: 'mt-4' }, studentsWrap),
    h('div', { class: 'mt-4' }, genBtn),
    out,
  );
}
