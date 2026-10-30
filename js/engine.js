// ============================================================================
// MOTOR DE AMORTIZACIÓN, SEGUROS POR RANGO, COMPRA DE CARTERA Y PROPIEDAD
// ============================================================================

function calcFrenchPmt(principal, rateDecimal, months) {
  if (principal <= 0 || months <= 0) return 0;
  if (rateDecimal <= 0) return principal / months;
  return (principal * rateDecimal * Math.pow(1 + rateDecimal, months)) / (Math.pow(1 + rateDecimal, months) - 1);
}

function getQuotaDateInfo(startDate, quotaIndex) {
  const parts = normalizeDate(startDate).split('-').map(Number);
  const y = parts[0] || 2026;
  const m = parts[1] || 10;
  const day = parts[2] || 2;
  const targetMonthIdx = (m - 1) + (quotaIndex - 1);
  // Ajustar el día si el mes destino tiene menos días (ej. 31 -> 30 o 28)
  const daysInTarget = new Date(y, targetMonthIdx + 1, 0).getDate();
  const d = new Date(y, targetMonthIdx, Math.min(day, daysInTarget));
  const monthsEs = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const calMonth = d.getMonth() + 1;
  return {
    label: `${String(d.getDate()).padStart(2, '0')} ${monthsEs[d.getMonth()]} ${d.getFullYear()}`,
    isBonusMonth: calMonth === 6 || calMonth === 12
  };
}

function getChargesSumForMonth(monthNum, maxTerm, targetState = state) {
  let sum = 0;
  (targetState.monthlyCharges || []).forEach((ch) => {
    if (!ch.active) return;
    const fromM = Math.max(1, parseInt(ch.fromMonth, 10) || 1);
    const untilM = ch.untilEnd ? maxTerm : Math.max(fromM, parseInt(ch.untilMonth, 10) || maxTerm);
    if (monthNum >= fromM && monthNum <= untilM) {
      sum += Number(ch.amount) || 0;
    }
  });
  return sum;
}

// Motor principal de simulación que rastrea tanto el crédito global como el saldo individual de cada participante
function simulateSchedule(withExtras = true, overrideMonthlyScale = 1, targetState = state) {
  const s = targetState || state;
  const baseFinanced = Math.max(0, Number(s.financedBase) || 0);
  const upfrontIns = Math.max(0, Number(s.financedUpfrontIns) || 0);
  const totalDisbursed = baseFinanced + upfrontIns;
  const n = Math.max(0, parseInt(s.termMonths, 10) || 0);

  if (totalDisbursed <= 0 || n <= 0) {
    return {
      rows: [],
      totals: { mandatoryQuota: 0, interest: 0, insAndFees: 0, scheduledCap: 0, extraCap: 0, totalPayment: 0, totalCap: 0 },
      totalDisbursed: 0,
      participantStats: []
    };
  }

  const r = Math.max(0, Number(s.rateMV) || 0) / 100;
  const upfrontMonths = Math.max(1, parseInt(s.upfrontInsMonths, 10) || 12);

  const pmtBase = Math.round(calcFrenchPmt(baseFinanced, r, n));
  const pmtUpfront = upfrontIns > 0 ? Math.round(calcFrenchPmt(upfrontIns, r, upfrontMonths)) : 0;

  const participants = Array.isArray(s.participants) && s.participants.length > 0
    ? s.participants
    : getZeroState().participants;
  const monthlyCharges = normalizeMonthlyCharges(s.monthlyCharges || [], n);
  const customExtras = s.customMonthPersonExtras || {};

  // Inicializar saldos individuales por participante para reparto justo
  const totalTargetPct = participants.reduce((acc, p) => acc + (Number(p.targetOwnershipPct) || 0), 0) || 100;
  const totalMandatoryShare = participants.reduce((acc, p) => acc + (Number(p.mandatorySharePct) || 0), 0) || 100;

  const vehicleCreditCap = baseFinanced;
  const sumInitialCapital = participants.reduce(
    (acc, p) => acc + (Number(p.downPayment) || 0) + (s.includeRegistrationInAsset ? (Number(p.regContribution) || 0) : 0),
    0
  );
  const grandTotalCapital = sumInitialCapital + vehicleCreditCap;

  const targetCreditCapShares = participants.map((p) => {
    const desiredRatio = (Number(p.targetOwnershipPct) || 0) / totalTargetPct;
    const desiredTotalCap = grandTotalCapital * desiredRatio;
    const myInit = (Number(p.downPayment) || 0) + (s.includeRegistrationInAsset ? (Number(p.regContribution) || 0) : 0);
    return Math.max(0, desiredTotalCap - myInit);
  });
  const sumTargetCreditCap = targetCreditCapShares.reduce((a, b) => a + b, 0) || 1;

  // Proporción inicial de la deuda en el crédito para cada socio
  const initDebtRatios = participants.map((p, idx) => {
    if (s.splitMode === 'by_target_pct') {
      return targetCreditCapShares[idx] / sumTargetCreditCap;
    }
    return (Number(p.mandatorySharePct) || 0) / totalMandatoryShare;
  });

  const personBalances = initDebtRatios.map((ratio) => totalDisbursed * ratio);
  let balance = totalDisbursed;
  const rows = [];
  let currentReducedPmt = null;

  for (let m = 1; m <= 600 && balance > 0; m++) {
    const dateInfo = getQuotaDateInfo(s.startDate, m);
    const stdInterest = Math.round(balance * r);
    const interest = (m === 1 && s.quota1InterestAdjust > 0)
      ? Math.round(s.quota1InterestAdjust)
      : stdInterest;

    let monthlyInsAndFees = 0;
    monthlyCharges.forEach((ch) => {
      if (!ch.active) return;
      const fromM = Math.max(1, parseInt(ch.fromMonth, 10) || 1);
      const untilM = ch.untilEnd ? 600 : Math.max(fromM, parseInt(ch.untilMonth, 10) || n);
      if (m >= fromM && m <= untilM) {
        monthlyInsAndFees += Number(ch.amount) || 0;
      }
    });

    if (m === 1 && s.quota1ExtraFee > 0) {
      monthlyInsAndFees += Number(s.quota1ExtraFee) || 0;
    }

    let basePI = m <= upfrontMonths ? (pmtBase + pmtUpfront) : pmtBase;
    if (m === 1 && s.quota1InterestAdjust > 0) {
      const cap1 = Math.max(0, (pmtBase + pmtUpfront) - stdInterest);
      basePI = cap1 + interest;
    } else if (withExtras && s.extraStrategy === 'reduce_quota' && currentReducedPmt !== null) {
      basePI = currentReducedPmt + (m <= upfrontMonths ? pmtUpfront : 0);
    }

    let scheduledCap = Math.max(0, basePI - interest);
    if (scheduledCap > balance || (m === n && !withExtras)) {
      scheduledCap = balance;
      basePI = scheduledCap + interest;
    }

    const mandatoryQuota = basePI + monthlyInsAndFees;

    // Si fairInternalDebt está activo, los intereses del mes se reparten según el saldo vivo de cada socio
    const totalPersonBal = personBalances.reduce((a, b) => a + Math.max(0, b), 0) || 1;
    const personIntShares = participants.map((_, idx) => {
      if (s.fairInternalDebt !== false && totalPersonBal > 0) {
        return Math.max(0, personBalances[idx]) / totalPersonBal;
      }
      return initDebtRatios[idx];
    });

    const personCapOrdShares = initDebtRatios;

    // Calcular abono extra de cada participante en este mes m
    let personExtras = participants.map(() => 0);

    if (withExtras && m >= (s.extraStartQuota || 1) && scheduledCap < balance) {
      const customForMonth = customExtras[m];

      participants.forEach((p, idx) => {
        const myMandCap = scheduledCap * personCapOrdShares[idx];
        const myMandInt = interest * personIntShares[idx];
        const myMandIns = monthlyInsAndFees * initDebtRatios[idx];
        const myMandatoryTotal = myMandCap + myMandInt + myMandIns;

        let myExtra = 0;
        if (customForMonth && customForMonth[p.id] !== undefined) {
          myExtra = Math.max(0, Number(customForMonth[p.id]) || 0);
        } else {
          const scaledInput = (Number(p.monthlyInput) || 0) * overrideMonthlyScale;
          if (s.splitMode === 'by_target_pct') {
            const totalBudget = participants.reduce((acc, x) => acc + (Number(x.monthlyInput) || 0) * overrideMonthlyScale, 0);
            const totalExtraPool = s.extraPaymentMode === 'total_budget'
              ? Math.max(0, totalBudget - mandatoryQuota)
              : totalBudget;
            myExtra = totalExtraPool * initDebtRatios[idx];
          } else if (s.extraPaymentMode === 'total_budget') {
            myExtra = Math.max(0, scaledInput - myMandatoryTotal);
          } else {
            myExtra = Math.max(0, scaledInput);
          }

          if (dateInfo.isBonusMonth && Number(p.semiAnnualBonus) > 0) {
            myExtra += Number(p.semiAnnualBonus) || 0;
          }
        }
        personExtras[idx] = myExtra;
      });

      const rawExtraSum = personExtras.reduce((a, b) => a + b, 0);
      const maxAllowedExtra = Math.max(0, balance - scheduledCap);
      if (rawExtraSum > maxAllowedExtra && rawExtraSum > 0) {
        const scale = maxAllowedExtra / rawExtraSum;
        personExtras = personExtras.map((v) => v * scale);
      }
    }

    const extraCap = Math.round(personExtras.reduce((a, b) => a + b, 0));
    const totalCap = scheduledCap + extraCap;
    const totalPayment = mandatoryQuota + extraCap;
    balance = Math.max(0, balance - totalCap);

    const perPersonRow = participants.map((p, idx) => {
      const capOrd = scheduledCap * personCapOrdShares[idx];
      const intAmt = interest * personIntShares[idx];
      const insAmt = monthlyInsAndFees * initDebtRatios[idx];
      const extAmt = personExtras[idx];
      const capTot = capOrd + extAmt;
      personBalances[idx] = Math.max(0, personBalances[idx] - capTot);
      return {
        id: p.id,
        name: p.name,
        mandatory: capOrd + intAmt + insAmt,
        extra: extAmt,
        totalPay: capOrd + intAmt + insAmt + extAmt,
        capTot,
        intAndIns: intAmt + insAmt,
        endingBal: personBalances[idx]
      };
    });

    if (withExtras && s.extraStrategy === 'reduce_quota' && extraCap > 0 && balance > 0) {
      const remainingMonths = Math.max(1, n - m);
      currentReducedPmt = Math.round(calcFrenchPmt(balance, r, remainingMonths));
    }

    rows.push({
      month: m,
      dateLabel: dateInfo.label,
      isBonusMonth: dateInfo.isBonusMonth,
      mandatoryQuota,
      interest,
      insAndFees: monthlyInsAndFees,
      scheduledCap,
      extraCap,
      totalPayment,
      totalCap,
      endingBalance: balance,
      perPerson: perPersonRow,
      hasCustomExtra: Boolean(customExtras[m])
    });

    if (balance <= 0) break;
  }

  const totals = rows.reduce(
    (acc, r) => {
      acc.mandatoryQuota += r.mandatoryQuota;
      acc.interest += r.interest;
      acc.insAndFees += r.insAndFees;
      acc.scheduledCap += r.scheduledCap;
      acc.extraCap += r.extraCap;
      acc.totalPayment += r.totalPayment;
      acc.totalCap += r.totalCap;
      return acc;
    },
    { mandatoryQuota: 0, interest: 0, insAndFees: 0, scheduledCap: 0, extraCap: 0, totalPayment: 0, totalCap: 0 }
  );

  return { rows, totals, totalDisbursed };
}

function calculateParticipantsBreakdown(simWithExtras, targetState = state) {
  const s = targetState || state;
  const { rows } = simWithExtras;
  const participants = Array.isArray(s.participants) ? s.participants : [];
  if (participants.length === 0) return { stats: [], totalCapitalBasis: 0, totalOutPocketBasis: 0 };

  const vehicleCreditCap = Math.max(0, Number(s.financedBase) || 0);
  const totalDisb = Math.max(1, simWithExtras.totalDisbursed || 1);
  const vehicleRatioInCredit = simWithExtras.totalDisbursed > 0 ? (vehicleCreditCap / totalDisb) : 1;

  const stats = participants.map((p, idx) => ({
    ...p,
    color: COLORS[idx % COLORS.length],
    initialTotal: (Number(p.downPayment) || 0) + (s.includeRegistrationInAsset ? (Number(p.regContribution) || 0) : 0),
    rawInitialOutPocket: (Number(p.downPayment) || 0) + (Number(p.regContribution) || 0),
    creditCapitalPaid: 0,
    interestAndInsPaid: 0,
    totalCreditPaid: 0,
    month2Payment: 0
  }));

  rows.forEach((row) => {
    row.perPerson.forEach((pp, idx) => {
      if (!stats[idx]) return;
      if (row.month === 2 || (rows.length === 1 && row.month === 1)) {
        stats[idx].month2Payment = pp.totalPay;
      }
      stats[idx].creditCapitalPaid += pp.capTot * vehicleRatioInCredit;
      stats[idx].interestAndInsPaid += pp.intAndIns + pp.capTot * (1 - vehicleRatioInCredit);
      stats[idx].totalCreditPaid += pp.totalPay;
    });
  });

  const totalCapitalBasis = stats.reduce((acc, p) => acc + p.initialTotal + p.creditCapitalPaid, 0);
  const totalOutPocketBasis = stats.reduce((acc, p) => acc + p.rawInitialOutPocket + p.totalCreditPaid, 0);

  stats.forEach((p) => {
    p.totalCapitalContributed = p.initialTotal + p.creditCapitalPaid;
    p.totalOutOfPocket = p.rawInitialOutPocket + p.totalCreditPaid;
    p.ownershipByCapitalPct = totalCapitalBasis > 0
      ? (p.totalCapitalContributed / totalCapitalBasis) * 100
      : (100 / stats.length);
    p.ownershipByPocketPct = totalOutPocketBasis > 0
      ? (p.totalOutOfPocket / totalOutPocketBasis) * 100
      : (100 / stats.length);
  });

  return { stats, totalCapitalBasis, totalOutPocketBasis };
}

// Simulador de Compra de Cartera / Refinanciación en otro banco
function simulateRefinancing(simPlan, simOriginal, targetState = state) {
  const s = targetState || state;
  if (!simPlan || simPlan.rows.length === 0) {
    return null;
  }

  const afterM = Math.max(1, Math.min(simPlan.rows.length, parseInt(s.refiAfterMonth, 10) || 12));
  const cutoffRow = simPlan.rows[afterM - 1];
  const balanceToTransfer = cutoffRow ? cutoffRow.endingBalance : 0;

  if (balanceToTransfer <= 0) {
    return {
      alreadyPaidOff: true,
      afterMonth: afterM,
      balanceToTransfer: 0
    };
  }

  const paidBeforeTransfer = simPlan.rows
    .slice(0, afterM)
    .reduce((sum, r) => sum + r.totalPayment, 0);

  const closingCosts = Math.max(0, Number(s.refiClosingCosts) || 0);
  const newPrincipal = balanceToTransfer + closingCosts;
  const newRateDecimal = Math.max(0, Number(s.refiNewRateMV) || 0) / 100;
  const newTerm = Math.max(1, parseInt(s.refiNewTermMonths, 10) || 48);
  const newIns = Math.max(0, Number(s.refiNewMonthlyIns) || 0);

  const newBasePmt = Math.round(calcFrenchPmt(newPrincipal, newRateDecimal, newTerm));
  const newMandatoryQuota = newBasePmt + newIns;

  // 1) Pagando solo la cuota mínima del nuevo banco durante newTerm meses
  let balMin = newPrincipal;
  let newBankMinTotalPaid = 0;
  let newBankMinInterest = 0;
  let newBankMinMonths = 0;

  for (let m = 1; m <= newTerm && balMin > 0; m++) {
    const intM = Math.round(balMin * newRateDecimal);
    let capM = Math.max(0, newBasePmt - intM);
    if (capM > balMin || m === newTerm) {
      capM = balMin;
    }
    balMin = Math.max(0, balMin - capM);
    newBankMinInterest += intM;
    newBankMinTotalPaid += capM + intM + newIns;
    newBankMinMonths = m;
  }

  // 2) Manteniendo el presupuesto mensual actual de los socios en el nuevo banco
  const nextPlanRow = simPlan.rows[Math.min(afterM, simPlan.rows.length - 1)];
  const currentMonthlyBudget = Math.max(newMandatoryQuota, nextPlanRow ? nextPlanRow.totalPayment : newMandatoryQuota);

  let balAccel = newPrincipal;
  let newBankAccelTotalPaid = 0;
  let newBankAccelMonths = 0;

  for (let m = 1; m <= 600 && balAccel > 0; m++) {
    const intM = Math.round(balAccel * newRateDecimal);
    const mandCap = Math.min(balAccel, Math.max(0, newBasePmt - intM));
    const extraAvailable = Math.max(0, currentMonthlyBudget - (mandCap + intM + newIns));
    const extraCap = Math.min(balAccel - mandCap, extraAvailable);
    const totCap = mandCap + extraCap;
    balAccel = Math.max(0, balAccel - totCap);
    newBankAccelTotalPaid += totCap + intM + newIns;
    newBankAccelMonths = m;
  }

  const combinedTotalMin = paidBeforeTransfer + newBankMinTotalPaid;
  const combinedTotalAccel = paidBeforeTransfer + newBankAccelTotalPaid;

  return {
    alreadyPaidOff: false,
    afterMonth: afterM,
    cutoffDateLabel: cutoffRow.dateLabel,
    balanceToTransfer,
    closingCosts,
    newPrincipal,
    newMandatoryQuota,
    currentQuotaBeforeRefi: cutoffRow.mandatoryQuota,
    monthlyQuotaReduction: cutoffRow.mandatoryQuota - newMandatoryQuota,
    newBankMinMonths,
    totalMonthsMin: afterM + newBankMinMonths,
    combinedTotalMin,
    newBankAccelMonths,
    totalMonthsAccel: afterM + newBankAccelMonths,
    combinedTotalAccel,
    savingsMinVsOriginalBank: simOriginal.totals.totalPayment - combinedTotalMin,
    savingsAccelVsCurrentPlan: simPlan.totals.totalPayment - combinedTotalAccel,
    savingsAccelVsOriginalBank: simOriginal.totals.totalPayment - combinedTotalAccel
  };
}
