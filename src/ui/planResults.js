import { h, mount, css } from './dom.js';
import { copyText, toast } from '../lib/clipboard.js';
import { downloadText } from '../lib/exporters.js';
import { combineBySubject } from '../lib/aiPlanGen.js';
import { notice } from './components.js';

function groupByStudent(list, nameOf) {
  const m = new Map();
  for (const x of list) { const n = nameOf(x); if (!m.has(n)) m.set(n, []); m.get(n).push(x); }
  return m;
}
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

// 편집 가능한 결과 + 평가기준별/과목별 묶기 토글 + PDF/텍스트 저장.
// rows: [{studentName, subjectName, elementName, level, text}] — text는 편집으로 갱신됨(가변).
export function renderPlanResults(container, rows, { title = '생성 결과' } = {}) {
  if (!rows || !rows.length) {
    mount(container, notice('생성된 평어가 없습니다. 성취수준을 입력했는지 확인하세요.', 'warn'));
    return;
  }
  let mode = 'element'; // 'element'(평가기준별, 편집) | 'subject'(과목별 묶기)
  const body = h('div', {});

  function renderBody() {
    if (mode === 'element') {
      mount(body, ...[...groupByStudent(rows, (r) => r.studentName).entries()].map(([name, items]) => {
        const bySub = groupByStudent(items, (r) => r.subjectName);
        return h('div', { class: 'border border-gray-200 rounded-lg overflow-hidden mb-3' },
          h('div', { class: 'bg-blue-50 px-4 py-2 border-b border-blue-100 font-bold text-blue-900 text-sm' }, name),
          h('div', { class: 'p-3 space-y-3' }, ...[...bySub.entries()].map(([sub, rs]) =>
            h('div', {},
              h('div', { class: 'text-xs font-bold text-gray-500 mb-1' }, sub),
              ...rs.map((r) => {
                const ta = h('textarea', { class: css.input + ' w-full text-sm leading-relaxed', rows: '2' });
                ta.value = r.text;
                ta.addEventListener('input', () => { r.text = ta.value; });
                return h('div', { class: 'mb-2' },
                  h('div', { class: 'text-xs text-gray-400 mb-0.5' }, r.elementName + (r.level ? ' · ' + r.level : '')),
                  ta);
              }))))
        );
      }));
    } else {
      const combined = combineBySubject(rows);
      mount(body, ...[...groupByStudent(combined, (c) => c.studentName).entries()].map(([name, subs]) =>
        h('div', { class: 'border border-gray-200 rounded-lg overflow-hidden mb-3' },
          h('div', { class: 'bg-blue-50 px-4 py-2 border-b border-blue-100 font-bold text-blue-900 text-sm' }, name),
          h('div', { class: 'p-3 space-y-3' }, ...subs.map((c) => {
            const para = h('div', { class: 'text-sm leading-relaxed text-gray-700 bg-gray-50 rounded p-2 cursor-pointer hover:bg-blue-50', title: '클릭하여 복사' }, c.paragraph);
            para.addEventListener('click', async () => { const okc = await copyText(c.paragraph); toast(okc ? '복사되었습니다' : '복사 실패'); });
            return h('div', {}, h('div', { class: 'text-xs font-bold text-gray-500 mb-1' }, c.subjectName), para);
          })))
      ));
    }
  }

  const toggleWrap = h('div', { class: 'flex gap-1' });
  function toggleBtn(m, label) {
    const on = mode === m;
    const b = h('button', { class: 'px-3 py-1.5 rounded-md text-sm font-bold transition ' + (on ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-500 border border-gray-200 hover:bg-gray-50') }, label);
    b.addEventListener('click', () => { mode = m; renderToggles(); renderBody(); });
    return b;
  }
  function renderToggles() { mount(toggleWrap, toggleBtn('element', '평가기준별'), toggleBtn('subject', '과목별 묶기')); }

  const pdfBtn = h('button', { class: 'text-sm bg-blue-600 text-white px-3 py-2 rounded hover:bg-blue-700 font-bold shadow transition' }, '📄 PDF로 저장');
  pdfBtn.addEventListener('click', () => printPdf(rows, mode));
  const txtBtn = h('button', { class: 'text-sm bg-white text-gray-600 border border-gray-200 px-3 py-2 rounded hover:bg-gray-50 font-bold transition' }, '텍스트');
  txtBtn.addEventListener('click', () => {
    let lines;
    if (mode === 'subject') lines = combineBySubject(rows).map((c) => `${c.studentName}\t${c.subjectName}\t${c.paragraph}`);
    else lines = rows.map((r) => `${r.studentName}\t${r.subjectName}\t${r.elementName}\t${r.text}`);
    downloadText(lines.join('\n'), '교과평어.txt');
  });

  renderToggles();
  renderBody();
  mount(container, h('div', { class: css.card + ' animate-fade-in' },
    h('div', { class: 'flex flex-wrap items-center justify-between gap-2 mb-4' },
      h('div', {},
        h('h3', { class: 'font-bold text-lg text-gray-800' }, title + ' · ' + rows.length + '개'),
        h('p', { class: 'text-xs text-gray-400 mt-0.5' }, '평가기준별에서 평어를 수정할 수 있고, 과목별 묶기는 나이스에 붙여넣을 한 문단입니다.')),
      h('div', { class: 'flex flex-wrap gap-2 items-center' }, toggleWrap, pdfBtn, txtBtn)),
    body));
}

// 인쇄용 새 창 → 브라우저 인쇄(PDF로 저장). 시스템 한글 폰트 사용.
function printPdf(rows, mode) {
  let bodyHtml = '';
  if (mode === 'subject') {
    for (const [name, subs] of groupByStudent(combineBySubject(rows), (c) => c.studentName)) {
      bodyHtml += `<h2>${esc(name)}</h2>`;
      for (const c of subs) bodyHtml += `<p><b>${esc(c.subjectName)}</b> ${esc(c.paragraph)}</p>`;
    }
  } else {
    for (const [name, items] of groupByStudent(rows, (r) => r.studentName)) {
      bodyHtml += `<h2>${esc(name)}</h2>`;
      for (const r of items) bodyHtml += `<p><b>${esc(r.subjectName)} · ${esc(r.elementName)}</b><br>${esc(r.text)}</p>`;
    }
  }
  const doc =
    `<!DOCTYPE html><html lang="ko"><head><meta charset="utf-8"><title>교과 평어</title>` +
    `<style>body{font-family:'Malgun Gothic','Apple SD Gothic Neo',sans-serif;padding:24px;color:#111}` +
    `h1{font-size:18pt;margin:0 0 12pt}h2{font-size:13pt;margin:14pt 0 4pt;border-bottom:1px solid #ccc;padding-bottom:2pt}` +
    `p{font-size:11pt;line-height:1.6;margin:3pt 0}b{color:#1e40af}</style></head>` +
    `<body><h1>교과 평어</h1>${bodyHtml}<script>window.onload=function(){window.print();}<\/script></body></html>`;
  const w = window.open('', '_blank');
  if (!w) { toast('팝업이 차단되었습니다. 팝업을 허용한 뒤 다시 시도하세요.'); return; }
  w.document.write(doc);
  w.document.close();
}
