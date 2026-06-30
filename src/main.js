import { h, mount, clear } from './ui/dom.js';
import { renderGyogwa } from './ui/gyogwaTab.js';
import { renderChangche } from './ui/changcheTab.js';
import { renderHaengbal } from './ui/haengbalTab.js';
import { renderAI } from './ui/aiTab.js';

const TABS = [
  { id: 'gyogwa', label: '교과 평어', render: renderGyogwa },
  { id: 'changche', label: '창의적 체험활동', render: renderChangche },
  { id: 'haengbal', label: '행동발달', render: renderHaengbal },
  { id: 'ai', label: 'AI 설정', render: renderAI },
];

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
          'px-3 py-2 -mb-px border-b-2 font-medium ' +
          (t.id === current ? 'tab-active' : 'border-transparent text-slate-500 hover:text-slate-700'),
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
