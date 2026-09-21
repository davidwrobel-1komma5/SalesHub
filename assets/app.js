const icons = {
  home: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>',
  calculator: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M8 6.5h8v3H8zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>',
  financing: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/></svg>',
  knowledge: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H11v18H6.5A2.5 2.5 0 0 0 4 22zM20 4.5A2.5 2.5 0 0 0 17.5 2H13v18h4.5A2.5 2.5 0 0 1 20 22z"/></svg>',
  pulse: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
  lock: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  menu: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  collapse: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m14 18-6-6 6-6"/></svg>',
  chevron: '<svg class="nav-group-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m9 6 6 6-6 6"/></svg>',
};

const navigation = [
  { id: 'home', href: 'index.html', label: 'Startseite', icon: icons.home },
  {
    id: 'calculators',
    label: 'Rechner',
    icon: icons.calculator,
    children: [
      { id: 'calculator', href: 'heizungsfoerderrechner.html', label: 'Heizungsförderung' },
      { id: 'pv-calculator', href: 'pv-wirtschaftlichkeitsrechner.html', label: 'Wirtschaftlichkeit' },
      { id: 'independence-calculator', href: 'unabhaengigkeitsrechner.html', label: 'Unabhängigkeit' },
      { id: 'pv-utilization-calculator', href: 'pv-ausnutzungsrechner.html', label: 'PV-Ausnutzung' },
      { id: 'financing-calculator', href: 'finanzierungsrechner.html', label: 'Finanzierungsrechner' },
    ],
  },
  {
    id: 'energy-management',
    label: 'Energiemanagement',
    icon: icons.pulse,
    children: [
      { id: 'heartbeat-pitch', href: 'heartbeat-ai.html', label: 'Heartbeat AI' },
      { id: 'hems-comparison', href: 'hems-vergleich.html', label: 'HEMS-Vergleich' },
    ],
  },
  {
    id: 'knowledge',
    label: 'Wissen & Argumentation',
    icon: icons.knowledge,
    children: [
      { id: 'objection-handling', href: 'einwandbehandlung.html', label: 'Häufige Fragen' },
    ],
  },
  {
    id: 'internal',
    label: 'Intern',
    icon: icons.lock,
    children: [
      { id: 'te-booking', href: 'te-buchung.html', label: 'TE Buchung' },
    ],
  },
];

function renderShell() {
  const active = document.body.dataset.page || 'home';
  const links = navigation.map((item) => {
    if (!item.children) {
      return `<li><a class="nav-link" href="${item.href}" aria-label="${item.label}" title="${item.label}" ${item.id === active ? 'aria-current="page"' : ''}>${item.icon}<span>${item.label}</span></a></li>`;
    }

    const isActiveGroup = item.children.some((child) => child.id === active);
    const childLinks = item.children.map((child) => `
      <li><a class="nav-sublink" href="${child.href}" ${child.id === active ? 'aria-current="page"' : ''}>${child.label}</a></li>
    `).join('');

    return `
      <li class="nav-group${isActiveGroup ? ' is-active' : ''}">
        <button class="nav-group-toggle" type="button" aria-expanded="${isActiveGroup}" aria-controls="nav-group-${item.id}" title="${item.label}">
          ${item.icon}<span>${item.label}</span>${icons.chevron}
        </button>
        <ul class="nav-group-list" id="nav-group-${item.id}" ${isActiveGroup ? '' : 'hidden'}>${childLinks}</ul>
      </li>
    `;
  }).join('');

  document.body.insertAdjacentHTML('afterbegin', `
    <a class="skip-link" href="#main-content">Zum Hauptinhalt</a>
    <div class="app-shell">
      <header class="mobile-header">
        <a class="brand-lockup" href="index.html" aria-label="Energieberatung Startseite"><img class="brand-logo" src="assets/1komma5-logo.png" alt="1KOMMA5°"><span class="brand-product">Beratung</span></a>
        <button class="menu-button" type="button" aria-label="Navigation öffnen" aria-expanded="false" aria-controls="main-navigation">${icons.menu}</button>
      </header>
      <aside class="sidebar" id="main-navigation" aria-label="Hauptnavigation" data-open="false">
        <a class="brand-lockup" href="index.html" aria-label="Energieberatung Startseite"><img class="brand-logo" src="assets/1komma5-logo.png" alt="1KOMMA5°"><span class="brand-compact" aria-hidden="true">1K5°</span><span class="brand-product">Beratung</span></a>
        <button class="sidebar-collapse" type="button" aria-label="Navigation einklappen" aria-expanded="true">${icons.collapse}<span>Navigation einklappen</span></button>
        <p class="nav-section-label">Ihre Themen</p>
        <nav><ul class="nav-list">${links}</ul></nav>
        <div class="nav-spacer"></div>
        <div class="sidebar-meta"><strong>Ihre Energieberatung</strong><br>Schritt für Schritt erklärt</div>
      </aside>
      <button class="sidebar-scrim" type="button" aria-label="Navigation schließen" data-open="false"></button>
    </div>
  `);

  const menuButton = document.querySelector('.menu-button');
  const sidebar = document.querySelector('.sidebar');
  const scrim = document.querySelector('.sidebar-scrim');
  const collapseButton = document.querySelector('.sidebar-collapse');
  const groupToggles = document.querySelectorAll('.nav-group-toggle');

  const setCollapsed = (collapsed) => {
    document.body.classList.toggle('nav-collapsed', collapsed);
    collapseButton.setAttribute('aria-expanded', String(!collapsed));
    collapseButton.setAttribute('aria-label', collapsed ? 'Navigation ausklappen' : 'Navigation einklappen');
    collapseButton.querySelector('span').textContent = collapsed ? 'Navigation ausklappen' : 'Navigation einklappen';
    try {
      localStorage.setItem('saleshub-nav-collapsed', String(collapsed));
    } catch (error) {
      // Die Navigation funktioniert auch, wenn der Browser keinen Speicher erlaubt.
    }
  };

  let initiallyCollapsed = false;
  try {
    initiallyCollapsed = localStorage.getItem('saleshub-nav-collapsed') === 'true';
  } catch (error) {
    initiallyCollapsed = false;
  }
  setCollapsed(initiallyCollapsed);

  const setMenu = (open) => {
    sidebar.dataset.open = String(open);
    scrim.dataset.open = String(open);
    menuButton.setAttribute('aria-expanded', String(open));
    menuButton.setAttribute('aria-label', open ? 'Navigation schließen' : 'Navigation öffnen');
    if (open) sidebar.querySelector('.nav-link')?.focus();
  };

  menuButton.addEventListener('click', () => setMenu(sidebar.dataset.open !== 'true'));
  collapseButton.addEventListener('click', () => setCollapsed(!document.body.classList.contains('nav-collapsed')));
  groupToggles.forEach((toggle) => {
    toggle.addEventListener('click', () => {
      const list = document.getElementById(toggle.getAttribute('aria-controls'));
      const expanded = toggle.getAttribute('aria-expanded') === 'true';
      toggle.setAttribute('aria-expanded', String(!expanded));
      list.hidden = expanded;
    });
  });
  scrim.addEventListener('click', () => setMenu(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.dataset.open === 'true') {
      setMenu(false);
      menuButton.focus();
    }
  });
}

renderShell();
