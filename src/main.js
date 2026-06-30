import { h, mount, clear } from './ui/dom.js';
import { renderGyogwa } from './ui/gyogwaTab.js';
import { renderChangche } from './ui/changcheTab.js';
import { renderHaengbal } from './ui/haengbalTab.js';
import { renderAI } from './ui/aiTab.js';

const TABS = [
  { id: 'ai', label: 'AI 설정', render: renderAI },
  { id: 'gyogwa', label: '교과 평어', render: renderGyogwa },
  { id: 'changche', label: '창의적 체험활동', render: renderChangche },
  { id: 'haengbal', label: '행동발달', render: renderHaengbal },
];

// AI 설정을 첫 탭으로 배치하되, 처음 진입은 핵심 기능인 교과 평어로(내장 무료 엔진은 키 불필요).
let current = location.hash.replace('#', '') || 'gyogwa';
if (!TABS.find((t) => t.id === current)) current = 'gyogwa';

const tabbar = document.getElementById('tabbar');
const app = document.getElementById('app');

function renderTabbar() {
  mount(
    tabbar,
    ...TABS.map((t) =>
      h('button', {
        class:
          'px-4 py-2 rounded-md font-bold transition ' +
          (t.id === current ? 'bg-blue-600 text-white shadow' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'),
        onClick: () => { current = t.id; location.hash = t.id; route(); },
      }, t.label)
    )
  );
}

function route() {
  renderTabbar();
  clear(app);
  const tab = TABS.find((t) => t.id === current);
  try {
    tab.render(app);
  } catch (err) {
    app.append(h('div', { class: 'text-rose-600 text-sm' }, '오류: ' + (err?.message || err)));
    console.error(err);
  }
}

window.addEventListener('hashchange', () => {
  const id = location.hash.replace('#', '');
  if (TABS.find((t) => t.id === id)) { current = id; route(); }
});

route();
