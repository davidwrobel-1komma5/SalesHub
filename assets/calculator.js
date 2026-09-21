const periods = [
  { label: '21.07.2026', cost: 28000, climate: 16 },
  { label: '01.02.2027', cost: 27250, climate: 12 },
  { label: '01.08.2027', cost: 26500, climate: 8 },
  { label: '01.02.2028', cost: 25750, climate: 4 },
  { label: '01.08.2028', cost: 25000, climate: 0 },
  { label: '01.02.2029', cost: 24250, climate: 0 },
  { label: '01.08.2029', cost: 23500, climate: 0 },
  { label: '01.02.2030', cost: 22750, climate: 0 },
  { label: '01.08.2030', cost: 22000, climate: 0 },
  { label: '2031', cost: 22000, climate: 0 },
];

const euro = new Intl.NumberFormat('de-DE', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
const numberValue = (id) => Math.max(0, Number(document.getElementById(id).value) || 0);

function calculate() {
  const period = periods[Number(document.getElementById('period').value)];
  const units = Number(document.getElementById('units').value);
  const investment = numberValue('investment');
  const income = numberValue('income');
  const family = document.getElementById('family').checked;
  const climateEligible = document.getElementById('climate').checked;

  const thresholdAdjustment = family ? 10000 : 0;
  const incomeBonus = income <= 30000 + thresholdAdjustment ? 40
    : income <= 40000 + thresholdAdjustment ? 30
    : income <= 50000 + thresholdAdjustment ? 10 : 0;
  const climateBonus = climateEligible ? period.climate : 0;
  const maximumCost = period.cost + ((units - 1) * 15000);
  const eligibleCost = Math.min(investment, maximumCost);
  const firstUnitShare = eligibleCost / units;
  const baseGrant = eligibleCost * 0.30;
  const cap = income <= 30000 + thresholdAdjustment ? 80 : 70;
  const firstUnitRate = Math.min(cap, 30 + climateBonus + incomeBonus);
  const bonusGrant = firstUnitShare * ((firstUnitRate - 30) / 100);
  const totalGrant = baseGrant + bonusGrant;
  const averageRate = eligibleCost ? Math.round((totalGrant / eligibleCost) * 100) : 0;
  const net = Math.max(0, investment - totalGrant);

  document.getElementById('period-value').value = period.label;
  document.getElementById('period-value').textContent = period.label;
  document.getElementById('result-heading').textContent = euro.format(totalGrant);
  document.getElementById('result-rate').textContent = `${averageRate} % mittlere Quote`;
  document.getElementById('result-basis').textContent = euro.format(eligibleCost);
  document.getElementById('result-base').textContent = euro.format(baseGrant);
  document.getElementById('result-climate').textContent = `${climateBonus} %`;
  document.getElementById('result-income').textContent = `${incomeBonus} %`;
  document.getElementById('result-investment').textContent = euro.format(investment);
  document.getElementById('result-net').textContent = euro.format(net);
  document.getElementById('assumption-climate').textContent = `${climateBonus} %`;
  document.getElementById('assumption-income').textContent = `${incomeBonus} %`;
  document.getElementById('assumption-basis').textContent = euro.format(maximumCost);

  const capNotice = investment > maximumCost ? ` Von den eingegebenen Kosten werden höchstens ${euro.format(maximumCost)} berücksichtigt.` : '';
  const unitNotice = units > 1 ? ` Zusatzboni werden in dieser vereinfachten Berechnung anteilig für die erste von ${units} Wohneinheiten angesetzt.` : '';
  document.getElementById('result-explanation').textContent = `Die Grundförderung beträgt 30 %. Für die gewählte Konfiguration werden ${climateBonus} % Klimageschwindigkeitsbonus und ${incomeBonus} % Einkommensbonus berücksichtigt.${capNotice}${unitNotice}`;
}

document.getElementById('calculator-form').addEventListener('input', calculate);
document.getElementById('print-result').addEventListener('click', () => window.print());
document.querySelectorAll('[data-adjust]').forEach((button) => {
  button.addEventListener('click', () => {
    const input = document.getElementById(button.dataset.adjust);
    input.value = Math.max(0, (Number(input.value) || 0) + Number(button.dataset.step));
    calculate();
    input.focus();
  });
});

calculate();
