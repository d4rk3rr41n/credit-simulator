// ============================================================================
// RENDERIZADO DE INTERFAZ Y MANEJADORES DE EVENTOS
// ============================================================================

function updateMonthlyChargesSummaryBar() {
  const labelEl = document.getElementById('totalMonthlyChargesLabel');
  const valEl = document.getElementById('totalMonthlyChargesDisplay');
  if (!valEl) return;

  const maxTerm = Math.max(1, parseInt(state.termMonths, 10) || 72);
  const firstSum = getChargesSumForMonth(1, maxTerm);
  const lastSum = getChargesSumForMonth(maxTerm, maxTerm);

  let hasStages = firstSum !== lastSum;
  if (!hasStages) {
    hasStages = state.monthlyCharges.some(
      (c) => c.active && ((parseInt(c.fromMonth, 10) || 1) > 1 || (!c.untilEnd && (parseInt(c.untilMonth, 10) || maxTerm) < maxTerm))
    );
  }

  if (hasStages) {
    if (labelEl) labelEl.textContent = 'Seguros por etapa:';
    valEl.textContent = `Inicio: ${fmtCOP(firstSum)}/mes → Final: ${fmtCOP(lastSum)}/mes`;
  } else {
    if (labelEl) labelEl.textContent = 'Seguros Mensuales:';
    valEl.textContent = `${fmtCOP(firstSum)} / mes`;
  }
}

function renderDynamicInputs() {
  // 1. Seguros / Cobros con selección de mes/cuota de inicio y fin
  const chargesEl = document.getElementById('monthlyChargesList');
  chargesEl.innerHTML = '';

  const baseTerm = Math.max(1, parseInt(state.termMonths, 10) || 72);
  const maxChargeBound = state.monthlyCharges.reduce(
    (mx, c) => Math.max(mx, parseInt(c.fromMonth, 10) || 1, c.untilEnd ? baseTerm : (parseInt(c.untilMonth, 10) || baseTerm)),
    baseTerm
  );

  state.monthlyCharges.forEach((ch) => {
    const fromM = Math.max(1, parseInt(ch.fromMonth, 10) || 1);
    const untilEnd = Boolean(ch.untilEnd);
    const untilM = untilEnd ? maxChargeBound : Math.max(fromM, parseInt(ch.untilMonth, 10) || maxChargeBound);

    let fromOptionsHtml = '';
    for (let m = 1; m <= maxChargeBound; m++) {
      const dLabel = getQuotaDateInfo(state.startDate, m).label;
      fromOptionsHtml += `<option value="${m}" ${m === fromM ? 'selected' : ''}>#${m} · ${dLabel}</option>`;
    }

    const endDateLabel = getQuotaDateInfo(state.startDate, baseTerm).label;
    let untilOptionsHtml = `<option value="end" ${untilEnd ? 'selected' : ''}>Hasta el final (#${baseTerm} · ${endDateLabel})</option>`;
    for (let m = fromM; m <= maxChargeBound; m++) {
      const dLabel = getQuotaDateInfo(state.startDate, m).label;
      const isSel = !untilEnd && m === untilM;
      untilOptionsHtml += `<option value="${m}" ${isSel ? 'selected' : ''}>#${m} · ${dLabel}</option>`;
    }

    const div = document.createElement('div');
    div.className = `charge-item${ch.active ? '' : ' charge-inactive'}`;
    div.innerHTML = `
      <div class="charge-top-row">
        <input type="checkbox" class="ch-toggle" data-id="${ch.id}" ${ch.active ? 'checked' : ''} title="Activar o desactivar este seguro" />
        <input type="text" class="charge-name" data-id="${ch.id}" value="${ch.name}" placeholder="Nombre del seguro o cargo" />
        <input type="text" class="charge-amount" data-id="${ch.id}" value="${fmtNum(ch.amount)}" title="Valor mensual ($)" placeholder="0" />
        <button type="button" class="btn btn-ghost btn-xs ch-remove" data-id="${ch.id}" title="Eliminar">${ICON.x}</button>
      </div>
      <div class="charge-range-row">
        <div class="form-group">
          <label>Desde (Mes / Cuota)</label>
          <select class="charge-from" data-id="${ch.id}">${fromOptionsHtml}</select>
        </div>
        <div class="form-group">
          <label>Hasta (Mes / Cuota)</label>
          <select class="charge-until" data-id="${ch.id}">${untilOptionsHtml}</select>
        </div>
      </div>
    `;
    chargesEl.appendChild(div);
  });

  updateMonthlyChargesSummaryBar();

  chargesEl.querySelectorAll('.ch-toggle').forEach((el) => {
    el.addEventListener('change', (e) => {
      const item = state.monthlyCharges.find((c) => c.id === Number(e.target.dataset.id));
      if (item) item.active = e.target.checked;
      recalcAndRender(true);
    });
  });

  chargesEl.querySelectorAll('.charge-name').forEach((el) => {
    el.addEventListener('input', (e) => {
      const item = state.monthlyCharges.find((c) => c.id === Number(e.target.dataset.id));
      if (item) item.name = e.target.value;
      saveToLocalStorage();
    });
  });

  chargesEl.querySelectorAll('.charge-amount').forEach((el) => {
    el.addEventListener('input', (e) => {
      const val = parseMoney(e.target.value);
      e.target.value = fmtNum(val);
      const item = state.monthlyCharges.find((c) => c.id === Number(e.target.dataset.id));
      if (item) item.amount = val;
      updateMonthlyChargesSummaryBar();
      recalcAndRender(false);
    });
  });

  chargesEl.querySelectorAll('.charge-from').forEach((el) => {
    el.addEventListener('change', (e) => {
      const item = state.monthlyCharges.find((c) => c.id === Number(e.target.dataset.id));
      if (item) {
        const newFrom = Math.max(1, parseInt(e.target.value, 10) || 1);
        item.fromMonth = newFrom;
        if (!item.untilEnd && (parseInt(item.untilMonth, 10) || 1) < newFrom) {
          item.untilMonth = newFrom;
        }
      }
      recalcAndRender(true);
    });
  });

  chargesEl.querySelectorAll('.charge-until').forEach((el) => {
    el.addEventListener('change', (e) => {
      const item = state.monthlyCharges.find((c) => c.id === Number(e.target.dataset.id));
      if (item) {
        if (e.target.value === 'end') {
          item.untilEnd = true;
          item.untilMonth = Math.max(item.fromMonth || 1, parseInt(state.termMonths, 10) || 72);
        } else {
          item.untilEnd = false;
          item.untilMonth = Math.max(item.fromMonth || 1, parseInt(e.target.value, 10) || 1);
        }
      }
      recalcAndRender(true);
    });
  });

  chargesEl.querySelectorAll('.ch-remove').forEach((el) => {
    el.addEventListener('click', (e) => {
      const id = Number(e.currentTarget.dataset.id);
      state.monthlyCharges = state.monthlyCharges.filter((c) => c.id !== id);
      recalcAndRender(true);
    });
  });

  // 2. Participantes
  const partEl = document.getElementById('participantsContainer');
  partEl.innerHTML = '';
  const isBudgetMode = state.extraPaymentMode === 'total_budget';
  const isTargetMode = state.splitMode === 'by_target_pct';

  state.participants.forEach((p, idx) => {
    const color = COLORS[idx % COLORS.length];
    const card = document.createElement('div');
    card.className = 'participant-card';
    card.innerHTML = `
      <div class="participant-header">
        <div class="participant-title-wrap">
          <span class="dot-color" style="background:${color}"></span>
          <input type="text" class="participant-name-input p-name" data-id="${p.id}" value="${p.name}" placeholder="Nombre" />
        </div>
        ${state.participants.length > 1 ? `<button type="button" class="btn btn-ghost btn-xs p-remove" data-id="${p.id}" title="Quitar persona">${ICON.x}</button>` : ''}
      </div>
      <div class="participant-grid">
        <div class="form-group">
          <label>Cuota Inicial ($)</label>
          <input type="text" class="p-down" data-id="${p.id}" value="${fmtNum(p.downPayment)}" />
        </div>
        <div class="form-group">
          <label>Aporte en Papeles ($)</label>
          <input type="text" class="p-reg" data-id="${p.id}" value="${fmtNum(p.regContribution)}" />
        </div>
        <div class="form-group">
          <label>${isBudgetMode ? 'Pago Mensual ($)' : 'Abono Extra Mes ($)'}</label>
          <input type="text" class="p-monthly" data-id="${p.id}" value="${fmtNum(p.monthlyInput)}" />
        </div>
        <div class="form-group">
          <label>${isTargetMode ? '% Propiedad Deseado' : '% Cuota Obligatoria'}</label>
          <input type="number" class="p-pct" data-id="${p.id}" step="0.1" min="0" max="100" value="${isTargetMode ? p.targetOwnershipPct : p.mandatorySharePct}" />
        </div>
        <div class="form-group full-width pro-only">
          <label>Abono Extra Semestral Prima Jun/Dic ($)</label>
          <input type="text" class="p-bonus" data-id="${p.id}" value="${fmtNum(p.semiAnnualBonus || 0)}" placeholder="0" />
        </div>
      </div>
    `;
    partEl.appendChild(card);
  });

  partEl.querySelectorAll('.p-name').forEach((el) => {
    el.addEventListener('input', (e) => {
      const p = state.participants.find((x) => x.id === Number(e.target.dataset.id));
      if (p) p.name = e.target.value;
      recalcAndRender(false);
    });
  });

  partEl.querySelectorAll('.p-down').forEach((el) => {
    el.addEventListener('input', (e) => {
      const p = state.participants.find((x) => x.id === Number(e.target.dataset.id));
      const val = parseMoney(e.target.value);
      e.target.value = fmtNum(val);
      if (p) p.downPayment = val;
      recalcAndRender(false);
    });
  });

  partEl.querySelectorAll('.p-reg').forEach((el) => {
    el.addEventListener('input', (e) => {
      const p = state.participants.find((x) => x.id === Number(e.target.dataset.id));
      const val = parseMoney(e.target.value);
      e.target.value = fmtNum(val);
      if (p) p.regContribution = val;
      recalcAndRender(false);
    });
  });

  partEl.querySelectorAll('.p-monthly').forEach((el) => {
    el.addEventListener('input', (e) => {
      const p = state.participants.find((x) => x.id === Number(e.target.dataset.id));
      const val = parseMoney(e.target.value);
      e.target.value = fmtNum(val);
      if (p) p.monthlyInput = val;
      recalcAndRender(false);
    });
  });

  partEl.querySelectorAll('.p-bonus').forEach((el) => {
    el.addEventListener('input', (e) => {
      const p = state.participants.find((x) => x.id === Number(e.target.dataset.id));
      const val = parseMoney(e.target.value);
      e.target.value = fmtNum(val);
      if (p) p.semiAnnualBonus = val;
      recalcAndRender(false);
    });
  });

  partEl.querySelectorAll('.p-pct').forEach((el) => {
    el.addEventListener('input', (e) => {
      const p = state.participants.find((x) => x.id === Number(e.target.dataset.id));
      const val = parseFloat(e.target.value) || 0;
      if (p) {
        if (state.splitMode === 'by_target_pct') {
          p.targetOwnershipPct = val;
        } else {
          p.mandatorySharePct = val;
        }
      }
      recalcAndRender(false);
    });
  });

  partEl.querySelectorAll('.p-remove').forEach((el) => {
    el.addEventListener('click', (e) => {
      const id = Number(e.currentTarget.dataset.id);
      state.participants = state.participants.filter((x) => x.id !== id);
      recalcAndRender(true);
    });
  });
}

function syncTopInputsFromState() {
  document.getElementById('loanType').value = state.loanType;
  document.getElementById('assetValue').value = fmtNum(state.assetValue);
  document.getElementById('financedBase').value = fmtNum(state.financedBase);
  document.getElementById('initialExtraCosts').value = fmtNum(state.initialExtraCosts);
  document.getElementById('financedUpfrontIns').value = fmtNum(state.financedUpfrontIns);
  document.getElementById('upfrontInsMonths').value = state.upfrontInsMonths;
  document.getElementById('termMonths').value = state.termMonths;
  document.getElementById('startDate').value = state.startDate;
  document.getElementById('rateMV').value = state.rateMV;
  document.getElementById('rateEA').value = state.rateEA;
  document.getElementById('quota1ExtraFee').value = fmtNum(state.quota1ExtraFee);
  document.getElementById('quota1InterestAdjust').value = fmtNum(state.quota1InterestAdjust);
  document.getElementById('extraStartQuota').value = state.extraStartQuota;
  document.getElementById('extraPaymentMode').value = state.extraPaymentMode;
  document.getElementById('splitMode').value = state.splitMode;
  document.getElementById('includeRegistrationInAsset').checked = state.includeRegistrationInAsset;
  document.getElementById('fairInternalDebtToggle').checked = state.fairInternalDebt !== false;
  document.getElementById('showPerPersonColumnsToggle').checked = Boolean(state.showPerPersonColumns);

  if (document.getElementById('refiAfterMonth')) {
    document.getElementById('refiAfterMonth').value = state.refiAfterMonth || 12;
    document.getElementById('refiNewTermMonths').value = state.refiNewTermMonths || 48;
    document.getElementById('refiNewRateMV').value = state.refiNewRateMV ?? 1.25;
    document.getElementById('refiNewRateEA').value = state.refiNewRateEA ?? 16.08;
    document.getElementById('refiNewMonthlyIns').value = fmtNum(state.refiNewMonthlyIns ?? 120000);
    document.getElementById('refiClosingCosts').value = fmtNum(state.refiClosingCosts ?? 0);
  }

  document.querySelectorAll('input[name="extraStrategy"]').forEach((r) => {
    r.checked = r.value === state.extraStrategy;
  });
  document.getElementById('labelStrategyTerm').classList.toggle('active', state.extraStrategy === 'reduce_term');
  document.getElementById('labelStrategyQuota').classList.toggle('active', state.extraStrategy === 'reduce_quota');
}

function renderRefinancingSection(simPlan, simOriginal) {
  const box = document.getElementById('refiSummaryBox');
  if (!box) return;

  const refi = simulateRefinancing(simPlan, simOriginal, state);
  if (!refi) {
    box.innerHTML = `<span class="refi-muted">Ingresa primero los datos de tu crédito para simular una compra de cartera.</span>`;
    return;
  }

  if (refi.alreadyPaidOff) {
    box.innerHTML = `<span class="refi-muted">En la cuota #${refi.afterMonth} tu crédito ya estaría pagado por completo ($0 de saldo).</span>`;
    return;
  }

  const diffMin = refi.savingsMinVsOriginalBank;
  const diffAccel = refi.savingsAccelVsCurrentPlan;

  box.innerHTML = `
    <div class="refi-grid">
      <div class="refi-metric">
        <span class="refi-label">Saldo a trasladar (Cuota #${refi.afterMonth})</span>
        <strong class="refi-val">${fmtCOP(refi.balanceToTransfer)}</strong>
      </div>
      <div class="refi-metric">
        <span class="refi-label">Nueva Cuota Mínima Banco</span>
        <strong class="refi-val">${fmtCOP(refi.newMandatoryQuota)}/mes</strong>
      </div>
      <div class="refi-metric">
        <span class="refi-label">Si pagas solo cuota mínima nueva</span>
        <strong class="refi-val ${diffMin >= 0 ? 'text-emerald' : ''}">
          ${diffMin >= 0 ? `Ahorras ${fmtCOP(diffMin)}` : `+${fmtCOP(Math.abs(diffMin))} más caro`}
        </strong>
        <span class="refi-sub">Frente al banco original (${refi.totalMonthsMin} meses totales)</span>
      </div>
      <div class="refi-metric">
        <span class="refi-label">Si mantienes tu abono mensual actual</span>
        <strong class="refi-val ${diffAccel >= 0 ? 'text-emerald' : ''}">
          ${diffAccel >= 0 ? `Ahorras ${fmtCOP(diffAccel)} extra` : `Diferencia: ${fmtCOP(diffAccel)}`}
        </strong>
        <span class="refi-sub">Terminas en la cuota #${refi.totalMonthsAccel} (${refi.newBankAccelMonths} m en nuevo banco)</span>
      </div>
    </div>
  `;
}

function recalcAndRender(rebuildSideLists = false) {
  if (rebuildSideLists) {
    renderDynamicInputs();
  }

  saveToLocalStorage();
  if (typeof pushHistorySnapshot === 'function') {
    pushHistorySnapshot();
  }

  const downPaymentCalc = Math.max(0, (Number(state.assetValue) || 0) - (Number(state.financedBase) || 0));
  document.getElementById('downPaymentCalculated').textContent = `Inicial: ${fmtCOP(downPaymentCalc)}`;
  document.getElementById('totalAcquisitionDisplay').value =
    fmtCOP((Number(state.assetValue) || 0) + (Number(state.initialExtraCosts) || 0));
  const totalDisb = (Number(state.financedBase) || 0) + (Number(state.financedUpfrontIns) || 0);
  document.getElementById('totalDisbursedDisplay').value = fmtCOP(totalDisb);

  const simOriginal = simulateSchedule(false);
  const simPlan = simulateSchedule(true);

  const origMonths = simOriginal.rows.length;
  const planMonths = simPlan.rows.length;
  const monthsSaved = Math.max(0, origMonths - planMonths);

  const origTotalPaid = simOriginal.totals.totalPayment;
  const planTotalPaid = simPlan.totals.totalPayment;
  const totalSavings = Math.max(0, origTotalPaid - planTotalPaid);
  const savingsPct = origTotalPaid > 0 ? ((totalSavings / origTotalPaid) * 100).toFixed(1) : '0';

  const lastRow = simPlan.rows[simPlan.rows.length - 1];
  const nextRow = simPlan.rows.find((r) => !state.paidMonths[r.month]) || simPlan.rows[Math.min(1, simPlan.rows.length - 1)] || simPlan.rows[0];
  const paidCount = simPlan.rows.filter((r) => state.paidMonths[r.month]).length;

  document.getElementById('kpiFinalMonths').textContent = planMonths > 0
    ? `${planMonths} meses (${(planMonths / 12).toFixed(1)} años)`
    : '0 meses';
  document.getElementById('kpiMonthsSavedTag').textContent = monthsSaved > 0 ? `-${monthsSaved} cuotas` : 'Sin reducción';
  document.getElementById('kpiFinalDate').textContent = lastRow
    ? `Termina en ${lastRow.dateLabel} (vs. ${origMonths} m)`
    : 'Plazo original: 0 meses';

  document.getElementById('kpiTotalSavings').textContent = fmtCOP(totalSavings);
  document.getElementById('kpiSavingsPercent').textContent = `${savingsPct}% menos`;
  const intSaved = Math.max(0, simOriginal.totals.interest - simPlan.totals.interest);
  const insSaved = Math.max(0, simOriginal.totals.insAndFees - simPlan.totals.insAndFees);
  document.getElementById('kpiSavingsBreakdown').textContent =
    `Intereses: ${fmtCOP(intSaved)} · Seguros: ${fmtCOP(insSaved)}`;

  document.getElementById('kpiTotalCreditPaid').textContent = fmtCOP(planTotalPaid);
  document.getElementById('kpiOriginalCostTag').textContent = `Banco: ${fmtCOP(origTotalPaid)}`;
  document.getElementById('kpiInterestAndIns').textContent =
    `Intereses: ${fmtCOP(simPlan.totals.interest)} · Seguros: ${fmtCOP(simPlan.totals.insAndFees)}`;
  document.getElementById('kpiProgressSimple').textContent =
    `Cuotas pagadas: ${paidCount} de ${planMonths}`;

  if (nextRow) {
    const capRatio = nextRow.totalPayment > 0 ? ((nextRow.totalCap / nextRow.totalPayment) * 100).toFixed(1) : '0.0';
    document.getElementById('kpiNextTotalPayment').textContent = fmtCOP(nextRow.totalPayment);
    document.getElementById('kpiCapitalRatioTag').textContent = `${capRatio}% a capital`;
    document.getElementById('kpiNextQuotaBreakdown').textContent =
      `Cuota #${nextRow.month}: ${fmtCOP(nextRow.mandatoryQuota)} + Extra: ${fmtCOP(nextRow.extraCap)}`;
  } else {
    document.getElementById('kpiNextTotalPayment').textContent = '$0';
    document.getElementById('kpiCapitalRatioTag').textContent = '0% a capital';
    document.getElementById('kpiNextQuotaBreakdown').textContent = 'Cuota: $0 + Extra: $0';
  }

  renderOwnershipSection(simPlan);
  renderProCharts(nextRow, simOriginal, simPlan);
  renderRefinancingSection(simPlan, simOriginal);
  renderAmortizationTable(simPlan);
}

function renderOwnershipSection(simPlan) {
  const { stats, totalCapitalBasis, totalOutPocketBasis } = calculateParticipantsBreakdown(simPlan);
  const barEl = document.getElementById('ownershipBarCapital');
  const tbody = document.getElementById('participantsSummaryBody');
  const tfoot = document.getElementById('participantsSummaryFoot');
  const eqBox = document.getElementById('equalizeBox');

  document.getElementById('totalAssetBaseLabel').textContent = `Base: ${fmtCOP(totalCapitalBasis)}`;
  barEl.innerHTML = '';
  tbody.innerHTML = '';

  stats.forEach((p) => {
    const seg = document.createElement('div');
    seg.className = 'ownership-segment';
    seg.style.width = `${Math.max(2, p.ownershipByCapitalPct)}%`;
    seg.style.background = p.color;
    seg.textContent = `${p.name}: ${p.ownershipByCapitalPct.toFixed(1)}%`;
    barEl.appendChild(seg);

    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>
        <span class="dot-color" style="background:${p.color}"></span>
        <strong>${p.name}</strong>
      </td>
      <td class="num">${fmtCOP(p.rawInitialOutPocket)}</td>
      <td class="num">${fmtCOP(p.month2Payment)}</td>
      <td class="num pro-only">${fmtCOP(p.creditCapitalPaid)}</td>
      <td class="num pro-only">${fmtCOP(p.interestAndInsPaid)}</td>
      <td class="num"><strong>${fmtCOP(p.totalOutOfPocket)}</strong></td>
      <td class="num"><span class="kpi-tag tag-blue">${p.ownershipByCapitalPct.toFixed(2)}%</span></td>
      <td class="num pro-only"><span class="kpi-tag tag-green">${p.ownershipByPocketPct.toFixed(2)}%</span></td>
    `;
    tbody.appendChild(tr);
  });

  const sumInit = stats.reduce((s, p) => s + p.rawInitialOutPocket, 0);
  const sumM2 = stats.reduce((s, p) => s + p.month2Payment, 0);
  const sumCap = stats.reduce((s, p) => s + p.creditCapitalPaid, 0);
  const sumIntIns = stats.reduce((s, p) => s + p.interestAndInsPaid, 0);

  tfoot.innerHTML = `
    <tr>
      <td>TOTAL (${stats.length})</td>
      <td class="num">${fmtCOP(sumInit)}</td>
      <td class="num">${fmtCOP(sumM2)}</td>
      <td class="num pro-only">${fmtCOP(sumCap)}</td>
      <td class="num pro-only">${fmtCOP(sumIntIns)}</td>
      <td class="num">${fmtCOP(totalOutPocketBasis)}</td>
      <td class="num">100%</td>
      <td class="num pro-only">100%</td>
    </tr>
  `;

  if (totalCapitalBasis <= 0) {
    eqBox.innerHTML = `Ingresa datos o importa un CSV para ver el análisis de equilibrio entre socios.`;
  } else if (stats.length === 2) {
    const [p1, p2] = stats;
    const diffCap = Math.abs(p1.totalCapitalContributed - p2.totalCapitalContributed);
    if (diffCap < 100) {
      eqBox.innerHTML = `<strong>Participación 50% / 50% exacta:</strong> Ambos aportan el mismo capital (${fmtCOP(p1.totalCapitalContributed)} c/u).`;
    } else {
      const leader = p1.totalCapitalContributed > p2.totalCapitalContributed ? p1 : p2;
      const follower = p1.totalCapitalContributed > p2.totalCapitalContributed ? p2 : p1;
      eqBox.innerHTML = `
        <strong>Equilibrio:</strong> <strong>${leader.name}</strong> aporta <strong>${fmtCOP(diffCap)}</strong> más de capital que <strong>${follower.name}</strong>.
        Para quedar 50/50, <strong>${follower.name}</strong> puede compensar directamente con <strong>${fmtCOP(diffCap / 2)}</strong> o abonar <strong>${fmtCOP(diffCap)}</strong> extra al crédito.
      `;
    }
  } else {
    eqBox.innerHTML = `Participación calculada entre ${stats.length} personas.`;
  }
}

function renderAmortizationTable(simPlan) {
  const thead = document.getElementById('amortizationHead');
  const tbody = document.getElementById('amortizationBody');
  const tfoot = document.getElementById('amortizationFoot');

  const showPersonCols = Boolean(state.showPerPersonColumns) && document.body.classList.contains('mode-pro');
  const personHeaders = showPersonCols
    ? state.participants.map((p, i) => `<th class="num"><span class="dot-color" style="background:${COLORS[i % COLORS.length]}"></span>Pago ${p.name}</th>`).join('')
    : '';

  thead.innerHTML = `
    <tr>
      <th class="no-print" title="Marcar cuota como pagada">${ICON.check}</th>
      <th>#</th>
      <th>Fecha</th>
      <th class="num">Cuota Base</th>
      <th class="num pro-only">Intereses</th>
      <th class="num pro-only">Seguros</th>
      <th class="num pro-only">Capital Ord.</th>
      <th class="num">Abono Extra Capital</th>
      ${personHeaders}
      <th class="num">Pago Total Mes</th>
      <th class="num pro-only">Total a Capital</th>
      <th class="num">Saldo Restante</th>
    </tr>
  `;

  tbody.innerHTML = '';

  if (simPlan.rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="12" class="table-empty-cell">Ingresa el monto financiado y el número de cuotas o importa un archivo CSV.</td></tr>`;
    tfoot.innerHTML = '';
    return;
  }

  simPlan.rows.forEach((r) => {
    const isPaid = Boolean(state.paidMonths[r.month]);
    const tr = document.createElement('tr');
    if (isPaid) tr.className = 'row-paid';

    const personCells = showPersonCols
      ? r.perPerson.map((pp) => `<td class="num">${fmtCOP(pp.totalPay)}</td>`).join('')
      : '';

    const customBadge = r.hasCustomExtra ? '<span class="custom-mark" title="Abono puntual personalizado"></span>' : '';

    tr.innerHTML = `
      <td class="no-print"><input type="checkbox" class="row-paid-check" data-month="${r.month}" ${isPaid ? 'checked' : ''} /></td>
      <td><strong>#${r.month}</strong></td>
      <td>${r.dateLabel}</td>
      <td class="num">${fmtCOP(r.mandatoryQuota)}</td>
      <td class="num pro-only">${fmtCOP(r.interest)}</td>
      <td class="num pro-only">${fmtCOP(r.insAndFees)}</td>
      <td class="num pro-only">${fmtCOP(r.scheduledCap)}</td>
      <td class="num">
        <button type="button" class="btn-extra-person" data-month="${r.month}" title="Clic para asignar cuánto abona extra cada persona en este mes">
          ${customBadge}+${fmtCOP(r.extraCap)} ${ICON.edit}
        </button>
      </td>
      ${personCells}
      <td class="num"><strong>${fmtCOP(r.totalPayment)}</strong></td>
      <td class="num pro-only text-emerald"><strong>${fmtCOP(r.totalCap)}</strong></td>
      <td class="num"><strong>${fmtCOP(r.endingBalance)}</strong></td>
    `;
    tbody.appendChild(tr);
  });

  tbody.querySelectorAll('.row-paid-check').forEach((chk) => {
    chk.addEventListener('change', (e) => {
      const m = Number(e.target.dataset.month);
      if (e.target.checked) {
        state.paidMonths[m] = true;
      } else {
        delete state.paidMonths[m];
      }
      recalcAndRender(false);
    });
  });

  tbody.querySelectorAll('.btn-extra-person').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const m = Number(e.currentTarget.dataset.month);
      openPersonExtraModal(m, simPlan);
    });
  });

  const t = simPlan.totals;
  const emptyPersonFoot = showPersonCols
    ? state.participants.map((_, idx) => {
      const sumP = simPlan.rows.reduce((s, r) => s + (r.perPerson[idx] ? r.perPerson[idx].totalPay : 0), 0);
      return `<td class="num">${fmtCOP(sumP)}</td>`;
    }).join('')
    : '';

  tfoot.innerHTML = `
    <tr>
      <td class="no-print"></td>
      <td colspan="2">TOTAL (${simPlan.rows.length} cuotas)</td>
      <td class="num">${fmtCOP(t.mandatoryQuota)}</td>
      <td class="num pro-only">${fmtCOP(t.interest)}</td>
      <td class="num pro-only">${fmtCOP(t.insAndFees)}</td>
      <td class="num pro-only">${fmtCOP(t.scheduledCap)}</td>
      <td class="num">${fmtCOP(t.extraCap)}</td>
      ${emptyPersonFoot}
      <td class="num">${fmtCOP(t.totalPayment)}</td>
      <td class="num pro-only">${fmtCOP(t.totalCap)}</td>
      <td class="num">$0</td>
    </tr>
  `;
}

function openPersonExtraModal(monthNumber, simPlan) {
  editingModalMonth = monthNumber;
  const row = simPlan.rows.find((r) => r.month === monthNumber);
  if (!row) return;

  document.getElementById('modalTitle').textContent = `Abono Extraordinario — Cuota #${monthNumber} (${row.dateLabel})`;
  const container = document.getElementById('modalPersonInputs');
  container.innerHTML = '';

  state.participants.forEach((p, idx) => {
    const pp = row.perPerson[idx];
    const currentExtra = pp ? Math.round(pp.extra) : 0;
    const div = document.createElement('div');
    div.className = 'form-group';
    div.innerHTML = `
      <label>Abono Extra a Capital de <strong>${p.name}</strong> ($)</label>
      <input type="text" class="modal-p-extra" data-pid="${p.id}" value="${fmtNum(currentExtra)}" />
      <span class="field-hint">Además de su parte de la cuota obligatoria (${fmtCOP(pp ? pp.mandatory : 0)})</span>
    `;
    container.appendChild(div);
  });

  container.querySelectorAll('.modal-p-extra').forEach((inp) => {
    inp.addEventListener('input', (e) => {
      e.target.value = fmtNum(parseMoney(e.target.value));
    });
  });

  document.getElementById('personExtraModal').style.display = 'flex';
}

document.addEventListener('DOMContentLoaded', () => {
  const savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  const themeBtn = document.getElementById('btnToggleTheme');
  const paintThemeIcon = () => {
    const t = document.documentElement.getAttribute('data-theme') || 'dark';
    themeBtn.innerHTML = t === 'dark' ? ICON.sun : ICON.moon;
  };
  paintThemeIcon();

  loadFromLocalStorage();
  renderSavedScenariosDropdown();
  syncTopInputsFromState();
  recalcAndRender(true);

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.remove('active'));
      document.querySelectorAll('.tab-panel').forEach((p) => p.classList.remove('active'));
      btn.classList.add('active');
      const target = document.getElementById(btn.dataset.tab);
      if (target) target.classList.add('active');
    });
  });

  const btnSimple = document.getElementById('btnModeSimple');
  const btnPro = document.getElementById('btnModePro');

  btnSimple.addEventListener('click', () => {
    document.body.classList.remove('mode-pro');
    document.body.classList.add('mode-simple');
    btnSimple.classList.add('active');
    btnPro.classList.remove('active');
    recalcAndRender(false);
  });

  btnPro.addEventListener('click', () => {
    document.body.classList.remove('mode-simple');
    document.body.classList.add('mode-pro');
    btnPro.classList.add('active');
    btnSimple.classList.remove('active');
    recalcAndRender(false);
  });

  document.getElementById('btnToggleTheme').addEventListener('click', () => {
    const curr = document.documentElement.getAttribute('data-theme') || 'dark';
    const next = curr === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem(STORAGE_KEY_THEME, next);
    paintThemeIcon();
  });

  document.getElementById('btnPrintPDF').addEventListener('click', () => {
    document.getElementById('printDateSubtitle').textContent =
      `Generado el ${new Date().toLocaleDateString('es-CO')} · Monto Financiado: ${fmtCOP(state.financedBase)} · Tasa: ${state.rateMV}% M.V. (${state.rateEA}% E.A.)`;
    window.print();
  });

  let themeBeforePrint = null;
  window.addEventListener('beforeprint', () => {
    themeBeforePrint = document.documentElement.getAttribute('data-theme') || 'dark';
    document.documentElement.setAttribute('data-theme', 'light');
  });
  window.addEventListener('afterprint', () => {
    if (themeBeforePrint) {
      document.documentElement.setAttribute('data-theme', themeBeforePrint);
      themeBeforePrint = null;
    }
  });

  // Menú desplegable de escenarios con símbolos y modal de Nuevo / Guardar Escenario
  let scenarioModalIsNew = false;
  let selectedModalLoanType = state.loanType || 'vehiculo';

  const syncScenarioModalTypeCards = (typeVal) => {
    selectedModalLoanType = typeVal;
    document.querySelectorAll('#scenarioLoanTypeGrid .loan-type-option').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.type === typeVal);
    });
  };

  const openScenarioModal = (isNew) => {
    scenarioModalIsNew = isNew;
    const menu = document.getElementById('scenarioDropdownMenu');
    if (menu) menu.style.display = 'none';

    const titleEl = document.getElementById('scenarioModalTitle');
    const nameInp = document.getElementById('scenarioNameInput');
    const blankWrap = document.getElementById('scenarioStartBlankWrap');
    const blankCheck = document.getElementById('scenarioStartBlankCheck');

    if (isNew) {
      titleEl.textContent = 'Crear Nuevo Escenario';
      nameInp.value = '';
      blankWrap.style.display = 'flex';
      blankCheck.checked = true;
      syncScenarioModalTypeCards(state.loanType || 'vehiculo');
    } else {
      titleEl.textContent = 'Guardar Escenario Actual';
      const defaultName = activeScenarioName || state.participants.map((p) => p.name).join(' + ') || 'Mi Crédito';
      nameInp.value = defaultName;
      blankWrap.style.display = 'none';
      blankCheck.checked = false;
      syncScenarioModalTypeCards(state.loanType || 'vehiculo');
    }

    document.getElementById('scenarioModal').style.display = 'flex';
    setTimeout(() => nameInp.focus(), 40);
  };

  document.getElementById('btnScenarioTrigger').addEventListener('click', (e) => {
    e.stopPropagation();
    const menu = document.getElementById('scenarioDropdownMenu');
    const isVisible = menu.style.display !== 'none';
    menu.style.display = isVisible ? 'none' : 'block';
  });

  document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('scenarioBarWrapper');
    const menu = document.getElementById('scenarioDropdownMenu');
    if (wrapper && menu && !wrapper.contains(e.target)) {
      menu.style.display = 'none';
    }
  });

  document.getElementById('btnMenuNewScenario').addEventListener('click', () => {
    openScenarioModal(true);
  });

  document.getElementById('btnNewScenarioQuick').addEventListener('click', () => {
    openScenarioModal(true);
  });

  document.getElementById('btnSaveScenario').addEventListener('click', () => {
    openScenarioModal(false);
  });

  document.querySelectorAll('#scenarioLoanTypeGrid .loan-type-option').forEach((btn) => {
    btn.addEventListener('click', () => {
      syncScenarioModalTypeCards(btn.dataset.type);
    });
  });

  const closeScenarioModal = () => {
    document.getElementById('scenarioModal').style.display = 'none';
  };

  document.getElementById('btnCloseScenarioModal').addEventListener('click', closeScenarioModal);
  document.getElementById('btnCancelScenarioModal').addEventListener('click', closeScenarioModal);

  document.getElementById('btnConfirmScenarioModal').addEventListener('click', () => {
    const rawName = document.getElementById('scenarioNameInput').value.trim();
    const meta = getLoanTypeMeta(selectedModalLoanType);
    const finalName = rawName || `${meta.label} ${Object.keys(getSavedScenarios()).length + 1}`;
    const startBlank = scenarioModalIsNew && document.getElementById('scenarioStartBlankCheck').checked;

    if (startBlank) {
      state = getZeroState();
    }
    state.loanType = selectedModalLoanType;
    activeScenarioName = finalName;

    const scenarios = getSavedScenarios();
    scenarios[finalName] = JSON.parse(JSON.stringify(state));
    localStorage.setItem(STORAGE_KEY_SCENARIOS, JSON.stringify(scenarios));

    closeScenarioModal();
    syncTopInputsFromState();
    renderSavedScenariosDropdown();
    recalcAndRender(true);
  });

  const moneyFields = [
    ['assetValue', 'assetValue'],
    ['financedBase', 'financedBase'],
    ['initialExtraCosts', 'initialExtraCosts'],
    ['financedUpfrontIns', 'financedUpfrontIns'],
    ['quota1ExtraFee', 'quota1ExtraFee'],
    ['quota1InterestAdjust', 'quota1InterestAdjust']
  ];

  moneyFields.forEach(([domId, stateKey]) => {
    const el = document.getElementById(domId);
    el.addEventListener('input', (e) => {
      const val = parseMoney(e.target.value);
      e.target.value = fmtNum(val);
      state[stateKey] = val;
      recalcAndRender(false);
    });
  });

  document.getElementById('loanType').addEventListener('change', (e) => {
    state.loanType = e.target.value;
    if (activeScenarioName) {
      const scenarios = getSavedScenarios();
      if (scenarios[activeScenarioName]) {
        scenarios[activeScenarioName].loanType = state.loanType;
        localStorage.setItem(STORAGE_KEY_SCENARIOS, JSON.stringify(scenarios));
      }
    }
    renderSavedScenariosDropdown();
    saveToLocalStorage();
  });

  document.getElementById('upfrontInsMonths').addEventListener('input', (e) => {
    state.upfrontInsMonths = Math.max(1, parseInt(e.target.value, 10) || 1);
    recalcAndRender(false);
  });

  document.getElementById('termMonths').addEventListener('input', (e) => {
    state.termMonths = Math.max(0, parseInt(e.target.value, 10) || 0);
    state.monthlyCharges.forEach((c) => {
      if (c.untilEnd && state.termMonths > 0) {
        c.untilMonth = state.termMonths;
      }
    });
    recalcAndRender(true);
  });

  document.getElementById('startDate').addEventListener('change', (e) => {
    state.startDate = normalizeDate(e.target.value);
    recalcAndRender(true);
  });

  document.getElementById('rateMV').addEventListener('input', (e) => {
    const mv = parseFloat(e.target.value) || 0;
    state.rateMV = mv;
    const ea = (Math.pow(1 + mv / 100, 12) - 1) * 100;
    state.rateEA = Number(ea.toFixed(2));
    document.getElementById('rateEA').value = state.rateEA;
    recalcAndRender(false);
  });

  document.getElementById('rateEA').addEventListener('input', (e) => {
    const ea = parseFloat(e.target.value) || 0;
    state.rateEA = ea;
    const mv = (Math.pow(1 + ea / 100, 1 / 12) - 1) * 100;
    state.rateMV = Number(mv.toFixed(4));
    document.getElementById('rateMV').value = state.rateMV.toFixed(2);
    recalcAndRender(false);
  });

  document.querySelectorAll('input[name="extraStrategy"]').forEach((radio) => {
    radio.addEventListener('change', (e) => {
      state.extraStrategy = e.target.value;
      document.getElementById('labelStrategyTerm').classList.toggle('active', state.extraStrategy === 'reduce_term');
      document.getElementById('labelStrategyQuota').classList.toggle('active', state.extraStrategy === 'reduce_quota');
      recalcAndRender(false);
    });
  });

  document.getElementById('extraStartQuota').addEventListener('input', (e) => {
    state.extraStartQuota = Math.max(1, parseInt(e.target.value, 10) || 1);
    recalcAndRender(false);
  });

  document.getElementById('extraPaymentMode').addEventListener('change', (e) => {
    state.extraPaymentMode = e.target.value;
    recalcAndRender(true);
  });

  document.getElementById('splitMode').addEventListener('change', (e) => {
    state.splitMode = e.target.value;
    recalcAndRender(true);
  });

  document.getElementById('includeRegistrationInAsset').addEventListener('change', (e) => {
    state.includeRegistrationInAsset = e.target.checked;
    recalcAndRender(false);
  });

  document.getElementById('fairInternalDebtToggle').addEventListener('change', (e) => {
    state.fairInternalDebt = e.target.checked;
    recalcAndRender(false);
  });

  document.getElementById('showPerPersonColumnsToggle').addEventListener('change', (e) => {
    state.showPerPersonColumns = e.target.checked;
    recalcAndRender(false);
  });

  // Eventos del Simulador de Compra de Cartera
  document.getElementById('refiAfterMonth').addEventListener('input', (e) => {
    state.refiAfterMonth = Math.max(1, parseInt(e.target.value, 10) || 1);
    recalcAndRender(false);
  });

  document.getElementById('refiNewTermMonths').addEventListener('input', (e) => {
    state.refiNewTermMonths = Math.max(1, parseInt(e.target.value, 10) || 1);
    recalcAndRender(false);
  });

  document.getElementById('refiNewRateMV').addEventListener('input', (e) => {
    const mv = parseFloat(e.target.value) || 0;
    state.refiNewRateMV = mv;
    const ea = (Math.pow(1 + mv / 100, 12) - 1) * 100;
    state.refiNewRateEA = Number(ea.toFixed(2));
    document.getElementById('refiNewRateEA').value = state.refiNewRateEA;
    recalcAndRender(false);
  });

  document.getElementById('refiNewRateEA').addEventListener('input', (e) => {
    const ea = parseFloat(e.target.value) || 0;
    state.refiNewRateEA = ea;
    const mv = (Math.pow(1 + ea / 100, 1 / 12) - 1) * 100;
    state.refiNewRateMV = Number(mv.toFixed(4));
    document.getElementById('refiNewRateMV').value = state.refiNewRateMV.toFixed(2);
    recalcAndRender(false);
  });

  document.getElementById('refiNewMonthlyIns').addEventListener('input', (e) => {
    const val = parseMoney(e.target.value);
    e.target.value = fmtNum(val);
    state.refiNewMonthlyIns = val;
    recalcAndRender(false);
  });

  document.getElementById('refiClosingCosts').addEventListener('input', (e) => {
    const val = parseMoney(e.target.value);
    e.target.value = fmtNum(val);
    state.refiClosingCosts = val;
    recalcAndRender(false);
  });

  // Botones Historial Deshacer / Rehacer
  document.getElementById('btnUndo').addEventListener('click', () => {
    undoState();
  });

  document.getElementById('btnRedo').addEventListener('click', () => {
    redoState();
  });

  // Comparador Lado a Lado de Escenarios Guardados
  const getScenarioByKey = (key) => {
    if (key === '__current__') {
      return { name: activeScenarioName ? `${activeScenarioName} (Actual)` : 'Simulación Actual', data: state };
    }
    if (key === '__bank_min__') {
      return { name: 'Solo Cuota Mínima Banco', data: state, forceNoExtras: true };
    }
    const all = getSavedScenarios();
    if (all[key]) {
      return { name: key, data: { ...getZeroState(), ...all[key] } };
    }
    return { name: 'Simulación Actual', data: state };
  };

  const renderCompareScenariosTable = () => {
    const selA = document.getElementById('compareScenarioSelectA');
    const selB = document.getElementById('compareScenarioSelectB');
    const tbody = document.getElementById('compareScenariosTableBody');
    if (!selA || !selB || !tbody) return;

    const scenA = getScenarioByKey(selA.value);
    const scenB = getScenarioByKey(selB.value);

    document.getElementById('compareColHeaderA').textContent = scenA.name;
    document.getElementById('compareColHeaderB').textContent = scenB.name;

    const simA = simulateSchedule(!scenA.forceNoExtras, 1, scenA.data);
    const simB = simulateSchedule(!scenB.forceNoExtras, 1, scenB.data);

    const nextA = simA.rows[Math.min(1, Math.max(0, simA.rows.length - 1))];
    const nextB = simB.rows[Math.min(1, Math.max(0, simB.rows.length - 1))];

    const mA = simA.rows.length;
    const mB = simB.rows.length;
    const diffM = mB - mA;

    const pmtA = nextA ? nextA.totalPayment : 0;
    const pmtB = nextB ? nextB.totalPayment : 0;
    const diffPmt = pmtB - pmtA;

    const intA = simA.totals.interest;
    const intB = simB.totals.interest;
    const diffInt = intB - intA;

    const insA = simA.totals.insAndFees;
    const insB = simB.totals.insAndFees;
    const diffIns = insB - insA;

    const totA = simA.totals.totalPayment;
    const totB = simB.totals.totalPayment;
    const diffTot = totB - totA;

    const fmtDiffMoney = (d) => {
      if (d === 0) return 'Igual ($0)';
      return d < 0 ? `${fmtCOP(Math.abs(d))} menos` : `+${fmtCOP(d)} más`;
    };

    tbody.innerHTML = `
      <tr>
        <td><strong>Tipo y Tasa</strong></td>
        <td class="num">${getLoanTypeMeta(scenA.data.loanType).label} · ${scenA.data.rateMV || 0}% M.V.</td>
        <td class="num">${getLoanTypeMeta(scenB.data.loanType).label} · ${scenB.data.rateMV || 0}% M.V.</td>
        <td class="num">${((scenB.data.rateMV || 0) - (scenA.data.rateMV || 0)).toFixed(2)}% M.V.</td>
      </tr>
      <tr>
        <td><strong>Total Desembolsado</strong></td>
        <td class="num">${fmtCOP(simA.totalDisbursed)}</td>
        <td class="num">${fmtCOP(simB.totalDisbursed)}</td>
        <td class="num">${fmtDiffMoney(simB.totalDisbursed - simA.totalDisbursed)}</td>
      </tr>
      <tr>
        <td><strong>Pago Mensual Típico</strong></td>
        <td class="num">${fmtCOP(pmtA)}</td>
        <td class="num">${fmtCOP(pmtB)}</td>
        <td class="num">${fmtDiffMoney(diffPmt)}</td>
      </tr>
      <tr>
        <td><strong>Duración Real</strong></td>
        <td class="num">${mA} cuotas</td>
        <td class="num">${mB} cuotas</td>
        <td class="num">${diffM === 0 ? 'Igual' : (diffM < 0 ? `${Math.abs(diffM)} cuotas menos` : `+${diffM} cuotas más`)}</td>
      </tr>
      <tr>
        <td><strong>Total Intereses</strong></td>
        <td class="num">${fmtCOP(intA)}</td>
        <td class="num">${fmtCOP(intB)}</td>
        <td class="num ${diffInt <= 0 ? 'text-emerald' : ''}">${fmtDiffMoney(diffInt)}</td>
      </tr>
      <tr>
        <td><strong>Total Seguros y Cargos</strong></td>
        <td class="num">${fmtCOP(insA)}</td>
        <td class="num">${fmtCOP(insB)}</td>
        <td class="num ${diffIns <= 0 ? 'text-emerald' : ''}">${fmtDiffMoney(diffIns)}</td>
      </tr>
      <tr>
        <td><strong>Costo Total Pagado</strong></td>
        <td class="num"><strong>${fmtCOP(totA)}</strong></td>
        <td class="num"><strong>${fmtCOP(totB)}</strong></td>
        <td class="num ${diffTot <= 0 ? 'text-emerald' : ''}"><strong>${fmtDiffMoney(diffTot)}</strong></td>
      </tr>
    `;
  };

  const openCompareScenariosModal = () => {
    const selA = document.getElementById('compareScenarioSelectA');
    const selB = document.getElementById('compareScenarioSelectB');
    const scenarios = getSavedScenarios();
    const names = Object.keys(scenarios);

    const buildOpts = () => {
      let html = `<option value="__current__">Simulación Actual (${getLoanTypeMeta(state.loanType).label})</option>`;
      html += `<option value="__bank_min__">Banco sin Abonos Extra (Cuota Mínima)</option>`;
      names.forEach((n) => {
        const meta = getLoanTypeMeta(scenarios[n].loanType);
        html += `<option value="${n.replace(/"/g, '&quot;')}">${n} (${meta.label})</option>`;
      });
      return html;
    };

    selA.innerHTML = buildOpts();
    selB.innerHTML = buildOpts();
    selA.value = '__bank_min__';
    selB.value = names.length > 0 ? names[0] : '__current__';

    renderCompareScenariosTable();
    document.getElementById('compareScenariosModal').style.display = 'flex';
  };

  document.getElementById('btnCompareScenarios').addEventListener('click', openCompareScenariosModal);
  document.getElementById('compareScenarioSelectA').addEventListener('change', renderCompareScenariosTable);
  document.getElementById('compareScenarioSelectB').addEventListener('change', renderCompareScenariosTable);

  const closeCompareModal = () => {
    document.getElementById('compareScenariosModal').style.display = 'none';
  };
  document.getElementById('btnCloseCompareModal').addEventListener('click', closeCompareModal);
  document.getElementById('btnDoneCompareModal').addEventListener('click', closeCompareModal);

  // ============================================================================
  // GLOSARIO FINANCIERO DEBAJO DEL PANEL IZQUIERDO
  // ============================================================================
  let activeGlossaryCategory = 'Todos';
  let glossarySearchQuery = '';

  const renderGlossaryCategories = () => {
    const bar = document.getElementById('glossaryCategoriesBar');
    if (!bar) return;
    const cats = ['Todos', ...new Set(FINANCIAL_GLOSSARY.map((item) => item.category))];
    bar.innerHTML = cats.map((cat) => `
      <button type="button" class="glossary-cat-btn${cat === activeGlossaryCategory ? ' active' : ''}" data-cat="${cat}">
        ${cat}
      </button>
    `).join('');

    bar.querySelectorAll('.glossary-cat-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        activeGlossaryCategory = btn.dataset.cat;
        renderGlossaryCategories();
        renderGlossaryList();
      });
    });
  };

  const renderGlossaryList = (highlightId = '') => {
    const listEl = document.getElementById('glossaryItemsList');
    if (!listEl) return;

    const q = glossarySearchQuery.trim().toLowerCase();
    const filtered = FINANCIAL_GLOSSARY.filter((item) => {
      const matchCat = activeGlossaryCategory === 'Todos' || item.category === activeGlossaryCategory;
      const matchQuery = !q ||
        item.term.toLowerCase().includes(q) ||
        item.definition.toLowerCase().includes(q) ||
        item.example.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });

    if (filtered.length === 0) {
      listEl.innerHTML = `<div class="scenario-empty-msg">No se encontraron términos para "${glossarySearchQuery}".</div>`;
      return;
    }

    listEl.innerHTML = filtered.map((item) => `
      <article class="glossary-item${item.id === highlightId ? ' glossary-item-highlight' : ''}" id="glossary-term-${item.id}">
        <div class="glossary-item-header">
          <strong>${item.term}</strong>
          <span class="kpi-tag">${item.category}</span>
        </div>
        <p class="glossary-item-def">${item.definition}</p>
        <p class="glossary-item-ex"><strong>Ejemplo:</strong> ${item.example}</p>
      </article>
    `).join('');
  };

  const toggleGlossaryBody = (forceOpen = null) => {
    const bodyEl = document.getElementById('glossaryBody');
    const btnEl = document.getElementById('btnToggleGlossary');
    const labelEl = document.getElementById('glossaryToggleLabel');
    if (!bodyEl || !btnEl) return;

    const isCurrentlyOpen = bodyEl.style.display !== 'none';
    const nextOpen = forceOpen !== null ? forceOpen : !isCurrentlyOpen;

    bodyEl.style.display = nextOpen ? 'block' : 'none';
    btnEl.setAttribute('aria-expanded', String(nextOpen));
    if (labelEl) {
      labelEl.textContent = nextOpen ? 'Ocultar' : 'Ver glosario';
    }
  };

  document.getElementById('btnToggleGlossary').addEventListener('click', () => {
    toggleGlossaryBody();
  });

  document.getElementById('glossarySearchInput').addEventListener('input', (e) => {
    glossarySearchQuery = e.target.value;
    renderGlossaryList();
  });

  document.querySelectorAll('.term-help-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const termId = btn.dataset.term;
      activeGlossaryCategory = 'Todos';
      glossarySearchQuery = '';
      const searchInp = document.getElementById('glossarySearchInput');
      if (searchInp) searchInp.value = '';
      renderGlossaryCategories();
      renderGlossaryList(termId);
      toggleGlossaryBody(true);
      const targetEl = document.getElementById(`glossary-term-${termId}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    });
  });

  renderGlossaryCategories();
  renderGlossaryList();

  // Atajos de teclado globales (Escape, Enter en modales, Ctrl+Z / Ctrl+Y)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        if (e.shiftKey) {
          redoState();
        } else {
          undoState();
        }
      }
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
      const tag = (document.activeElement && document.activeElement.tagName) || '';
      if (tag !== 'INPUT' && tag !== 'TEXTAREA') {
        e.preventDefault();
        redoState();
      }
    } else if (e.key === 'Escape') {
      document.getElementById('personExtraModal').style.display = 'none';
      document.getElementById('scenarioModal').style.display = 'none';
      document.getElementById('compareScenariosModal').style.display = 'none';
      const menu = document.getElementById('scenarioDropdownMenu');
      if (menu) menu.style.display = 'none';
    } else if (e.key === 'Enter') {
      if (document.getElementById('personExtraModal').style.display === 'flex') {
        e.preventDefault();
        document.getElementById('btnSaveMonthExtra').click();
      } else if (document.getElementById('scenarioModal').style.display === 'flex') {
        e.preventDefault();
        document.getElementById('btnConfirmScenarioModal').click();
      }
    }
  });

  document.getElementById('btnAddCharge').addEventListener('click', () => {
    const nextId = state.monthlyCharges.reduce((m, c) => Math.max(m, c.id), 0) + 1;
    const maxM = Math.max(1, parseInt(state.termMonths, 10) || 72);
    const lastCharge = state.monthlyCharges[state.monthlyCharges.length - 1];
    let suggestedStart = 1;
    if (lastCharge && !lastCharge.untilEnd && (parseInt(lastCharge.untilMonth, 10) || 0) < maxM) {
      suggestedStart = (parseInt(lastCharge.untilMonth, 10) || 1) + 1;
    }
    state.monthlyCharges.push({
      id: nextId,
      name: `Seguro ${nextId}`,
      amount: 0,
      active: true,
      fromMonth: suggestedStart,
      untilMonth: maxM,
      untilEnd: true
    });
    recalcAndRender(true);
  });

  document.getElementById('btnAddParticipant').addEventListener('click', () => {
    const nextId = state.participants.reduce((m, p) => Math.max(m, p.id), 0) + 1;
    const newCount = state.participants.length + 1;
    const eqShare = Number((100 / newCount).toFixed(2));
    state.participants.forEach((p) => {
      p.mandatorySharePct = eqShare;
      p.targetOwnershipPct = eqShare;
    });
    state.participants.push({
      id: nextId,
      name: `Persona ${nextId}`,
      downPayment: 0,
      regContribution: 0,
      mandatorySharePct: eqShare,
      monthlyInput: 0,
      semiAnnualBonus: 0,
      targetOwnershipPct: eqShare
    });
    recalcAndRender(true);
  });

  document.getElementById('btnClearCustomExtras').addEventListener('click', () => {
    state.customMonthPersonExtras = {};
    recalcAndRender(false);
  });

  document.getElementById('btnCloseModal').addEventListener('click', () => {
    document.getElementById('personExtraModal').style.display = 'none';
  });

  document.getElementById('btnResetMonthExtra').addEventListener('click', () => {
    if (editingModalMonth) {
      delete state.customMonthPersonExtras[editingModalMonth];
    }
    document.getElementById('personExtraModal').style.display = 'none';
    recalcAndRender(false);
  });

  document.getElementById('btnSaveMonthExtra').addEventListener('click', () => {
    if (editingModalMonth) {
      const mapObj = {};
      document.querySelectorAll('.modal-p-extra').forEach((inp) => {
        const pid = Number(inp.dataset.pid);
        mapObj[pid] = parseMoney(inp.value);
      });
      state.customMonthPersonExtras[editingModalMonth] = mapObj;
    }
    document.getElementById('personExtraModal').style.display = 'none';
    recalcAndRender(false);
  });

  document.getElementById('btnResetZero').addEventListener('click', () => {
    state = getZeroState();
    activeScenarioName = '';
    syncTopInputsFromState();
    renderSavedScenariosDropdown();
    recalcAndRender(true);
  });

  document.getElementById('btnExportCSV').addEventListener('click', exportToCSV);

  const fileInput = document.getElementById('csvFileInput');
  document.getElementById('btnImportCSV').addEventListener('click', () => {
    fileInput.value = '';
    fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      importFromCSVText(String(ev.target.result || ''));
    };
    reader.readAsText(file, 'UTF-8');
  });
});
