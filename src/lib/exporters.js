// 내보내기: 한글/워드 호환 .doc(HTML 기반), 텍스트
// 한글(HWP)은 .doc(워드 HTML)을 열 수 있어 호환 형식으로 저장한다.

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// rows: [{ heading, lines: [{label, text}] }] 형태의 섹션 배열
export function downloadDoc(title, sections, filename = '평어.doc') {
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const body = sections.map((sec) => {
    const head = sec.heading ? `<h2 style="font-size:14pt;margin:14pt 0 6pt;">${esc(sec.heading)}</h2>` : '';
    const items = sec.lines.map((ln) => {
      const label = ln.label ? `<b>${esc(ln.label)}</b>  ` : '';
      return `<p style="margin:2pt 0;font-size:11pt;line-height:1.5;">${label}${esc(ln.text)}</p>`;
    }).join('');
    return head + items;
  }).join('');
  const html =
    `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">` +
    `<head><meta charset="utf-8"><title>${esc(title)}</title></head>` +
    `<body style="font-family:'함초롬바탕',serif;">` +
    `<h1 style="font-size:16pt;">${esc(title)}</h1>${body}</body></html>`;
  downloadBlob(new Blob(['﻿' + html], { type: 'application/msword' }), filename);
}

export function downloadText(text, filename = '평어.txt') {
  downloadBlob(new Blob(['﻿' + text], { type: 'text/plain;charset=utf-8' }), filename);
}
