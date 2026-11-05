/* Heartbeat-AI-Simulation: vereinfachtes, regelbasiertes Modell zur Veranschaulichung.
   Annahmen: 10 kWp Solaranlage, 10 kWh Speicher (5 kW), Wallbox 11 kW, E-Auto angeschlossen, Abfahrt DEPART Uhr.
   Verkauf ins Netz ab SELL_PRICE; SOC_RESERVE bleibt für den eigenen Bedarf im Speicher. */
(function () {
  const root = document.getElementById('hb-sim');
  if (!root) return;

  const SEASONS = [
    { name: 'Winter', inName: 'im Winter', rise: 8.25, set: 16.25, peak: 3.0, soc0: 0.25, sunPeak: 82 },
    { name: 'Frühling', inName: 'im Frühling', rise: 6.5, set: 19.75, peak: 6.5, soc0: 0.40, sunPeak: 55 },
    { name: 'Sommer', inName: 'im Sommer', rise: 5.25, set: 21.5, peak: 8.0, soc0: 0.55, sunPeak: 40 },
    { name: 'Herbst', inName: 'im Herbst', rise: 7.25, set: 18.25, peak: 5.0, soc0: 0.35, sunPeak: 66 },
  ];
  const BAT_KWH = 10, BAT_KW = 5, EV_KW = 11, EV_MIN = 1.4, SOC_MIN = 0.1, SOC_MAX = 0.95;
  const SELL_PRICE = 20, SOC_RESERVE = 0.3, AC_MAX = 10; // AC_MAX: Leistungsgrenze des Wechselrichters
  const DEPART = 7, EV_KWH_PER_KM = 0.18;

  const LEVELS = {
    negativ: { label: 'negativ' },
    sehr: { label: 'sehr günstig' },
    guenstig: { label: 'günstig' },
    mittel: { label: 'mittel' },
    teuer: { label: 'hoch' },
  };
  const levelKey = (p) => (p < 0 ? 'negativ' : p < 5 ? 'sehr' : p < 10 ? 'guenstig' : p < 16 ? 'mittel' : 'teuer');

  const pvAt = (h, s) => (h <= s.rise || h >= s.set ? 0
    : s.peak * Math.pow(Math.sin(Math.PI * (h - s.rise) / (s.set - s.rise)), 1.3));

  function homeProfile(h) {
    let kw = 0.35;
    if (h >= 6.5 && h < 8.5) kw += 0.6;
    if (h >= 12 && h < 13.5) kw += 0.4;
    if (h >= 17.5 && h < 22) kw += 0.9;
    return kw;
  }
  let profileDay = 0; // kWh pro Tag im unskalierten Profil
  for (let i = 0; i < 96; i++) profileDay += homeProfile(i / 4) * 0.25;
  const homeLoad = (h, annual) => homeProfile(h) * (annual / 365) / profileDay;

  function wpBase(T) {
    const heating = T < 15;
    const thermal = (heating ? (15 - T) * 0.38 : 0) + 0.5; // Heizung + Warmwasser
    const cop = Math.min(5, Math.max(2, 3.2 + 0.09 * T));
    return { heating, elec: thermal / cop };
  }

  function dayProfile(s, T, annual) {
    const wpE = wpBase(T).elec;
    const steps = [];
    for (let i = 0; i < 96; i++) {
      const h = i / 4, pv = pvAt(h, s), home = homeLoad(h, annual);
      steps.push({ h, pv, home, surplus: Math.max(0, pv - home - wpE) * 0.25 });
    }
    const ahead = new Array(97).fill(0); // erwarteter Solarüberschuss ab Zeitpunkt i (kWh)
    for (let i = 95; i >= 0; i--) ahead[i] = ahead[i + 1] + steps[i].surplus;
    return { steps, ahead, wpE };
  }


  function decide(h, p, T, si, soc, annual, evNeed) {
    const s = SEASONS[si];
    const prof = dayProfile(s, T, annual);
    const idx = Math.round(h * 4);
    const pv = pvAt(h, s), home = homeLoad(h, annual), base = wpBase(T);
    const lvl = levelKey(p);
    const cheap = lvl === 'negativ' || lvl === 'sehr';
    const surplusRaw = pv - home - base.elec;

    // Wärmepumpe: das Gebäude ist ein Wärmespeicher – vorheizen, wenn Strom günstig ist, drosseln, wenn er teuer ist.
    let wp = base.elec, wpMode = base.heating ? 'normal' : 'bereit';
    if (cheap || (surplusRaw > 1.5 && p < SELL_PRICE)) {
      if (base.heating) { wp = base.elec * 1.4; wpMode = 'vorheizen'; }
      else { wp = Math.max(base.elec, 1.2); wpMode = 'warmwasser'; }
    } else if (lvl === 'teuer' && base.heating && T > -5) {
      wp = base.elec * 0.5; wpMode = 'drosseln';
    }

    const residual = pv - home - wp;
    const room = (SOC_MAX - soc) * BAT_KWH, avail = (soc - SOC_MIN) * BAT_KWH;
    let bat = 0, ev = 0, batMode = 'haelt', evMode = 'wartet', market = false;
    const hoursLeft = h < DEPART ? DEPART - h : 24 - h + DEPART;
    const evUrgent = evNeed > 0.05 && evNeed / EV_KW >= hoursLeft - 0.25;

    if (lvl === 'negativ') {
      if (room > 0.2) { bat = BAT_KW; batMode = 'laedt'; } else batMode = 'voll';
      ev = EV_KW; evMode = 'laedt';
    } else if (p >= SELL_PRICE && soc > SOC_RESERVE + 0.05 && !evUrgent) {
      // Hoher Preis: Speicherstrom verkaufen statt selbst verbrauchen – die Reserve bleibt fürs Haus.
      bat = -Math.max(0, Math.min(BAT_KW, AC_MAX - Math.max(0, residual))); batMode = 'verkauft'; market = true;
    } else if (residual > 0) {
      let rest = residual;
      const holdForPeak = (si === 1 || si === 2) && h < 11 && soc > 0.3 && room > 0.2;
      if (room <= 0.2) batMode = 'voll';
      else if (holdForPeak) batMode = 'reserviert';
      else { bat = Math.min(rest, BAT_KW); rest -= bat; batMode = 'laedt'; }
      if (rest >= EV_MIN) { ev = Math.min(rest, EV_KW); evMode = 'laedt'; }
      else evMode = 'ueberschuss';
    } else {
      const need = -residual;
      if (cheap) {
        if (room > 0.5 && room > prof.ahead[idx]) { bat = BAT_KW; batMode = 'netzladen'; }
        else batMode = room <= 0.2 ? 'voll' : 'haelt';
        ev = EV_KW; evMode = 'laedt';
      } else if (lvl === 'guenstig') {
        batMode = avail > 0.2 ? 'haelt' : 'leer';
        ev = EV_KW; evMode = 'laedt';
      } else if (lvl === 'mittel') {
        if (soc > 0.5) { bat = -Math.min(need, BAT_KW); batMode = 'entlaedt'; }
        else batMode = avail > 0.2 ? 'haelt' : 'leer';
      } else {
        if (avail > 0.2) { bat = -Math.min(need, BAT_KW, avail * 4); batMode = 'entlaedt'; }
        else batMode = 'leer';
      }
    }

    // E-Auto: ohne Bedarf kein Laden; reicht die Zeit bis zur Abfahrt nicht mehr, lädt es sofort voll.
    if (evNeed <= 0.05) { ev = 0; evMode = 'voll'; }
    else if (evUrgent && ev < EV_KW) { ev = EV_KW; evMode = 'pflicht'; }

    let grid = home + wp + ev + bat - pv; // positiv = Bezug, negativ = Einspeisung
    let curtail = 0;
    if (lvl === 'negativ' && grid < 0) { curtail = -grid; grid = 0; }

    return { h, p, T, s, si, pv, home, wp, wpMode, base, soc, lvl, bat, batMode, ev, evMode, evNeed, grid, curtail, market, residual };
  }

  // ---------- Texte ----------
  const kw = (v) => Math.abs(v).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const signed = (v) => String(v).replace('-', '−');
  const clock = (h) => `${String(Math.floor(h)).padStart(2, '0')}:${String(Math.round((h % 1) * 60)).padStart(2, '0')}`;
  const pct = (soc) => `${Math.round(soc * 100)} %`;

  function headline(d) {
    if (d.lvl === 'negativ') return 'Negativer Börsenpreis: Strom aufnehmen statt einspeisen';
    if (d.evMode === 'pflicht') return `Abfahrt um ${DEPART} Uhr: Das E-Auto muss jetzt laden`;
    if (d.market) return d.pv > 0.5 ? 'Hoher Preis: Solar- und Speicherstrom werden verkauft' : 'Hoher Preis: Speicherstrom wird ins Netz verkauft';
    if (d.residual > 0) {
      if (d.batMode === 'reserviert') return 'Speicher bleibt für die Mittagsspitze frei';
      if (d.bat > 0) return 'Solarstrom wird gespeichert statt eingespeist';
      if (d.ev > 0) return 'E-Auto lädt mit Sonnenstrom';
      return 'Solarüberschuss fließt ins Netz';
    }
    if (d.batMode === 'netzladen') return 'Günstige Stunde: Speicher wird vorgeladen';
    if (d.lvl === 'sehr' || d.lvl === 'guenstig') return 'Günstige Stunde: Strom aus dem Netz nutzen';
    if (d.batMode === 'entlaedt') return d.lvl === 'teuer' ? 'Teure Stunde: Der Speicher übernimmt' : 'Der Speicher versorgt das Haus';
    if (d.batMode === 'leer') return 'Speicher leer: Strom kommt aus dem Netz';
    return 'Speicher wird für teurere Stunden aufgehoben';
  }

  function reasons(d) {
    const out = [];
    const t = clock(d.h);
    out.push(d.pv < 0.05
      ? `Um ${t} Uhr liefert die Solaranlage ${d.s.inName} keinen Strom.`
      : `Um ${t} Uhr erzeugt die Solaranlage rund ${kw(d.pv)} kW, das Haus braucht ${kw(d.home)} kW.`);
    const p = signed(d.p);
    out.push({
      negativ: `Der Börsenpreis ist negativ (${p} ct/kWh) – im Netz ist gerade mehr Strom als Bedarf.`,
      sehr: `Der Börsenpreis ist mit ${p} ct/kWh sehr niedrig.`,
      guenstig: `Der Börsenpreis ist mit ${p} ct/kWh günstig.`,
      mittel: `Der Börsenpreis liegt mit ${p} ct/kWh im mittleren Bereich.`,
      teuer: d.market
        ? `Der Börsenpreis liegt mit ${p} ct/kWh über der Verkaufsschwelle von ${SELL_PRICE} ct/kWh.`
        : `Der Börsenpreis ist mit ${p} ct/kWh hoch – für einen Verkauf ins Netz aber noch unter ${SELL_PRICE} ct/kWh.`,
    }[d.lvl]);

    const T = `${signed(d.T)} °C`;
    const wpText = {
      vorheizen: `Bei ${T} heizt die Wärmepumpe jetzt vor – das Gebäude speichert die Wärme für später.`,
      drosseln: `Bei ${T} kann das Haus die teure Stunde überbrücken – die Wärmepumpe läuft gedrosselt.`,
      warmwasser: 'Heizen ist nicht nötig – die Wärmepumpe lädt mit dem günstigen Strom den Warmwasserspeicher.',
      normal: d.T <= -5 ? `Bei ${T} hat Wärme Vorrang – die Wärmepumpe läuft ohne Einschränkung.` : null,
      bereit: null,
    }[d.wpMode];

    const batText = {
      reserviert: 'Heartbeat erwartet zur Mittagszeit mehr Solarstrom und hält dafür Platz im Speicher frei.',
      netzladen: `${d.s.inName.charAt(0).toUpperCase() + d.s.inName.slice(1)} ist heute kaum Solarüberschuss zu erwarten – der Speicher wird jetzt günstig geladen.`,
      laedt: `Der Speicher (${pct(d.soc)}) nimmt die Energie auf.`,
      haelt: `Der Speicher (${pct(d.soc)}) wird für teurere Stunden aufgehoben.`,
      entlaedt: `Der Speicher (${pct(d.soc)}) deckt den Bedarf, statt teuren Netzstrom zu kaufen.`,
      verkauft: `Der Speicher ist zu ${pct(d.soc)} gefüllt – Heartbeat verkauft ${kw(-d.bat)} kW daraus und behält ${Math.round(SOC_RESERVE * 100)} % als Reserve für das Haus.`,
      voll: 'Der Speicher ist bereits voll.',
      leer: `Der Speicher ist mit ${pct(d.soc)} leer – es bleibt nur das Netz.`,
    }[d.batMode];

    const need = `${Math.round(d.evNeed)} kWh`;
    const evText = d.evMode === 'pflicht'
      ? `Das E-Auto braucht bis ${DEPART} Uhr noch ${need} – das schafft es nur, wenn es jetzt lädt, auch zum aktuellen Preis.`
      : d.evMode === 'voll' ? null
      : d.evMode === 'wartet'
      ? `Das E-Auto braucht noch ${need} und wartet auf eine günstigere Stunde – bis ${DEPART} Uhr bleibt genug Zeit.`
      : d.evMode === 'ueberschuss' ? 'Für die Wallbox reicht der Überschuss noch nicht – das E-Auto lädt, sobald mehr Sonnenstrom da ist.'
      : d.residual > 0 && d.lvl !== 'negativ' ? 'Das E-Auto nutzt den Überschuss, der sonst ins Netz ginge.' : null;

    const extra = d.market ? 'In günstigeren Stunden wird der Speicher wieder geladen. Die Vermarktung ist markt- und anlagenabhängig.'
      : d.curtail > 0.05 ? 'Was darüber hinaus erzeugt wird, wird abgeregelt statt eingespeist.' : null;
    const heatFirst = d.wpMode === 'vorheizen' || d.wpMode === 'drosseln';
    // Beim Verkauf gehört der Hinweis auf die Marktabhängigkeit immer dazu.
    (d.evMode === 'pflicht' ? [evText, batText, wpText, extra] : d.market ? [batText, extra, wpText, evText] : heatFirst ? [wpText, batText, evText, extra] : [batText, evText, wpText, extra]).forEach((r) => r && out.push(r));
    return out.slice(0, 4);
  }

  function naive(d) {
    if (d.lvl === 'negativ') return d.pv > d.home + d.base.elec + BAT_KW
      ? 'würde der Solarüberschuss trotz negativem Preis ins Netz fließen.'
      : 'bliebe der Stromüberfluss ungenutzt – Speicher und E-Auto würden nicht laden.';
    if (d.market) return 'würde der Speicher nur das eigene Haus versorgen – der hohe Marktpreis bliebe ungenutzt.';
    if (d.batMode === 'netzladen') return 'würde der Speicher nicht günstig nachgeladen – das Haus müsste später teureren Strom kaufen.';
    if (d.batMode === 'haelt') return 'würde der Speicher schon jetzt entladen und in den teuren Stunden fehlen.';
    if (d.batMode === 'reserviert') return 'wäre der Speicher vor Mittag voll und die Solarspitze würde ins Netz fließen.';
    if (d.evMode === 'wartet') return `würde das E-Auto jetzt sofort mit ${EV_KW} kW zum aktuellen Preis laden.`;
    if (d.wpMode === 'drosseln') return 'liefe die Wärmepumpe auch in dieser teuren Stunde mit voller Leistung.';
    if (d.wpMode === 'vorheizen') return 'würde die Wärmepumpe nur nach aktuellem Bedarf heizen und die günstige Stunde nicht nutzen.';
    return null;
  }

  function status(d) {
    const wpLabel = { vorheizen: 'heizt vor', drosseln: 'gedrosselt', warmwasser: 'Warmwasser', normal: 'heizt', bereit: 'bereit' }[d.wpMode];
    const batLabel = { laedt: 'lädt', netzladen: 'lädt aus Netz', entlaedt: 'entlädt', verkauft: 'verkauft', haelt: 'hält', reserviert: 'hält Platz frei', voll: 'voll', leer: 'leer' }[d.batMode];
    return {
      grid: d.grid > 0.05 ? [`Bezug · ${kw(d.grid)} kW`, true] : d.grid < -0.05 ? [`${d.market ? 'Verkauf' : 'Einspeisung'} · ${kw(d.grid)} kW`, true] : ['kein Austausch', false],
      pv: d.pv > 0.05 ? [`${kw(d.pv)} kW`, true] : ['keine Erzeugung', false],
      wp: [d.wp > 0.15 ? `${wpLabel} · ${kw(d.wp)} kW` : wpLabel, d.wp > 0.15],
      bat: [`${pct(d.soc)} · ${batLabel}`, Math.abs(d.bat) > 0.05],
      home: [`${kw(d.home)} kW`, true],
      hb: [`Preis ${LEVELS[d.lvl].label}`, true],
      ev: d.ev > 0.05 ? [`lädt · ${kw(d.ev)} kW`, true] : [{ ueberschuss: 'wartet auf Überschuss', voll: 'voll geladen' }[d.evMode] || 'wartet', false],
    };
  }

  // ---------- Grafik ----------
  const FLOWS = {
    grid: ['M110 395 V540 H345 V362'],
    pv: ['M405 277 V362'],
    bat: ['M405 362 V392'],
    home: ['M505 362 V392'],
    wp: ['M250 362 V415'],
    ev: ['M657 400 H706', 'M714 424 C714 462 740 462 752 440'],
  };
  const NAMES = { grid: 'Stromnetz', pv: 'Solaranlage', wp: 'Wärmepumpe', bat: 'Speicher', home: 'Haushalt', hb: 'Heartbeat AI', ev: 'Wallbox & E-Auto' };
  const SVGNS = 'http://www.w3.org/2000/svg';
  const layer = root.querySelector('#hb-flows');
  const groups = {};
  Object.entries(FLOWS).forEach(([key, paths]) => {
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', 'hb-flow');
    paths.forEach((d) => ['base', 'halo', 'core'].forEach((part) => {
      const path = document.createElementNS(SVGNS, 'path');
      path.setAttribute('d', d);
      path.setAttribute('class', `hb-flow__${part}`);
      g.appendChild(path);
    }));
    layer.appendChild(g);
    groups[key] = g;
  });

  function setFlow(key, value) {
    const g = groups[key], mag = Math.abs(value);
    g.classList.toggle('is-active', mag > 0.05);
    g.classList.toggle('is-reverse', value < -0.05);
    g.style.setProperty('--hb-w', `${2.6 + Math.min(mag / 10, 1) * 3.4}px`);
    g.style.setProperty('--hb-dur', `${1.7 - Math.min(mag / 8, 1) * 1.2}s`);
  }

  function drawGridBadge(d) {
    const badge = root.querySelector('#hb-grid-badge');
    const text = badge.querySelector('text'), rect = badge.querySelector('rect');
    const price = `${signed(d.p)} ct/kWh`;
    let label = null;
    if (d.grid < -0.05) label = d.market ? `Verkauf · ${price}` : 'Einspeisung';
    else if (d.grid > 0.05) label = `Bezug · ${price}`;
    badge.style.display = label ? '' : 'none';
    badge.classList.toggle('is-sell', d.market);
    if (!label) return;
    text.textContent = label;
    const w = Math.ceil(text.getComputedTextLength()) + 24;
    rect.setAttribute('x', (110 - w / 2).toFixed(1));
    rect.setAttribute('width', w);
  }

  function drawSky(d) {
    const s = d.s, frac = (d.h - s.rise) / (s.set - s.rise);
    const day = frac > 0 && frac < 1;
    const sun = root.querySelector('#hb-sun');
    sun.style.display = day ? '' : 'none';
    if (day) {
      const x = 170 + 760 * frac, y = 140 - (140 - s.sunPeak) * Math.sin(Math.PI * frac);
      sun.setAttribute('transform', `translate(${x.toFixed(1)} ${y.toFixed(1)})`);
    }
    const dist = day ? 0 : Math.min(Math.abs(d.h - s.rise), Math.abs(d.h - s.set), Math.abs(d.h + 24 - s.set), Math.abs(s.rise + 24 - d.h));
    const night = day ? 0 : Math.min(1, dist / 0.75);
    root.querySelector('#hb-night').style.opacity = (night * 0.9).toFixed(2);
    root.querySelector('#hb-stars').style.opacity = night.toFixed(2);
    root.querySelector('#hb-moon').style.opacity = night.toFixed(2);
    root.querySelector('#hb-snow').style.display = d.T <= 1 ? '' : 'none';
    const soc = root.querySelector('#hb-soc');
    const hgt = 75 * Math.max(0, Math.min(1, d.soc));
    soc.setAttribute('y', (471 - hgt).toFixed(1));
    soc.setAttribute('height', hgt.toFixed(1));
  }

  // ---------- Bedienung ----------
  const inputs = {
    h: root.querySelector('#hb-time'),
    p: root.querySelector('#hb-price'),
    T: root.querySelector('#hb-temp'),
    s: root.querySelector('#hb-season'),
    c: root.querySelector('#hb-soc-input'),
    a: root.querySelector('#hb-home-input'),
    e: root.querySelector('#hb-ev-input'),
  };
  const out = {
    h: root.querySelector('#hb-time-out'),
    p: root.querySelector('#hb-price-out'),
    T: root.querySelector('#hb-temp-out'),
    s: root.querySelector('#hb-season-out'),
    c: root.querySelector('#hb-soc-out'),
    a: root.querySelector('#hb-home-out'),
    e: root.querySelector('#hb-ev-out'),
  };
  const chips = root.querySelectorAll('[data-preset]');

  function render() {
    const d = decide(+inputs.h.value, +inputs.p.value, +inputs.T.value, +inputs.s.value, +inputs.c.value / 100, +inputs.a.value, +inputs.e.value);

    const timeText = `${clock(d.h)} Uhr`;
    const priceText = `${signed(d.p)} ct/kWh`;
    const tempText = `${signed(d.T)} °C`;
    out.h.textContent = timeText; inputs.h.setAttribute('aria-valuetext', timeText);
    out.p.textContent = `${priceText} · ${LEVELS[d.lvl].label}`; inputs.p.setAttribute('aria-valuetext', `${priceText}, ${LEVELS[d.lvl].label}`);
    out.T.textContent = tempText; inputs.T.setAttribute('aria-valuetext', tempText);
    out.s.textContent = d.s.name; inputs.s.setAttribute('aria-valuetext', d.s.name);
    out.c.textContent = pct(d.soc); inputs.c.setAttribute('aria-valuetext', pct(d.soc));
    const annualText = `${(+inputs.a.value).toLocaleString('de-DE')} kWh/Jahr`;
    out.a.textContent = annualText; inputs.a.setAttribute('aria-valuetext', `${annualText}, derzeit ${kw(d.home)} kW`);
    const evTag = d.evNeed <= 0.05 ? 'voll geladen' : `${Math.round(d.evNeed)} kWh · ca. ${Math.round(d.evNeed / EV_KWH_PER_KM / 10) * 10} km`;
    out.e.textContent = evTag; inputs.e.setAttribute('aria-valuetext', evTag);

    setFlow('pv', d.pv);
    setFlow('grid', d.grid);
    setFlow('bat', d.bat);
    setFlow('home', d.home);
    setFlow('wp', d.wp > 0.15 ? d.wp : 0);
    setFlow('ev', d.ev);
    drawSky(d);
    drawGridBadge(d);

    const st = status(d);
    const list = root.querySelector('#hb-devices');
    list.innerHTML = '';
    Object.entries(st).forEach(([key, [text, on]]) => {
      const el = root.querySelector(`#hb-s-${key}`);
      el.textContent = text;
      el.classList.toggle('is-on', on);
      const li = document.createElement('li');
      li.className = on ? 'is-on' : '';
      li.innerHTML = `<strong>${NAMES[key]}</strong><span>${text}</span>`;
      list.appendChild(li);
    });

    root.querySelector('#hb-headline').textContent = headline(d);
    const ul = root.querySelector('#hb-reasons');
    ul.innerHTML = '';
    reasons(d).forEach((r) => { const li = document.createElement('li'); li.textContent = r; ul.appendChild(li); });
    const n = naive(d), naiveEl = root.querySelector('#hb-naive');
    naiveEl.hidden = !n;
    if (n) naiveEl.innerHTML = `<strong>Ohne intelligente Steuerung</strong> ${n}`;
  }

  Object.values(inputs).forEach((input) => input.addEventListener('input', () => {
    chips.forEach((c) => { c.classList.remove('is-active'); c.setAttribute('aria-pressed', 'false'); });
    render();
  }));

  chips.forEach((chip) => chip.addEventListener('click', () => {
    const preset = JSON.parse(chip.dataset.preset);
    inputs.h.value = preset.h; inputs.p.value = preset.p; inputs.T.value = preset.t; inputs.s.value = preset.s; inputs.c.value = preset.c;
    inputs.a.value = preset.a ?? 5000; inputs.e.value = preset.e ?? 20;
    chips.forEach((c) => { c.classList.toggle('is-active', c === chip); c.setAttribute('aria-pressed', String(c === chip)); });
    render();
  }));

  render();
})();
