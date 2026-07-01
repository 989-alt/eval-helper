import { h, mount, css } from './dom.js';
import { getState } from '../lib/store.js';
import { LEVELS } from '../lib/levels.js';
import { generateBank, generatePerStudent } from '../lib/gyogwaEngine.js';
import { generate } from '../lib/providers.js';
import { downloadTemplate, parseWorkbook, buildSkeletonEvalSet } from '../lib/excel.js';
import { generateFromPlan } from '../lib/aiPlanGen.js';
import { notice, levelCard, LEVEL_COLORS, btnLoading } from './components.js';
import { renderPlanResults } from './planResults.js';
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
    try { renderPlanResults(xlsOut, generatePerStudent(parseWorkbook(await f.arrayBuffer())), { title: '교과 평어 (내장 생성)' }); }
    catch (e) { toast('엑셀 읽기 실패: ' + (e?.message || e)); }
    finally { fileInput.value = ''; }
  });

  // ── AI 기준 분석 (채운 엑셀 + 평가 계획안 첨부, AI 전용) ──
  const aiExcelInput = h('input', { type: 'file', accept: '.xlsx,.xls', class: 'hidden' });
  const aiPlanInput = h('input', { type: 'file', accept: '.pdf,image/*', class: 'hidden' });
  const aiExcelName = h('span', { class: 'text-xs text-gray-500' }, '선택된 엑셀 없음');
  const aiPlanName = h('span', { class: 'text-xs text-gray-500' }, '선택된 계획안 없음');
  aiExcelInput.addEventListener('change', () => { aiExcelName.textContent = aiExcelInput.files[0]?.name || '선택된 엑셀 없음'; });
  aiPlanInput.addEventListener('change', () => { aiPlanName.textContent = aiPlanInput.files[0]?.name || '선택된 계획안 없음'; });
  const aiExcelBtn = h('button', { class: 'text-sm bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded hover:bg-gray-50 font-bold transition' }, '① 채운 엑셀 선택');
  aiExcelBtn.addEventListener('click', () => aiExcelInput.click());
  const aiPlanBtn = h('button', { class: 'text-sm bg-white text-gray-700 border border-gray-300 px-3 py-2 rounded hover:bg-gray-50 font-bold transition' }, '② 평가 계획안 선택 (PDF·이미지)');
  aiPlanBtn.addEventListener('click', () => aiPlanInput.click());
  const aiGenBtn = h('button', { class: 'text-sm bg-indigo-600 text-white px-4 py-2 rounded hover:bg-indigo-700 font-bold shadow transition' }, '🤖 AI로 기준 분석·생성');
  aiGenBtn.addEventListener('click', async () => {
    const ai = getState().ai;
    if (!ai.apiKey || !ai.model) { toast('상단 카드에서 API 키와 모델을 선택하세요'); return; }
    if (ai.provider === 'openai') { toast('OpenAI는 파일 분석 미지원. Google 또는 Anthropic 키를 사용하세요'); return; }
    const ex = aiExcelInput.files[0], pl = aiPlanInput.files[0];
    if (!ex) { toast('① 채운 엑셀을 선택하세요'); return; }
    if (!pl) { toast('② 평가 계획안(PDF·이미지)을 선택하세요'); return; }
    const restore = btnLoading(aiGenBtn, '분석 중…');
    try {
      const evalSet = parseWorkbook(await ex.arrayBuffer());
      const file = { mime: pl.type || 'application/pdf', base64: await fileToBase64(pl) };
      const rows = await generateFromPlan(ai, evalSet, file, (done, total, sub) => {
        aiGenBtn.innerHTML = '<span class="inline-flex items-center justify-center gap-2"><span class="loader" style="display:inline-block"></span>분석 중… (' + done + '/' + total + ') ' + (sub || '') + '</span>';
      });
      renderPlanResults(xlsOut, rows, { title: '교과 평어 (AI 기준 분석)' });
    } catch (e) { mount(xlsOut, notice('AI 기준 분석 실패: ' + (e?.message || e), 'warn')); }
    finally { restore(); }
  });

  const excelPanel = h('div', { class: 'hidden mt-4 p-4 rounded-lg border border-teal-200 bg-teal-50 space-y-4' },
    h('p', { class: 'text-sm text-gray-600' }, '학생 수·과목 수·과목별 평가기준 수만 입력해 빈 양식을 받은 뒤, 엑셀에서 채워 업로드하세요. (안내 시트에 작성법이 있습니다)'),
    h('div', { class: 'flex flex-wrap gap-3' },
      h('label', { class: 'flex flex-col gap-1' }, h('span', { class: css.label }, '학생 수'), numStudentsInp),
      h('label', { class: 'flex flex-col gap-1' }, h('span', { class: css.label }, '과목 수'), numSubjectsInp)),
    critWrap,
    h('div', { class: 'flex flex-wrap gap-2' }, tplBtn, upBtn, fileInput),
    h('div', { class: 'pt-4 border-t border-teal-200' },
      h('p', { class: 'text-sm font-bold text-gray-700 mb-1' }, 'AI로 기준 분석 (평가 계획안 필요)'),
      h('p', { class: 'text-xs text-gray-500 mb-2' }, '엑셀엔 평가 주제와 학생별 성취수준만 넣고, 세부 기준·루브릭은 학교 평가 계획안/도구표(PDF·이미지)를 첨부하면 AI가 분석해 평어를 만듭니다. Google 또는 Anthropic 키가 필요합니다.'),
      h('div', { class: 'flex flex-wrap items-center gap-2' }, aiExcelBtn, aiExcelName),
      h('div', { class: 'flex flex-wrap items-center gap-2 mt-2' }, aiPlanBtn, aiPlanName),
      h('div', { class: 'mt-3' }, aiGenBtn),
      aiExcelInput, aiPlanInput));
  const excelToggle = h('button', { class: 'text-sm bg-teal-50 text-teal-700 border border-teal-200 px-3 py-1.5 rounded hover:bg-teal-100 font-bold transition' }, '📊 엑셀로 한 번에');
  excelToggle.addEventListener('click', () => {
    excelPanel.classList.toggle('hidden');
    excelToggle.classList.toggle('bg-teal-100');
  });

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

// 파일 → 순수 base64(data URL 접두사 제거)
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => { const s = String(reader.result); const i = s.indexOf(','); resolve(i >= 0 ? s.slice(i + 1) : s); };
    reader.onerror = () => reject(reader.error || new Error('파일 읽기 실패'));
    reader.readAsDataURL(file);
  });
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
