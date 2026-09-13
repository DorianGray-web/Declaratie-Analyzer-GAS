// QUnitGS2 regression tests for the source-document ingestion boundary.

var QUnit = QUnitGS2.QUnit;

const QUNIT_TEST_REGISTRATIONS = Object.freeze([
  Object.freeze({
    id: 'source-ingestion-tests',
    register: function() { registerSourceIngestionTests_(); }
  }),
  Object.freeze({
    id: 'raw-document-extraction-tests',
    register: function() { registerRawDocumentExtractionTests_(); }
  }),
  Object.freeze({
    id: 'canonical-financial-document-tests',
    register: function() { registerCanonicalFinancialDocumentTests_(); }
  }),
  Object.freeze({
    id: 'evidence-record-tests',
    register: function() { registerEvidenceRecordTests_(); }
  }),
  Object.freeze({
    id: 'drive-evidence-store-tests',
    register: function() { registerDriveEvidenceStoreTests_(); }
  }),
  Object.freeze({
    id: 'test-harness-tests',
    register: function() { registerTestHarnessTests_(); }
  }),
  Object.freeze({
    id: 'processed-financial-document-tests',
    register: function() { registerProcessedFinancialDocumentTests_(); }
  })
]);

const QUNIT_AUTHORITATIVE_GAS_BATCHES = Object.freeze([
  Object.freeze({ selector: 'source-ingestion', registrationIds: Object.freeze(['source-ingestion-tests']) }),
  Object.freeze({ selector: 'raw-document-extraction', registrationIds: Object.freeze(['raw-document-extraction-tests']) }),
  Object.freeze({ selector: 'canonical-financial-document', registrationIds: Object.freeze(['canonical-financial-document-tests']) }),
  Object.freeze({ selector: 'evidence-record', registrationIds: Object.freeze(['evidence-record-tests']) }),
  Object.freeze({ selector: 'drive-evidence-store', registrationIds: Object.freeze(['drive-evidence-store-tests']) }),
  Object.freeze({ selector: 'test-harness', registrationIds: Object.freeze(['test-harness-tests']) }),
  Object.freeze({ selector: 'processed-financial-document', registrationIds: Object.freeze(['processed-financial-document-tests']) })
]);

const QUNIT_TEST_HARNESS_ERROR_CODES = Object.freeze({
  invalidBatch: 'INVALID_QUNIT_BATCH',
  invalidPartition: 'INVALID_QUNIT_PARTITION'
});

function doGet(event) {
  const plan = resolveQUnitTestPlan_(event);

  QUnitGS2.init();
  registerQUnitTestPlan_(plan);
  QUnit.start();
  return QUnitGS2.getHtml();
}

function registerSourceIngestionTests_() {

  QUnit.module('Source document ingestion');

  QUnit.test('supported image source is accepted', function(assert) {
    const descriptor = validateSourceFile({
      sourceFileName: 'synthetic-image.png',
      mimeType: 'image/png',
      rawSizeBytes: 3
    });

    assert.equal(descriptor.mimeType, 'image/png');
  });

  QUnit.test('supported PDF source is accepted', function(assert) {
    const file = createSyntheticSourceFile_(
      'synthetic-document.pdf',
      'application/pdf',
      3,
      [65, 66, 67]
    );
    const encoded = ingestSourceFile(file);

    assert.equal(encoded.mimeType, 'application/pdf');
    assert.equal(encoded.base64Content, 'QUJD');
  });

  QUnit.test('unsupported MIME fails closed', function(assert) {
    assertSourceIngestionError_(assert, function() {
      validateSourceFile({
        sourceFileName: 'synthetic.txt',
        mimeType: 'text/plain',
        rawSizeBytes: 3
      });
    }, SOURCE_INGESTION_ERROR_CODES.unsupportedMime);
  });

  QUnit.test('PDF exactly at 5 MiB is accepted', function(assert) {
    const descriptor = validateSourceFile({
      sourceFileName: 'boundary.pdf',
      mimeType: 'application/pdf',
      rawSizeBytes: SOURCE_INGESTION_POLICY.maxRawPdfSizeBytes
    });

    assert.equal(
      descriptor.rawSizeBytes,
      5 * 1024 * 1024
    );
  });

  QUnit.test('PDF at 5 MiB plus one byte is rejected', function(assert) {
    assertSourceIngestionError_(assert, function() {
      validateSourceFile({
        sourceFileName: 'oversized.pdf',
        mimeType: 'application/pdf',
        rawSizeBytes: SOURCE_INGESTION_POLICY.maxRawPdfSizeBytes + 1
      });
    }, SOURCE_INGESTION_ERROR_CODES.pdfTooLarge);
  });

  QUnit.test('oversized PDF is rejected before blob access', function(assert) {
    let blobAccessCount = 0;
    const file = createSyntheticSourceFile_(
      'oversized.pdf',
      'application/pdf',
      SOURCE_INGESTION_POLICY.maxRawPdfSizeBytes + 1,
      [65, 66, 67],
      function() {
        blobAccessCount += 1;
      }
    );

    assertSourceIngestionError_(assert, function() {
      ingestSourceFile(file);
    }, SOURCE_INGESTION_ERROR_CODES.pdfTooLarge);
    assert.equal(blobAccessCount, 0, 'blob content was not read');
  });

  QUnit.test('encoded source preserves filename and MIME provenance', function(assert) {
    const file = createSyntheticSourceFile_(
      'synthetic-image.png',
      'image/png',
      3,
      [65, 66, 67]
    );

    const encoded = ingestSourceFile(file);

    assert.equal(encoded.sourceFileName, 'synthetic-image.png');
    assert.equal(encoded.mimeType, 'image/png');
    assert.equal(encoded.rawSizeBytes, 3);
  });

  QUnit.test('Base64 encoding is deterministic for known bytes', function(assert) {
    const file = createSyntheticSourceFile_(
      'synthetic-image.png',
      'image/png',
      3,
      [65, 66, 67]
    );

    const encoded = ingestSourceFile(file);

    assert.equal(encoded.base64Content, 'QUJD');
  });

  QUnit.test('invalid source file interface fails explicitly', function(assert) {
    assertSourceIngestionError_(assert, function() {
      inspectSourceFile({
        getName: function() {
          return 'synthetic-image.png';
        }
      });
    }, SOURCE_INGESTION_ERROR_CODES.invalidSourceFile);
  });

  QUnit.test('invalid source metadata fails explicitly', function(assert) {
    assertSourceIngestionError_(assert, function() {
      validateSourceFile({
        sourceFileName: '',
        mimeType: 'image/png',
        rawSizeBytes: 3
      });
    }, SOURCE_INGESTION_ERROR_CODES.invalidSourceMetadata);

    assertSourceIngestionError_(assert, function() {
      validateSourceFile({
        sourceFileName: 'synthetic-image.png',
        mimeType: '',
        rawSizeBytes: 3
      });
    }, SOURCE_INGESTION_ERROR_CODES.invalidSourceMetadata);

    assertSourceIngestionError_(assert, function() {
      validateSourceFile({
        sourceFileName: 'synthetic-image.png',
        mimeType: 'image/png',
        rawSizeBytes: -1
      });
    }, SOURCE_INGESTION_ERROR_CODES.invalidSourceMetadata);
  });
}

function resolveQUnitTestPlan_(event) {
  auditQUnitBatchMembership_();

  const hasExplicitBatch = event && event.parameter &&
    Object.prototype.hasOwnProperty.call(event.parameter, 'batch');

  if (!hasExplicitBatch) {
    return {
      selector: null,
      authoritativeGasGate: false,
      registrationIds: QUNIT_TEST_REGISTRATIONS.map(function(registration) {
        return registration.id;
      })
    };
  }

  const requestedBatch = event.parameter.batch;
  if (typeof requestedBatch !== 'string' || requestedBatch === '') {
    throw createQUnitTestHarnessError_(
      QUNIT_TEST_HARNESS_ERROR_CODES.invalidBatch,
      'QUnitGS2 batch selector is missing or invalid.'
    );
  }

  const batch = QUNIT_AUTHORITATIVE_GAS_BATCHES.find(function(candidate) {
    return candidate.selector === requestedBatch;
  });
  if (!batch) {
    throw createQUnitTestHarnessError_(
      QUNIT_TEST_HARNESS_ERROR_CODES.invalidBatch,
      'Unknown QUnitGS2 batch selector.'
    );
  }

  return {
    selector: batch.selector,
    authoritativeGasGate: true,
    registrationIds: batch.registrationIds.slice()
  };
}

function registerQUnitTestPlan_(plan) {
  plan.registrationIds.forEach(function(registrationId) {
    findQUnitTestRegistration_(registrationId).register();
  });
}

function auditQUnitBatchMembership_() {
  const registrationCounts = {};
  const batchSelectors = {};

  QUNIT_TEST_REGISTRATIONS.forEach(function(registration) {
    if (
      !registration || typeof registration.id !== 'string' || registration.id === '' ||
      typeof registration.register !== 'function' ||
      Object.prototype.hasOwnProperty.call(registrationCounts, registration.id)
    ) {
      throwInvalidQUnitPartition_();
    }
    registrationCounts[registration.id] = 0;
  });

  QUNIT_AUTHORITATIVE_GAS_BATCHES.forEach(function(batch) {
    if (
      !batch || typeof batch.selector !== 'string' || batch.selector === '' ||
      !Array.isArray(batch.registrationIds) || batch.registrationIds.length === 0 ||
      Object.prototype.hasOwnProperty.call(batchSelectors, batch.selector)
    ) {
      throwInvalidQUnitPartition_();
    }
    batchSelectors[batch.selector] = true;

    const batchMembership = {};
    batch.registrationIds.forEach(function(registrationId) {
      if (
        !Object.prototype.hasOwnProperty.call(registrationCounts, registrationId) ||
        Object.prototype.hasOwnProperty.call(batchMembership, registrationId)
      ) {
        throwInvalidQUnitPartition_();
      }
      batchMembership[registrationId] = true;
      registrationCounts[registrationId] += 1;
    });
  });

  Object.keys(registrationCounts).forEach(function(registrationId) {
    if (registrationCounts[registrationId] !== 1) {
      throwInvalidQUnitPartition_();
    }
  });

  return {
    registrationCount: Object.keys(registrationCounts).length,
    authoritativeBatchCount: Object.keys(batchSelectors).length
  };
}

function findQUnitTestRegistration_(registrationId) {
  const registration = QUNIT_TEST_REGISTRATIONS.find(function(candidate) {
    return candidate.id === registrationId;
  });
  if (!registration) {
    throwInvalidQUnitPartition_();
  }
  return registration;
}

function throwInvalidQUnitPartition_() {
  throw createQUnitTestHarnessError_(
    QUNIT_TEST_HARNESS_ERROR_CODES.invalidPartition,
    'QUnitGS2 batch partition is invalid.'
  );
}

function createQUnitTestHarnessError_(code, message) {
  const error = new Error(message);
  error.name = 'QUnitTestHarnessError';
  error.code = code;
  return error;
}

function createSyntheticSourceFile_(name, mimeType, size, bytes, onGetBlob) {
  return {
    getName: function() {
      return name;
    },
    getMimeType: function() {
      return mimeType;
    },
    getSize: function() {
      return size;
    },
    getBlob: function() {
      if (typeof onGetBlob === 'function') {
        onGetBlob();
      }

      return {
        getBytes: function() {
          return bytes.slice();
        }
      };
    }
  };
}

function assertSourceIngestionError_(assert, action, expectedCode) {
  try {
    action();
    assert.ok(false, 'expected source-ingestion error ' + expectedCode);
  } catch (error) {
    assert.equal(error.name, 'SourceIngestionError');
    assert.equal(error.code, expectedCode);
  }
}
