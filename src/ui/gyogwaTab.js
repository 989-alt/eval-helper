import { h, mount, css } from './dom.js';
import { getState, setState, update, uid } from '../lib/store.js';
import { LEVELS } from '../lib/levels.js';
import { generateBank, generatePerStudent } from '../lib/gyogwaEngine.js';
import { generate } from '../lib/providers.js';
import { downloadTemplate, parseWorkbook } from '../lib/excel.js';
import { downloadDoc, downloadText } from '../lib/exporters.js';
import { copyLine, sectionTitle, notice } from './components.js';
import { toast } from '../lib/clipboard.js';

let mode = 'A';
const GRID_LEVELS = ['', ...LEVELS, '미실시'];

export function renderGyogwa(root) {
  const toggle = h('div', { class: 'inline-flex rounded-lg border border-slate-200 overflow-hidden mb-4' },
    modeBtn('A', '모드 A · 수준별 예시 뱅크'),
    modeBtn('B', '모드 B · 학생별 전 과목 일괄'),
  );
  const body = h('div', {});
  mount(root, toggle, body);
  (mode === 'A' ? renderModeA : renderModeB)(body);

  function modeBtn(id, label) {
    const b = h('button', { class: css.btn + ' rounded-none ' + (mode === id ? css.btnPrimary : css.btnGhost) }, label);
    b.addEventListener('click', () => { mode = id; renderGyogwa(root); });
    return b;
  }
}

/* ---------------- 모드 A: 수준별 예시 뱅크 ---------------- */
function renderModeA(root) {
  const elInput = h('input', { class: css.input + ' w-full', placeholder: '평가요소 또는 핵심 키워드 (예: 비와 비율 / 토론하기)' });
  const counts = {};
  const countRow = h('div', { class: 'flex flex-wrap gap-3 mt-3' },
    ...LEVELS.map((lv) => {
      const inp = h('input', { class: css.input + ' w-16', type: 'number', min: '0', max: '40', value: '3' });
      counts[lv] = inp;
      return h('label', { class: 'flex items-center gap-1 text-sm' }, lv, inp);
    })
  );
  const out = h('div', { class: 'mt-4' });

  function showBank(bank) {
    const sections = LEVELS.filter((lv) => bank[lv]?.length).map((lv) =>
      h('div', { class: 'mb-3' },
        h('div', { class: 'font-semibold text-slate-700 mb-1' }, '[' + lv + ']'),
        ...bank[lv].map((t, i) => copyLine(t, { prefix: (i + 1) + '.' }))
      )
    );
    mount(out, h('div', { class: css.card }, sectionTitle('생성 결과', '클릭하여 복사'), ...(sections.length ? sections : [notice('생성된 평어가 없습니다.', 'warn')])));
  }

  const genBtn = h('button', { class: css.btn + ' ' + css.btnPrimary }, '내장 무료 생성');
  genBtn.addEventListener('click', () => {
    const name = elInput.value.trim();
    if (!name) { toast('평가요소를 입력하세요'); return; }
    const c = {}; LEVELS.forEach((lv) => c[lv] = Math.max(0, Math.min(40, parseInt(counts[lv].value) || 0)));
    showBank(generateBank(name, c));
  });

  const aiBtn = h('button', { class: css.btn + ' ' + css.btnGhost }, 'AI로 생성');
  aiBtn.addEventListener('click', async () => {
    const ai = getState().ai;
    const name = elInput.value.trim();
    if (!name) { toast('평가요소를 입력하세요'); return; }
    if (!ai.apiKey || !ai.model) { toast('AI 설정에서 키와 모델을 선택하세요'); return; }
    const c = {}; LEVELS.forEach((lv) => c[lv] = Math.max(0, Math.min(40, parseInt(counts[lv].value) || 0)));
    aiBtn.textContent = '생성 중…'; aiBtn.disabled = true;
    try { showBank(await aiBank(ai, name, c)); }
    catch (e) { mount(out, notice('AI 생성 실패: ' + (e?.message || e), 'warn')); }
    finally { aiBtn.textContent = 'AI로 생성'; aiBtn.disabled = false; }
  });

  mount(root,
    h('div', { class: css.card },
      sectionTitle('수준별 예시 뱅크', '평가요소 하나에 대해 성취수준별로 서로 다른 평어를 N개 만들어 골라 씁니다.'),
      elInput, countRow,
      h('div', { class: 'flex gap-2 mt-3' }, genBtn, aiBtn),
    ),
    out,
  );
}

async function aiBank(ai, name, counts) {
  const want = LEVELS.filter((lv) => counts[lv] > 0)
    .map((lv) => `${lv} ${counts[lv]}개`).join(', ');
  const prompt = `초등 교과 평어를 만들어줘. 평가요소는 "${name}". 성취수준별로 ${want} 생성.\n` +
    `규칙: 각 평어는 한 문장, 명사형 어미(~함, ~임)로 종결, 특수문자와 영어 금지(마침표 쉼표만), 기업이나 제품 이름 금지, 모두 서로 다르게. ` +
    `매우잘함은 정확하게/능숙하게 같은 강조 표현, 보통은 기본 개념 이해 수준, 노력요함은 긍정적 성장 표현으로.\n` +
    `출력 형식: 각 수준을 [매우잘함] 처럼 대괄호 머리로 표시하고 그 아래 한 줄에 하나씩.`;
  const res = await generate(ai.provider, ai.apiKey, ai.model, prompt);
  const bank = {}; LEVELS.forEach((lv) => bank[lv] = []);
  let cur = null;
  for (const raw of res.split('\n')) {
    const line = raw.trim();
    const m = line.match(/^\[?\s*(매우\s*잘함|잘함|보통|노력\s*요함)\s*\]?\s*:?$/);
    if (m) { cur = m[1].replace(/\s/g, ''); if (cur === '매우잘함') cur = '매우잘함'; continue; }
    const lvHead = line.match(/^\[?\s*(매우잘함|잘함|보통|노력요함)\s*\]?\s*[:.]?\s*(.+)$/);
    if (lvHead) { cur = lvHead[1]; const t = lvHead[2].replace(/^\d+[.)]\s*/, '').trim(); if (t) (bank[cur] ||= []).push(t); continue; }
    if (cur && line) (bank[cur] ||= []).push(line.replace(/^\d+[.)]\s*/, '').trim());
  }
  LEVELS.forEach((lv) => { bank[lv] = (bank[lv] || []).slice(0, counts[lv]); });
  return bank;
}

/* ---------------- 모드 B: 학생별 전 과목 일괄 ---------------- */
function renderModeB(root) {
  const s = getState();
  const ev = s.evalSet;

  // 학생 명단
  const namesArea = h('textarea', { class: css.input + ' w-full h-24', placeholder: '학생 이름(또는 번호)을 한 줄에 하나씩' },
    ev.students.map((st) => st.name).join('\n'));
  const applyNames = h('button', { class: css.btn + ' ' + css.btnGhost }, '명단 적용');
  applyNames.addEventListener('click', () => {
    const names = namesArea.value.split('\n').map((x) => x.trim()).filter(Boolean);
    const students = names.map((name, i) => ({ id: ev.students[i]?.id || uid('s'), name }));
    const keep = new Set(students.map((x) => x.id));
    const scores = {}; for (const id of Object.keys(ev.scores)) if (keep.has(id)) scores[id] = ev.scores[id];
    setState((st0) => ({ ...st0, evalSet: { ...st0.evalSet, students, scores } }));
    renderGyogwaRoot();
  });

  // 과목/평가요소 편집
  const subjWrap = h('div', { class: 'grid gap-2 mt-2' });
  function renderSubjects() {
    mount(subjWrap, ...ev.subjects.map((sub) => subjectRow(sub)));
  }
  function subjectRow(sub) {
    const nameInp = h('input', { class: css.input + ' font-semibold', value: sub.name, placeholder: '과목명' });
    nameInp.addEventListener('change', () => { sub.name = nameInp.value.trim(); commit(); });
    const elsWrap = h('div', { class: 'flex flex-wrap gap-1.5 mt-1' });
    sub.elements.forEach((elx) => {
      const chip = h('span', { class: 'inline-flex items-center gap-1 bg-slate-100 rounded px-2 py-0.5 text-sm' },
        elx.name,
        h('button', { class: 'text-slate-400 hover:text-rose-500', onClick: () => { sub.elements = sub.elements.filter((e) => e !== elx); commit(); renderGyogwaRoot(); } }, '×'));
      elsWrap.append(chip);
    });
    const addEl = h('input', { class: css.input + ' w-40', placeholder: '평가요소 추가 후 Enter' });
    addEl.addEventListener('keydown', (e) => { if (e.key === 'Enter' && addEl.value.trim()) { sub.elements.push({ id: uid('e'), name: addEl.value.trim() }); commit(); renderGyogwaRoot(); } });
    return h('div', { class: 'border border-slate-200 rounded-lg p-3' },
      h('div', { class: 'flex items-center gap-2' }, nameInp,
        h('button', { class: css.btn + ' ' + css.btnDanger + ' ml-auto', onClick: () => { ev.subjects = ev.subjects.filter((x) => x !== sub); commit(); renderGyogwaRoot(); } }, '과목 삭제')),
      elsWrap, addEl);
  }
  const addSubjBtn = h('button', { class: css.btn + ' ' + css.btnGhost }, '+ 과목 추가');
  addSubjBtn.addEventListener('click', () => { ev.subjects.push({ id: uid('subj'), name: '', elements: [] }); commit(); renderGyogwaRoot(); });

  // 점수 그리드 (과목별)
  const gridWrap = h('div', { class: 'mt-4 grid gap-4' });
  function renderGrids() {
    mount(gridWrap, ...ev.subjects.filter((sub) => sub.elements.length && ev.students.length).map((sub) => subjectGrid(sub)));
  }
  function subjectGrid(sub) {
    const head = h('tr', {}, h('th', { class: 'text-left p-1 text-xs text-slate-500' }, '학생'),
      ...sub.elements.map((e) => h('th', { class: 'p-1 text-xs text-slate-500' }, e.name)));
    const rows = ev.students.map((stu) => h('tr', { class: 'border-t border-slate-100' },
      h('td', { class: 'p-1 text-sm whitespace-nowrap' }, stu.name),
      ...sub.elements.map((e) => {
        const cur = ev.scores[stu.id]?.[e.id] || '';
        const sel = h('select', { class: css.input + ' py-0.5' },
          ...GRID_LEVELS.map((lv) => h('option', { value: lv, selected: lv === cur }, lv || '—')));
        sel.addEventListener('change', () => {
          (ev.scores[stu.id] ||= {})[e.id] = sel.value;
          commit();
        });
        return h('td', { class: 'p-1' }, sel);
      })));
    return h('div', { class: 'border border-slate-200 rounded-lg p-2 overflow-auto' },
      h('div', { class: 'font-semibold text-sm mb-1' }, sub.name || '(과목명 없음)'),
      h('table', { class: 'text-sm' }, head, ...rows));
  }

  // 엑셀
  const tplBtn = h('button', { class: css.btn + ' ' + css.btnGhost }, '엑셀 양식 받기');
  tplBtn.addEventListener('click', () => {
    if (!ev.subjects.some((x) => x.elements.length) || !ev.students.length) { toast('과목·평가요소·학생을 먼저 입력하세요'); return; }
    try { downloadTemplate(ev); } catch (e) { toast('엑셀 생성 실패: ' + (e?.message || e)); }
  });
  const upload = h('input', { type: 'file', accept: '.xlsx,.xls', class: 'hidden' });
  const upBtn = h('button', { class: css.btn + ' ' + css.btnGhost }, '엑셀 업로드');
  upBtn.addEventListener('click', () => upload.click());
  upload.addEventListener('change', async () => {
    const f = upload.files[0]; if (!f) return;
    try {
      const buf = await f.arrayBuffer();
      const parsed = parseWorkbook(buf);
      setState((st0) => ({ ...st0, evalSet: parsed }));
      toast('엑셀을 불러왔습니다'); renderGyogwaRoot();
    } catch (e) { toast('엑셀 읽기 실패: ' + (e?.message || e)); }
  });

  // 생성
  const out = h('div', { class: 'mt-4' });
  const genBtn = h('button', { class: css.btn + ' ' + css.btnPrimary }, '내장 무료 · 전 과목 평어 생성');
  genBtn.addEventListener('click', () => { try { showResults(generatePerStudent(getState().evalSet)); } catch (e) { mount(out, notice('생성 실패: ' + (e?.message || e), 'warn')); } });

  function showResults(rows) {
    if (!rows.length) { mount(out, notice('생성할 점수가 없습니다. 수준을 입력했는지 확인하세요.', 'warn')); return; }
    const byStudent = new Map();
    rows.forEach((r) => {
      if (!byStudent.has(r.studentName)) byStudent.set(r.studentName, []);
      byStudent.get(r.studentName).push(r);
    });
    const sections = [...byStudent.entries()].map(([name, items]) =>
      h('div', { class: 'mb-3' }, h('div', { class: 'font-semibold text-slate-700 mb-1' }, name),
        ...items.map((r) => copyLine(r.text, { prefix: r.subjectName }))));
    mount(out, h('div', { class: css.card },
      h('div', { class: 'flex items-center justify-between mb-2' },
        sectionTitle(rows.length + '개 평어 (학생별)', '클릭하여 복사'),
        h('div', { class: 'flex gap-2' },
          h('button', { class: css.btn + ' ' + css.btnGhost, onClick: () => exportDoc(byStudent) }, '한글(.doc) 내보내기'),
          h('button', { class: css.btn + ' ' + css.btnGhost, onClick: () => downloadText(rows.map((r) => `${r.studentName}\t${r.subjectName}\t${r.text}`).join('\n'), '평어.txt') }, '텍스트'),
        )),
      ...sections));
  }
  function exportDoc(byStudent) {
    const sections = [...byStudent.entries()].map(([name, items]) => ({ heading: name, lines: items.map((r) => ({ label: r.subjectName, text: r.text })) }));
    downloadDoc('교과 평어', sections, '교과평어.doc');
  }

  function commit() { setState((st0) => ({ ...st0, evalSet: ev })); }
  function renderGyogwaRoot() { renderModeB(root); }

  renderSubjects(); renderGrids();
  mount(root,
    h('div', { class: css.card },
      sectionTitle('① 학생 명단'), namesArea,
      h('div', { class: 'mt-2' }, applyNames)),
    h('div', { class: css.card + ' mt-4' },
      sectionTitle('② 과목 · 평가요소'), subjWrap, h('div', { class: 'mt-2' }, addSubjBtn),
      h('div', { class: 'flex gap-2 mt-3 pt-3 border-t border-slate-100' }, tplBtn, upBtn, upload),
      notice('엑셀 양식을 받아 성취수준을 채운 뒤 업로드하거나, 아래 표에서 직접 드롭다운으로 입력하세요.')),
    h('div', { class: css.card + ' mt-4' }, sectionTitle('③ 성취수준 입력'), gridWrap),
    h('div', { class: 'mt-4' }, genBtn),
    out,
  );
}
