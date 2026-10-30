// ============================================================================
// ESTADO GLOBAL, CONSTANTES, HISTORIAL (UNDO/REDO) Y GLOSARIO FINANCIERO
// ============================================================================

const COLORS = ['#1d4ed8', '#047857', '#b45309', '#6d28d9', '#be185d', '#0e7490'];
const STORAGE_KEY_AUTOSAVE = 'simulador_credito_autosave_v2';
const STORAGE_KEY_SCENARIOS = 'simulador_credito_scenarios_v2';
const STORAGE_KEY_THEME = 'simulador_credito_theme_v2';

// Iconos lineales sobrios (SVG)
const svgIcon = (paths, cls = 'icon') =>
  `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;

const ICON = {
  x: svgIcon('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'icon icon-sm'),
  edit: svgIcon('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>', 'icon icon-sm'),
  check: svgIcon('<path d="M20 6 9 17l-5-5"/>', 'icon icon-sm'),
  info: svgIcon('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>', 'icon'),
  sun: svgIcon('<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>'),
  moon: svgIcon('<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>'),
  plus: svgIcon('<path d="M12 5v14"/><path d="M5 12h14"/>', 'icon icon-sm'),
  trash: svgIcon('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>', 'icon icon-sm'),
  chevronDown: svgIcon('<path d="m6 9 6 6 6-6"/>', 'icon icon-sm'),
  undo: svgIcon('<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13"/>', 'icon icon-sm'),
  redo: svgIcon('<path d="M21 7v6h-6"/><path d="M3 17a9 9 0 0 1 9-9 9 9 0 0 1 6 2.3l3 2.7"/>', 'icon icon-sm'),
  book: svgIcon('<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>', 'icon'),
  compare: svgIcon('<path d="M16 3h5v5"/><path d="M8 3H3v5"/><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3"/><path d="m15 9 6-6"/>', 'icon icon-sm'),
  loan_vehiculo: svgIcon('<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>', 'icon'),
  loan_personal: svgIcon('<rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/><path d="M6 15h.01"/><path d="M10 15h4"/>', 'icon'),
  loan_hipotecario: svgIcon('<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>', 'icon'),
  loan_otro: svgIcon('<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" x2="8" y1="13" y2="13"/><line x1="16" x2="8" y1="17" y2="17"/>', 'icon')
};

const LOAN_TYPE_META = {
  vehiculo: { label: 'Vehicular', icon: ICON.loan_vehiculo },
  personal: { label: 'Libre Inversión', icon: ICON.loan_personal },
  hipotecario: { label: 'Hogar', icon: ICON.loan_hipotecario },
  otro: { label: 'Otro', icon: ICON.loan_otro }
};

function getLoanTypeMeta(type) {
  return LOAN_TYPE_META[type] || LOAN_TYPE_META.vehiculo;
}

// Glosario Financiero Básico
const FINANCIAL_GLOSSARY = [
  {
    id: 'capital',
    term: 'Capital (Principal)',
    category: 'Conceptos Base',
    definition: 'Es el monto real de dinero que te prestó el banco para pagar el bien, sin contar intereses ni seguros. Tu deuda baja únicamente en la medida en que abonas a capital.',
    example: 'Si el vehículo cuesta $85,99M y das $39M de cuota inicial, el capital base del vehículo es $46,99M.'
  },
  {
    id: 'tasa-mv',
    term: 'Tasa M.V. (Mes Vencido)',
    category: 'Tasas e Intereses',
    definition: 'Es el porcentaje de interés que el banco cobra cada mes sobre el saldo vivo de tu deuda. Si el saldo baja gracias a tus abonos extra, el interés del mes siguiente también baja.',
    example: 'Con una tasa de 1,94% M.V. sobre un saldo de $40M, el interés de ese mes será $776.000.'
  },
  {
    id: 'tasa-ea',
    term: 'Tasa E.A. (Efectiva Anual)',
    category: 'Tasas e Intereses',
    definition: 'Expresa el costo total anual del crédito teniendo en cuenta la capitalización mensual durante 12 meses. Fórmula: (1 + M.V.)^12 - 1. Es el estándar legal para comparar qué banco es más económico.',
    example: 'Una tasa mensual del 1,94% M.V. equivale exactamente a un 25,93% E.A.'
  },
  {
    id: 'abono-extra',
    term: 'Abono Extraordinario a Capital',
    category: 'Estrategia',
    definition: 'Cualquier pago voluntario que haces por encima de la cuota obligatoria del mes. Va 100% directo a restar el saldo de capital, sin pagar intereses ni comisiones.',
    example: 'Si tu cuota obligatoria es $1,94M y pagas $2,40M, los $455.000 restantes reducen directamente tu deuda.'
  },
  {
    id: 'reduccion-plazo-cuota',
    term: 'Reducción de Plazo vs. Reducción de Cuota',
    category: 'Estrategia',
    definition: 'Al hacer un abono extra puedes elegir dos caminos: "Reducción de Plazo" mantiene tu cuota mensual igual para terminar en muchos menos meses (genera el máximo ahorro en intereses y seguros); "Reducción de Cuota" conserva los meses originales pero disminuye el pago mínimo exigible cada mes.',
    example: 'Abonando a reducción de plazo puedes pasar de 72 a 33 cuotas y ahorrar más de 39 meses de intereses y seguros.'
  },
  {
    id: 'amortizacion-francesa',
    term: 'Sistema de Amortización Francés (Cuota Fija)',
    category: 'Conceptos Base',
    definition: 'Es el método más usado en créditos bancarios: la cuota base (capital + intereses) se mantiene constante, pero en las primeras cuotas pagas mayor proporción de intereses y menos capital; hacia el final pagas casi todo a capital.',
    example: 'Por eso los abonos extra hechos en los primeros meses del crédito son los que más dinero ahorran.'
  },
  {
    id: 'seguro-financiado',
    term: 'Seguro Financiado al Inicio',
    category: 'Seguros y Cargos',
    definition: 'Ocurre cuando el banco paga por adelantado una póliza anual (por ejemplo, el primer año de seguro de vida) y te la suma al monto desembolsado para cobrártela diferida durante los primeros 12 meses.',
    example: 'Si el banco financia $676.656 de seguro de vida a 12 meses, durante el primer año tu cuota es ligeramente mayor y en el mes 13 baja automáticamente.'
  },
  {
    id: 'endoso-seguro',
    term: 'Endoso de Póliza (Seguro Externo)',
    category: 'Seguros y Cargos',
    definition: 'Derecho que tiene todo deudor de contratar su propio seguro (todo riesgo o vida deudor) con cualquier aseguradora externa más económica y designar al banco como primer beneficiario, evitando el cobro mensual de la póliza colectiva del banco.',
    example: 'Puedes pagar el seguro del banco del mes 1 al 12 y en la pestaña "3. Seguros" programar uno más económico desde el mes 13 hasta el final.'
  },
  {
    id: 'compra-cartera',
    term: 'Compra de Cartera (Refinanciación)',
    category: 'Estrategia',
    definition: 'Consiste en que otro banco pague la totalidad de tu saldo actual y te abra un nuevo crédito con una tasa de interés más baja (por ejemplo, bajar de 1,94% M.V. a 1,20% M.V.), disminuyendo el costo financiero restante.',
    example: 'Puedes simularla en la pestaña "4. Ajustes" indicando en qué cuota harías el traslado y qué tasa te ofrece el nuevo banco.'
  },
  {
    id: 'participacion-capital-bolsillo',
    term: '% del Bien vs. % por Bolsillo',
    category: 'Copropiedad',
    definition: '"% del Bien" calcula de quién es el activo sumando solo aportes patrimoniales (cuota inicial + papeles + capital pagado). "% por Bolsillo" mide cuánto dinero total (incluyendo intereses y seguros) ha salido de la cuenta de cada persona.',
    example: 'Si un socio dio más cuota inicial pero el otro paga más cuota mensual, ambos porcentajes te muestran cuándo llegan al 50% / 50%.'
  },
  {
    id: 'deuda-interna-justa',
    term: 'Deuda Interna Justa entre Socios',
    category: 'Copropiedad',
    definition: 'Rastrea por separado el saldo vivo de deuda de cada participante dentro del crédito. Si uno de los socios hace un abono extra grande, su saldo individual baja y en los meses siguientes se le cobran menos intereses internos que a su compañero.',
    example: 'Garantiza que quien adelanta capital con su prima o ahorros se beneficie directamente del ahorro de intereses que generó.'
  }
];

// Normaliza fechas: acepta 'YYYY-MM' (formato anterior) o 'YYYY-MM-DD'
function normalizeDate(val) {
  if (!val) return '2026-10-02';
  if (/^\d{4}-\d{2}$/.test(val)) return `${val}-02`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
  return '2026-10-02';
}

const fmtCOP = (val) => {
  const n = Math.round(Number(val) || 0);
  return '$' + n.toLocaleString('es-CO');
};

const fmtNum = (val) => {
  const n = Math.round(Number(val) || 0);
  return n.toLocaleString('es-CO');
};

const parseMoney = (str) => {
  if (typeof str === 'number') return str;
  const cleaned = String(str || '').replace(/[^\d]/g, '');
  return cleaned ? parseInt(cleaned, 10) : 0;
};

function getZeroState() {
  return {
    loanType: 'vehiculo',
    assetValue: 0,
    financedBase: 0,
    initialExtraCosts: 0,
    financedUpfrontIns: 0,
    upfrontInsMonths: 12,
    termMonths: 0,
    startDate: '2026-10-02',
    rateMV: 0,
    rateEA: 0,
    quota1ExtraFee: 0,
    quota1InterestAdjust: 0,
    extraStrategy: 'reduce_term',
    extraStartQuota: 2,
    extraPaymentMode: 'total_budget',
    splitMode: 'by_contributions',
    includeRegistrationInAsset: true,
    fairInternalDebt: true,
    showPerPersonColumns: false,
    // Parámetros de simulación de Compra de Cartera / Refinanciación
    refiAfterMonth: 12,
    refiNewRateMV: 1.25,
    refiNewRateEA: 16.08,
    refiNewTermMonths: 48,
    refiNewMonthlyIns: 120000,
    refiClosingCosts: 0,
    monthlyCharges: [],
    participants: [
      {
        id: 1,
        name: 'Participante 1',
        downPayment: 0,
        regContribution: 0,
        mandatorySharePct: 100,
        monthlyInput: 0,
        semiAnnualBonus: 0,
        targetOwnershipPct: 100
      }
    ],
    // Abonos puntuales por mes y por persona: { [month]: { [participantId]: amount } }
    customMonthPersonExtras: {},
    // Cuotas marcadas como ya pagadas: { [month]: true }
    paidMonths: {}
  };
}

function normalizeMonthlyCharges(charges, termMonths) {
  const n = Math.max(1, parseInt(termMonths, 10) || 72);
  if (!Array.isArray(charges)) return [];
  return charges.map((c, idx) => {
    const fromM = Math.max(1, parseInt(c.fromMonth, 10) || 1);
    const rawUntil = parseInt(c.untilMonth, 10) || n;
    const untilEnd = c.untilEnd !== undefined
      ? Boolean(c.untilEnd)
      : (c.fromMonth === undefined && rawUntil >= n);
    return {
      id: c.id || (idx + 1),
      name: c.name || `Seguro ${idx + 1}`,
      amount: Number(c.amount) || 0,
      active: c.active !== false,
      fromMonth: fromM,
      untilMonth: untilEnd ? n : Math.max(fromM, rawUntil),
      untilEnd
    };
  });
}

let state = getZeroState();
let editingModalMonth = null;
let activeScenarioName = '';

// ============================================================================
// GESTOR DE HISTORIAL DESHACER / REHACER (UNDO / REDO)
// ============================================================================

const MAX_HISTORY_STEPS = 40;
let historyStack = [];
let redoStack = [];
let isRestoringHistory = false;

function pushHistorySnapshot() {
  if (isRestoringHistory) return;
  const serialized = JSON.stringify(state);
  if (historyStack.length > 0 && historyStack[historyStack.length - 1] === serialized) {
    return;
  }
  historyStack.push(serialized);
  if (historyStack.length > MAX_HISTORY_STEPS) {
    historyStack.shift();
  }
  redoStack = [];
  updateUndoRedoButtons();
}

function updateUndoRedoButtons() {
  if (typeof document === 'undefined') return;
  const btnU = document.getElementById('btnUndo');
  const btnR = document.getElementById('btnRedo');
  if (btnU) btnU.disabled = historyStack.length <= 1;
  if (btnR) btnR.disabled = redoStack.length === 0;
}

function undoState() {
  if (historyStack.length <= 1) return false;
  isRestoringHistory = true;
  const currentSnap = historyStack.pop();
  redoStack.push(currentSnap);
  const prevSnap = historyStack[historyStack.length - 1];
  state = { ...getZeroState(), ...JSON.parse(prevSnap) };
  state.monthlyCharges = normalizeMonthlyCharges(state.monthlyCharges, state.termMonths);
  state.startDate = normalizeDate(state.startDate);
  if (typeof syncTopInputsFromState === 'function') syncTopInputsFromState();
  if (typeof renderSavedScenariosDropdown === 'function') renderSavedScenariosDropdown();
  if (typeof recalcAndRender === 'function') recalcAndRender(true);
  isRestoringHistory = false;
  updateUndoRedoButtons();
  return true;
}

function redoState() {
  if (redoStack.length === 0) return false;
  isRestoringHistory = true;
  const nextSnap = redoStack.pop();
  historyStack.push(nextSnap);
  state = { ...getZeroState(), ...JSON.parse(nextSnap) };
  state.monthlyCharges = normalizeMonthlyCharges(state.monthlyCharges, state.termMonths);
  state.startDate = normalizeDate(state.startDate);
  if (typeof syncTopInputsFromState === 'function') syncTopInputsFromState();
  if (typeof renderSavedScenariosDropdown === 'function') renderSavedScenariosDropdown();
  if (typeof recalcAndRender === 'function') recalcAndRender(true);
  isRestoringHistory = false;
  updateUndoRedoButtons();
  return true;
}
