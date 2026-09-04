// QUnitGS2 regression tests for the raw document extraction boundary.

function registerRawDocumentExtractionTests_() {
  QUnit.module('Raw document extraction');

  QUnit.test('minimal valid model output produces a completed extraction', function(assert) {
    const result = parseSyntheticRawExtraction_(minimalRawModelOutput_());

    assert.equal(result.sourceProvenance.sourceFileName, 'synthetic-document.pdf');
    assert.equal(result.sourceProvenance.mimeType, 'application/pdf');
    assert.notOk(hasRawExtractionField_(result, 'documentTypeEvidence'));
    assert.deepEqual(result.identityEvidence.dates, []);
    assert.deepEqual(result.identityEvidence.identifiers, []);
    assert.deepEqual(result.financialEvidence.items, []);
    assert.deepEqual(result.financialEvidence.additionalCosts, []);
    assert.deepEqual(result.financialEvidence.adjustments, []);
    assert.deepEqual(result.financialEvidence.vat, []);
    assert.deepEqual(result.financialEvidence.totals, []);
  });

  QUnit.test('full synthetic evidence preserves raw values and ordering', function(assert) {
    const modelOutput = fullRawModelOutput_();
    const result = parseSyntheticRawExtraction_(modelOutput);

    assert.equal(result.documentTypeEvidence.rawValue, '  Synthetic invoice  ');
    assert.equal(result.documentTypeEvidence.printedLabel, 'Document kind');
    assert.equal(result.identityEvidence.dates.length, 2);
    assert.equal(result.identityEvidence.dates[0].rawValue, ' 31 January 2099 ');
    assert.equal(result.identityEvidence.dates[1].rawValue, '29 January 2099');
    assert.equal(result.identityEvidence.identifiers.length, 2);
    assert.equal(result.identityEvidence.identifiers[0].rawValue, 'SYN-INV-002');
    assert.equal(result.identityEvidence.identifiers[1].rawValue, 'SYN-ORDER-900');
    assert.equal(result.financialEvidence.items[0].quantity.rawValue, ' 2 ');
    assert.equal(result.financialEvidence.items[0].printedUnitAmount.rawValue, ' € 17,29 ');
    assert.equal(result.financialEvidence.items[0].printedLineAmount.rawValue, '€ 34,58');
    assert.equal(result.financialEvidence.additionalCosts[0].printedLineAmount.rawValue, '€ 3,40');
    assert.equal(result.financialEvidence.adjustments[0].printedAmount.rawValue, '- € 1,25');
    assert.equal(result.financialEvidence.vat[0].printedRate.rawValue, '21%');
    assert.equal(result.financialEvidence.vat[0].printedAmount.rawValue, '€ 6,37');
    assert.equal(result.financialEvidence.totals.length, 2);
    assert.equal(result.financialEvidence.totals[0].printedAmount.rawValue, '€ 30,36');
    assert.equal(result.financialEvidence.totals[1].printedAmount.rawValue, '€ 36,73');
    assert.equal(result.financialEvidence.totals[1].printedAmount.context, 'document footer');
  });

  QUnit.test('trusted provenance is attached without filename interpretation', function(assert) {
    const result = parseRawDocumentExtraction(
      JSON.stringify(minimalRawModelOutput_()),
      {
        sourceFileName: 'SYN-IDENTIFIER-ONLY.pdf',
        mimeType: 'application/pdf',
        rawSizeBytes: 25
      }
    );

    assert.deepEqual(result.sourceProvenance, {
      sourceFileName: 'SYN-IDENTIFIER-ONLY.pdf',
      mimeType: 'application/pdf'
    });
    assert.deepEqual(result.identityEvidence.identifiers, []);
  });

  QUnit.test('model-authored provenance is rejected', function(assert) {
    const modelOutput = minimalRawModelOutput_();
    modelOutput.sourceProvenance = {
      sourceFileName: 'untrusted.pdf',
      mimeType: 'application/pdf'
    };

    assertInvalidRawModelObject_(assert, modelOutput);
  });

  QUnit.test('model-authored canonical identity fields are rejected', function(assert) {
    ['documentDate', 'sourceDocumentId'].forEach(function(fieldName) {
      const modelOutput = minimalRawModelOutput_();
      modelOutput[fieldName] = 'synthetic-authority';
      assertInvalidRawModelObject_(assert, modelOutput);
    });
  });

  QUnit.test('malformed JSON fails with a distinct error code', function(assert) {
    assertRawDocumentExtractionError_(assert, function() {
      parseRawDocumentExtraction('{not-json', syntheticRawProvenance_());
    }, RAW_DOCUMENT_EXTRACTION_ERROR_CODES.invalidJson);
  });

  QUnit.test('wrong top-level JSON types fail structurally', function(assert) {
    ['[]', '"text"', 'null'].forEach(function(modelJsonText) {
      assertRawDocumentExtractionError_(assert, function() {
        parseRawDocumentExtraction(modelJsonText, syntheticRawProvenance_());
      }, RAW_DOCUMENT_EXTRACTION_ERROR_CODES.invalidStructure);
    });
  });

  QUnit.test('required evidence objects must be present', function(assert) {
    ['identityEvidence', 'financialEvidence'].forEach(function(fieldName) {
      const modelOutput = minimalRawModelOutput_();
      delete modelOutput[fieldName];
      assertInvalidRawModelObject_(assert, modelOutput);
    });
  });

  QUnit.test('required evidence collections must be present', function(assert) {
    const withoutDates = minimalRawModelOutput_();
    delete withoutDates.identityEvidence.dates;
    assertInvalidRawModelObject_(assert, withoutDates);

    const withoutTotals = minimalRawModelOutput_();
    delete withoutTotals.financialEvidence.totals;
    assertInvalidRawModelObject_(assert, withoutTotals);
  });

  QUnit.test('evidence collections must be arrays', function(assert) {
    const invalidDates = minimalRawModelOutput_();
    invalidDates.identityEvidence.dates = {};
    assertInvalidRawModelObject_(assert, invalidDates);

    const invalidItems = minimalRawModelOutput_();
    invalidItems.financialEvidence.items = 'value';
    assertInvalidRawModelObject_(assert, invalidItems);
  });

  QUnit.test('unknown fields fail recursively', function(assert) {
    const cases = [];

    const topLevel = minimalRawModelOutput_();
    topLevel.unexpected = true;
    cases.push(topLevel);

    const identity = minimalRawModelOutput_();
    identity.identityEvidence.unexpected = [];
    cases.push(identity);

    const financial = minimalRawModelOutput_();
    financial.financialEvidence.unexpected = [];
    cases.push(financial);

    const rawObservation = minimalRawModelOutput_();
    rawObservation.identityEvidence.dates.push({ rawValue: '2099-01-01', unexpected: true });
    cases.push(rawObservation);

    const composite = minimalRawModelOutput_();
    composite.financialEvidence.items.push({
      description: { rawValue: 'Synthetic item' },
      unexpected: true
    });
    cases.push(composite);

    cases.forEach(function(modelOutput) {
      assertInvalidRawModelObject_(assert, modelOutput);
    });
  });

  QUnit.test('labels and context belong only to RawObservation values', function(assert) {
    const modelOutput = minimalRawModelOutput_();
    modelOutput.financialEvidence.vat.push({
      printedAmount: { rawValue: '€ 1,80' },
      context: 'not permitted on the composite observation'
    });

    assertInvalidRawModelObject_(assert, modelOutput);
  });

  QUnit.test('RawObservation requires an unmodified non-whitespace string value', function(assert) {
    [
      {},
      { rawValue: 12 },
      { rawValue: '' },
      { rawValue: '   ' },
      { rawValue: 'value', printedLabel: 12 },
      { rawValue: 'value', context: null }
    ].forEach(function(observation) {
      const modelOutput = minimalRawModelOutput_();
      modelOutput.identityEvidence.dates.push(observation);
      assertInvalidRawModelObject_(assert, modelOutput);
    });

    const meaningfulWhitespace = minimalRawModelOutput_();
    meaningfulWhitespace.financialEvidence.totals.push({
      printedAmount: { rawValue: '  € 17,29  ' }
    });
    const result = parseSyntheticRawExtraction_(meaningfulWhitespace);
    assert.equal(
      result.financialEvidence.totals[0].printedAmount.rawValue,
      '  € 17,29  '
    );
  });

  QUnit.test('nested structural errors report paths without evidence values', function(assert) {
    const rawEvidenceValue = 'SYNTHETIC-EVIDENCE-DO-NOT-ECHO';
    const modelOutput = minimalRawModelOutput_();
    modelOutput.financialEvidence.totals.push({
      printedAmount: {
        rawValue: rawEvidenceValue,
        unexpectedField: true
      }
    });

    let caughtError = null;
    try {
      parseSyntheticRawExtraction_(modelOutput);
    } catch (error) {
      caughtError = error;
    }

    if (!caughtError) {
      assert.ok(false, 'expected a nested structural validation error');
      return;
    }

    assert.equal(
      caughtError.code,
      RAW_DOCUMENT_EXTRACTION_ERROR_CODES.invalidStructure
    );
    assert.ok(
      caughtError.message.indexOf(
        'financialEvidence.totals[0].printedAmount.unexpectedField'
      ) !== -1,
      'error identifies the nested structural path'
    );
    assert.equal(
      caughtError.message.indexOf(rawEvidenceValue),
      -1,
      'error does not reproduce the raw evidence value'
    );
  });

  QUnit.test('expense observation requires a description', function(assert) {
    const modelOutput = minimalRawModelOutput_();
    modelOutput.financialEvidence.items.push({
      quantity: { rawValue: '1' },
      printedLineAmount: { rawValue: '€ 8,00' }
    });

    assertInvalidRawModelObject_(assert, modelOutput);
  });

  QUnit.test('additional cost requires at least one printed amount', function(assert) {
    const modelOutput = minimalRawModelOutput_();
    modelOutput.financialEvidence.additionalCosts.push({
      description: { rawValue: 'Synthetic service cost' }
    });

    assertInvalidRawModelObject_(assert, modelOutput);
  });

  QUnit.test('adjustment requires a signed printed amount observation', function(assert) {
    const modelOutput = minimalRawModelOutput_();
    modelOutput.financialEvidence.adjustments.push({
      description: { rawValue: 'Synthetic reduction' }
    });

    assertInvalidRawModelObject_(assert, modelOutput);
  });

  QUnit.test('VAT observation requires a printed rate or amount', function(assert) {
    const modelOutput = minimalRawModelOutput_();
    modelOutput.financialEvidence.vat.push({});

    assertInvalidRawModelObject_(assert, modelOutput);
  });

  QUnit.test('total observation requires a printed amount', function(assert) {
    const modelOutput = minimalRawModelOutput_();
    modelOutput.financialEvidence.totals.push({});

    assertInvalidRawModelObject_(assert, modelOutput);
  });

  QUnit.test('optional nested observations may be omitted', function(assert) {
    const modelOutput = minimalRawModelOutput_();
    modelOutput.financialEvidence.items.push({
      description: { rawValue: 'Synthetic item' }
    });
    modelOutput.financialEvidence.additionalCosts.push({
      printedUnitAmount: { rawValue: '€ 2,00' }
    });
    modelOutput.financialEvidence.adjustments.push({
      printedAmount: { rawValue: '- € 0,50' }
    });
    modelOutput.financialEvidence.vat.push({
      printedRate: { rawValue: '9%' }
    });
    modelOutput.financialEvidence.totals.push({
      printedAmount: { rawValue: '€ 10,00' }
    });

    const result = parseSyntheticRawExtraction_(modelOutput);
    assert.equal(result.financialEvidence.items.length, 1);
    assert.equal(result.financialEvidence.additionalCosts.length, 1);
    assert.equal(result.financialEvidence.adjustments.length, 1);
    assert.equal(result.financialEvidence.vat.length, 1);
    assert.equal(result.financialEvidence.totals.length, 1);
  });

  QUnit.test('parser does not normalize, reorder, merge, or deduplicate evidence', function(assert) {
    const modelOutput = minimalRawModelOutput_();
    modelOutput.identityEvidence.dates = [
      { rawValue: ' 3 februari 2099 ' },
      { rawValue: '2099/02/03' },
      { rawValue: ' 3 februari 2099 ' }
    ];
    modelOutput.financialEvidence.totals = [
      { printedAmount: { rawValue: ' EUR 1.234,50 ' } },
      { printedAmount: { rawValue: ' EUR 1.234,50 ' } }
    ];

    const result = parseSyntheticRawExtraction_(modelOutput);
    assert.deepEqual(result.identityEvidence.dates, modelOutput.identityEvidence.dates);
    assert.deepEqual(result.financialEvidence.totals, modelOutput.financialEvidence.totals);
    assert.equal(result.identityEvidence.dates.length, 3);
    assert.equal(result.financialEvidence.totals.length, 2);
  });

  QUnit.test('classification and normalized-value fields are rejected', function(assert) {
    const cases = [];

    const typeCandidate = minimalRawModelOutput_();
    typeCandidate.financialEvidence.additionalCosts.push({
      printedLineAmount: { rawValue: '€ 2,00' },
      typeCandidate: 'SHIPPING'
    });
    cases.push(typeCandidate);

    const roleCandidate = minimalRawModelOutput_();
    roleCandidate.financialEvidence.totals.push({
      printedAmount: { rawValue: '€ 10,00' },
      roleCandidate: 'INCL_VAT'
    });
    cases.push(roleCandidate);

    const confidence = minimalRawModelOutput_();
    confidence.identityEvidence.identifiers.push({
      rawValue: 'SYN-001',
      confidence: 0.99
    });
    cases.push(confidence);

    const normalizedValue = minimalRawModelOutput_();
    normalizedValue.identityEvidence.dates.push({
      rawValue: '3 February 2099',
      normalizedValue: '2099-02-03'
    });
    cases.push(normalizedValue);

    cases.forEach(function(modelOutput) {
      assertInvalidRawModelObject_(assert, modelOutput);
    });
  });
}

function minimalRawModelOutput_() {
  return {
    identityEvidence: {
      dates: [],
      identifiers: []
    },
    financialEvidence: {
      items: [],
      additionalCosts: [],
      adjustments: [],
      vat: [],
      totals: []
    }
  };
}

function fullRawModelOutput_() {
  return {
    documentTypeEvidence: {
      rawValue: '  Synthetic invoice  ',
      printedLabel: 'Document kind',
      context: 'synthetic header'
    },
    identityEvidence: {
      dates: [
        {
          rawValue: ' 31 January 2099 ',
          printedLabel: 'Invoice date',
          context: 'synthetic header'
        },
        {
          rawValue: '29 January 2099',
          printedLabel: 'Order date',
          context: 'synthetic order metadata'
        }
      ],
      identifiers: [
        {
          rawValue: 'SYN-INV-002',
          printedLabel: 'Invoice number',
          context: 'synthetic header'
        },
        {
          rawValue: 'SYN-ORDER-900',
          printedLabel: 'Order number',
          context: 'synthetic order metadata'
        }
      ]
    },
    financialEvidence: {
      items: [
        {
          description: {
            rawValue: 'Synthetic cable',
            context: 'synthetic item row'
          },
          quantity: {
            rawValue: ' 2 ',
            printedLabel: 'Quantity'
          },
          printedUnitAmount: {
            rawValue: ' € 17,29 ',
            printedLabel: 'Unit price'
          },
          printedLineAmount: {
            rawValue: '€ 34,58',
            printedLabel: 'Line amount'
          }
        }
      ],
      additionalCosts: [
        {
          description: {
            rawValue: 'Synthetic delivery'
          },
          quantity: {
            rawValue: '1'
          },
          printedLineAmount: {
            rawValue: '€ 3,40',
            printedLabel: 'Delivery amount'
          }
        }
      ],
      adjustments: [
        {
          description: {
            rawValue: 'Synthetic reduction'
          },
          printedAmount: {
            rawValue: '- € 1,25',
            printedLabel: 'Reduction'
          }
        }
      ],
      vat: [
        {
          printedRate: {
            rawValue: '21%',
            printedLabel: 'VAT rate'
          },
          printedAmount: {
            rawValue: '€ 6,37',
            printedLabel: 'VAT amount',
            context: 'synthetic totals block'
          }
        }
      ],
      totals: [
        {
          printedAmount: {
            rawValue: '€ 30,36',
            printedLabel: 'Subtotal'
          }
        },
        {
          printedAmount: {
            rawValue: '€ 36,73',
            printedLabel: 'Total',
            context: 'document footer'
          }
        }
      ]
    }
  };
}

function syntheticRawProvenance_() {
  return {
    sourceFileName: 'synthetic-document.pdf',
    mimeType: 'application/pdf'
  };
}

function parseSyntheticRawExtraction_(modelOutput) {
  return parseRawDocumentExtraction(
    JSON.stringify(modelOutput),
    syntheticRawProvenance_()
  );
}

function assertInvalidRawModelObject_(assert, modelOutput) {
  assertRawDocumentExtractionError_(assert, function() {
    parseSyntheticRawExtraction_(modelOutput);
  }, RAW_DOCUMENT_EXTRACTION_ERROR_CODES.invalidStructure);
}

function assertRawDocumentExtractionError_(assert, action, expectedCode) {
  try {
    action();
    assert.ok(false, 'expected raw-document-extraction error ' + expectedCode);
  } catch (error) {
    assert.equal(error.name, 'RawDocumentExtractionError');
    assert.equal(error.code, expectedCode);
  }
}
