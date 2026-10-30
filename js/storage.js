// ============================================================================
// PERSISTENCIA EN LOCALSTORAGE E IMPORTACIÓN / EXPORTACIÓN CSV
// ============================================================================

function saveToLocalStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEY_AUTOSAVE, JSON.stringify(state));
    if (typeof document !== 'undefined') {
      const badge = document.getElementById('autosaveBadge');
      if (badge) {
        badge.textContent = 'Guardado';
        badge.style.opacity = '1';
      }
    }
  } catch (e) {
    // Ignorar errores de almacenamiento privado
  }
}

function loadFromLocalStorage() {
  try {
    if (typeof localStorage === 'undefined') return;
    const raw = localStorage.getItem(STORAGE_KEY_AUTOSAVE);
    if (raw) {
      const parsed = JSON.parse(raw);
      state = { ...getZeroState(), ...parsed };
      if (!Array.isArray(state.participants) || state.participants.length === 0) {
        state.participants = getZeroState().participants;
      }
      state.participants.forEach((p) => {
        if (p.semiAnnualBonus === undefined) p.semiAnnualBonus = 0;
      });
      state.monthlyCharges = normalizeMonthlyCharges(state.monthlyCharges, state.termMonths);
      if (!state.customMonthPersonExtras) state.customMonthPersonExtras = {};
      if (!state.paidMonths) state.paidMonths = {};
      state.startDate = normalizeDate(state.startDate);
    }
  } catch (e) {
    state = getZeroState();
  }
}

function getSavedScenarios() {
  try {
    if (typeof localStorage === 'undefined') return {};
    const raw = localStorage.getItem(STORAGE_KEY_SCENARIOS);
    return raw ? JSON.parse(raw) : {};
  } catch (e) {
    return {};
  }
}

function renderSavedScenariosDropdown() {
  if (typeof document === 'undefined') return;
  const scenarios = getSavedScenarios();
  const names = Object.keys(scenarios);

  const iconEl = document.getElementById('scenarioTriggerIcon');
  const textEl = document.getElementById('scenarioTriggerText');
  const listEl = document.getElementById('scenarioMenuList');

  const currentMeta = getLoanTypeMeta(state.loanType);
  if (iconEl) {
    iconEl.innerHTML = currentMeta.icon;
    iconEl.title = `Tipo actual: ${currentMeta.label}`;
  }

  if (textEl) {
    if (activeScenarioName && scenarios[activeScenarioName]) {
      textEl.textContent = activeScenarioName;
    } else {
      textEl.textContent = `Escenarios (${names.length})`;
    }
  }

  if (!listEl) return;
  listEl.innerHTML = '';

  if (names.length === 0) {
    listEl.innerHTML = `<div class="scenario-empty-msg">No hay escenarios guardados aún</div>`;
    return;
  }

  names.forEach((name) => {
    const sc = scenarios[name] || {};
    const meta = getLoanTypeMeta(sc.loanType || 'vehiculo');
    const isActive = name === activeScenarioName;

    const item = document.createElement('div');
    item.className = `scenario-menu-item${isActive ? ' active' : ''}`;
    item.innerHTML = `
      <button type="button" class="scenario-select-btn" data-name="${name.replace(/"/g, '&quot;')}">
        <span class="scenario-item-icon" title="${meta.label}">${meta.icon}</span>
        <span class="scenario-item-info">
          <strong class="scenario-item-name">${name}</strong>
          <span class="scenario-item-type">${meta.label}</span>
        </span>
      </button>
      <button type="button" class="btn btn-ghost btn-xs scenario-del-btn" data-name="${name.replace(/"/g, '&quot;')}" title="Eliminar escenario">
        ${ICON.trash}
      </button>
    `;
    listEl.appendChild(item);
  });

  listEl.querySelectorAll('.scenario-select-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      const selectedName = e.currentTarget.dataset.name;
      const allScenarios = getSavedScenarios();
      if (allScenarios[selectedName]) {
        activeScenarioName = selectedName;
        state = { ...getZeroState(), ...JSON.parse(JSON.stringify(allScenarios[selectedName])) };
        state.monthlyCharges = normalizeMonthlyCharges(state.monthlyCharges, state.termMonths);
        state.startDate = normalizeDate(state.startDate);
        if (typeof syncTopInputsFromState === 'function') syncTopInputsFromState();
        if (typeof recalcAndRender === 'function') recalcAndRender(true);
        renderSavedScenariosDropdown();
      }
      const menu = document.getElementById('scenarioDropdownMenu');
      if (menu) menu.style.display = 'none';
    });
  });

  listEl.querySelectorAll('.scenario-del-btn').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const delName = e.currentTarget.dataset.name;
      const allScenarios = getSavedScenarios();
      delete allScenarios[delName];
      if (activeScenarioName === delName) activeScenarioName = '';
      localStorage.setItem(STORAGE_KEY_SCENARIOS, JSON.stringify(allScenarios));
      renderSavedScenariosDropdown();
    });
  });
}

function exportToCSV() {
  const simPlan = simulateSchedule(true);
  const { stats } = calculateParticipantsBreakdown(simPlan);

  const lines = [];
  lines.push('[PARAMETROS_CREDITO]');
  lines.push('Clave,Valor');
  lines.push(`loanType,${state.loanType}`);
  lines.push(`assetValue,${state.assetValue}`);
  lines.push(`financedBase,${state.financedBase}`);
  lines.push(`initialExtraCosts,${state.initialExtraCosts}`);
  lines.push(`financedUpfrontIns,${state.financedUpfrontIns}`);
  lines.push(`upfrontInsMonths,${state.upfrontInsMonths}`);
  lines.push(`termMonths,${state.termMonths}`);
  lines.push(`startDate,${state.startDate}`);
  lines.push(`rateMV,${state.rateMV}`);
  lines.push(`rateEA,${state.rateEA}`);
  lines.push(`quota1ExtraFee,${state.quota1ExtraFee}`);
  lines.push(`quota1InterestAdjust,${state.quota1InterestAdjust}`);
  lines.push(`extraStrategy,${state.extraStrategy}`);
  lines.push(`extraStartQuota,${state.extraStartQuota}`);
  lines.push(`extraPaymentMode,${state.extraPaymentMode}`);
  lines.push(`splitMode,${state.splitMode}`);
  lines.push(`includeRegistrationInAsset,${state.includeRegistrationInAsset}`);
  lines.push(`fairInternalDebt,${state.fairInternalDebt !== false}`);
  lines.push('');

  lines.push('[COBROS_MENSUALES]');
  lines.push('id,name,amount,active,fromMonth,untilMonth,untilEnd');
  state.monthlyCharges.forEach((c) => {
    const fromM = Math.max(1, parseInt(c.fromMonth, 10) || 1);
    const untilM = Math.max(fromM, parseInt(c.untilMonth, 10) || (state.termMonths || 72));
    const uEnd = Boolean(c.untilEnd);
    lines.push(`${c.id},"${String(c.name).replace(/"/g, '""')}",${c.amount},${c.active},${fromM},${untilM},${uEnd}`);
  });
  lines.push('');

  lines.push('[PARTICIPANTES]');
  lines.push('id,name,downPayment,regContribution,mandatorySharePct,monthlyInput,targetOwnershipPct,semiAnnualBonus');
  state.participants.forEach((p) => {
    lines.push(`${p.id},"${String(p.name).replace(/"/g, '""')}",${p.downPayment},${p.regContribution},${p.mandatorySharePct},${p.monthlyInput},${p.targetOwnershipPct},${p.semiAnnualBonus || 0}`);
  });
  lines.push('');

  lines.push('[ABONOS_PUNTUALES_POR_PERSONA]');
  lines.push('month,participantId,extraAmount');
  Object.entries(state.customMonthPersonExtras).forEach(([m, mapObj]) => {
    Object.entries(mapObj).forEach(([pid, val]) => {
      lines.push(`${m},${pid},${val}`);
    });
  });
  lines.push('');

  lines.push('[CUOTAS_PAGADAS]');
  lines.push('month,paid');
  Object.keys(state.paidMonths).forEach((m) => {
    if (state.paidMonths[m]) lines.push(`${m},true`);
  });
  lines.push('');

  lines.push('[RESUMEN_PARTICIPANTES]');
  lines.push('Persona,Aporte Inicial,Pago Mensual,Capital Credito,Intereses y Seguros,Total Aportado,% del Bien,% por Bolsillo');
  stats.forEach((p) => {
    lines.push(`"${p.name}",${Math.round(p.rawInitialOutPocket)},${Math.round(p.month2Payment)},${Math.round(p.creditCapitalPaid)},${Math.round(p.interestAndInsPaid)},${Math.round(p.totalOutOfPocket)},${p.ownershipByCapitalPct.toFixed(2)}%,${p.ownershipByPocketPct.toFixed(2)}%`);
  });
  lines.push('');

  lines.push('[TABLA_AMORTIZACION]');
  lines.push('Cuota,Fecha,Cuota Obligatoria,Intereses,Seguros y Otros,Capital Ordinario,Abono Extra Capital,Pago Total Mes,Total a Capital,Saldo Capital');
  simPlan.rows.forEach((r) => {
    lines.push(`${r.month},"${r.dateLabel}",${r.mandatoryQuota},${r.interest},${r.insAndFees},${r.scheduledCap},${r.extraCap},${r.totalPayment},${r.totalCap},${r.endingBalance}`);
  });

  const csvContent = lines.join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `credito_${state.loanType}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function parseCSVLine(line) {
  const result = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function importFromCSVText(text) {
  const cleanText = text.replace(/^\uFEFF/, '');
  const rawLines = cleanText.split(/\r?\n/);

  const newState = getZeroState();
  newState.monthlyCharges = [];
  newState.participants = [];
  newState.customMonthPersonExtras = {};
  newState.paidMonths = {};

  let currentSection = '';
  let skipHeader = false;

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith('[') && line.endsWith(']')) {
      currentSection = line;
      skipHeader = true;
      continue;
    }

    if (skipHeader) {
      skipHeader = false;
      continue;
    }

    const cols = parseCSVLine(line);

    if (currentSection === '[PARAMETROS_CREDITO]' && cols.length >= 2) {
      const [key, val] = cols;
      if (['loanType', 'startDate', 'extraStrategy', 'extraPaymentMode', 'splitMode'].includes(key)) {
        newState[key] = val;
      } else if (['includeRegistrationInAsset', 'fairInternalDebt'].includes(key)) {
        newState[key] = val === 'true' || val === '1';
      } else if (['rateMV', 'rateEA'].includes(key)) {
        newState[key] = parseFloat(val) || 0;
      } else if (key in newState) {
        newState[key] = parseInt(val, 10) || 0;
      }
    } else if (currentSection === '[COBROS_MENSUALES]' && cols.length >= 5) {
      const termRef = newState.termMonths || 72;
      let fromM = 1;
      let untilM = termRef;
      let untilEnd = true;
      if (cols.length >= 6) {
        fromM = Math.max(1, parseInt(cols[4], 10) || 1);
        untilM = Math.max(fromM, parseInt(cols[5], 10) || termRef);
        untilEnd = cols.length >= 7 ? (cols[6] === 'true' || cols[6] === '1') : (untilM >= termRef);
      } else {
        untilM = Math.max(1, parseInt(cols[4], 10) || termRef);
        untilEnd = untilM >= termRef;
      }
      newState.monthlyCharges.push({
        id: parseInt(cols[0], 10) || (newState.monthlyCharges.length + 1),
        name: cols[1] || 'Seguro',
        amount: parseFloat(cols[2]) || 0,
        active: cols[3] === 'true' || cols[3] === '1',
        fromMonth: fromM,
        untilMonth: untilM,
        untilEnd
      });
    } else if (currentSection === '[PARTICIPANTES]' && cols.length >= 7) {
      newState.participants.push({
        id: parseInt(cols[0], 10) || (newState.participants.length + 1),
        name: cols[1] || 'Participante',
        downPayment: parseFloat(cols[2]) || 0,
        regContribution: parseFloat(cols[3]) || 0,
        mandatorySharePct: parseFloat(cols[4]) || 50,
        monthlyInput: parseFloat(cols[5]) || 0,
        targetOwnershipPct: parseFloat(cols[6]) || 50,
        semiAnnualBonus: parseFloat(cols[7]) || 0
      });
    } else if (currentSection === '[ABONOS_PUNTUALES_POR_PERSONA]' && cols.length >= 3) {
      const m = parseInt(cols[0], 10);
      const pid = parseInt(cols[1], 10);
      const val = parseFloat(cols[2]) || 0;
      if (m > 0 && pid > 0) {
        if (!newState.customMonthPersonExtras[m]) newState.customMonthPersonExtras[m] = {};
        newState.customMonthPersonExtras[m][pid] = val;
      }
    } else if (currentSection === '[CUOTAS_PAGADAS]' && cols.length >= 2) {
      const m = parseInt(cols[0], 10);
      if (m > 0 && (cols[1] === 'true' || cols[1] === '1')) {
        newState.paidMonths[m] = true;
      }
    }
  }

  if (newState.participants.length === 0) {
    newState.participants = getZeroState().participants;
  }
  newState.startDate = normalizeDate(newState.startDate);

  state = newState;
  if (typeof syncTopInputsFromState === 'function') syncTopInputsFromState();
  if (typeof renderSavedScenariosDropdown === 'function') renderSavedScenariosDropdown();
  if (typeof recalcAndRender === 'function') recalcAndRender(true);
}
