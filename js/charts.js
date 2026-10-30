// ============================================================================
// GRÁFICAS VECTORIALES (SVG) Y COMPARADOR DE ESCENARIOS EN MODO PRO
// ============================================================================

function renderProCharts(nextRow, simOriginal, simPlan) {
  const scenGrid = document.getElementById('scenarioComparisonGrid');
  const balanceSvgContainer = document.getElementById('svgBalanceChart');
  const donutSvgContainer = document.getElementById('svgDonutChart');
  const anatomyEl = document.getElementById('quotaAnatomyContainer');
  const compEl = document.getElementById('comparisonBarsContainer');

  if (simOriginal.rows.length === 0) {
    scenGrid.innerHTML = '';
    balanceSvgContainer.innerHTML = '<span class="chart-empty-text">Sin datos</span>';
    donutSvgContainer.innerHTML = '<span class="chart-empty-text">Sin datos</span>';
    anatomyEl.innerHTML = '';
    compEl.innerHTML = '';
    return;
  }

  // Comparador automático de 3 escenarios (1. Sin abonos, 2. Plan actual, 3. Un +33% más de pago mensual)
  const simAccel = simulateSchedule(true, 1.3333333);
  scenGrid.innerHTML = `
    <div class="scen-card">
      <h4><span class="scen-accent" style="background:#64748b"></span>1. Solo Cuota Mínima</h4>
      <div class="scen-big">${simOriginal.rows.length} meses · ${fmtCOP(simOriginal.totals.totalPayment)}</div>
      <div class="scen-sub">Ahorro: $0 (Intereses: ${fmtCOP(simOriginal.totals.interest)})</div>
    </div>
    <div class="scen-card scen-active">
      <h4><span class="scen-accent" style="background:#10b981"></span>2. Tu Plan Actual</h4>
      <div class="scen-big">${simPlan.rows.length} meses · ${fmtCOP(simPlan.totals.totalPayment)}</div>
      <div class="scen-sub">Ahorras: <strong>${fmtCOP(Math.max(0, simOriginal.totals.totalPayment - simPlan.totals.totalPayment))}</strong></div>
    </div>
    <div class="scen-card">
      <h4><span class="scen-accent" style="background:#3b82f6"></span>3. Plan Acelerado (+33% aporte)</h4>
      <div class="scen-big">${simAccel.rows.length} meses · ${fmtCOP(simAccel.totals.totalPayment)}</div>
      <div class="scen-sub">Ahorrarías: <strong>${fmtCOP(Math.max(0, simOriginal.totals.totalPayment - simAccel.totals.totalPayment))}</strong></div>
    </div>
  `;

  // Gráfico SVG Curva de Saldo
  const w = 460, h = 195, padL = 56, padR = 16, padT = 14, padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;
  const maxM = Math.max(1, simOriginal.rows.length);
  const maxBal = Math.max(1, simOriginal.totalDisbursed);

  const toPoints = (rows) => {
    const pts = [`${padL},${padT}`];
    rows.forEach((r) => {
      const x = padL + (r.month / maxM) * plotW;
      const y = padT + plotH - (r.endingBalance / maxBal) * plotH;
      pts.push(`${x.toFixed(1)},${y.toFixed(1)}`);
    });
    return pts.join(' ');
  };

  balanceSvgContainer.innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" width="100%" height="195">
      <line x1="${padL}" y1="${padT}" x2="${padL}" y2="${padT + plotH}" stroke="#475569" />
      <line x1="${padL}" y1="${padT + plotH}" x2="${padL + plotW}" y2="${padT + plotH}" stroke="#475569" />
      <text x="${padL - 6}" y="${padT + 10}" fill="currentColor" font-size="12" text-anchor="end">${(maxBal / 1e6).toFixed(1)}M</text>
      <text x="${padL - 6}" y="${padT + plotH / 2}" fill="currentColor" font-size="12" text-anchor="end">${(maxBal / 2e6).toFixed(1)}M</text>
      <text x="${padL - 6}" y="${padT + plotH}" fill="currentColor" font-size="12" text-anchor="end">$0</text>
      <text x="${padL}" y="${h - 6}" fill="currentColor" font-size="12">Mes 0</text>
      <text x="${padL + (simPlan.rows.length / maxM) * plotW}" y="${h - 6}" fill="currentColor" font-size="12" font-weight="600" text-anchor="middle">Mes ${simPlan.rows.length}</text>
      <text x="${padL + plotW}" y="${h - 6}" fill="currentColor" font-size="12" text-anchor="end">Mes ${maxM}</text>
      <polyline fill="none" stroke="#64748b" stroke-width="2" stroke-dasharray="4,4" points="${toPoints(simOriginal.rows)}" />
      <polyline fill="none" stroke="#10b981" stroke-width="3" points="${toPoints(simPlan.rows)}" />
    </svg>
  `;

  // Gráfico Dona SVG
  const capVal = simPlan.totals.totalCap;
  const intVal = simPlan.totals.interest;
  const insVal = simPlan.totals.insAndFees;
  const sumAll = Math.max(1, capVal + intVal + insVal);

  const slices = [
    { label: 'Capital', val: capVal, color: '#2563eb' },
    { label: 'Intereses', val: intVal, color: '#e11d48' },
    { label: 'Seguros', val: insVal, color: '#d97706' }
  ];

  const rDonut = 56;
  const circ = 2 * Math.PI * rDonut;
  let offset = 0;
  const circlesSvg = slices.map((s) => {
    const len = (s.val / sumAll) * circ;
    const tag = `<circle cx="80" cy="90" r="${rDonut}" fill="transparent" stroke="${s.color}" stroke-width="20" stroke-dasharray="${len} ${circ - len}" stroke-dashoffset="${-offset}" transform="rotate(-90 80 90)" />`;
    offset += len;
    return tag;
  }).join('');

  const legendHtml = slices.map((s) => {
    const pct = ((s.val / sumAll) * 100).toFixed(1);
    return `
      <div class="donut-legend-row">
        <span><span class="dot-color" style="background:${s.color}"></span>${s.label}</span>
        <strong>${pct}% (${fmtCOP(s.val)})</strong>
      </div>
    `;
  }).join('');

  donutSvgContainer.innerHTML = `
    <div style="display:flex;align-items:center;gap:12px;width:100%;">
      <svg viewBox="0 0 160 180" width="145" height="165">
        ${circlesSvg}
        <text x="80" y="86" fill="currentColor" font-size="12" font-weight="bold" text-anchor="middle">Total</text>
        <text x="80" y="104" fill="currentColor" font-size="12" font-weight="bold" text-anchor="middle">${(sumAll / 1e6).toFixed(1)}M</text>
      </svg>
      <div style="flex:1;">${legendHtml}</div>
    </div>
  `;

  if (nextRow) {
    const tot = Math.max(1, nextRow.totalPayment);
    const items = [
      { label: 'Abono Extra a Capital', val: nextRow.extraCap, color: '#10b981' },
      { label: 'Capital Ordinario', val: nextRow.scheduledCap, color: '#2563eb' },
      { label: 'Intereses del Mes', val: nextRow.interest, color: '#e11d48' },
      { label: 'Seguros y Cargos', val: nextRow.insAndFees, color: '#d97706' }
    ];
    anatomyEl.innerHTML = items.map((it) => {
      const pct = ((it.val / tot) * 100).toFixed(1);
      return `
        <div class="stat-bar-row">
          <div class="stat-bar-top">
            <span>${it.label}</span>
            <strong>${fmtCOP(it.val)} (${pct}%)</strong>
          </div>
          <div class="stat-bar-track">
            <div class="stat-bar-fill" style="width:${pct}%;background:${it.color}"></div>
          </div>
        </div>
      `;
    }).join('');
  }

  const maxCost = Math.max(1, simOriginal.totals.totalPayment, simPlan.totals.totalPayment);
  const origPct = ((simOriginal.totals.totalPayment / maxCost) * 100).toFixed(1);
  const planPct = ((simPlan.totals.totalPayment / maxCost) * 100).toFixed(1);

  compEl.innerHTML = `
    <div class="stat-bar-row">
      <div class="stat-bar-top">
        <span>Plan Banco (${simOriginal.rows.length} meses)</span>
        <strong>${fmtCOP(simOriginal.totals.totalPayment)}</strong>
      </div>
      <div class="stat-bar-track" style="height:10px;">
        <div class="stat-bar-fill" style="width:${origPct}%;background:#64748b"></div>
      </div>
    </div>
    <div class="stat-bar-row">
      <div class="stat-bar-top">
        <span>Tu Estrategia (${simPlan.rows.length} meses)</span>
        <strong class="text-emerald">${fmtCOP(simPlan.totals.totalPayment)}</strong>
      </div>
      <div class="stat-bar-track" style="height:10px;">
        <div class="stat-bar-fill" style="width:${planPct}%;background:#10b981"></div>
      </div>
    </div>
  `;
}
