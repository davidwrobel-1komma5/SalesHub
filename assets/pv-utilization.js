(() => {
  const $ = (id) => document.getElementById(id);
  const numberDE = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 0 });
  const decimalDE = new Intl.NumberFormat('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const specificYield = 950;
  const svg = $('utilization-chart');
  const tooltip = $('utilization-tooltip');
  const chartWrap = $('utilization-chart-wrap');
  const chart = { width: 900, height: 430, left: 72, right: 72, top: 32, bottom: 58 };
  const innerWidth = chart.width - chart.left - chart.right;
  const innerHeight = chart.height - chart.top - chart.bottom;

  const interpolateAutarky = (pvRatio, batteryRatio) => {
    const matrix = window.AUTARKY_MATRIX;
    const step = 0.0625;
    const maxIndex = 160;
    const x = clamp(Math.round(pvRatio * 10000) / 10000, 0, maxIndex * step);
    const y = clamp(Math.round(batteryRatio * 10000) / 10000, 0, maxIndex * step);
    const x0 = Math.min(Math.floor(x / step), maxIndex);
    const y0 = Math.min(Math.floor(y / step), maxIndex);
    const x1 = Math.min(x0 + 1, maxIndex);
    const y1 = Math.min(y0 + 1, maxIndex);
    const tx = x1 === x0 ? 0 : (x - x0 * step) / step;
    const ty = y1 === y0 ? 0 : (y - y0 * step) / step;
    const top = matrix[y0 + 1][x0 + 1] + tx * (matrix[y0 + 1][x1 + 1] - matrix[y0 + 1][x0 + 1]);
    const bottom = matrix[y1 + 1][x0 + 1] + tx * (matrix[y1 + 1][x1 + 1] - matrix[y1 + 1][x0 + 1]);
    return top + ty * (bottom - top);
  };

  const energyAt = (pvPower, consumption, storage) => {
    const generation = pvPower * specificYield;
    const pvRatio = pvPower / consumption * 1000;
    const batteryRatio = storage / consumption * 1000;
    const autarky = clamp(interpolateAutarky(pvRatio, batteryRatio), 0, 1);
    const own = Math.min(consumption * autarky, generation);
    return { pvPower, generation, own, feed: Math.max(generation - own, 0), perKwp: own / pvPower };
  };

  const niceMaximum = (value) => Math.ceil(value / 5000) * 5000;
  const path = (points, x, y) => points.map((point, index) => `${index ? 'L' : 'M'}${x(point).toFixed(1)},${y(point).toFixed(1)}`).join(' ');

  const draw = (points, selectedPv) => {
    const maxEnergy = niceMaximum(points[points.length - 1].generation);
    const x = (point) => chart.left + ((point.pvPower - 1) / 29) * innerWidth;
    const yEnergy = (value) => chart.top + innerHeight - (value / maxEnergy) * innerHeight;
    const yUtil = (value) => chart.top + innerHeight - (value / specificYield) * innerHeight;
    const bottomY = chart.top + innerHeight;
    const generationPath = path(points, x, (point) => yEnergy(point.generation));
    const ownPath = path(points, x, (point) => yEnergy(point.own));
    const utilizationPath = path(points, x, (point) => yUtil(point.perKwp));
    const areaGeneration = `${generationPath} L${x(points[points.length - 1])},${bottomY} L${x(points[0])},${bottomY} Z`;
    const areaOwn = `${ownPath} L${x(points[points.length - 1])},${bottomY} L${x(points[0])},${bottomY} Z`;
    const selected = points.reduce((closest, point) => Math.abs(point.pvPower - selectedPv) < Math.abs(closest.pvPower - selectedPv) ? point : closest, points[0]);
    const selectedX = x(selected);
    const grid = [];
    for (let index = 0; index <= 5; index += 1) {
      const value = maxEnergy / 5 * index;
      const utilizationValue = specificYield / 5 * index;
      const y = yEnergy(value);
      grid.push(`<line class="utilization-grid-line" x1="${chart.left}" x2="${chart.width - chart.right}" y1="${y}" y2="${y}"/><text class="utilization-axis-label" x="${chart.left - 12}" y="${y + 4}" text-anchor="end">${value === 0 ? '0' : `${numberDE.format(value / 1000)}k`}</text><text class="utilization-axis-label" x="${chart.width - chart.right + 12}" y="${y + 4}" text-anchor="start">${numberDE.format(utilizationValue)}</text>`);
    }
    const xLabels = [1, 5, 10, 15, 20, 25, 30].map((value) => {
      const point = { pvPower: value };
      return `<text class="utilization-axis-label" x="${x(point)}" y="${chart.height - 25}" text-anchor="middle">${value}</text>`;
    }).join('');
    svg.innerHTML = `
      <g>${grid.join('')}${xLabels}</g>
      <path class="utilization-area-feed" d="${areaGeneration}"/>
      <path class="utilization-area-own" d="${areaOwn}"/>
      <path class="utilization-curve" d="${utilizationPath}"/>
      <text class="utilization-axis-title" x="${chart.left}" y="17">kWh/Jahr</text>
      <text class="utilization-axis-title" x="${chart.width - chart.right}" y="17" text-anchor="end">selbst genutzt je kWp</text>
      <line class="utilization-selection-line" x1="${selectedX}" x2="${selectedX}" y1="${chart.top}" y2="${bottomY}"/>
      <circle class="utilization-selection-dot" cx="${selectedX}" cy="${yEnergy(selected.generation)}" r="6"/>
      <circle class="utilization-selection-dot utilization-selection-dot--line" cx="${selectedX}" cy="${yUtil(selected.perKwp)}" r="6"/>
      <rect class="utilization-hit-area" x="${chart.left}" y="${chart.top}" width="${innerWidth}" height="${innerHeight}"/>
    `;
    svg._chartState = { points, x, maxEnergy };
  };

  const updateResults = (point) => {
    const ownPercent = point.generation ? Math.round(point.own / point.generation * 100) : 0;
    $('util-result-pv').textContent = `${decimalDE.format(point.pvPower)} kWp`;
    $('util-result-generation').textContent = `${numberDE.format(point.generation)} kWh Solarstrom pro Jahr`;
    $('util-result-own').textContent = `${numberDE.format(point.own)} kWh`;
    $('util-result-own-percent').textContent = `${ownPercent} % der Erzeugung`;
    $('util-result-feed').textContent = `${numberDE.format(point.feed)} kWh`;
    $('util-result-feed-percent').textContent = `${100 - ownPercent} % der Erzeugung`;
    $('util-result-per-kwp').textContent = `${numberDE.format(point.perKwp)} kWh`;
  };

  const calculate = () => {
    const consumption = clamp(Number($('util-consumption').value) || 6000, 1000, 20000);
    const storage = clamp(Number($('util-storage').value) || 0, 0, 30);
    const selectedPv = clamp(Number($('util-pv').value) || 10, 1, 30);
    const points = [];
    for (let pv = 1; pv <= 30; pv += 0.5) points.push(energyAt(pv, consumption, storage));
    draw(points, selectedPv);
    updateResults(energyAt(selectedPv, consumption, storage));
  };

  [
    ['util-consumption', 'util-consumption-range'],
    ['util-storage', 'util-storage-range'],
    ['util-pv', 'util-pv-range']
  ].forEach(([inputId, rangeId]) => {
    const input = $(inputId);
    const range = $(rangeId);
    input.addEventListener('input', () => { range.value = input.value; calculate(); });
    range.addEventListener('input', () => { input.value = range.value; calculate(); });
  });

  svg.addEventListener('pointermove', (event) => {
    const state = svg._chartState;
    if (!state) return;
    const bounds = svg.getBoundingClientRect();
    const svgX = (event.clientX - bounds.left) / bounds.width * chart.width;
    const estimatedPv = 1 + clamp((svgX - chart.left) / innerWidth, 0, 1) * 29;
    const point = state.points.reduce((closest, candidate) => Math.abs(candidate.pvPower - estimatedPv) < Math.abs(closest.pvPower - estimatedPv) ? candidate : closest, state.points[0]);
    const ownPercent = Math.round(point.own / point.generation * 100);
    tooltip.innerHTML = `<strong>${decimalDE.format(point.pvPower)} kWp</strong><span>${numberDE.format(point.own)} kWh selbst genutzt</span><span>${numberDE.format(point.feed)} kWh eingespeist</span><span>${numberDE.format(point.perKwp)} kWh je kWp · ${ownPercent} % Eigenverbrauch</span>`;
    tooltip.hidden = false;
    const wrapBounds = chartWrap.getBoundingClientRect();
    const left = clamp(event.clientX - wrapBounds.left + 14, 8, wrapBounds.width - tooltip.offsetWidth - 8);
    const top = clamp(event.clientY - wrapBounds.top - tooltip.offsetHeight - 14, 8, wrapBounds.height - tooltip.offsetHeight - 8);
    tooltip.style.left = `${left}px`;
    tooltip.style.top = `${top}px`;
  });
  svg.addEventListener('pointerleave', () => { tooltip.hidden = true; });
  calculate();
})();
