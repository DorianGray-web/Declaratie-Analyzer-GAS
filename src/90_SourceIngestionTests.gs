// QUnitGS2 regression tests for the source-document ingestion boundary.

var QUnit = QUnitGS2.QUnit;

function doGet() {
  QUnitGS2.init();

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

  registerRawDocumentExtractionTests_();
  registerCanonicalFinancialDocumentTests_();

  QUnit.start();
  return QUnitGS2.getHtml();
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
