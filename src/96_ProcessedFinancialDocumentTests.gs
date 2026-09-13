// QUnitGS2 regression tests for the pure ProcessedFinancialDocument envelope.

function registerProcessedFinancialDocumentTests_() {
  QUnit.module('Processed financial document');

  QUnit.test('factory creates the minimum recognized envelope deterministically', function(assert) {
    const processed = createProcessedFinancialDocument(
      syntheticProcessedFinancialDocumentInput_(),
      syntheticProcessedFinancialDocumentDependencies_()
    );

    assert.equal(processed.evidenceId, '11111111-1111-4111-8111-111111111111');
    assert.equal(processed.processedAt, '2099-02-01T11:22:33.000Z');
    assert.ok(processed.canonicalFinancialDocument);
    assert.equal(validateProcessedFinancialDocument(processed), processed);
  });

  QUnit.test('complete valid envelope passes direct validation', function(assert) {
    const processed = buildSyntheticProcessedFinancialDocument_();

    assert.equal(validateProcessedFinancialDocument(processed), processed);
  });

  QUnit.test('invalid envelope and canonical primitive types fail explicitly', function(assert) {
    [null, [], 'not-an-envelope'].forEach(function(value) {
      assertProcessedFinancialDocumentInvalid_(assert, function() {
        validateProcessedFinancialDocument(value);
      });
    });

    const processed = buildSyntheticProcessedFinancialDocument_();
    processed.canonicalFinancialDocument = 'not-a-canonical-document';
    assertProcessedFinancialDocumentInvalid_(assert, function() {
      validateProcessedFinancialDocument(processed);
    });
  });

  QUnit.test('all three envelope fields are required', function(assert) {
    ['evidenceId', 'canonicalFinancialDocument', 'processedAt'].forEach(function(fieldName) {
      const processed = buildSyntheticProcessedFinancialDocument_();
      delete processed[fieldName];

      assertProcessedFinancialDocumentInvalid_(assert, function() {
        validateProcessedFinancialDocument(processed);
      });
    });
  });

  QUnit.test('evidenceId reuses EvidenceRecord UUID semantics', function(assert) {
    [
      '',
      'not-a-uuid',
      '11111111-1111-3111-8111-111111111111',
      '11111111-1111-4111-7111-111111111111',
      'ABCDEFAB-CDEF-4ABC-ACDE-ABCDEFABCDEF',
      123
    ].forEach(function(evidenceId) {
      const processed = buildSyntheticProcessedFinancialDocument_();
      processed.evidenceId = evidenceId;

      assertProcessedFinancialDocumentInvalid_(assert, function() {
        validateProcessedFinancialDocument(processed);
      });
    });
  });

  QUnit.test('invalid canonical document is rejected through the envelope', function(assert) {
    const processed = buildSyntheticProcessedFinancialDocument_();
    delete processed.canonicalFinancialDocument.reconciliation;

    assertProcessedFinancialDocumentInvalid_(assert, function() {
      validateProcessedFinancialDocument(processed);
    });
  });

  QUnit.test('canonical unknown fields remain rejected through nested validation', function(assert) {
    const processed = buildSyntheticProcessedFinancialDocument_();
    processed.canonicalFinancialDocument.expenses[0].unreviewedClassification = true;

    assertProcessedFinancialDocumentInvalid_(assert, function() {
      validateProcessedFinancialDocument(processed);
    });
  });

  QUnit.test('unresolved canonical identity remains valid', function(assert) {
    const processed = createProcessedFinancialDocument(
      syntheticProcessedFinancialDocumentInput_(),
      syntheticProcessedFinancialDocumentDependencies_()
    );

    assert.notOk(Object.prototype.hasOwnProperty.call(
      processed.canonicalFinancialDocument,
      'documentDate'
    ));
    assert.notOk(Object.prototype.hasOwnProperty.call(
      processed.canonicalFinancialDocument,
      'sourceDocumentId'
    ));
  });

  QUnit.test('one envelope accepts one canonical document with multiple financial lines', function(assert) {
    const processed = buildSyntheticProcessedFinancialDocument_();

    assert.equal(processed.canonicalFinancialDocument.expenses.length, 2);
    assert.equal(processed.canonicalFinancialDocument.additionalCosts.length, 1);
    assert.equal(processed.canonicalFinancialDocument.adjustments.length, 1);
    assert.equal(processed.canonicalFinancialDocument.vat.length, 1);
    assert.notOk(Object.prototype.hasOwnProperty.call(processed, 'financialDocuments'));
  });

  QUnit.test('factory creates a deep canonical snapshot independent of caller mutation', function(assert) {
    const input = syntheticProcessedFinancialDocumentInput_(syntheticMultiLineCanonical_());
    const processed = createProcessedFinancialDocument(
      input,
      syntheticProcessedFinancialDocumentDependencies_()
    );

    input.canonicalFinancialDocument.sourceProvenance.sourceFileName = 'mutated.pdf';
    input.canonicalFinancialDocument.expenses[0].description = 'Mutated description';
    input.canonicalFinancialDocument.expenses.push({
      description: 'Late mutation',
      printedLineAmount: 999
    });
    input.canonicalFinancialDocument.printedTotals.inclVAT = 999;

    assert.equal(
      processed.canonicalFinancialDocument.sourceProvenance.sourceFileName,
      'synthetic-document.pdf'
    );
    assert.equal(processed.canonicalFinancialDocument.expenses[0].description, 'Synthetic cable');
    assert.equal(processed.canonicalFinancialDocument.expenses.length, 2);
    assert.equal(processed.canonicalFinancialDocument.printedTotals.inclVAT, 4573);
    assert.notEqual(processed.canonicalFinancialDocument, input.canonicalFinancialDocument);
  });

  QUnit.test('processedAt requires one real canonical UTC timestamp', function(assert) {
    [
      '2099-02-30T11:22:33.000Z',
      '2099-02-01T11:22:33Z',
      '2099-02-01T12:22:33.000+01:00',
      'not-a-timestamp',
      new Date('2099-02-01T11:22:33.000Z')
    ].forEach(function(processedAt) {
      const processed = buildSyntheticProcessedFinancialDocument_();
      processed.processedAt = processedAt;

      assertProcessedFinancialDocumentInvalid_(assert, function() {
        validateProcessedFinancialDocument(processed);
      });
    });
  });

  QUnit.test('factory rejects invalid clock dependencies and owns processedAt', function(assert) {
    assertProcessedFinancialDocumentInvalid_(assert, function() {
      createProcessedFinancialDocument(syntheticProcessedFinancialDocumentInput_(), {
        clock: 'not-a-function'
      });
    });
    assertProcessedFinancialDocumentInvalid_(assert, function() {
      createProcessedFinancialDocument(syntheticProcessedFinancialDocumentInput_(), []);
    });
    assertProcessedFinancialDocumentInvalid_(assert, function() {
      createProcessedFinancialDocument(syntheticProcessedFinancialDocumentInput_(), {
        clock: function() { return '2099-02-01T11:22:33.000Z'; }
      });
    });

    const callerTimestamp = syntheticProcessedFinancialDocumentInput_();
    callerTimestamp.processedAt = '2099-02-01T11:22:33.000Z';
    assertProcessedFinancialDocumentInvalid_(assert, function() {
      createProcessedFinancialDocument(
        callerTimestamp,
        syntheticProcessedFinancialDocumentDependencies_()
      );
    });
  });

  QUnit.test('factory rejects unknown inputs and dependency seams', function(assert) {
    const unknownInput = syntheticProcessedFinancialDocumentInput_();
    unknownInput.status = 'RECOGNIZED';
    assertProcessedFinancialDocumentInvalid_(assert, function() {
      createProcessedFinancialDocument(
        unknownInput,
        syntheticProcessedFinancialDocumentDependencies_()
      );
    });

    assertProcessedFinancialDocumentInvalid_(assert, function() {
      createProcessedFinancialDocument(syntheticProcessedFinancialDocumentInput_(), {
        clock: function() { return new Date('2099-02-01T11:22:33.000Z'); },
        registry: {}
      });
    });
  });

  QUnit.test('envelope rejects evidence, financial, lifecycle, storage, and profile leakage', function(assert) {
    [
      'processedDocumentId',
      'status',
      'sourceDocumentId',
      'documentDate',
      'expenses',
      'additionalCosts',
      'adjustments',
      'vat',
      'printedTotals',
      'reconciliation',
      'originRef',
      'contentRef',
      'evidence',
      'evidenceRecord',
      'sha256',
      'sourceFileName',
      'mimeType',
      'rawSizeBytes',
      'capturedAt',
      'declarationInstanceId',
      'DeclarationPeriod',
      'declarationPeriod',
      'operationReference',
      'assignmentStatus',
      'expectedEvidenceManifest',
      'archivePdfRef',
      'submittedAt',
      'archivedAt',
      'registryRow',
      'storageRef',
      'declarantProfile',
      'name',
      'surname',
      'address',
      'postcode',
      'city',
      'IBAN',
      'BSN',
      'KvK',
      'creditorNumber',
      'applicantCode'
    ].forEach(function(fieldName) {
      const processed = buildSyntheticProcessedFinancialDocument_();
      processed[fieldName] = 'synthetic-forbidden';

      assertProcessedFinancialDocumentInvalid_(assert, function() {
        validateProcessedFinancialDocument(processed);
      });
    });
  });

  QUnit.test('validation errors identify structure without reproducing canonical values', function(assert) {
    const processed = buildSyntheticProcessedFinancialDocument_();
    const syntheticSensitiveValue = 'SYNTHETIC-VALUE-DO-NOT-ECHO';
    processed.canonicalFinancialDocument.expenses[0].description = syntheticSensitiveValue;
    processed.canonicalFinancialDocument.expenses[0].unexpected = true;
    let caught = null;

    try {
      validateProcessedFinancialDocument(processed);
    } catch (error) {
      caught = error;
    }

    assert.ok(caught, 'expected ProcessedFinancialDocument validation failure');
    assert.equal(caught.name, 'ProcessedFinancialDocumentError');
    assert.equal(caught.code, PROCESSED_FINANCIAL_DOCUMENT_ERROR_CODES.invalidProcessedDocument);
    assert.equal(caught.message.indexOf(syntheticSensitiveValue), -1);
  });
}

function buildSyntheticProcessedFinancialDocument_() {
  return {
    evidenceId: '11111111-1111-4111-8111-111111111111',
    canonicalFinancialDocument: syntheticMultiLineCanonical_(),
    processedAt: '2099-02-01T11:22:33.000Z'
  };
}

function syntheticProcessedFinancialDocumentInput_(canonicalFinancialDocument) {
  return {
    evidenceId: '11111111-1111-4111-8111-111111111111',
    canonicalFinancialDocument: canonicalFinancialDocument ||
      createMinimalCanonicalFinancialDocument(syntheticProcessedCanonicalProvenance_())
  };
}

function syntheticProcessedFinancialDocumentDependencies_() {
  return {
    clock: function() { return new Date('2099-02-01T11:22:33.000Z'); }
  };
}

function syntheticProcessedCanonicalProvenance_() {
  return {
    sourceFileName: 'synthetic-document.pdf',
    mimeType: 'application/pdf'
  };
}

function syntheticMultiLineCanonical_() {
  return {
    sourceProvenance: syntheticProcessedCanonicalProvenance_(),
    documentDate: '2099-01-31',
    sourceDocumentId: 'SYN-DOC-002',
    expenses: [
      { description: 'Synthetic cable', quantity: 2, printedUnitAmount: 1729, printedLineAmount: 3458 },
      { description: 'Synthetic adapter', printedLineAmount: 850 }
    ],
    additionalCosts: [
      { description: 'Synthetic delivery', printedAmount: 340, category: ADDITIONAL_COST_CATEGORY.SHIPPING }
    ],
    adjustments: [
      { description: 'Synthetic discount', printedAmount: -75, adjustmentType: ADJUSTMENT_TYPE.COMMERCIAL_DISCOUNT }
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

function assertProcessedFinancialDocumentInvalid_(assert, action) {
  try {
    action();
    assert.ok(false, 'expected ProcessedFinancialDocument validation to fail');
  } catch (error) {
    assert.equal(error.name, 'ProcessedFinancialDocumentError');
    assert.equal(error.code, PROCESSED_FINANCIAL_DOCUMENT_ERROR_CODES.invalidProcessedDocument);
  }
}
