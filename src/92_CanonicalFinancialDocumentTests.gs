// QUnitGS2 regression tests for the CanonicalFinancialDocument boundary.

function registerCanonicalFinancialDocumentTests_() {
  QUnit.module('Canonical financial document');

  QUnit.test('minimum document is valid with required provenance and unresolved identity', function(assert) {
    const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());

    assert.deepEqual(canonical.sourceProvenance, syntheticCanonicalProvenance_());
    assert.deepEqual(canonical.expenses, []);
    assert.deepEqual(canonical.additionalCosts, []);
    assert.deepEqual(canonical.adjustments, []);
    assert.deepEqual(canonical.vat, []);
    assert.deepEqual(canonical.printedTotals, {});
    assert.equal(canonical.reconciliation.status, RECONCILIATION_STATUS.NOT_CHECKABLE);
    assert.notOk(hasCanonicalField_(canonical, 'documentDate'));
    assert.notOk(hasCanonicalField_(canonical, 'sourceDocumentId'));
  });

  QUnit.test('validator and factory both require source provenance', function(assert) {
    const withoutProvenance = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
    delete withoutProvenance.sourceProvenance;

    assertCanonicalInvalid_(assert, function() {
      validateCanonicalFinancialDocument(withoutProvenance);
    });
    assertCanonicalInvalid_(assert, function() {
      createMinimalCanonicalFinancialDocument({ mimeType: 'application/pdf' });
    });
  });

  QUnit.test('source provenance rejects missing and unknown fields', function(assert) {
    const missingMime = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
    delete missingMime.sourceProvenance.mimeType;

    const unknownField = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
    unknownField.sourceProvenance.evidenceId = 'synthetic-forbidden';

    [missingMime, unknownField].forEach(function(canonical) {
      assertCanonicalInvalid_(assert, function() {
        validateCanonicalFinancialDocument(canonical);
      });
    });

    assertCanonicalInvalid_(assert, function() {
      createMinimalCanonicalFinancialDocument({
        sourceFileName: 'synthetic-document.pdf',
        mimeType: 'application/pdf',
        evidenceId: 'synthetic-forbidden'
      });
    });
  });

  QUnit.test('required financial collections and result objects cannot be omitted', function(assert) {
    ['expenses', 'additionalCosts', 'adjustments', 'vat', 'printedTotals', 'reconciliation'].forEach(function(fieldName) {
      const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
      delete canonical[fieldName];

      assertCanonicalInvalid_(assert, function() {
        validateCanonicalFinancialDocument(canonical);
      });
    });
  });

  QUnit.test('valid authoritative identity values are accepted', function(assert) {
    const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
    canonical.documentDate = '2028-02-29';
    canonical.sourceDocumentId = 'SYN-INV-002';

    const validated = validateCanonicalFinancialDocument(canonical);
    assert.equal(validated.documentDate, '2028-02-29');
    assert.equal(validated.sourceDocumentId, 'SYN-INV-002');
  });

  QUnit.test('invalid calendar dates are rejected without resolving identity', function(assert) {
    ['10-08-2026', '2026-02-30', '2026-13-01', '2026-00-10', '2027-02-29'].forEach(function(value) {
      const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
      canonical.documentDate = value;

      assertCanonicalInvalid_(assert, function() {
        validateCanonicalFinancialDocument(canonical);
      });
    });
  });

  QUnit.test('sourceDocumentId must be a non-empty string when resolved', function(assert) {
    ['', '   ', 42].forEach(function(value) {
      const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
      canonical.sourceDocumentId = value;

      assertCanonicalInvalid_(assert, function() {
        validateCanonicalFinancialDocument(canonical);
      });
    });
  });

  QUnit.test('one document accepts multiple financial lines using printed-value terminology', function(assert) {
    const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
    canonical.expenses = [
      { description: 'Synthetic cable', quantity: 2, printedUnitAmount: 1729, printedLineAmount: 3458 },
      { description: 'Synthetic adapter', printedLineAmount: 850 }
    ];

    const validated = validateCanonicalFinancialDocument(canonical);
    assert.equal(validated.expenses.length, 2);
    assert.equal(validated.expenses[0].printedUnitAmount, 1729);
    assert.equal(validated.expenses[1].printedLineAmount, 850);
  });

  QUnit.test('legacy uncommitted monetary aliases are rejected', function(assert) {
    const expense = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
    expense.expenses.push({ description: 'Synthetic item', lineAmount: 1000 });

    const cost = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
    cost.additionalCosts.push({ amount: 100, category: ADDITIONAL_COST_CATEGORY.FEE });

    const vat = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
    vat.vat.push({ rate: 21, amount: 210 });

    [expense, cost, vat].forEach(function(canonical) {
      assertCanonicalInvalid_(assert, function() {
        validateCanonicalFinancialDocument(canonical);
      });
    });
  });

  QUnit.test('monetary values require safe integer minor units', function(assert) {
    [1234.5, '1234', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].forEach(function(value) {
      const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
      canonical.expenses.push({ description: 'Synthetic item', printedLineAmount: value });

      assertCanonicalInvalid_(assert, function() {
        validateCanonicalFinancialDocument(canonical);
      });
    });
  });

  QUnit.test('all accepted adjustment types allow a described negative adjustment', function(assert) {
    Object.keys(ADJUSTMENT_TYPE).forEach(function(key) {
      const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
      canonical.adjustments.push({
        description: 'Synthetic reduction',
        printedAmount: -125,
        adjustmentType: ADJUSTMENT_TYPE[key]
      });

      assert.equal(validateCanonicalFinancialDocument(canonical).adjustments.length, 1);
    });
  });

  QUnit.test('adjustment requires a non-empty description', function(assert) {
    [undefined, ''].forEach(function(description) {
      const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
      const adjustment = {
        printedAmount: -125,
        adjustmentType: ADJUSTMENT_TYPE.OTHER_ADJUSTMENT
      };
      if (description !== undefined) {
        adjustment.description = description;
      }
      canonical.adjustments.push(adjustment);

      assertCanonicalInvalid_(assert, function() {
        validateCanonicalFinancialDocument(canonical);
      });
    });
  });

  QUnit.test('adjustment amount must remain negative and signed', function(assert) {
    [0, 125].forEach(function(value) {
      const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
      canonical.adjustments.push({
        description: 'Synthetic reduction',
        printedAmount: value,
        adjustmentType: ADJUSTMENT_TYPE.OTHER_ADJUSTMENT
      });

      assertCanonicalInvalid_(assert, function() {
        validateCanonicalFinancialDocument(canonical);
      });
    });
  });

  QUnit.test('unknown adjustment type is rejected', function(assert) {
    const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
    canonical.adjustments.push({
      description: 'Synthetic reduction',
      printedAmount: -125,
      adjustmentType: 'SYNTHETIC_UNKNOWN'
    });

    assertCanonicalInvalid_(assert, function() {
      validateCanonicalFinancialDocument(canonical);
    });
  });

  QUnit.test('SHIPPING and FEE are accepted additional-cost categories', function(assert) {
    const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
    canonical.additionalCosts = [
      { description: 'Synthetic delivery', printedAmount: 340, category: ADDITIONAL_COST_CATEGORY.SHIPPING },
      { printedAmount: 125, category: ADDITIONAL_COST_CATEGORY.FEE }
    ];

    assert.equal(validateCanonicalFinancialDocument(canonical).additionalCosts.length, 2);
  });

  QUnit.test('additional cost requires an accepted category', function(assert) {
    [undefined, 'SYNTHETIC_UNKNOWN'].forEach(function(category) {
      const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
      const cost = { printedAmount: 340 };
      if (category !== undefined) {
        cost.category = category;
      }
      canonical.additionalCosts.push(cost);

      assertCanonicalInvalid_(assert, function() {
        validateCanonicalFinancialDocument(canonical);
      });
    });
  });

  QUnit.test('VAT accepts printed rate, printed amount, or both', function(assert) {
    const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
    canonical.vat = [
      { printedRate: 9 },
      { printedAmount: 637 },
      { printedRate: 21, printedAmount: 637 }
    ];

    assert.equal(validateCanonicalFinancialDocument(canonical).vat.length, 3);
  });

  QUnit.test('valid reconciliation states are accepted', function(assert) {
    const cases = [
      { status: RECONCILIATION_STATUS.NOT_CHECKABLE },
      { status: RECONCILIATION_STATUS.MATCHED, difference: 0 },
      { status: RECONCILIATION_STATUS.MISMATCH, difference: -25 }
    ];

    cases.forEach(function(reconciliation) {
      const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
      canonical.reconciliation = reconciliation;
      assert.equal(validateCanonicalFinancialDocument(canonical).reconciliation.status, reconciliation.status);
    });
  });

  QUnit.test('inconsistent reconciliation states are rejected', function(assert) {
    [
      { status: RECONCILIATION_STATUS.NOT_CHECKABLE, difference: 0 },
      { status: RECONCILIATION_STATUS.MATCHED },
      { status: RECONCILIATION_STATUS.MATCHED, difference: 1 },
      { status: RECONCILIATION_STATUS.MISMATCH },
      { status: RECONCILIATION_STATUS.MISMATCH, difference: 0 },
      { status: RECONCILIATION_STATUS.MISMATCH, difference: 1.5 },
      { status: 'SYNTHETIC_UNKNOWN' }
    ].forEach(function(reconciliation) {
      const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
      canonical.reconciliation = reconciliation;

      assertCanonicalInvalid_(assert, function() {
        validateCanonicalFinancialDocument(canonical);
      });
    });
  });

  QUnit.test('unrelated lifecycle, declaration, and profile fields are rejected', function(assert) {
    [
      'evidenceId',
      'declarationInstanceId',
      'operationReference',
      'declarationPeriod',
      'assignmentStatus',
      'expectedEvidenceManifest',
      'declarantProfile',
      'declarantName',
      'surname',
      'address',
      'postcode',
      'city',
      'creditorNumber',
      'applicantCode',
      'BSN',
      'IBAN'
    ].forEach(function(fieldName) {
      const canonical = createMinimalCanonicalFinancialDocument(syntheticCanonicalProvenance_());
      canonical[fieldName] = 'synthetic-forbidden';

      assertCanonicalInvalid_(assert, function() {
        validateCanonicalFinancialDocument(canonical);
      });
    });
  });

  QUnit.test('unknown fields are rejected throughout nested canonical structures', function(assert) {
    const cases = [];

    const expense = buildFullSyntheticCanonical_();
    expense.expenses[0].unexpected = true;
    cases.push(expense);

    const additionalCost = buildFullSyntheticCanonical_();
    additionalCost.additionalCosts[0].unexpected = true;
    cases.push(additionalCost);

    const adjustment = buildFullSyntheticCanonical_();
    adjustment.adjustments[0].unexpected = true;
    cases.push(adjustment);

    const vat = buildFullSyntheticCanonical_();
    vat.vat[0].unexpected = true;
    cases.push(vat);

    const totals = buildFullSyntheticCanonical_();
    totals.printedTotals.unexpected = true;
    cases.push(totals);

    const reconciliation = buildFullSyntheticCanonical_();
    reconciliation.reconciliation.unexpected = true;
    cases.push(reconciliation);

    cases.forEach(function(canonical) {
      assertCanonicalInvalid_(assert, function() {
        validateCanonicalFinancialDocument(canonical);
      });
    });
  });

  QUnit.test('full synthetic canonical document validates', function(assert) {
    const validated = validateCanonicalFinancialDocument(buildFullSyntheticCanonical_());

    assert.equal(validated.documentDate, '2099-01-31');
    assert.equal(validated.expenses.length, 2);
    assert.equal(validated.adjustments.length, 2);
    assert.equal(validated.additionalCosts.length, 2);
    assert.equal(validated.vat.length, 1);
    assert.equal(validated.reconciliation.status, RECONCILIATION_STATUS.MATCHED);
  });
}

function syntheticCanonicalProvenance_() {
  return {
    sourceFileName: 'synthetic-document.pdf',
    mimeType: 'application/pdf'
  };
}

function buildFullSyntheticCanonical_() {
  return {
    sourceProvenance: syntheticCanonicalProvenance_(),
    documentDate: '2099-01-31',
    sourceDocumentId: 'SYN-INV-002',
    expenses: [
      { description: 'Synthetic cable', quantity: 2, printedUnitAmount: 1729, printedLineAmount: 3458 },
      { description: 'Synthetic adapter', printedLineAmount: 850 }
    ],
    additionalCosts: [
      { description: 'Synthetic delivery', printedAmount: 340, category: ADDITIONAL_COST_CATEGORY.SHIPPING },
      { description: 'Synthetic handling', printedAmount: 100, category: ADDITIONAL_COST_CATEGORY.FEE }
    ],
    adjustments: [
      { description: 'Synthetic discount', printedAmount: -125, adjustmentType: ADJUSTMENT_TYPE.COMMERCIAL_DISCOUNT },
      { description: 'Synthetic unresolved adjustment', printedAmount: -50, adjustmentType: ADJUSTMENT_TYPE.UNRESOLVED }
    ],
    vat: [
      { printedRate: 21, printedAmount: 637 }
    ],
    printedTotals: {
      exclVAT: 3936,
      vatAmount: 637,
      inclVAT: 4573
    },
    reconciliation: {
      status: RECONCILIATION_STATUS.MATCHED,
      difference: 0
    }
  };
}

function assertCanonicalInvalid_(assert, action) {
  try {
    action();
    assert.ok(false, 'expected canonical financial document validation to fail');
  } catch (error) {
    assert.equal(error.name, 'CanonicalFinancialDocumentError');
    assert.equal(error.code, CANONICAL_FINANCIAL_DOCUMENT_ERROR_CODES.invalidCanonical);
  }
}
