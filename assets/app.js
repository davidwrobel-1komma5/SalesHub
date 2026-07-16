const icons = {
  home: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10M9 20v-6h6v6"/></svg>',
  pitch: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 19V7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12"/><path d="M8 9h8M8 13h5M3 19h18"/></svg>',
  calculator: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="4" y="2.5" width="16" height="19" rx="2"/><path d="M8 6.5h8v3H8zM8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>',
  financing: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 9h18M7 15h4"/></svg>',
  knowledge: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M4 4.5A2.5 2.5 0 0 1 6.5 2H11v18H6.5A2.5 2.5 0 0 0 4 22zM20 4.5A2.5 2.5 0 0 0 17.5 2H13v18h4.5A2.5 2.5 0 0 1 20 22z"/></svg>',
  pulse: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 12h4l2-5 4 10 2-5h6"/></svg>',
  menu: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  collapse: '<svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="m14 18-6-6 6-6"/></svg>',
};

const navigation = [
  { id: 'home', href: 'index.html', label: 'Übersicht', icon: icons.home },
  { id: 'pitch', href: 'heizungsfoerderung.html', label: 'Förderung verstehen', icon: icons.pitch },
  { id: 'calculator', href: 'heizungsfoerderrechner.html', label: 'Heizungsförderung', icon: icons.calculator },
  { id: 'pv-calculator', href: 'pv-wirtschaftlichkeitsrechner.html', label: 'Wirtschaftlichkeit', icon: icons.calculator },
  { id: 'independence-calculator', href: 'unabhaengigkeitsrechner.html', label: 'Unabhängigkeit', icon: icons.pulse },
  { id: 'financing-calculator', href: 'finanzierungsrechner.html', label: 'Finanzierungsrechner', icon: icons.financing },
  { id: 'heartbeat-pitch', href: 'heartbeat-ai.html', label: 'Heartbeat AI', icon: icons.pulse },
];

function renderShell() {
  const active = document.body.dataset.page || 'home';
  const links = navigation.map((item) => `
    <li><a class="nav-link" href="${item.href}" aria-label="${item.label}" title="${item.label}" ${item.id === active ? 'aria-current="page"' : ''}>${item.icon}<span>${item.label}</span></a></li>
  `).join('');

  document.body.insertAdjacentHTML('afterbegin', `
    <a class="skip-link" href="#main-content">Zum Hauptinhalt</a>
    <div class="app-shell">
      <header class="mobile-header">
        <a class="brand-lockup" href="index.html" aria-label="Energieberatung Startseite"><span class="brand-name">1KOMMA5°</span><span class="brand-product">Beratung</span></a>
        <button class="menu-button" type="button" aria-label="Navigation öffnen" aria-expanded="false" aria-controls="main-navigation">${icons.menu}</button>
      </header>
      <aside class="sidebar" id="main-navigation" aria-label="Hauptnavigation" data-open="false">
        <a class="brand-lockup" href="index.html" aria-label="Energieberatung Startseite"><span class="brand-name">1KOMMA5°</span><span class="brand-compact" aria-hidden="true">1K5°</span><span class="brand-product">Beratung</span></a>
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
  scrim.addEventListener('click', () => setMenu(false));
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && sidebar.dataset.open === 'true') {
      setMenu(false);
      menuButton.focus();
    }
  });
}

renderShell();
