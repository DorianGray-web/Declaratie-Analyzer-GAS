// QUnitGS2 regression tests for the injected-adapter FinancialDocumentRegistry.

function registerFinancialDocumentRegistryFoundationTests_() {
  QUnit.module('Financial document registry foundation');

  QUnit.test('frozen v2 topology and every exact ordered header are declared', function(assert) {
    assert.deepEqual(FINANCIAL_DOCUMENT_REGISTRY_TABS, [
      'Documenten', 'Regels', 'ExtraKosten', 'Correcties', 'BTW', 'Evidence',
      '_Canonical', '_Meta'
    ]);
    assert.equal(FINANCIAL_DOCUMENT_REGISTRY_HEADERS.Evidence.join('|'), [
      'evidenceId', 'evidenceSchemaVersion', 'evidenceRecordJson',
      'evidencePayloadSha256', 'capturedAt', 'mimeType', 'rawSizeBytes', 'sha256',
      'originRefType', 'originFileId', 'contentRefType', 'contentFileId',
      'sourceFileName'
    ].join('|'));
    assert.equal(FINANCIAL_DOCUMENT_REGISTRY_HEADERS._Canonical.join('|'), [
      'evidenceId', 'processedDocumentSchemaVersion', 'processedDocumentJson',
      'processedPayloadSha256', 'processedAt', 'documentDate', 'sourceDocumentId'
    ].join('|'));
    assert.equal(FINANCIAL_DOCUMENT_REGISTRY_HEADERS.Documenten.length, 15);
    assert.equal(FINANCIAL_DOCUMENT_REGISTRY_HEADERS.Regels.length, 6);
    assert.equal(FINANCIAL_DOCUMENT_REGISTRY_HEADERS.ExtraKosten.length, 5);
    assert.equal(FINANCIAL_DOCUMENT_REGISTRY_HEADERS.Correcties.length, 5);
    assert.equal(FINANCIAL_DOCUMENT_REGISTRY_HEADERS.BTW.length, 4);
    assert.equal(FINANCIAL_DOCUMENT_REGISTRY_HEADERS._Meta.length, 6);
  });

  QUnit.test('schema validation accepts blank initializedAt and ignores only _Legacy_v1', function(assert) {
    const fixture = createRegistryTestFixture_({ initialized: false, includeLegacy: true });
    const metadata = validateFinancialDocumentRegistrySchema_(fixture.workbook, fixture.dependencies, false);
    assert.equal(metadata.registrySchemaVersion, 2);
    assert.equal(metadata.initializedAt, '');
    assert.equal(fixture.workbook.readCountByTab._Legacy_v1 || 0, 0);
  });

  QUnit.test('schema validation fails closed on missing, renamed, or unexpected tabs', function(assert) {
    ['missing', 'renamed', 'unexpected'].forEach(function(kind) {
      const fixture = createRegistryTestFixture_({ initialized: false });
      if (kind === 'missing') fixture.workbook.sheetNames.splice(0, 1);
      if (kind === 'renamed') fixture.workbook.sheetNames[0] = 'Documents';
      if (kind === 'unexpected') fixture.workbook.sheetNames.push('Unexpected');
      assertRegistryError_(assert, function() {
        fixture.registry.initializeFinancialDocumentRegistry();
      }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.schemaMismatch);
    });
  });

  QUnit.test('schema validation rejects missing, reordered, duplicate, and extra headers', function(assert) {
    ['missing', 'reordered', 'duplicate', 'extra'].forEach(function(kind) {
      const fixture = createRegistryTestFixture_({ initialized: false });
      const headers = fixture.workbook.headers.Regels;
      if (kind === 'missing') headers.pop();
      if (kind === 'reordered') headers.reverse();
      if (kind === 'duplicate') headers[2] = headers[1];
      if (kind === 'extra') headers.push('unexpectedHeader');
      assertRegistryError_(assert, function() {
        fixture.registry.initializeFinancialDocumentRegistry();
      }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.schemaMismatch);
    });
  });

  QUnit.test('schema validation rejects registry/domain versions and malformed metadata', function(assert) {
    [0, 1, 2].forEach(function(index) {
      const fixture = createRegistryTestFixture_({ initialized: false });
      fixture.workbook.rows._Meta[0][index] = 99;
      assertRegistryError_(assert, function() {
        fixture.registry.initializeFinancialDocumentRegistry();
      }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.schemaMismatch);
    });
    const malformed = createRegistryTestFixture_({ initialized: false });
    malformed.workbook.rows._Meta[0][3] = 'not-a-time';
    assertRegistryError_(assert, function() {
      malformed.registry.initializeFinancialDocumentRegistry();
    }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.schemaMismatch);
  });

  QUnit.test('initialization writes only initializedAt and retry preserves it', function(assert) {
    const fixture = createRegistryTestFixture_({ initialized: false });
    const before = fixture.workbook.rows._Meta[0].slice();
    const first = fixture.registry.initializeFinancialDocumentRegistry();
    const second = fixture.registry.initializeFinancialDocumentRegistry();
    assert.equal(first.initializedAt, '2026-09-13T10:00:00.000Z');
    assert.equal(second.initializedAt, first.initializedAt);
    assert.equal(fixture.workbook.setCellCalls.length, 1);
    assert.equal(fixture.workbook.rows._Meta[0][4], before[4]);
    assert.equal(fixture.workbook.rows._Meta[0][5], before[5]);
    assert.equal(fixture.lock.acquireCount, 2);
    assert.equal(fixture.lock.releaseCount, 2);
  });

  QUnit.test('initialization failure paths release lock and fail before unsafe writes', function(assert) {
    const topology = createRegistryTestFixture_({ initialized: false });
    topology.workbook.headers.BTW[0] = 'changed';
    assertRegistryError_(assert, function() { topology.registry.initializeFinancialDocumentRegistry(); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.schemaMismatch);
    assert.equal(topology.workbook.setCellCalls.length, 0);
    assert.equal(topology.lock.releaseCount, 1);

    const write = createRegistryTestFixture_({ initialized: false });
    write.workbook.failSetCell = true;
    assertRegistryError_(assert, function() { write.registry.initializeFinancialDocumentRegistry(); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.writeFailure);

    const readback = createRegistryTestFixture_({ initialized: false });
    readback.workbook.mutateMetaReadback = true;
    assertRegistryError_(assert, function() { readback.registry.initializeFinancialDocumentRegistry(); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.writeFailure);
  });

  QUnit.test('initialization validates compatible existing authority and rejects orphan Canonical', function(assert) {
    const compatible = createRegistryTestFixture_({ initialized: true });
    const evidence = createRegistryEvidenceRecord_(1);
    const processed = createRegistryProcessedDocument_(1, {});
    compatible.workbook.rows.Evidence.push(buildEvidenceRegistryRow_(evidence, serializeEvidenceRecordForRegistry(evidence, compatible.dependencies)));
    compatible.workbook.rows._Canonical.push(buildProcessedRegistryRow_(processed, serializeProcessedFinancialDocumentForRegistry(processed, compatible.dependencies)));
    assert.equal(compatible.registry.initializeFinancialDocumentRegistry().initializedAt, '2026-09-12T10:00:00.000Z');

    const orphan = createRegistryTestFixture_({ initialized: false });
    orphan.workbook.rows._Canonical.push(buildProcessedRegistryRow_(processed, serializeProcessedFinancialDocumentForRegistry(processed, orphan.dependencies)));
    assertRegistryError_(assert, function() { orphan.registry.initializeFinancialDocumentRegistry(); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.corruptRecord);
    assert.equal(orphan.workbook.setCellCalls.length, 0);
  });

  QUnit.test('lock timeout fails closed and successful exception path releases', function(assert) {
    const timeout = createRegistryTestFixture_({ initialized: true });
    timeout.lock.allowAcquire = false;
    assertRegistryError_(assert, function() { timeout.registry.readEvidenceRecord(registryEvidenceId_(1)); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.lockTimeout);
    assert.equal(timeout.lock.releaseCount, 0);

    const failure = createRegistryTestFixture_({ initialized: true });
    assertRegistryError_(assert, function() { failure.registry.readEvidenceRecord('bad-id'); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.validation);
    assert.equal(failure.lock.releaseCount, 1);
  });

  QUnit.test('registry errors expose only bounded metadata and no restricted payload values', testRegistryErrorsExposeOnlyBoundedMetadata_);
  QUnit.test('configuration and workbook adapter failures use bounded registry errors', testRegistryConfigurationFailuresUseBoundedErrors_);
}

function registerFinancialDocumentRegistrySerializationTests_() {
  QUnit.module('Financial document registry serialization');

  QUnit.test('EvidenceRecord serialization is compact, ordered, versioned, and round trips', function(assert) {
    const fixture = createRegistryTestFixture_({ initialized: true });
    const record = createRegistryEvidenceRecord_(1);
    const serialized = serializeEvidenceRecordForRegistry(record, fixture.dependencies);
    assert.equal(serialized.schemaVersion, 1);
    assert.equal(serialized.json.indexOf('\n'), -1);
    assert.equal(serialized.json.indexOf('{"evidenceId"'), 0);
    assert.ok(serialized.json.indexOf('"originRef"') < serialized.json.indexOf('"contentRef"'));
    const row = buildEvidenceRegistryRow_(record, serialized);
    assert.deepEqual(readEvidenceRegistryRow_(row, fixture.dependencies, 0), record);
  });

  QUnit.test('Processed serialization preserves nested order and omits unresolved optional identity', function(assert) {
    const fixture = createRegistryTestFixture_({ initialized: true });
    const unresolved = createRegistryProcessedDocument_(1, { unresolved: true });
    const serialized = serializeProcessedFinancialDocumentForRegistry(unresolved, fixture.dependencies);
    assert.equal(serialized.schemaVersion, 1);
    assert.equal(serialized.json.indexOf('"documentDate"'), -1);
    assert.equal(serialized.json.indexOf('"sourceDocumentId"'), -1);
    assert.equal(serialized.json.indexOf(':null'), -1);
    const full = serializeProcessedFinancialDocumentForRegistry(createRegistryProcessedDocument_(1, { multiple: true }), fixture.dependencies);
    assert.ok(full.json.indexOf('Synthetic expense A') < full.json.indexOf('Synthetic expense B'));
  });

  QUnit.test('Processed authoritative reader round trips and rejects framing corruption', function(assert) {
    const fixture = createRegistryTestFixture_({ initialized: true });
    const processed = createRegistryProcessedDocument_(1, { multiple: true });
    const serialized = serializeProcessedFinancialDocumentForRegistry(processed, fixture.dependencies);
    const good = buildProcessedRegistryRow_(processed, serialized);
    assert.deepEqual(readProcessedRegistryRow_(good, fixture.dependencies, 0), processed);
    const variants = [good.slice(), good.slice(), good.slice()];
    variants[0][1] = 2;
    variants[1][2] = '{bad'; variants[1][3] = computeRegistryPayloadSha256_(1, variants[1][2], fixture.dependencies);
    variants[2][3] = '0'.repeat(64);
    variants.forEach(function(row) {
      assertRegistryError_(assert, function() { readProcessedRegistryRow_(row, fixture.dependencies, 0); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.corruptRecord);
    });
  });

  QUnit.test('payload digest covers UTF-8 schema version, newline, and deterministic JSON', function(assert) {
    let capturedBytes;
    const fixture = createRegistryTestFixture_({ initialized: true });
    fixture.dependencies.digestFunction = function(bytes) {
      capturedBytes = bytes.slice();
      return registryTestDigest_(bytes);
    };
    const serialized = serializeEvidenceRecordForRegistry(createRegistryEvidenceRecord_(1), fixture.dependencies);
    const prefix = capturedBytes.slice(0, 2);
    assert.deepEqual(prefix, [49, 10]);
    assert.equal(serialized.payloadSha256.length, 64);
    assert.equal(serialized.payloadSha256, computeRegistryPayloadSha256_(1, serialized.json, fixture.dependencies));
  });

  QUnit.test('authoritative readers reject unsupported versions, malformed JSON, digest, and scalar mismatch', function(assert) {
    const fixture = createRegistryTestFixture_({ initialized: true });
    const record = createRegistryEvidenceRecord_(1);
    const good = buildEvidenceRegistryRow_(record, serializeEvidenceRecordForRegistry(record, fixture.dependencies));
    const variants = [good.slice(), good.slice(), good.slice(), good.slice()];
    variants[0][1] = 2;
    variants[1][2] = '{bad'; variants[1][3] = computeRegistryPayloadSha256_(1, variants[1][2], fixture.dependencies);
    variants[2][3] = '0'.repeat(64);
    variants[3][5] = 'image/png';
    variants.forEach(function(row) {
      assertRegistryError_(assert, function() { readEvidenceRegistryRow_(row, fixture.dependencies, 0); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.corruptRecord);
    });

    const processed = createRegistryProcessedDocument_(1, {});
    const processedRow = buildProcessedRegistryRow_(processed, serializeProcessedFinancialDocumentForRegistry(processed, fixture.dependencies));
    processedRow[5] = '2030-01-01';
    assertRegistryError_(assert, function() { readProcessedRegistryRow_(processedRow, fixture.dependencies, 0); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.corruptRecord);
  });

  QUnit.test('unknown domain fields fail before serialization', function(assert) {
    const fixture = createRegistryTestFixture_({ initialized: true });
    const record = createRegistryEvidenceRecord_(1);
    record.unexpected = true;
    assertRegistryError_(assert, function() { serializeEvidenceRecordForRegistry(record, fixture.dependencies); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.validation);
    const processed = createRegistryProcessedDocument_(1, {});
    processed.canonicalFinancialDocument.unexpected = true;
    assertRegistryError_(assert, function() { serializeProcessedFinancialDocumentForRegistry(processed, fixture.dependencies); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.validation);
  });

  QUnit.test('cell guard accepts below limit and rejects at and above limit before write', function(assert) {
    const fixture = createRegistryTestFixture_({ initialized: true });
    const below = resizeRegistryEvidenceJson_(createRegistryEvidenceRecord_(1), 49999, fixture.dependencies);
    assert.equal(serializeEvidenceRecordForRegistry(below, fixture.dependencies).json.length, 49999);
    [50000, 50001].forEach(function(length) {
      const record = resizeRegistryEvidenceJson_(createRegistryEvidenceRecord_(1), length, fixture.dependencies, true);
      assertRegistryError_(assert, function() { fixture.registry.persistEvidenceRecord(record); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.serializationTooLarge);
    });
    assert.equal(fixture.workbook.appendCalls.length, 0);
  });
}

function registerFinancialDocumentRegistryPersistenceTests_() {
  QUnit.module('Financial document registry persistence');

  QUnit.test('Evidence first write commits CAPTURED and exact retry is a no-op', function(assert) {
    const fixture = createRegistryTestFixture_({ initialized: true });
    const record = createRegistryEvidenceRecord_(1);
    assert.deepEqual(fixture.registry.persistEvidenceRecord(record), record);
    assert.deepEqual(fixture.registry.readEvidenceRecord(record.evidenceId), record);
    assert.equal(fixture.registry.readProcessedFinancialDocument(record.evidenceId), null);
    fixture.registry.persistEvidenceRecord(JSON.parse(JSON.stringify(record)));
    assert.equal(activeRegistryRows_(fixture.workbook, 'Evidence').length, 1);
    assert.equal(fixture.workbook.rows.Evidence[0][0], record.evidenceId);
    assert.equal(fixture.workbook.rows.Evidence[0][7], record.sha256);
  });

  QUnit.test('same evidenceId conflict does not overwrite first valid authority', function(assert) {
    const fixture = createRegistryTestFixture_({ initialized: true });
    const first = createRegistryEvidenceRecord_(1);
    fixture.registry.persistEvidenceRecord(first);
    const conflict = JSON.parse(JSON.stringify(first));
    conflict.rawSizeBytes += 1;
    assertRegistryError_(assert, function() { fixture.registry.persistEvidenceRecord(conflict); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.duplicateConflict);
    assert.deepEqual(fixture.registry.readEvidenceRecord(first.evidenceId), first);
    assert.equal(activeRegistryRows_(fixture.workbook, 'Evidence').length, 1);
  });

  QUnit.test('partial Evidence write is cleared and cleanup failure remains bounded', function(assert) {
    const cleanup = createRegistryTestFixture_({ initialized: true });
    cleanup.workbook.failReadRow = true;
    assertRegistryError_(assert, function() { cleanup.registry.persistEvidenceRecord(createRegistryEvidenceRecord_(1)); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.writeFailure);
    assert.equal(activeRegistryRows_(cleanup.workbook, 'Evidence').length, 0);

    const failedCleanup = createRegistryTestFixture_({ initialized: true });
    failedCleanup.workbook.failReadRow = true;
    failedCleanup.workbook.failClearRow = true;
    const error = captureRegistryError_(function() { failedCleanup.registry.persistEvidenceRecord(createRegistryEvidenceRecord_(1)); });
    assert.equal(error.code, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.writeFailure);
    assert.equal(error.cleanupFailed, true);
    assert.equal(activeRegistryRows_(failedCleanup.workbook, 'Evidence').length, 1);
  });

  QUnit.test('corrupt or duplicate physical Evidence rows fail closed', function(assert) {
    const fixture = createRegistryTestFixture_({ initialized: true });
    const record = createRegistryEvidenceRecord_(1);
    const row = buildEvidenceRegistryRow_(record, serializeEvidenceRecordForRegistry(record, fixture.dependencies));
    fixture.workbook.rows.Evidence.push(row.slice());
    fixture.workbook.rows.Evidence[0][3] = '0'.repeat(64);
    assertRegistryError_(assert, function() { fixture.registry.persistEvidenceRecord(record); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.corruptRecord);

    const duplicate = createRegistryTestFixture_({ initialized: true });
    const validRow = buildEvidenceRegistryRow_(record, serializeEvidenceRecordForRegistry(record, duplicate.dependencies));
    duplicate.workbook.rows.Evidence.push(validRow.slice(), validRow.slice());
    assertRegistryError_(assert, function() { duplicate.registry.readEvidenceRecord(record.evidenceId); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.corruptRecord);
  });

  QUnit.test('capture correlation reports candidates without selecting or deduplicating identity', function(assert) {
    const fixture = createRegistryTestFixture_({ initialized: true });
    const first = createRegistryEvidenceRecord_(1);
    const second = createRegistryEvidenceRecord_(2);
    second.originRef = JSON.parse(JSON.stringify(first.originRef));
    second.sha256 = first.sha256;
    const changed = createRegistryEvidenceRecord_(3);
    changed.originRef = JSON.parse(JSON.stringify(first.originRef));
    const sameBytesElsewhere = createRegistryEvidenceRecord_(4);
    sameBytesElsewhere.sha256 = first.sha256;
    [first, second, changed, sameBytesElsewhere].forEach(function(record) { fixture.registry.persistEvidenceRecord(record); });
    const matches = fixture.registry.findEvidenceCaptureCandidates(first.originRef, first.sha256);
    assert.equal(matches.length, 2);
    assert.notEqual(matches[0].evidenceId, matches[1].evidenceId);
    assert.equal(fixture.registry.findEvidenceCaptureCandidates(first.originRef, changed.sha256).length, 1);
  });

  QUnit.test('processed persistence requires Evidence and exact provenance', testRegistryProcessedPersistenceRequiresEvidenceAndProvenance_);
  QUnit.test('valid processed write commits RECOGNIZED and full cardinality projections', testRegistryValidProcessedWriteCommitsRecognizedDocument_);
  QUnit.test('processed exact retry is no-op authority and repairs scoped projection drift', testRegistryProcessedRetryRepairsProjectionDrift_);
  QUnit.test('processed conflicts including changed processedAt never overwrite first commit', testRegistryProcessedConflictsNeverOverwriteFirstCommit_);
  QUnit.test('corrupt or duplicate Canonical rows fail closed', testRegistryCorruptOrDuplicateCanonicalRowsFailClosed_);
  QUnit.test('unresolved identity remains recognized with blank indexes and outside date query', testRegistryUnresolvedIdentityRemainsRecognized_);

  QUnit.test('serialized writes make exact retry and conflict decisions under one lock', testRegistrySerializedWritesUseOneLock_);
}

function registerFinancialDocumentRegistryReadModelsTests_() {
  QUnit.module('Financial document registry read models');

  QUnit.test('projection builder preserves positions, signed amounts, and blank optionals', testRegistryProjectionBuilderPreservesValues_);

  QUnit.test('projection verification detects missing, duplicate, wrong, extra, and orphan rows', function(assert) {
    const mutations = [
      function(w) { w.rows.Documenten = []; },
      function(w) { w.rows.Documenten.push(w.rows.Documenten[0].slice()); },
      function(w) { w.rows.Regels.pop(); },
      function(w) { w.rows.Regels.push([registryEvidenceId_(1), 9, 'extra', '', '', 1]); },
      function(w) { w.rows.Regels[0][1] = 4; },
      function(w) { w.rows.Regels[0][5] += 1; },
      function(w) { w.rows.BTW.push([registryEvidenceId_(1), 9, '', 1]); }
    ];
    mutations.forEach(function(mutate) {
      const fixture = createRecognizedRegistryTestFixture_(1, { multiple: true });
      mutate(fixture.workbook);
      assertRegistryError_(assert, function() { fixture.registry.verifyFinancialDocumentProjections(fixture.evidence.evidenceId); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.projectionDrift);
    });
  });

  QUnit.test('scoped and full rebuild repair drift from Canonical only without changing authority', function(assert) {
    const fixture = createRecognizedRegistryTestFixture_(1, { multiple: true });
    const evidenceBefore = JSON.stringify(fixture.workbook.rows.Evidence);
    const canonicalBefore = JSON.stringify(fixture.workbook.rows._Canonical);
    fixture.workbook.rows.Documenten = [];
    fixture.workbook.rows.Regels = [[registryEvidenceId_(99), 0, 'orphan', '', '', 1]];
    fixture.registry.rebuildFinancialDocumentProjections(fixture.evidence.evidenceId);
    assert.equal(fixture.registry.verifyFinancialDocumentProjections(fixture.evidence.evidenceId), true);
    fixture.workbook.rows.BTW = [];
    const result = fixture.registry.rebuildFinancialDocumentProjections();
    assert.equal(result.recognizedDocumentCount, 1);
    assert.equal(fixture.registry.verifyFinancialDocumentProjections(fixture.evidence.evidenceId), true);
    assert.equal(JSON.stringify(fixture.workbook.rows.Evidence), evidenceBefore);
    assert.equal(JSON.stringify(fixture.workbook.rows._Canonical), canonicalBefore);
  });

  QUnit.test('full projection audit detects a child row orphaned from Canonical', function(assert) {
    const fixture = createRecognizedRegistryTestFixture_(1, {});
    assert.equal(fixture.registry.auditFinancialDocumentProjections().valid, true);
    fixture.workbook.rows.Regels.push([registryEvidenceId_(99), 0, 'orphan', '', '', 1]);
    assertRegistryError_(assert, function() {
      fixture.registry.auditFinancialDocumentProjections();
    }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.projectionDrift);
    fixture.registry.rebuildFinancialDocumentProjections();
    assert.equal(fixture.registry.auditFinancialDocumentProjections().valid, true);
  });

  QUnit.test('projection failure after commit preserves recognition and exact retry repairs', function(assert) {
    const fixture = createRegistryTestFixture_({ initialized: true });
    fixture.registry.persistEvidenceRecord(createRegistryEvidenceRecord_(1));
    const processed = createRegistryProcessedDocument_(1, {});
    fixture.workbook.failReplaceRows = true;
    const error = captureRegistryError_(function() { fixture.registry.persistProcessedFinancialDocument(processed); });
    assert.equal(error.code, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.projectionFailure);
    assert.equal(error.recognizedCommitted, true);
    assert.equal(error.projectionRepairRequired, true);
    assert.equal(activeRegistryRows_(fixture.workbook, '_Canonical').length, 1);
    fixture.workbook.failReplaceRows = false;
    fixture.registry.persistProcessedFinancialDocument(processed);
    assert.equal(activeRegistryRows_(fixture.workbook, '_Canonical').length, 1);
    assert.equal(fixture.registry.verifyFinancialDocumentProjections(processed.evidenceId), true);
  });

  QUnit.test('date range is inclusive, excludes outside/unresolved, and sorts deterministically', function(assert) {
    const fixture = createRegistryTestFixture_({ initialized: true });
    const documents = [
      createRegistryProcessedDocument_(1, { date: '2026-09-01', processedAt: '2026-09-13T10:03:00.000Z' }),
      createRegistryProcessedDocument_(2, { date: '2026-09-30', processedAt: '2026-09-13T10:02:00.000Z' }),
      createRegistryProcessedDocument_(3, { date: '2026-09-15', processedAt: '2026-09-13T10:01:00.000Z' }),
      createRegistryProcessedDocument_(4, { date: '2026-10-01' }),
      createRegistryProcessedDocument_(5, { unresolved: true })
    ];
    documents.forEach(function(processed, index) {
      fixture.registry.persistEvidenceRecord(createRegistryEvidenceRecord_(index + 1));
      fixture.registry.persistProcessedFinancialDocument(processed);
    });
    const results = fixture.registry.queryRecognizedDocumentsByDateRange('2026-09-01', '2026-09-30');
    assert.deepEqual(results.map(function(value) { return value.evidenceId; }), [registryEvidenceId_(1), registryEvidenceId_(3), registryEvidenceId_(2)]);
    assert.ok(registryHasOwn_(results[0], 'canonicalFinancialDocument'));
    assert.equal(registryHasOwn_(results[0], 'expenseIndex'), false);
  });

  QUnit.test('date query validates boundaries and detects scalar/JSON mismatch', function(assert) {
    const fixture = createRecognizedRegistryTestFixture_(1, {});
    assertRegistryError_(assert, function() { fixture.registry.queryRecognizedDocumentsByDateRange('bad', '2026-12-31'); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.validation);
    fixture.workbook.rows._Canonical[0][5] = '2026-01-01';
    assertRegistryError_(assert, function() { fixture.registry.queryRecognizedDocumentsByDateRange('2026-01-01', '2026-12-31'); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.corruptRecord);
  });
}

function testRegistryProjectionBuilderPreservesValues_(assert) {
  const projections = buildFinancialDocumentProjections(createRegistryProcessedDocument_(1, { multiple: true }));
  assert.deepEqual(projections.Regels.map(function(row) { return row[1]; }), [0, 1]);
  assert.deepEqual(projections.ExtraKosten.map(function(row) { return row[1]; }), [0, 1]);
  assert.deepEqual(projections.Correcties.map(function(row) { return row[1]; }), [0, 1]);
  assert.ok(projections.Correcties[0][4] < 0);
  assert.equal(projections.BTW[0][3], '');
  assert.equal(projections.BTW[1][2], '');
  assert.equal(projections.Regels[1][3], '');
}

function testRegistrySerializedWritesUseOneLock_(assert) {
  const fixture = createRegistryTestFixture_({ initialized: true });
  const first = createRegistryEvidenceRecord_(1);
  fixture.registry.persistEvidenceRecord(first);
  fixture.registry.persistEvidenceRecord(JSON.parse(JSON.stringify(first)));
  const conflict = JSON.parse(JSON.stringify(first)); conflict.capturedAt = '2026-09-13T11:00:00.000Z';
  assertRegistryError_(assert, function() { fixture.registry.persistEvidenceRecord(conflict); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.duplicateConflict);
  assert.equal(fixture.lock.acquireCount, 3);
  assert.equal(fixture.lock.releaseCount, 3);
  assert.deepEqual(fixture.registry.readEvidenceRecord(first.evidenceId), first);
}

function testRegistryErrorsExposeOnlyBoundedMetadata_(assert) {
  const fixture = createRegistryTestFixture_({ initialized: true });
  const evidence = createRegistryEvidenceRecord_(1);
  fixture.registry.persistEvidenceRecord(evidence);
  const conflict = JSON.parse(JSON.stringify(evidence)); conflict.rawSizeBytes += 1;
  const error = captureRegistryError_(function() { fixture.registry.persistEvidenceRecord(conflict); });
  const serialized = JSON.stringify(error);
  [evidence.sourceFileName, evidence.originRef.fileId, evidence.contentRef.fileId, evidence.sha256, 'base64', 'iban', 'bsn', 'applicantCode'].forEach(function(forbidden) {
    assert.equal(String(error.message).toLowerCase().indexOf(forbidden.toLowerCase()), -1);
    assert.equal(serialized.toLowerCase().indexOf(forbidden.toLowerCase()), -1);
  });
  assert.equal(error.evidenceId, evidence.evidenceId);
}

function testRegistryConfigurationFailuresUseBoundedErrors_(assert) {
  assertRegistryError_(assert, function() { createFinancialDocumentRegistry({}); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.configuration);
  const fixture = createRegistryTestFixture_({ initialized: true });
  fixture.dependencies.configuration.getRegistrySpreadsheetId = function() { return ''; };
  assertRegistryError_(assert, function() { fixture.registry.readEvidenceRecord(registryEvidenceId_(1)); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.configuration);
}

function testRegistryProcessedPersistenceRequiresEvidenceAndProvenance_(assert) {
  const missing = createRegistryTestFixture_({ initialized: true });
  assertRegistryError_(assert, function() { missing.registry.persistProcessedFinancialDocument(createRegistryProcessedDocument_(1, {})); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.missingEvidence);

  ['sourceFileName', 'mimeType'].forEach(function(fieldName) {
    const fixture = createRegistryTestFixture_({ initialized: true });
    const evidence = createRegistryEvidenceRecord_(1);
    fixture.registry.persistEvidenceRecord(evidence);
    const processed = createRegistryProcessedDocument_(1, {});
    processed.canonicalFinancialDocument.sourceProvenance[fieldName] = fieldName === 'mimeType' ? 'image/png' : 'different.pdf';
    assertRegistryError_(assert, function() { fixture.registry.persistProcessedFinancialDocument(processed); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.validation);
  });
}

function testRegistryValidProcessedWriteCommitsRecognizedDocument_(assert) {
  const fixture = createRegistryTestFixture_({ initialized: true });
  const evidence = createRegistryEvidenceRecord_(1);
  const processed = createRegistryProcessedDocument_(1, { multiple: true });
  fixture.registry.persistEvidenceRecord(evidence);
  assert.deepEqual(fixture.registry.persistProcessedFinancialDocument(processed), processed);
  assert.deepEqual(fixture.registry.readProcessedFinancialDocument(evidence.evidenceId), processed);
  assert.equal(activeRegistryRows_(fixture.workbook, 'Evidence').length, 1);
  assert.equal(activeRegistryRows_(fixture.workbook, '_Canonical').length, 1);
  assert.equal(activeRegistryRows_(fixture.workbook, 'Documenten').length, 1);
  assert.equal(activeRegistryRows_(fixture.workbook, 'Regels').length, 2);
  assert.equal(activeRegistryRows_(fixture.workbook, 'ExtraKosten').length, 2);
  assert.equal(activeRegistryRows_(fixture.workbook, 'Correcties').length, 2);
  assert.equal(activeRegistryRows_(fixture.workbook, 'BTW').length, 2);
  assert.equal(fixture.registry.verifyFinancialDocumentProjections(evidence.evidenceId), true);
}

function testRegistryProcessedRetryRepairsProjectionDrift_(assert) {
  const fixture = createRecognizedRegistryTestFixture_(1, { multiple: true });
  const originalCanonical = fixture.workbook.rows._Canonical[0].slice();
  fixture.workbook.rows.Regels.pop();
  fixture.registry.persistProcessedFinancialDocument(fixture.processed);
  assert.equal(activeRegistryRows_(fixture.workbook, '_Canonical').length, 1);
  assert.deepEqual(fixture.workbook.rows._Canonical[0], originalCanonical);
  assert.equal(activeRegistryRows_(fixture.workbook, 'Regels').length, 2);
  assert.equal(fixture.registry.verifyFinancialDocumentProjections(fixture.evidence.evidenceId), true);
}

function testRegistryProcessedConflictsNeverOverwriteFirstCommit_(assert) {
  ['content', 'time'].forEach(function(kind) {
    const fixture = createRecognizedRegistryTestFixture_(1, {});
    const conflict = JSON.parse(JSON.stringify(fixture.processed));
    if (kind === 'content') conflict.canonicalFinancialDocument.expenses[0].printedLineAmount += 1;
    if (kind === 'time') conflict.processedAt = '2026-09-13T12:00:00.000Z';
    assertRegistryError_(assert, function() { fixture.registry.persistProcessedFinancialDocument(conflict); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.duplicateConflict);
    assert.equal(activeRegistryRows_(fixture.workbook, '_Canonical').length, 1);
    assert.deepEqual(fixture.registry.readProcessedFinancialDocument(fixture.evidence.evidenceId), fixture.processed);
  });
}

function testRegistryCorruptOrDuplicateCanonicalRowsFailClosed_(assert) {
  const corrupt = createRecognizedRegistryTestFixture_(1, {});
  corrupt.workbook.rows._Canonical[0][3] = '0'.repeat(64);
  assertRegistryError_(assert, function() { corrupt.registry.readProcessedFinancialDocument(corrupt.evidence.evidenceId); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.corruptRecord);

  const duplicate = createRecognizedRegistryTestFixture_(1, {});
  duplicate.workbook.rows._Canonical.push(duplicate.workbook.rows._Canonical[0].slice());
  assertRegistryError_(assert, function() { duplicate.registry.persistProcessedFinancialDocument(duplicate.processed); }, FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.corruptRecord);
}

function testRegistryUnresolvedIdentityRemainsRecognized_(assert) {
  const fixture = createRecognizedRegistryTestFixture_(1, { unresolved: true });
  assert.equal(fixture.workbook.rows._Canonical[0][5], '');
  assert.equal(fixture.workbook.rows._Canonical[0][6], '');
  assert.equal(fixture.workbook.rows.Documenten[0][1], '');
  assert.equal(fixture.workbook.rows.Documenten[0][2], '');
  assert.equal(fixture.registry.queryRecognizedDocumentsByDateRange('2026-01-01', '2026-12-31').length, 0);
  assert.ok(fixture.registry.readProcessedFinancialDocument(fixture.evidence.evidenceId));
}

function createRegistryTestFixture_(options) {
  const settings = options || {};
  const workbook = createRegistryFakeWorkbook_(settings);
  const lock = createRegistryFakeLock_();
  const dependencies = {
    configuration: { getRegistrySpreadsheetId: function() { return 'synthetic_registry_id'; } },
    spreadsheet: { openById: function() { return workbook; } },
    lock: lock,
    clock: function() { return new Date('2026-09-13T10:00:00.000Z'); },
    digestFunction: registryTestDigest_
  };
  return {
    workbook: workbook,
    lock: lock,
    dependencies: dependencies,
    registry: createFinancialDocumentRegistry(dependencies)
  };
}

function createRecognizedRegistryTestFixture_(number, options) {
  const fixture = createRegistryTestFixture_({ initialized: true });
  fixture.evidence = createRegistryEvidenceRecord_(number);
  fixture.processed = createRegistryProcessedDocument_(number, options || {});
  fixture.registry.persistEvidenceRecord(fixture.evidence);
  fixture.registry.persistProcessedFinancialDocument(fixture.processed);
  return fixture;
}

function createRegistryFakeWorkbook_(options) {
  const sheetNames = FINANCIAL_DOCUMENT_REGISTRY_TABS.slice();
  if (options.includeLegacy) sheetNames.push('_Legacy_v1');
  const headers = {};
  const rows = {};
  FINANCIAL_DOCUMENT_REGISTRY_TABS.forEach(function(tab) {
    headers[tab] = FINANCIAL_DOCUMENT_REGISTRY_HEADERS[tab].slice();
    rows[tab] = [];
  });
  if (options.includeLegacy) rows._Legacy_v1 = [['migration-only']];
  rows._Meta = [[
    2, 1, 1, options.initialized ? '2026-09-12T10:00:00.000Z' : '', '', ''
  ]];
  return {
    sheetNames: sheetNames,
    headers: headers,
    rows: rows,
    appendCalls: [],
    setCellCalls: [],
    readCountByTab: {},
    failSetCell: false,
    failReadRow: false,
    failClearRow: false,
    failReplaceRows: false,
    mutateMetaReadback: false,
    getSheetNames: function() { return this.sheetNames.slice(); },
    getHeaders: function(tab) { return this.headers[tab].slice(); },
    getRows: function(tab) {
      this.readCountByTab[tab] = (this.readCountByTab[tab] || 0) + 1;
      const copy = this.rows[tab].map(function(row) { return row.slice(); });
      if (tab === '_Meta' && this.mutateMetaReadback && copy[0][3] !== '') copy[0][3] = '2026-09-13T10:00:01.000Z';
      return copy;
    },
    setCell: function(tab, rowIndex, columnIndex, value) {
      if (this.failSetCell) throw new Error('synthetic set failure');
      this.setCellCalls.push([tab, rowIndex, columnIndex]);
      this.rows[tab][rowIndex][columnIndex] = value;
    },
    appendRow: function(tab, row) {
      const index = this.rows[tab].length;
      this.rows[tab].push(row.slice());
      this.appendCalls.push([tab, index]);
      return index;
    },
    readRow: function(tab, index) {
      if (this.failReadRow) throw new Error('synthetic read failure');
      return this.rows[tab][index].slice();
    },
    clearRow: function(tab, index) {
      if (this.failClearRow) throw new Error('synthetic clear failure');
      this.rows[tab][index] = new Array(this.headers[tab].length).fill('');
    },
    replaceRows: function(tab, replacement) {
      if (this.failReplaceRows) throw new Error('synthetic projection failure');
      this.rows[tab] = replacement.map(function(row) { return row.slice(); });
    },
    flush: function() {}
  };
}

function createRegistryFakeLock_() {
  return {
    allowAcquire: true,
    acquireCount: 0,
    releaseCount: 0,
    tryAcquire: function() { this.acquireCount += 1; return this.allowAcquire; },
    release: function() { this.releaseCount += 1; }
  };
}

function registryTestDigest_(bytes) {
  let state = 17;
  bytes.forEach(function(value) { state = (state * 31 + ((value + 256) % 256)) >>> 0; });
  const output = [];
  for (let index = 0; index < 32; index += 1) {
    state = (state * 1664525 + 1013904223) >>> 0;
    output.push((state >>> 24) & 255);
  }
  return output;
}

function registryEvidenceId_(number) {
  const suffix = String(number).padStart(12, '0');
  return '00000000-0000-4000-8000-' + suffix;
}

function createRegistryEvidenceRecord_(number) {
  return validateEvidenceRecord({
    evidenceId: registryEvidenceId_(number),
    originRef: { type: 'DRIVE_FILE', fileId: 'origin_' + number },
    contentRef: { type: 'DRIVE_FILE', fileId: 'content_' + number },
    sourceFileName: 'synthetic-' + number + '.pdf',
    mimeType: 'application/pdf',
    rawSizeBytes: 100 + number,
    sha256: String(number % 10).repeat(64),
    capturedAt: '2026-09-13T10:00:00.000Z'
  });
}

function createRegistryProcessedDocument_(number, options) {
  const settings = options || {};
  const canonical = createMinimalCanonicalFinancialDocument({
    sourceFileName: 'synthetic-' + number + '.pdf',
    mimeType: 'application/pdf'
  });
  if (!settings.unresolved) {
    canonical.documentDate = settings.date || '2026-09-13';
    canonical.sourceDocumentId = 'SYNTH-' + number;
  }
  canonical.expenses = [
    { description: 'Synthetic expense A', quantity: 2, printedUnitAmount: 500, printedLineAmount: 1000 }
  ];
  canonical.additionalCosts = [{ category: 'SHIPPING', description: 'Synthetic shipping', printedAmount: 100 }];
  canonical.adjustments = [{ adjustmentType: 'COMMERCIAL_DISCOUNT', description: 'Synthetic discount', printedAmount: -50 }];
  canonical.vat = [{ printedRate: 21 }];
  canonical.printedTotals = { exclVAT: 1050, vatAmount: 200, inclVAT: 1250 };
  canonical.reconciliation = { status: 'MATCHED', difference: 0 };
  if (settings.multiple) {
    canonical.expenses.push({ description: 'Synthetic expense B', printedLineAmount: 250 });
    canonical.additionalCosts.push({ category: 'FEE', printedAmount: 25 });
    canonical.adjustments.push({ adjustmentType: 'OTHER_ADJUSTMENT', description: 'Synthetic adjustment', printedAmount: -25 });
    canonical.vat.push({ printedAmount: 200 });
  }
  validateCanonicalFinancialDocument(canonical);
  return validateProcessedFinancialDocument({
    evidenceId: registryEvidenceId_(number),
    canonicalFinancialDocument: canonical,
    processedAt: settings.processedAt || '2026-09-13T11:00:00.000Z'
  });
}

function resizeRegistryEvidenceJson_(record, targetLength, dependencies, allowGuardFailure) {
  const copy = JSON.parse(JSON.stringify(record));
  const base = serializeEvidenceRecordForRegistry(copy, dependencies).json.length;
  copy.sourceFileName += 'x'.repeat(targetLength - base);
  if (!allowGuardFailure) validateEvidenceRecord(copy);
  return copy;
}

function activeRegistryRows_(workbook, tab) {
  return workbook.rows[tab].filter(function(row) { return !isEmptyRegistryRow_(row); });
}

function captureRegistryError_(action) {
  try { action(); } catch (error) { return error; }
  throw new Error('Expected registry error.');
}

function assertRegistryError_(assert, action, expectedCode) {
  const error = captureRegistryError_(action);
  assert.equal(error.name, 'FinancialDocumentRegistryError');
  assert.equal(error.code, expectedCode);
}
