// Canonical financial document contract.
//
// This is the normalized, calculation-safe representation of a source document
// after identity resolution and financial normalization from RawDocumentExtraction.
//
// All monetary values use integer minor units (cents for EUR).
// This contract is independent of any specific extraction provider or document layout.

const CANONICAL_FINANCIAL_DOCUMENT_ERROR_CODES = Object.freeze({
  invalidCanonical: 'INVALID_CANONICAL_FINANCIAL_DOCUMENT'
});

const ADJUSTMENT_TYPE = Object.freeze({
  COMMERCIAL_DISCOUNT: 'COMMERCIAL_DISCOUNT',
  PERSONAL_BENEFIT: 'PERSONAL_BENEFIT',
  OTHER_ADJUSTMENT: 'OTHER_ADJUSTMENT',
  UNRESOLVED: 'UNRESOLVED'
});

const ADDITIONAL_COST_CATEGORY = Object.freeze({
  SHIPPING: 'SHIPPING',
  FEE: 'FEE'
});

const RECONCILIATION_STATUS = Object.freeze({
  MATCHED: 'MATCHED',
  MISMATCH: 'MISMATCH',
  NOT_CHECKABLE: 'NOT_CHECKABLE'
});

function createCanonicalFinancialDocumentError_(code, message) {
  const error = new Error(message);
  error.name = 'CanonicalFinancialDocumentError';
  error.code = code;
  return error;
}

/**
 * Validates that the supplied object conforms to the canonical financial document contract.
 * Throws CanonicalFinancialDocumentError on any structural violation.
 */
function validateCanonicalFinancialDocument(canonical) {
  assertCanonicalObject_(canonical, '$');

  const allowedTopLevel = [
    'sourceProvenance',
    'documentDate',
    'sourceDocumentId',
    'expenses',
    'additionalCosts',
    'adjustments',
    'vat',
    'printedTotals',
    'reconciliation'
  ];
  assertCanonicalAllowedFields_(canonical, allowedTopLevel, '$');

  if (!hasCanonicalField_(canonical, 'sourceProvenance')) {
    throwInvalidCanonical_('sourceProvenance', 'required object is missing');
  }
  validateCanonicalSourceProvenance_(canonical.sourceProvenance);

  validateOptionalCanonicalDate_(canonical, 'documentDate');
  validateOptionalCanonicalString_(canonical, 'sourceDocumentId', 'sourceDocumentId');

  validateCanonicalExpenses_(canonical);
  validateCanonicalAdditionalCosts_(canonical);
  validateCanonicalAdjustments_(canonical);
  validateCanonicalVat_(canonical);
  validateCanonicalPrintedTotals_(canonical);
  validateCanonicalReconciliation_(canonical);

  return canonical;
}

function validateCanonicalSourceProvenance_(provenance) {
  assertCanonicalObject_(provenance, 'sourceProvenance');
  assertCanonicalAllowedFields_(provenance, ['sourceFileName', 'mimeType'], 'sourceProvenance');

  if (
    typeof provenance.sourceFileName !== 'string' ||
    provenance.sourceFileName.trim() === ''
  ) {
    throwInvalidCanonical_('sourceProvenance.sourceFileName', 'must be a non-empty string');
  }
  if (typeof provenance.mimeType !== 'string' || provenance.mimeType.trim() === '') {
    throwInvalidCanonical_('sourceProvenance.mimeType', 'must be a non-empty string');
  }
}

function validateOptionalCanonicalDate_(owner, fieldName) {
  if (!hasCanonicalField_(owner, fieldName)) {
    return;
  }
  const value = owner[fieldName];
  if (typeof value !== 'string') {
    throwInvalidCanonical_(fieldName, 'must be a string when present');
  }
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    throwInvalidCanonical_(fieldName, 'must be a real calendar date in YYYY-MM-DD form when present');
  }

  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const daysInMonth = [31, isCanonicalLeapYear_(year) ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];

  if (month < 1 || month > 12 || day < 1 || day > daysInMonth[month - 1]) {
    throwInvalidCanonical_(fieldName, 'must be a real calendar date in YYYY-MM-DD form when present');
  }
}

function isCanonicalLeapYear_(year) {
  return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
}

function validateOptionalCanonicalString_(owner, fieldName, path) {
  if (hasCanonicalField_(owner, fieldName)) {
    const value = owner[fieldName];
    if (typeof value !== 'string' || value.trim() === '') {
      throwInvalidCanonical_(path, 'must be a non-empty string when present');
    }
  }
}

function validateCanonicalExpenses_(canonical) {
  if (!hasCanonicalField_(canonical, 'expenses')) {
    throwInvalidCanonical_('expenses', 'required array is missing');
  }

  const expenses = canonical.expenses;
  assertCanonicalArray_(expenses, 'expenses');

  expenses.forEach(function(expense, index) {
    const path = 'expenses[' + index + ']';
    assertCanonicalObject_(expense, path);
    assertCanonicalAllowedFields_(
      expense,
      ['description', 'quantity', 'printedUnitAmount', 'printedLineAmount'],
      path
    );

    if (!hasCanonicalField_(expense, 'description')) {
      throwInvalidCanonical_(path + '.description', 'required field is missing');
    }
    if (typeof expense.description !== 'string' || expense.description.trim() === '') {
      throwInvalidCanonical_(path + '.description', 'must be a non-empty string');
    }

    if (hasCanonicalField_(expense, 'quantity')) {
      validateCanonicalQuantity_(expense.quantity, path + '.quantity');
    }

    if (hasCanonicalField_(expense, 'printedUnitAmount')) {
      validateCanonicalMinorUnits_(expense.printedUnitAmount, path + '.printedUnitAmount');
    }

    if (!hasCanonicalField_(expense, 'printedLineAmount')) {
      throwInvalidCanonical_(path + '.printedLineAmount', 'required field is missing');
    }
    validateCanonicalMinorUnits_(expense.printedLineAmount, path + '.printedLineAmount');
  });
}

function validateCanonicalAdditionalCosts_(canonical) {
  if (!hasCanonicalField_(canonical, 'additionalCosts')) {
    throwInvalidCanonical_('additionalCosts', 'required array is missing');
  }

  const costs = canonical.additionalCosts;
  assertCanonicalArray_(costs, 'additionalCosts');

  costs.forEach(function(cost, index) {
    const path = 'additionalCosts[' + index + ']';
    assertCanonicalObject_(cost, path);
    assertCanonicalAllowedFields_(
      cost,
      ['description', 'printedAmount', 'category'],
      path
    );

    if (hasCanonicalField_(cost, 'description')) {
      if (typeof cost.description !== 'string' || cost.description.trim() === '') {
        throwInvalidCanonical_(path + '.description', 'must be a non-empty string when present');
      }
    }

    if (!hasCanonicalField_(cost, 'printedAmount')) {
      throwInvalidCanonical_(path + '.printedAmount', 'required field is missing');
    }
    validateCanonicalMinorUnits_(cost.printedAmount, path + '.printedAmount');

    if (!hasCanonicalField_(cost, 'category')) {
      throwInvalidCanonical_(path + '.category', 'required field is missing');
    }
    const cat = cost.category;
    if (
      cat !== ADDITIONAL_COST_CATEGORY.SHIPPING &&
      cat !== ADDITIONAL_COST_CATEGORY.FEE
    ) {
      throwInvalidCanonical_(path + '.category', 'must be SHIPPING or FEE');
    }
  });
}

function validateCanonicalAdjustments_(canonical) {
  if (!hasCanonicalField_(canonical, 'adjustments')) {
    throwInvalidCanonical_('adjustments', 'required array is missing');
  }

  const adjustments = canonical.adjustments;
  assertCanonicalArray_(adjustments, 'adjustments');

  adjustments.forEach(function(adj, index) {
    const path = 'adjustments[' + index + ']';
    assertCanonicalObject_(adj, path);
    assertCanonicalAllowedFields_(
      adj,
      ['description', 'printedAmount', 'adjustmentType'],
      path
    );

    if (!hasCanonicalField_(adj, 'description')) {
      throwInvalidCanonical_(path + '.description', 'required field is missing');
    }
    if (typeof adj.description !== 'string' || adj.description.trim() === '') {
      throwInvalidCanonical_(path + '.description', 'must be a non-empty string');
    }

    if (!hasCanonicalField_(adj, 'printedAmount')) {
      throwInvalidCanonical_(path + '.printedAmount', 'required field is missing');
    }
    validateCanonicalMinorUnits_(adj.printedAmount, path + '.printedAmount');
    if (adj.printedAmount >= 0) {
      throwInvalidCanonical_(path + '.printedAmount', 'must be a negative signed adjustment');
    }

    if (!hasCanonicalField_(adj, 'adjustmentType')) {
      throwInvalidCanonical_(path + '.adjustmentType', 'required field is missing');
    }
    const type = adj.adjustmentType;
    if (
      type !== ADJUSTMENT_TYPE.COMMERCIAL_DISCOUNT &&
      type !== ADJUSTMENT_TYPE.PERSONAL_BENEFIT &&
      type !== ADJUSTMENT_TYPE.OTHER_ADJUSTMENT &&
      type !== ADJUSTMENT_TYPE.UNRESOLVED
    ) {
      throwInvalidCanonical_(path + '.adjustmentType', 'must be a valid adjustment type');
    }
  });
}

function validateCanonicalVat_(canonical) {
  if (!hasCanonicalField_(canonical, 'vat')) {
    throwInvalidCanonical_('vat', 'required array is missing');
  }

  const vatEntries = canonical.vat;
  assertCanonicalArray_(vatEntries, 'vat');

  vatEntries.forEach(function(vat, index) {
    const path = 'vat[' + index + ']';
    assertCanonicalObject_(vat, path);
    assertCanonicalAllowedFields_(vat, ['printedRate', 'printedAmount'], path);

    if (hasCanonicalField_(vat, 'printedRate')) {
      const rate = vat.printedRate;
      if (typeof rate !== 'number' || !isFinite(rate) || rate < 0) {
        throwInvalidCanonical_(path + '.printedRate', 'must be a non-negative finite number when present');
      }
    }

    if (hasCanonicalField_(vat, 'printedAmount')) {
      validateCanonicalMinorUnits_(vat.printedAmount, path + '.printedAmount');
    }

    if (
      !hasCanonicalField_(vat, 'printedRate') &&
      !hasCanonicalField_(vat, 'printedAmount')
    ) {
      throwInvalidCanonical_(path, 'at least a printedRate or printedAmount is required');
    }
  });
}

function validateCanonicalPrintedTotals_(canonical) {
  if (!hasCanonicalField_(canonical, 'printedTotals')) {
    throwInvalidCanonical_('printedTotals', 'required object is missing');
  }

  const totals = canonical.printedTotals;
  assertCanonicalObject_(totals, 'printedTotals');
  assertCanonicalAllowedFields_(totals, ['exclVAT', 'vatAmount', 'inclVAT'], 'printedTotals');

  if (hasCanonicalField_(totals, 'exclVAT')) {
    validateCanonicalMinorUnits_(totals.exclVAT, 'printedTotals.exclVAT');
  }
  if (hasCanonicalField_(totals, 'vatAmount')) {
    validateCanonicalMinorUnits_(totals.vatAmount, 'printedTotals.vatAmount');
  }
  if (hasCanonicalField_(totals, 'inclVAT')) {
    validateCanonicalMinorUnits_(totals.inclVAT, 'printedTotals.inclVAT');
  }
}

function validateCanonicalReconciliation_(canonical) {
  if (!hasCanonicalField_(canonical, 'reconciliation')) {
    throwInvalidCanonical_('reconciliation', 'required object is missing');
  }

  const rec = canonical.reconciliation;
  assertCanonicalObject_(rec, 'reconciliation');
  assertCanonicalAllowedFields_(rec, ['status', 'difference'], 'reconciliation');

  if (!hasCanonicalField_(rec, 'status')) {
    throwInvalidCanonical_('reconciliation.status', 'required field is missing');
  }
  const status = rec.status;
  if (
    status !== RECONCILIATION_STATUS.MATCHED &&
    status !== RECONCILIATION_STATUS.MISMATCH &&
    status !== RECONCILIATION_STATUS.NOT_CHECKABLE
  ) {
    throwInvalidCanonical_('reconciliation.status', 'must be MATCHED, MISMATCH, or NOT_CHECKABLE');
  }

  const hasDifference = hasCanonicalField_(rec, 'difference');

  if (status === RECONCILIATION_STATUS.NOT_CHECKABLE) {
    if (hasDifference) {
      throwInvalidCanonical_('reconciliation.difference', 'must not be present when status is NOT_CHECKABLE');
    }
    return;
  }

  if (!hasDifference) {
    throwInvalidCanonical_('reconciliation.difference', 'is required when reconciliation was performed');
  }
  validateCanonicalMinorUnits_(rec.difference, 'reconciliation.difference');

  if (status === RECONCILIATION_STATUS.MATCHED && rec.difference !== 0) {
    throwInvalidCanonical_('reconciliation.difference', 'must be zero when status is MATCHED');
  }
  if (status === RECONCILIATION_STATUS.MISMATCH && rec.difference === 0) {
    throwInvalidCanonical_('reconciliation.difference', 'must be non-zero when status is MISMATCH');
  }
}

function validateCanonicalQuantity_(value, path) {
  if (typeof value !== 'number' || !isFinite(value) || value <= 0) {
    throwInvalidCanonical_(path, 'must be a positive finite number');
  }
}

function validateCanonicalMinorUnits_(value, path) {
  if (!Number.isSafeInteger(value)) {
    throwInvalidCanonical_(path, 'must be a safe integer (minor units)');
  }
}

function assertCanonicalObject_(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throwInvalidCanonical_(path, 'must be an object');
  }
}

function assertCanonicalArray_(value, path) {
  if (!Array.isArray(value)) {
    throwInvalidCanonical_(path, 'must be an array');
  }
}

function assertCanonicalAllowedFields_(value, allowedFields, path) {
  Object.keys(value).forEach(function(fieldName) {
    if (allowedFields.indexOf(fieldName) === -1) {
      throwInvalidCanonical_(path + '.' + fieldName, 'unexpected field');
    }
  });
}

function hasCanonicalField_(value, fieldName) {
  return Object.prototype.hasOwnProperty.call(value, fieldName);
}

function throwInvalidCanonical_(path, reason) {
  throw createCanonicalFinancialDocumentError_(
    CANONICAL_FINANCIAL_DOCUMENT_ERROR_CODES.invalidCanonical,
    'Invalid canonical financial document at ' + path + ': ' + reason + '.'
  );
}

/**
 * Creates a minimal valid canonical financial document for the given provenance.
 * All financial collections are empty and reconciliation is NOT_CHECKABLE.
 * Use this as a starting point for normalization logic.
 */
function createMinimalCanonicalFinancialDocument(sourceProvenance) {
  const doc = {
    sourceProvenance: sourceProvenance,
    expenses: [],
    additionalCosts: [],
    adjustments: [],
    vat: [],
    printedTotals: {},
    reconciliation: {
      status: RECONCILIATION_STATUS.NOT_CHECKABLE
    }
  };

  // documentDate and sourceDocumentId intentionally omitted when unresolved
  return validateCanonicalFinancialDocument(doc);
}
