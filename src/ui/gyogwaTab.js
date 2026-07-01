import { h, mount, css } from './dom.js';
import { getState } from '../lib/store.js';
import { LEVELS } from '../lib/levels.js';
import { generateBank, generatePerStudent } from '../lib/gyogwaEngine.js';
import { generate } from '../lib/providers.js';
import { downloadTemplate, parseWorkbook, buildSkeletonEvalSet } from '../lib/excel.js';
import { downloadDoc, downloadText } from '../lib/exporters.js';
import { copyLine, sectionTitle, notice, levelCard, LEVEL_COLORS, btnLoading } from './components.js';
import { buildGyogwaPrompt } from '../lib/pyeoeoRules.js';
import { toast } from '../lib/clipboard.js';

export function renderGyogwa(root) {
  /* ── 성취기준(다중 입력) ─────────────────────────────────────────────── */
  let standards = [''];
  const bankOut = h('div', { class: 'mt-6' });
  const stdWrap = h('div', { class: 'grid gap-2' });

  function syncStandardsFromDOM() {
    stdWrap.querySelectorAll('input').forEach((inp, i) => { if (i < standards.length) standards[i] = inp.value; });
  }
  function renderStandards() {
    mount(stdWrap, ...standards.map((val, i) => {
      const inp = h('input', { class: css.input + ' flex-1', placeholder: '예: 비와 비율 / 토론에서 근거 들어 주장하기', value: val });
      inp.addEventListener('input', () => { standards[i] = inp.value; });
      const row = h('div', { class: 'flex items-center gap-2' }, inp);
      if (standards.length > 1) {
        const del = h('button', { class: 'text-red-500 hover:text-red-700 px-2 font-bold' }, '×');
        del.addEventListener('click', () => { syncStandardsFromDOM(); standards.splice(i, 1); renderStandards(); });
        row.append(del);
      }
      return row;
    }));
  }
  const addStdBtn = h('button', { class: 'text-sm bg-blue-100 text-blue-700 px-3 py-1 rounded hover:bg-blue-200 font-bold transition' }, '+ 추가');
  addStdBtn.addEventListener('click', () => { syncStandardsFromDOM(); standards.push(''); renderStandards(); });

  /* ── 생성 설정(수준별 개수) ─ 오른쪽 카드, 세로 배치 ──────────────────── */
  const countInputs = {};
  const countRow = h('div', { class: 'space-y-2' },
    ...LEVELS.map((lv) => {
      const inp = h('input', { class: css.input + ' w-16 text-right', type: 'number', min: '0', max: '40', value: '3' });
      countInputs[lv] = inp;
      const color = (LEVEL_COLORS[lv] || {}).text || 'text-gray-600';
      return h('label', { class: 'flex items-center justify-between gap-2' },
        h('span', { class: 'font-bold text-sm ' + color }, lv),
        h('div', { class: 'flex items-center gap-1' }, inp, h('span', { class: 'text-xs text-gray-400' }, '개')));
    }));
  function readCounts() {
    const c = {}; LEVELS.forEach((lv) => { c[lv] = Math.max(0, Math.min(40, parseInt(countInputs[lv].value) || 0)); });
    return c;
  }
  function readStandards() { syncStandardsFromDOM(); return standards.map((s) => s.trim()).filter(Boolean); }

  function showBanks(results) {
    if (!results.length) { mount(bankOut, h('div', { class: css.card }, notice('생성된 평어가 없습니다.', 'warn'))); return; }
    let activeTab = 0;
    const panelDiv = h('div', { class: 'p-4' });
    function renderPanel() {
      const r = results[activeTab];
      const cards = LEVELS.filter((lv) => r.bank[lv]?.length).map((lv) => levelCard(lv, r.bank[lv]));
      mount(panelDiv,
        h('div', { class: 'bg-blue-50 p-3 rounded border border-blue-100 mb-4 text-sm text-blue-900 font-medium' }, r.standard),
        cards.length ? h('div', { class: 'grid grid-cols-1 md:grid-cols-2 gap-4' }, ...cards) : notice('생성된 평어가 없습니다.', 'warn'));
    }
    const tabBar = h('div', { class: 'bg-gray-50 border-b flex overflow-x-auto' });
    function renderTabBar() {
      mount(tabBar, ...results.map((r, i) => {
        const btn = h('button', { class: i === activeTab
          ? 'px-5 py-3 text-sm font-bold whitespace-nowrap bg-white border-t-2 border-blue-600 text-blue-700'
          : 'px-5 py-3 text-sm font-bold whitespace-nowrap text-gray-500 hover:bg-gray-100' }, '성취기준 ' + (i + 1));
        btn.addEventListener('click', () => { activeTab = i; renderTabBar(); renderPanel(); });
        return btn;
      }));
    }
    renderTabBar(); renderPanel();
    mount(bankOut, h('div', { class: css.card + ' animate-fade-in overflow-hidden' }, tabBar, panelDiv));
  }

  /* ── 엑셀 양식(성취기준 카드 헤더에서 토글로 열기) ───────────────────── */
  const xlsOut = h('div', { class: 'mt-6' });
  let critCounts = [3];
  const critWrap = h('div', { class: 'flex flex-wrap gap-3' });
  function syncCritFromDOM() {
    critWrap.querySelectorAll('input').forEach((inp, i) => { if (i < critCounts.length) critCounts[i] = Math.max(1, parseInt(inp.value) || 1); });
  }
  function renderCrit() {
    mount(critWrap, ...critCounts.map((val, i) => {
      const inp = h('input', { class: css.input + ' w-20 text-right', type: 'number', min: '1', max: '20', value: String(val) });
      inp.addEventListener('input', () => { critCounts[i] = Math.max(1, parseInt(inp.value) || 1); });
      return h('label', { class: 'flex flex-col gap-1' }, h('span', { class: css.label }, '과목' + (i + 1) + ' 기준 수'), inp);
    }));
  }
  const numStudentsInp = h('input', { class: css.input + ' w-24', type: 'number', min: '1', max: '50', value: '25' });
  const numSubjectsInp = h('input', { class: css.input + ' w-24', type: 'number', min: '1', max: '20', value: '1' });
  numSubjectsInp.addEventListener('change', () => {
    syncCritFromDOM();
    const M = Math.max(1, Math.min(20, parseInt(numSubjectsInp.value) || 1));
    const prev = critCounts.slice();
    critCounts = Array.from({ length: M }, (_, i) => prev[i] !== undefined ? prev[i] : 3);
    renderCrit();
  });
  const tplBtn = h('button', { class: 'text-sm bg-teal-600 text-white px-4 py-2 rounded hover:bg-teal-700 font-bold shadow transition' }, '엑셀 양식 다운로드');
  tplBtn.addEventListener('click', () => {
    syncCritFromDOM();
    const N = Math.max(1, Math.min(50, parseInt(numStudentsInp.value) || 1));
    try { downloadTemplate(buildSkeletonEvalSet(N, critCounts), '교과평어_양식.xlsx'); }
    catch (e) { toast('엑셀 생성 실패: ' + (e?.message || e)); }
  });
  const fileInput = h('input', { type: 'file', accept: '.xlsx,.xls', class: 'hidden' });
  const upBtn = h('button', { class: 'text-sm bg-white text-teal-700 border border-teal-300 px-4 py-2 rounded hover:bg-teal-50 font-bold transition' }, '엑셀 양식 업로드');
  upBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const f = fileInput.files[0]; if (!f) return;
    try { showStudentResults(generatePerStudent(parseWorkbook(await f.arrayBuffer()))); }
    catch (e) { toast('엑셀 읽기 실패: ' + (e?.message || e)); }
  });

  const excelPanel = h('div', { class: 'hidden mt-4 p-4 rounded-lg border border-teal-200 bg-teal-50 space-y-4' },
    h('p', { class: 'text-sm text-gray-600' }, '학생 수·과목 수·과목별 평가기준 수만 입력해 빈 양식을 받은 뒤, 엑셀에서 채워 업로드하세요. (안내 시트에 작성법이 있습니다)'),
    h('div', { class: 'flex flex-wrap gap-3' },
      h('label', { class: 'flex flex-col gap-1' }, h('span', { class: css.label }, '학생 수'), numStudentsInp),
      h('label', { class: 'flex flex-col gap-1' }, h('span', { class: css.label }, '과목 수'), numSubjectsInp)),
    critWrap,
    h('div', { class: 'flex flex-wrap gap-2' }, tplBtn, upBtn, fileInput));
  const excelToggle = h('button', { class: 'text-sm bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1.5 rounded hover:bg-teal-100 font-bold transition' }, '📊 엑셀로 한 번에');
  excelToggle.addEventListener('click', () => {
    excelPanel.classList.toggle('hidden');
    excelToggle.classList.toggle('bg-teal-100');
  });

  function showStudentResults(rows) {
    if (!rows.length) { mount(xlsOut, notice('생성할 점수가 없습니다. 엑셀에 성취수준을 입력했는지 확인하세요.', 'warn')); return; }
    const byStudent = new Map();
    rows.forEach((r) => { if (!byStudent.has(r.studentName)) byStudent.set(r.studentName, []); byStudent.get(r.studentName).push(r); });
    const sections = [...byStudent.entries()].map(([name, items]) =>
      h('div', { class: 'border border-gray-200 rounded-lg overflow-hidden' },
        h('div', { class: 'bg-blue-50 px-4 py-2 border-b border-blue-100 font-bold text-blue-900 text-sm' }, name),
        h('div', { class: 'p-2' }, ...items.map((r) => copyLine(r.text, { prefix: r.subjectName, accent: 'blue' })))));
    mount(xlsOut, h('div', { class: css.card + ' animate-fade-in' },
      h('div', { class: 'flex flex-wrap items-center justify-between gap-2 mb-4' },
        h('div', {},
          h('h3', { class: 'font-bold text-lg text-gray-800' }, rows.length + '개 평어 (학생별)'),
          h('p', { class: 'text-xs text-gray-400 mt-0.5' }, '문장을 클릭하면 복사됩니다.')),
        h('div', { class: 'flex gap-2' },
          h('button', { class: 'text-sm bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 font-bold shadow transition', onClick: () => exportDoc(byStudent) }, '💾 한글(.doc)'),
          h('button', { class: 'text-sm bg-white text-gray-600 border border-gray-200 px-3 py-2 rounded hover:bg-gray-50 font-bold transition', onClick: () => downloadText(rows.map((r) => `${r.studentName}\t${r.subjectName}\t${r.text}`).join('\n'), '평어.txt') }, '텍스트'))),
      h('div', { class: 'grid gap-3' }, ...sections)));
  }
  function exportDoc(byStudent) {
    const sections = [...byStudent.entries()].map(([name, items]) => ({ heading: name, lines: items.map((r) => ({ label: r.subjectName, text: r.text })) }));
    downloadDoc('교과 평어', sections, '교과평어.doc');
  }

  /* ── 생성 버튼 ───────────────────────────────────────────────────────── */
  const genBtn = h('button', { class: css.cta + ' bg-blue-600 hover:bg-blue-700' }, '내장 무료 생성');
  genBtn.addEventListener('click', () => {
    const names = readStandards();
    if (!names.length) { toast('성취기준을 입력하세요'); return; }
    const counts = readCounts();
    showBanks(names.map((name) => ({ standard: name, bank: generateBank(name, counts) })));
  });
  const aiBtn = h('button', { class: 'px-5 py-3 rounded-lg font-bold border border-blue-200 text-blue-700 hover:bg-blue-50 transition whitespace-nowrap disabled:opacity-50' }, 'AI로 생성');
  aiBtn.addEventListener('click', async () => {
    const ai = getState().ai;
    if (!ai.apiKey || !ai.model) { toast('상단 카드에서 API 키와 모델을 선택하세요'); return; }
    const names = readStandards();
    if (!names.length) { toast('성취기준을 입력하세요'); return; }
    const counts = readCounts();
    const restore = btnLoading(aiBtn, '생성 중…');
    try {
      const results = [];
      for (const name of names) results.push({ standard: name, bank: await aiBank(ai, name, counts) });
      showBanks(results);
    } catch (e) { mount(bankOut, notice('AI 생성 실패: ' + (e?.message || e), 'warn')); }
    finally { restore(); }
  });

  /* ── 레이아웃: 좌(성취기준, col-span-2) + 우(생성 설정, col-span-1) ───── */
  const leftCard = h('div', { class: css.card + ' lg:col-span-2' },
    h('div', { class: 'flex flex-wrap items-center justify-between gap-2 mb-3' },
      h('div', { class: 'flex flex-wrap items-center gap-3' },
        h('h3', { class: 'font-bold text-lg text-gray-800' }, '성취기준 · 평가요소'),
        excelToggle),
      addStdBtn),
    stdWrap,
    excelPanel);
  const rightCard = h('div', { class: css.card + ' h-fit' },
    h('h3', { class: 'font-bold text-lg text-gray-800 mb-3' }, '생성 설정'),
    countRow);

  renderStandards();
  renderCrit();
  mount(root, h('div', { class: 'animate-fade-in' },
    h('div', { class: 'grid grid-cols-1 lg:grid-cols-3 gap-6' }, leftCard, rightCard),
    h('div', { class: 'flex flex-col sm:flex-row gap-2 mt-6' }, h('div', { class: 'flex-1' }, genBtn), aiBtn),
    bankOut,
    xlsOut,
  ));
}

/* ── AI 평어 생성 (레벨 헤더 파싱) ──────────────────────────────────────── */
async function aiBank(ai, name, counts) {
  const res = await generate(ai.provider, ai.apiKey, ai.model, buildGyogwaPrompt(name, counts));
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
