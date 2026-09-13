// Pure, downward-only projections derived from ProcessedFinancialDocument.

const FINANCIAL_DOCUMENT_REGISTRY_PROJECTION_TABS = Object.freeze([
  'Documenten', 'Regels', 'ExtraKosten', 'Correcties', 'BTW'
]);

function buildFinancialDocumentProjections(processedDocument) {
  try {
    validateProcessedFinancialDocument(processedDocument);
  } catch (error) {
    throw createFinancialDocumentRegistryError_(
      FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.validation,
      'buildProjections'
    );
  }
  const evidenceId = processedDocument.evidenceId;
  const canonical = processedDocument.canonicalFinancialDocument;
  const blank = function(owner, fieldName) {
    return registryHasOwn_(owner, fieldName) ? owner[fieldName] : '';
  };

  return {
    Documenten: [[
      evidenceId,
      blank(canonical, 'documentDate'),
      blank(canonical, 'sourceDocumentId'),
      canonical.sourceProvenance.sourceFileName,
      canonical.sourceProvenance.mimeType,
      canonical.expenses.length,
      canonical.additionalCosts.length,
      canonical.adjustments.length,
      canonical.vat.length,
      blank(canonical.printedTotals, 'exclVAT'),
      blank(canonical.printedTotals, 'vatAmount'),
      blank(canonical.printedTotals, 'inclVAT'),
      canonical.reconciliation.status,
      blank(canonical.reconciliation, 'difference'),
      processedDocument.processedAt
    ]],
    Regels: canonical.expenses.map(function(expense, index) {
      return [
        evidenceId, index, expense.description, blank(expense, 'quantity'),
        blank(expense, 'printedUnitAmount'), expense.printedLineAmount
      ];
    }),
    ExtraKosten: canonical.additionalCosts.map(function(cost, index) {
      return [
        evidenceId, index, cost.category, blank(cost, 'description'), cost.printedAmount
      ];
    }),
    Correcties: canonical.adjustments.map(function(adjustment, index) {
      return [
        evidenceId, index, adjustment.adjustmentType, adjustment.description,
        adjustment.printedAmount
      ];
    }),
    BTW: canonical.vat.map(function(entry, index) {
      return [
        evidenceId, index, blank(entry, 'printedRate'), blank(entry, 'printedAmount')
      ];
    })
  };
}

function verifyFinancialDocumentProjections_(workbook, processedDocument) {
  const expected = buildFinancialDocumentProjections(processedDocument);
  const evidenceId = processedDocument.evidenceId;
  FINANCIAL_DOCUMENT_REGISTRY_PROJECTION_TABS.forEach(function(tab) {
    const actual = readRegistryRows_(workbook, tab).filter(function(row) {
      return Array.isArray(row) && row[0] === evidenceId;
    });
    if (!registryMatricesEqual_(actual, expected[tab])) {
      throw createFinancialDocumentRegistryError_(
        FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.projectionDrift,
        'verifyProjections',
        { tab: tab, evidenceId: evidenceId, expectedCount: expected[tab].length, actualCount: actual.length }
      );
    }
  });
  return true;
}

function replaceFinancialDocumentProjections_(workbook, processedDocument) {
  const expected = buildFinancialDocumentProjections(processedDocument);
  const evidenceId = processedDocument.evidenceId;
  FINANCIAL_DOCUMENT_REGISTRY_PROJECTION_TABS.forEach(function(tab) {
    const retained = readRegistryRows_(workbook, tab).filter(function(row) {
      return isEmptyRegistryRow_(row) || row[0] !== evidenceId;
    }).filter(function(row) {
      return !isEmptyRegistryRow_(row);
    });
    writeRegistryRows_(workbook, tab, sortFinancialProjectionRows_(tab, retained.concat(expected[tab])));
  });
  flushRegistryWorkbook_(workbook);
  verifyFinancialDocumentProjections_(workbook, processedDocument);
  return expected;
}

function rebuildAllFinancialDocumentProjections_(workbook, dependencies) {
  const recognized = readAllProcessedFinancialDocuments_(workbook, dependencies);
  const all = { Documenten: [], Regels: [], ExtraKosten: [], Correcties: [], BTW: [] };
  recognized.sort(function(left, right) {
    return left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0;
  }).forEach(function(processedDocument) {
    const built = buildFinancialDocumentProjections(processedDocument);
    FINANCIAL_DOCUMENT_REGISTRY_PROJECTION_TABS.forEach(function(tab) {
      all[tab] = all[tab].concat(built[tab]);
    });
  });
  FINANCIAL_DOCUMENT_REGISTRY_PROJECTION_TABS.forEach(function(tab) {
    writeRegistryRows_(workbook, tab, all[tab]);
  });
  flushRegistryWorkbook_(workbook);
  recognized.forEach(function(processedDocument) {
    verifyFinancialDocumentProjections_(workbook, processedDocument);
  });
  return { recognizedDocumentCount: recognized.length };
}

function auditAllFinancialDocumentProjections_(workbook, dependencies) {
  const recognized = readAllProcessedFinancialDocuments_(workbook, dependencies);
  const expected = { Documenten: [], Regels: [], ExtraKosten: [], Correcties: [], BTW: [] };
  recognized.sort(function(left, right) {
    return left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0;
  }).forEach(function(processedDocument) {
    const built = buildFinancialDocumentProjections(processedDocument);
    FINANCIAL_DOCUMENT_REGISTRY_PROJECTION_TABS.forEach(function(tab) {
      expected[tab] = expected[tab].concat(built[tab]);
    });
  });
  FINANCIAL_DOCUMENT_REGISTRY_PROJECTION_TABS.forEach(function(tab) {
    const actual = sortFinancialProjectionRows_(tab, readRegistryRows_(workbook, tab).filter(function(row) {
      return !isEmptyRegistryRow_(row);
    }));
    if (!registryMatricesEqual_(actual, expected[tab])) {
      throw createFinancialDocumentRegistryError_(
        FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.projectionDrift,
        'auditProjections',
        { tab: tab, expectedCount: expected[tab].length, actualCount: actual.length }
      );
    }
  });
  return { recognizedDocumentCount: recognized.length, valid: true };
}

function sortFinancialProjectionRows_(tab, rows) {
  return rows.slice().sort(function(left, right) {
    if (left[0] !== right[0]) return left[0] < right[0] ? -1 : 1;
    if (tab === 'Documenten') return 0;
    if (left[1] !== right[1]) return left[1] < right[1] ? -1 : 1;
    return 0;
  });
}
