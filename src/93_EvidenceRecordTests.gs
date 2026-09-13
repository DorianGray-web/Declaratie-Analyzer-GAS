// QUnitGS2 regression tests for the pure EvidenceRecord boundary.

function registerEvidenceRecordTests_() {
  QUnit.module('Evidence record');

  QUnit.test('factory creates a valid record with deterministic identity and time seams', function(assert) {
    const record = createEvidenceRecord(syntheticEvidenceMetadata_(), {
      uuidGenerator: function() { return '11111111-1111-4111-8111-111111111111'; },
      clock: function() { return new Date('2099-01-31T10:20:30.000Z'); }
    });

    assert.equal(record.evidenceId, '11111111-1111-4111-8111-111111111111');
    assert.equal(record.capturedAt, '2099-01-31T10:20:30.000Z');
    assert.deepEqual(record.originRef, syntheticOriginRef_());
    assert.deepEqual(record.contentRef, syntheticContentRef_());
    assert.equal(record.sourceFileName, 'synthetic-evidence.pdf');
    assert.equal(record.mimeType, 'application/pdf');
    assert.equal(record.rawSizeBytes, 3);
    assert.equal(record.sha256.length, 64);
  });

  QUnit.test('complete valid record passes direct structural validation', function(assert) {
    const record = buildSyntheticEvidenceRecord_();

    assert.equal(validateEvidenceRecord(record), record);
  });

  QUnit.test('every EvidenceRecord field is required', function(assert) {
    [
      'evidenceId',
      'originRef',
      'contentRef',
      'sourceFileName',
      'mimeType',
      'rawSizeBytes',
      'sha256',
      'capturedAt'
    ].forEach(function(fieldName) {
      const record = buildSyntheticEvidenceRecord_();
      delete record[fieldName];

      assertEvidenceRecordInvalid_(assert, function() {
        validateEvidenceRecord(record);
      });
    });
  });

  QUnit.test('evidenceId must be a lowercase version-4 UUID', function(assert) {
    [
      '',
      'not-a-uuid',
      '11111111-1111-3111-8111-111111111111',
      '11111111-1111-4111-7111-111111111111',
      '11111111-1111-4111-8111-11111111111G',
      'abcdefab-cdef-4abc-acde-abcdefabcdef'.toUpperCase()
    ].forEach(function(value) {
      const record = buildSyntheticEvidenceRecord_();
      record.evidenceId = value;

      assertEvidenceRecordInvalid_(assert, function() {
        validateEvidenceRecord(record);
      });
    });
  });

  QUnit.test('same filename does not define evidence identity', function(assert) {
    const first = buildSyntheticEvidenceRecord_();
    const second = buildSyntheticEvidenceRecord_();
    second.evidenceId = '22222222-2222-4222-a222-222222222222';

    validateEvidenceRecord(first);
    validateEvidenceRecord(second);
    assert.equal(first.sourceFileName, second.sourceFileName);
    assert.notEqual(first.evidenceId, second.evidenceId);
  });

  QUnit.test('same SHA-256 does not define evidence identity', function(assert) {
    const first = buildSyntheticEvidenceRecord_();
    const second = buildSyntheticEvidenceRecord_();
    second.evidenceId = '22222222-2222-4222-a222-222222222222';
    second.originRef = { type: EVIDENCE_REFERENCE_TYPE.DRIVE_FILE, fileId: 'origin_file_002' };
    second.contentRef = { type: EVIDENCE_REFERENCE_TYPE.DRIVE_FILE, fileId: 'content_file_002' };

    validateEvidenceRecord(first);
    validateEvidenceRecord(second);
    assert.equal(first.sha256, second.sha256);
    assert.notEqual(first.evidenceId, second.evidenceId);
  });

  QUnit.test('origin and managed-content references remain separate roles', function(assert) {
    const record = buildSyntheticEvidenceRecord_();

    assert.equal(record.originRef.fileId, 'origin_file_001');
    assert.equal(record.contentRef.fileId, 'content_file_001');
    assert.notEqual(record.originRef.fileId, record.contentRef.fileId);
  });

  QUnit.test('malformed origin and content references are rejected', function(assert) {
    const cases = [];

    const wrongType = buildSyntheticEvidenceRecord_();
    wrongType.originRef.type = 'SYNTHETIC_STORAGE';
    cases.push(wrongType);

    const missingId = buildSyntheticEvidenceRecord_();
    delete missingId.contentRef.fileId;
    cases.push(missingId);

    const invalidId = buildSyntheticEvidenceRecord_();
    invalidId.originRef.fileId = 'contains whitespace';
    cases.push(invalidId);

    const unknownField = buildSyntheticEvidenceRecord_();
    unknownField.contentRef.folderName = 'synthetic-folder';
    cases.push(unknownField);

    cases.forEach(function(record) {
      assertEvidenceRecordInvalid_(assert, function() {
        validateEvidenceRecord(record);
      });
    });
  });

  QUnit.test('supported source MIME types are accepted and unsupported MIME fails', function(assert) {
    const image = buildSyntheticEvidenceRecord_();
    image.mimeType = 'image/png';
    assert.equal(validateEvidenceRecord(image).mimeType, 'image/png');

    const unsupported = buildSyntheticEvidenceRecord_();
    unsupported.mimeType = 'text/plain';
    assertEvidenceRecordInvalid_(assert, function() {
      validateEvidenceRecord(unsupported);
    });
  });

  QUnit.test('rawSizeBytes follows non-negative safe-integer ingestion semantics', function(assert) {
    const empty = buildSyntheticEvidenceRecord_();
    empty.rawSizeBytes = 0;
    assert.equal(validateEvidenceRecord(empty).rawSizeBytes, 0);

    [-1, 1.5, '3', NaN, Infinity, Number.MAX_SAFE_INTEGER + 1].forEach(function(value) {
      const record = buildSyntheticEvidenceRecord_();
      record.rawSizeBytes = value;
      assertEvidenceRecordInvalid_(assert, function() {
        validateEvidenceRecord(record);
      });
    });
  });

  QUnit.test('SHA-256 helper produces deterministic lowercase hexadecimal', function(assert) {
    assert.equal(
      computeEvidenceSha256([65, 66, 67]),
      'b5d4045c3f466fa91fe2cc6abe79232a1a57cdf104f7a26e716e0a1e2789df78'
    );
  });

  QUnit.test('SHA-256 helper handles signed Apps Script digest bytes', function(assert) {
    const digest = computeEvidenceSha256([0], function() {
      return Array(32).fill(-1);
    });

    assert.equal(digest, Array(65).join('f'));
  });

  QUnit.test('invalid captured bytes and digest results fail explicitly', function(assert) {
    assertEvidenceRecordError_(assert, function() {
      computeEvidenceSha256('not-bytes');
    }, EVIDENCE_RECORD_ERROR_CODES.invalidCapturedBytes);

    assertEvidenceRecordError_(assert, function() {
      computeEvidenceSha256([256]);
    }, EVIDENCE_RECORD_ERROR_CODES.invalidCapturedBytes);

    assertEvidenceRecordError_(assert, function() {
      computeEvidenceSha256([0], function() { return [0]; });
    }, EVIDENCE_RECORD_ERROR_CODES.digestFailed);

    assertEvidenceRecordError_(assert, function() {
      computeEvidenceSha256([0], function() { throw new Error('synthetic failure'); });
    }, EVIDENCE_RECORD_ERROR_CODES.digestFailed);
  });

  QUnit.test('SHA-256 field requires canonical lowercase hexadecimal', function(assert) {
    [
      '',
      Array(64).join('a'),
      Array(65).join('A'),
      Array(64).join('g') + '0',
      123
    ].forEach(function(value) {
      const record = buildSyntheticEvidenceRecord_();
      record.sha256 = value;
      assertEvidenceRecordInvalid_(assert, function() {
        validateEvidenceRecord(record);
      });
    });
  });

  QUnit.test('capturedAt requires a real canonical UTC timestamp', function(assert) {
    [
      '2099-02-30T10:20:30.000Z',
      '2099-01-31T10:20:30Z',
      '2099-01-31T11:20:30.000+01:00',
      'not-a-timestamp',
      new Date('2099-01-31T10:20:30.000Z')
    ].forEach(function(value) {
      const record = buildSyntheticEvidenceRecord_();
      record.capturedAt = value;
      assertEvidenceRecordInvalid_(assert, function() {
        validateEvidenceRecord(record);
      });
    });
  });

  QUnit.test('factory rejects invalid seams and unknown capture metadata', function(assert) {
    assertEvidenceRecordInvalid_(assert, function() {
      createEvidenceRecord(syntheticEvidenceMetadata_(), { uuidGenerator: 'not-a-function' });
    });
    assertEvidenceRecordInvalid_(assert, function() {
      createEvidenceRecord(syntheticEvidenceMetadata_(), { clock: function() { return '2099-01-31'; } });
    });

    const unknownMetadata = syntheticEvidenceMetadata_();
    unknownMetadata.sourceDocumentId = 'SYN-DOC-001';
    assertEvidenceRecordInvalid_(assert, function() {
      createEvidenceRecord(unknownMetadata, syntheticEvidenceDependencies_());
    });
  });

  QUnit.test('financial, declaration, profile, and raw-content fields are rejected', function(assert) {
    [
      'sourceDocumentId',
      'documentDate',
      'expenses',
      'vat',
      'reconciliation',
      'canonicalFinancialDocument',
      'declarationInstanceId',
      'declarationPeriod',
      'operationReference',
      'assignmentStatus',
      'expectedEvidenceManifest',
      'packageState',
      'declarantProfile',
      'applicantCode',
      'BSN',
      'IBAN',
      'base64Content',
      'rawContent'
    ].forEach(function(fieldName) {
      const record = buildSyntheticEvidenceRecord_();
      record[fieldName] = 'synthetic-forbidden';
      assertEvidenceRecordInvalid_(assert, function() {
        validateEvidenceRecord(record);
      });
    });
  });

  QUnit.test('validation errors identify fields without reproducing filenames', function(assert) {
    const record = buildSyntheticEvidenceRecord_();
    const syntheticSensitiveName = 'SYNTHETIC-NAME-DO-NOT-ECHO.pdf';
    record.sourceFileName = syntheticSensitiveName;
    record.sha256 = 'invalid';

    let caught = null;
    try {
      validateEvidenceRecord(record);
    } catch (error) {
      caught = error;
    }

    assert.ok(caught, 'expected validation failure');
    assert.equal(caught.code, EVIDENCE_RECORD_ERROR_CODES.invalidRecord);
    assert.equal(caught.message.indexOf(syntheticSensitiveName), -1);
  });
}

function buildSyntheticEvidenceRecord_() {
  return {
    evidenceId: '11111111-1111-4111-8111-111111111111',
    originRef: syntheticOriginRef_(),
    contentRef: syntheticContentRef_(),
    sourceFileName: 'synthetic-evidence.pdf',
    mimeType: 'application/pdf',
    rawSizeBytes: 3,
    sha256: Array(65).join('a'),
    capturedAt: '2099-01-31T10:20:30.000Z'
  };
}

function syntheticEvidenceMetadata_() {
  const record = buildSyntheticEvidenceRecord_();
  delete record.evidenceId;
  delete record.capturedAt;
  return record;
}

function syntheticEvidenceDependencies_() {
  return {
    uuidGenerator: function() { return '11111111-1111-4111-8111-111111111111'; },
    clock: function() { return new Date('2099-01-31T10:20:30.000Z'); }
  };
}

function syntheticOriginRef_() {
  return {
    type: EVIDENCE_REFERENCE_TYPE.DRIVE_FILE,
    fileId: 'origin_file_001'
  };
}

function syntheticContentRef_() {
  return {
    type: EVIDENCE_REFERENCE_TYPE.DRIVE_FILE,
    fileId: 'content_file_001'
  };
}

function assertEvidenceRecordInvalid_(assert, action) {
  assertEvidenceRecordError_(assert, action, EVIDENCE_RECORD_ERROR_CODES.invalidRecord);
}

function assertEvidenceRecordError_(assert, action, expectedCode) {
  try {
    action();
    assert.ok(false, 'expected EvidenceRecord validation to fail');
  } catch (error) {
    assert.equal(error.name, 'EvidenceRecordError');
    assert.equal(error.code, expectedCode);
  }
}
