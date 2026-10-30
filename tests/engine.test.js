// ============================================================================
// SUITE DE PRUEBAS AUTOMATIZADAS DEL MOTOR FINANCIERO (javascript-testing-patterns)
// Ejecutar con: node tests/engine.test.js
// ============================================================================

const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');

function createSimulatorContext() {
  const root = path.resolve(__dirname, '..');
  const code = [
    fs.readFileSync(path.join(root, 'js/state.js'), 'utf8'),
    fs.readFileSync(path.join(root, 'js/engine.js'), 'utf8'),
    fs.readFileSync(path.join(root, 'js/storage.js'), 'utf8')
  ].join('\n');

  const sandbox = {
    console,
    Math,
    Date,
    Number,
    String,
    Object,
    Array,
    Boolean,
    Set,
    parseInt,
    parseFloat,
    JSON
  };
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  return sandbox;
}

const SAMPLE_LOAN_CSV = `[PARAMETROS_CREDITO]
Clave,Valor
loanType,vehiculo
assetValue,85990000
financedBase,46990000
initialExtraCosts,2500000
financedUpfrontIns,676656
upfrontInsMonths,12
termMonths,72
startDate,2026-10-02
rateMV,1.94
rateEA,25.93
quota1ExtraFee,108477
quota1InterestAdjust,955558
extraStrategy,reduce_term
extraStartQuota,2
extraPaymentMode,total_budget
splitMode,by_contributions
includeRegistrationInAsset,true
fairInternalDebt,true

[COBROS_MENSUALES]
id,name,amount,active,fromMonth,untilMonth,untilEnd
1,"Seguro Todo Riesgo",308381,true,1,72,true
2,"Seguro Protección",88670,true,1,72,true

[PARTICIPANTES]
id,name,downPayment,regContribution,mandatorySharePct,monthlyInput,targetOwnershipPct,semiAnnualBonus
1,"Socio A",16000000,2500000,50,1200000,50,0
2,"Socio B",23000000,0,50,1200000,50,0
`;

function runSuite() {
  let passed = 0;
  const test = (name, fn) => {
    fn();
    passed++;
    console.log(`  [PASS] ${name}`);
  };

  console.log('Iniciando pruebas del motor financiero...\n');

  test('1. Importación CSV + amortización francesa + copropiedad', () => {
    // Arrange
    const ctx = createSimulatorContext();

    // Act
    ctx.importFromCSVText(SAMPLE_LOAN_CSV);
    const simOrig = ctx.simulateSchedule(false);
    const simPlan = ctx.simulateSchedule(true);
    const breakdown = ctx.calculateParticipantsBreakdown(simPlan);

    // Assert
    assert.equal(simPlan.totalDisbursed, 47666656, 'El desembolso total debe ser $47.666.656');
    assert.equal(simOrig.rows.length, 72, 'El plazo original sin abonos debe ser 72 cuotas');
    assert.equal(simPlan.rows.length, 33, 'Con el plan de abonos debe terminar en 33 cuotas');
    assert.equal(simPlan.rows[0].totalPayment, 1816743, 'La cuota #1 real debe ser $1.816.743');
    assert.equal(simPlan.rows[1].totalPayment, 2400000, 'El pago mensual desde la cuota #2 debe ser $2.400.000');
    assert.equal(breakdown.stats.length, 2, 'Deben existir 2 participantes');
    assert.equal(breakdown.stats[0].ownershipByCapitalPct.toFixed(2), '47.46');
    assert.equal(breakdown.stats[1].ownershipByCapitalPct.toFixed(2), '52.54');
  });

  test('2. Seguros escalonados por mes de inicio y fin (fromMonth / untilMonth / untilEnd)', () => {
    // Arrange
    const ctx = createSimulatorContext();
    ctx.importFromCSVText(SAMPLE_LOAN_CSV);

    // Seguro del banco del mes 1 al 12 ($308.381) y póliza endosada económica desde el mes 13 hasta el final ($160.000)
    ctx.runResult = vm.runInContext(`
      state.monthlyCharges[0].fromMonth = 1;
      state.monthlyCharges[0].untilMonth = 12;
      state.monthlyCharges[0].untilEnd = false;
      state.monthlyCharges.push({
        id: 99,
        name: 'Seguro Endosado Económico',
        amount: 160000,
        active: true,
        fromMonth: 13,
        untilMonth: 72,
        untilEnd: true
      });
      simulateSchedule(true);
    `, ctx);

    // Assert
    const row12 = ctx.runResult.rows[11]; // Mes 12
    const row13 = ctx.runResult.rows[12]; // Mes 13
    assert.equal(row12.insAndFees, 308381 + 88670, 'En el mes 12 cobra el seguro del banco ($397.051)');
    assert.equal(row13.insAndFees, 160000 + 88670, 'En el mes 13 entra el seguro más económico ($248.670)');
  });

  test('3. Simulador de Compra de Cartera / Refinanciación (simulateRefinancing)', () => {
    // Arrange
    const ctx = createSimulatorContext();
    ctx.importFromCSVText(SAMPLE_LOAN_CSV);

    // Act: trasladar tras la cuota #12 a una tasa de 1.15% M.V. a 48 meses con seguro de $100.000
    const refi = vm.runInContext(`
      state.refiAfterMonth = 12;
      state.refiNewRateMV = 1.15;
      state.refiNewTermMonths = 48;
      state.refiNewMonthlyIns = 100000;
      state.refiClosingCosts = 0;
      const orig = simulateSchedule(false);
      const plan = simulateSchedule(true);
      simulateRefinancing(plan, orig, state);
    `, ctx);

    // Assert
    assert.equal(refi.alreadyPaidOff, false);
    assert.equal(refi.afterMonth, 12);
    assert.ok(refi.balanceToTransfer > 30000000, 'El saldo a trasladar en el mes 12 debe ser mayor a $30M');
    assert.ok(refi.savingsMinVsOriginalBank > 15000000, 'La compra de cartera debe ahorrar más de $15M frente al banco original');
    assert.ok(refi.savingsAccelVsCurrentPlan > 0, 'Mantener el abono mensual en el banco con menor tasa debe ahorrar aún más que el plan actual');
  });

  test('4. Historial Deshacer / Rehacer (pushHistorySnapshot, undoState, redoState)', () => {
    // Arrange
    const ctx = createSimulatorContext();
    vm.runInContext(`
      state = getZeroState();
      state.assetValue = 50000000;
      pushHistorySnapshot();
      state.assetValue = 85990000;
      pushHistorySnapshot();
    `, ctx);

    // Act & Assert: Undo
    const undoneVal = vm.runInContext(`undoState(); state.assetValue;`, ctx);
    assert.equal(undoneVal, 50000000, 'Deshacer debe restaurar el valor anterior ($50.000.000)');

    // Act & Assert: Redo
    const redoneVal = vm.runInContext(`redoState(); state.assetValue;`, ctx);
    assert.equal(redoneVal, 85990000, 'Rehacer debe volver a aplicar el valor ($85.990.000)');
  });

  test('5. Glosario Financiero contiene todos los términos clave con definición y ejemplo', () => {
    const ctx = createSimulatorContext();
    const count = vm.runInContext(`FINANCIAL_GLOSSARY.length`, ctx);
    const hasAllFields = vm.runInContext(`
      FINANCIAL_GLOSSARY.every(g => g.id && g.term && g.category && g.definition && g.example)
    `, ctx);
    assert.ok(count >= 10, 'El glosario debe incluir al menos 10 términos financieros');
    assert.equal(hasAllFields, true, 'Cada término debe tener id, term, category, definition y example');
  });

  console.log(`\nResultado: ${passed}/5 pruebas superadas exitosamente.`);
}

runSuite();
