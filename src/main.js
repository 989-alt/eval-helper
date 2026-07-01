import { h, mount, clear } from './ui/dom.js';
import { renderGyogwa } from './ui/gyogwaTab.js';
import { renderChangche } from './ui/changcheTab.js';
import { renderHaengbal } from './ui/haengbalTab.js';
import { renderAI } from './ui/aiTab.js';

const TABS = [
  { id: 'gyogwa', label: '교과 평어', render: renderGyogwa },
  { id: 'changche', label: '창의적 체험활동', render: renderChangche },
  { id: 'haengbal', label: '행동발달', render: renderHaengbal },
];

let current = location.hash.replace('#', '') || 'gyogwa';
if (!TABS.find((t) => t.id === current)) current = 'gyogwa';

// AI 설정은 탭이 아니라 상단 상시 카드로 1회 렌더 (어느 탭에서도 노출).
renderAI(document.getElementById('apicard'));

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
