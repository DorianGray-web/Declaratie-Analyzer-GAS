// QUnitGS2 tests for managed Drive evidence capture and retrieval.

function registerDriveEvidenceStoreTests_() {
  QUnit.module('Drive evidence store');

  QUnit.test('successful capture preserves one byte snapshot and distinct identities', function(assert) {
    const harness = createDriveEvidenceHarness_();
    const record = captureDriveEvidence('origin_file_001', harness.dependencies);

    assert.equal(record.originRef.fileId, 'origin_file_001');
    assert.equal(record.contentRef.fileId, 'managed_file_001');
    assert.notEqual(record.originRef.fileId, record.contentRef.fileId);
    assert.equal(record.rawSizeBytes, 3);
    assert.equal(record.sha256, computeEvidenceSha256([65, 66, 67]));
    assert.deepEqual(harness.state.created[0].bytes, [65, 66, 67]);
    assert.equal(harness.state.sourceBlobReads, 1, 'origin bytes captured once');
    assert.equal(harness.state.sourceMutations, 0, 'origin was not mutated');
    assert.equal(validateEvidenceRecord(record), record);
  });

  QUnit.test('managed filename is neutral and MIME-derived', function(assert) {
    const harness = createDriveEvidenceHarness_({
      sourceName: 'SYNTHETIC-PRIVATE-NAME.png',
      mimeType: 'image/png'
    });
    const record = captureDriveEvidence('origin_file_001', harness.dependencies);
    const managedName = harness.state.created[0].name;

    assert.equal(managedName, record.evidenceId + '.png');
    assert.equal(managedName.indexOf('SYNTHETIC-PRIVATE-NAME'), -1);
    assert.equal(record.mimeType, 'image/png');
  });

  QUnit.test('generic supported image MIME receives safe fallback extension', function(assert) {
    const harness = createDriveEvidenceHarness_({ mimeType: 'image/x-synthetic' });
    const record = captureDriveEvidence('origin_file_001', harness.dependencies);

    assert.equal(harness.state.created[0].name, record.evidenceId + '.img');
  });

  QUnit.test('captured length overrides non-authoritative Drive metadata size', function(assert) {
    const harness = createDriveEvidenceHarness_({ reportedSize: 999 });
    const record = captureDriveEvidence('origin_file_001', harness.dependencies);

    assert.equal(record.rawSizeBytes, 3);
  });

  QUnit.test('unsupported MIME is rejected before byte read or managed creation', function(assert) {
    const harness = createDriveEvidenceHarness_({ mimeType: 'text/plain' });

    assertEvidenceStoreError_(assert, function() {
      captureDriveEvidence('origin_file_001', harness.dependencies);
    }, SOURCE_INGESTION_ERROR_CODES.unsupportedMime, 'SourceIngestionError');
    assert.equal(harness.state.sourceBlobReads, 0);
    assert.equal(harness.state.created.length, 0);
  });

  QUnit.test('missing source and missing folder configuration fail explicitly', function(assert) {
    const missingSource = createDriveEvidenceHarness_({ missingSource: true });
    assertEvidenceStoreError_(assert, function() {
      captureDriveEvidence('origin_file_001', missingSource.dependencies);
    }, DRIVE_EVIDENCE_STORE_ERROR_CODES.sourceUnavailable);

    const missingConfiguration = createDriveEvidenceHarness_({ folderId: null });
    assertEvidenceStoreError_(assert, function() {
      captureDriveEvidence('origin_file_001', missingConfiguration.dependencies);
    }, DRIVE_EVIDENCE_STORE_ERROR_CODES.missingConfiguration);
  });

  QUnit.test('invalid configured folder and managed create failure fail closed', function(assert) {
    const invalidFolder = createDriveEvidenceHarness_({ invalidFolder: true });
    assertEvidenceStoreError_(assert, function() {
      captureDriveEvidence('origin_file_001', invalidFolder.dependencies);
    }, DRIVE_EVIDENCE_STORE_ERROR_CODES.folderUnavailable);

    const createFailure = createDriveEvidenceHarness_({ createFailure: true });
    assertEvidenceStoreError_(assert, function() {
      captureDriveEvidence('origin_file_001', createFailure.dependencies);
    }, DRIVE_EVIDENCE_STORE_ERROR_CODES.managedCreateFailed);
    assert.equal(createFailure.state.created.length, 0);
  });

  QUnit.test('post-create EvidenceRecord failure trashes managed content', function(assert) {
    let recordFactoryCalls = 0;
    const harness = createDriveEvidenceHarness_({
      recordFactory: function(metadata, dependencies) {
        recordFactoryCalls += 1;
        if (recordFactoryCalls === 2) {
          throw createEvidenceRecordError_(
            EVIDENCE_RECORD_ERROR_CODES.invalidRecord,
            'Synthetic EvidenceRecord construction failure.'
          );
        }
        return createEvidenceRecord(metadata, dependencies);
      }
    });

    assertEvidenceStoreError_(assert, function() {
      captureDriveEvidence('origin_file_001', harness.dependencies);
    }, EVIDENCE_RECORD_ERROR_CODES.invalidRecord, 'EvidenceRecordError');
    assert.equal(harness.state.trashAttempts, 1);
    assert.ok(harness.state.created[0].trashed);
  });

  QUnit.test('cleanup failure preserves original failure with sanitized indication', function(assert) {
    let recordFactoryCalls = 0;
    const harness = createDriveEvidenceHarness_({
      cleanupFailure: true,
      recordFactory: function(metadata, dependencies) {
        recordFactoryCalls += 1;
        if (recordFactoryCalls === 2) {
          throw createEvidenceRecordError_(
            EVIDENCE_RECORD_ERROR_CODES.invalidRecord,
            'Synthetic EvidenceRecord construction failure.'
          );
        }
        return createEvidenceRecord(metadata, dependencies);
      }
    });
    let caught;

    try {
      captureDriveEvidence('origin_file_001', harness.dependencies);
    } catch (error) {
      caught = error;
    }

    assert.ok(caught);
    assert.equal(caught.name, 'EvidenceRecordError');
    assert.equal(caught.code, EVIDENCE_RECORD_ERROR_CODES.invalidRecord);
    assert.equal(caught.cleanupFailed, true);
    assert.equal(caught.cleanupCode, 'MANAGED_EVIDENCE_CLEANUP_FAILED');
    assert.equal(caught.message.indexOf('SYNTHETIC-PRIVATE'), -1);
  });

  QUnit.test('retrieval resolves typed contentRef by file ID', function(assert) {
    const harness = createDriveEvidenceHarness_();
    const record = captureDriveEvidence('origin_file_001', harness.dependencies);
    const bytes = retrieveManagedEvidenceBytes(record.contentRef, harness.dependencies);

    assert.deepEqual(bytes, [65, 66, 67]);
    assert.equal(harness.state.lastRetrievedFileId, 'managed_file_001');
    assert.equal(harness.state.managedBlobReads, 1);
  });

  QUnit.test('invalid reference and missing managed content fail explicitly', function(assert) {
    const harness = createDriveEvidenceHarness_();
    assertEvidenceStoreError_(assert, function() {
      retrieveManagedEvidenceBytes({ type: 'DRIVE_FILE', fileName: 'synthetic.pdf' }, harness.dependencies);
    }, DRIVE_EVIDENCE_STORE_ERROR_CODES.invalidReference);
    assertEvidenceStoreError_(assert, function() {
      retrieveManagedEvidenceBytes(
        { type: 'DRIVE_FILE', fileId: 'missing_managed_file' },
        harness.dependencies
      );
    }, DRIVE_EVIDENCE_STORE_ERROR_CODES.managedContentUnavailable);
  });

  QUnit.test('verified retrieval accepts intact bytes and rejects size or digest mismatch', function(assert) {
    const harness = createDriveEvidenceHarness_();
    const record = captureDriveEvidence('origin_file_001', harness.dependencies);
    assert.deepEqual(
      retrieveVerifiedManagedEvidenceBytes(record, harness.dependencies),
      [65, 66, 67]
    );

    const wrongSize = Object.assign({}, record, { rawSizeBytes: 2 });
    assertEvidenceStoreError_(assert, function() {
      retrieveVerifiedManagedEvidenceBytes(wrongSize, harness.dependencies);
    }, DRIVE_EVIDENCE_STORE_ERROR_CODES.integrityMismatch);

    const wrongDigest = Object.assign({}, record, { sha256: Array(65).join('a') });
    assertEvidenceStoreError_(assert, function() {
      retrieveVerifiedManagedEvidenceBytes(wrongDigest, harness.dependencies);
    }, DRIVE_EVIDENCE_STORE_ERROR_CODES.integrityMismatch);
  });

  QUnit.test('same bytes may produce independent evidence records and snapshots', function(assert) {
    const harness = createDriveEvidenceHarness_({
      uuidValues: [
        '11111111-1111-4111-8111-111111111111',
        '22222222-2222-4222-a222-222222222222'
      ]
    });
    const first = captureDriveEvidence('origin_file_001', harness.dependencies);
    const second = captureDriveEvidence('origin_file_001', harness.dependencies);

    assert.notEqual(first.evidenceId, second.evidenceId);
    assert.notEqual(first.contentRef.fileId, second.contentRef.fileId);
    assert.equal(first.sha256, second.sha256);
    assert.equal(harness.state.created.length, 2);
  });
}

function createDriveEvidenceHarness_(options) {
  const settings = options || {};
  const state = {
    sourceBlobReads: 0,
    managedBlobReads: 0,
    sourceMutations: 0,
    trashAttempts: 0,
    created: [],
    lastRetrievedFileId: null
  };
  const sourceBytes = settings.bytes || [65, 66, 67];
  const uuidValues = (settings.uuidValues || [
    '11111111-1111-4111-8111-111111111111'
  ]).slice();
  let uuidIndex = 0;
  const managedById = {};

  const sourceFile = {
    getName: function() { return settings.sourceName || 'SYNTHETIC-PRIVATE-NAME.pdf'; },
    getMimeType: function() { return settings.mimeType || 'application/pdf'; },
    getSize: function() { return settings.reportedSize === undefined ? sourceBytes.length : settings.reportedSize; },
    getBlob: function() {
      state.sourceBlobReads += 1;
      return { getBytes: function() { return sourceBytes.slice(); } };
    },
    setName: function() { state.sourceMutations += 1; },
    setTrashed: function() { state.sourceMutations += 1; },
    moveTo: function() { state.sourceMutations += 1; }
  };

  const drive = {
    getFolderById: function() {
      if (settings.invalidFolder) {
        throw new Error('synthetic folder failure');
      }
      return { syntheticFolder: true };
    },
    getFileById: function(fileId) {
      state.lastRetrievedFileId = fileId;
      if (fileId === 'origin_file_001') {
        if (settings.missingSource) {
          throw new Error('synthetic missing source');
        }
        return sourceFile;
      }
      if (!managedById[fileId]) {
        throw new Error('synthetic missing managed file');
      }
      return managedById[fileId];
    },
    createManagedFile: function(folder, bytes, mimeType, name) {
      if (settings.createFailure) {
        throw new Error('synthetic create failure');
      }
      const ordinal = state.created.length + 1;
      const id = settings.managedFileId || ('managed_file_00' + ordinal);
      const stored = bytes.slice();
      const file = {
        id: id,
        name: name,
        mimeType: mimeType,
        bytes: stored,
        trashed: false,
        getId: function() { return id; },
        getBlob: function() {
          state.managedBlobReads += 1;
          return { getBytes: function() { return stored.slice(); } };
        }
      };
      state.created.push(file);
      managedById[id] = file;
      return file;
    },
    trashManagedFile: function(file) {
      state.trashAttempts += 1;
      if (settings.cleanupFailure) {
        throw new Error('synthetic cleanup failure');
      }
      file.trashed = true;
    }
  };

  const result = {
    state: state,
    dependencies: {
      configuration: {
        getEvidenceFolderId: function() {
          return settings.folderId === undefined ? 'evidence_folder_001' : settings.folderId;
        }
      },
      drive: drive,
      uuidGenerator: function() {
        const value = uuidValues[Math.min(uuidIndex, uuidValues.length - 1)];
        uuidIndex += 1;
        return value;
      },
      clock: function() { return new Date('2099-01-31T10:20:30.000Z'); }
    }
  };

  if (settings.recordFactory) {
    result.dependencies.recordFactory = settings.recordFactory;
  }
  return result;
}

function assertEvidenceStoreError_(assert, action, expectedCode, expectedName) {
  try {
    action();
    assert.ok(false, 'expected Evidence Store error ' + expectedCode);
  } catch (error) {
    assert.equal(error.name, expectedName || 'DriveEvidenceStoreError');
    assert.equal(error.code, expectedCode);
  }
}
