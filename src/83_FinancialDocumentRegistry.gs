// FinancialDocumentRegistry core using injected configuration, spreadsheet,
// lock, clock, and digest seams. This slice deliberately defers live GAS
// adapters: no SpreadsheetApp, LockService, or PropertiesService call occurs.
//
// configuration.getRegistrySpreadsheetId() -> string
// spreadsheet.openById(id) -> workbook
// lock.tryAcquire(timeoutMilliseconds) -> boolean; lock.release()
// workbook: getSheetNames(), getHeaders(tab), getRows(tab), setCell(tab,row,col,value),
// appendRow(tab,row)->data row index, readRow(tab,index), clearRow(tab,index),
// replaceRows(tab,rows), flush(). Data-row indexes are zero based.
// Every public operation that observes registry state holds this one injected
// script-wide lock. Pure serialization and projection construction do not.

function createFinancialDocumentRegistry(dependencies) {
  const seams = resolveFinancialDocumentRegistryDependencies_(dependencies);
  return {
    initializeFinancialDocumentRegistry: function() {
      return withFinancialDocumentRegistryLock_(seams, function(workbook) {
        return initializeFinancialDocumentRegistry_(workbook, seams);
      });
    },
    persistEvidenceRecord: function(record) {
      const serialization = serializeEvidenceRecordForRegistry(record, seams);
      return withFinancialDocumentRegistryLock_(seams, function(workbook) {
        validateInitializedFinancialDocumentRegistry_(workbook, seams);
        return persistEvidenceRecord_(workbook, record, serialization, seams);
      });
    },
    readEvidenceRecord: function(evidenceId) {
      return withFinancialDocumentRegistryLock_(seams, function(workbook) {
        validateInitializedFinancialDocumentRegistry_(workbook, seams);
        return findEvidenceRecordById_(workbook, evidenceId, seams);
      });
    },
    findEvidenceCaptureCandidates: function(originRef, sha256) {
      return withFinancialDocumentRegistryLock_(seams, function(workbook) {
        validateInitializedFinancialDocumentRegistry_(workbook, seams);
        return findEvidenceCaptureCandidates_(workbook, originRef, sha256, seams);
      });
    },
    persistProcessedFinancialDocument: function(processedDocument) {
      const serialization = serializeProcessedFinancialDocumentForRegistry(processedDocument, seams);
      return withFinancialDocumentRegistryLock_(seams, function(workbook) {
        validateInitializedFinancialDocumentRegistry_(workbook, seams);
        return persistProcessedFinancialDocument_(workbook, processedDocument, serialization, seams);
      });
    },
    readProcessedFinancialDocument: function(evidenceId) {
      return withFinancialDocumentRegistryLock_(seams, function(workbook) {
        validateInitializedFinancialDocumentRegistry_(workbook, seams);
        return findProcessedFinancialDocumentById_(workbook, evidenceId, seams);
      });
    },
    queryRecognizedDocumentsByDateRange: function(startDate, endDate) {
      return withFinancialDocumentRegistryLock_(seams, function(workbook) {
        validateInitializedFinancialDocumentRegistry_(workbook, seams);
        return queryRecognizedDocumentsByDateRange_(workbook, startDate, endDate, seams);
      });
    },
    verifyFinancialDocumentProjections: function(evidenceId) {
      return withFinancialDocumentRegistryLock_(seams, function(workbook) {
        validateInitializedFinancialDocumentRegistry_(workbook, seams);
        const processed = requireProcessedFinancialDocument_(workbook, evidenceId, seams);
        return verifyFinancialDocumentProjections_(workbook, processed);
      });
    },
    auditFinancialDocumentProjections: function() {
      return withFinancialDocumentRegistryLock_(seams, function(workbook) {
        validateInitializedFinancialDocumentRegistry_(workbook, seams);
        return auditAllFinancialDocumentProjections_(workbook, seams);
      });
    },
    rebuildFinancialDocumentProjections: function(evidenceId) {
      return withFinancialDocumentRegistryLock_(seams, function(workbook) {
        validateInitializedFinancialDocumentRegistry_(workbook, seams);
        if (evidenceId === undefined) {
          return rebuildAllFinancialDocumentProjections_(workbook, seams);
        }
        const processed = requireProcessedFinancialDocument_(workbook, evidenceId, seams);
        replaceFinancialDocumentProjections_(workbook, processed);
        return { evidenceId: evidenceId, rebuilt: true };
      });
    }
  };
}

function resolveFinancialDocumentRegistryDependencies_(dependencies) {
  if (!dependencies || typeof dependencies !== 'object' || Array.isArray(dependencies)) {
    throw createFinancialDocumentRegistryError_(
      FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.configuration,
      'dependencies'
    );
  }
  const required = ['configuration', 'spreadsheet', 'lock'];
  const methods = {
    configuration: ['getRegistrySpreadsheetId'],
    spreadsheet: ['openById'],
    lock: ['tryAcquire', 'release']
  };
  required.forEach(function(name) {
    const adapter = dependencies[name];
    if (!adapter || methods[name].some(function(method) { return typeof adapter[method] !== 'function'; })) {
      throw createFinancialDocumentRegistryError_(
        FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.configuration,
        'dependencies'
      );
    }
  });
  if (registryHasOwn_(dependencies, 'clock') && typeof dependencies.clock !== 'function') {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.configuration, 'dependencies');
  }
  if (registryHasOwn_(dependencies, 'digestFunction') && typeof dependencies.digestFunction !== 'function') {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.configuration, 'dependencies');
  }
  return dependencies;
}

function withFinancialDocumentRegistryLock_(dependencies, action) {
  let acquired = false;
  try {
    acquired = dependencies.lock.tryAcquire(
      FINANCIAL_DOCUMENT_REGISTRY_CONFIG.lockTimeoutMilliseconds
    ) === true;
  } catch (error) {
    acquired = false;
  }
  if (!acquired) {
    throw createFinancialDocumentRegistryError_(
      FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.lockTimeout,
      'acquireLock'
    );
  }
  try {
    return action(openFinancialDocumentRegistryWorkbook_(dependencies));
  } finally {
    try {
      dependencies.lock.release();
    } catch (ignored) {
      // A release error must not replace the operation result or original error.
    }
  }
}

function openFinancialDocumentRegistryWorkbook_(dependencies) {
  let spreadsheetId;
  try {
    spreadsheetId = dependencies.configuration.getRegistrySpreadsheetId();
  } catch (error) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.configuration, 'readConfiguration');
  }
  if (typeof spreadsheetId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(spreadsheetId)) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.configuration, 'readConfiguration');
  }
  let workbook;
  try {
    workbook = dependencies.spreadsheet.openById(spreadsheetId);
  } catch (error) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.readFailure, 'openRegistry');
  }
  validateRegistryWorkbookAdapter_(workbook);
  return workbook;
}

function validateRegistryWorkbookAdapter_(workbook) {
  const required = [
    'getSheetNames', 'getHeaders', 'getRows', 'setCell', 'appendRow', 'readRow',
    'clearRow', 'replaceRows', 'flush'
  ];
  if (!workbook || required.some(function(method) { return typeof workbook[method] !== 'function'; })) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.configuration, 'workbookAdapter');
  }
}

function validateFinancialDocumentRegistrySchema_(workbook, dependencies, requireInitialized) {
  let sheetNames;
  try {
    sheetNames = workbook.getSheetNames();
  } catch (error) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.readFailure, 'readTopology');
  }
  if (!Array.isArray(sheetNames)) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.schemaMismatch, 'validateTopology');
  }
  const allowed = FINANCIAL_DOCUMENT_REGISTRY_TABS.concat(FINANCIAL_DOCUMENT_REGISTRY_ALLOWED_NON_V2_TABS);
  const uniqueNames = {};
  sheetNames.forEach(function(name) { uniqueNames[name] = (uniqueNames[name] || 0) + 1; });
  const topologyValid = FINANCIAL_DOCUMENT_REGISTRY_TABS.every(function(name) {
    return uniqueNames[name] === 1;
  }) && sheetNames.every(function(name) {
    return allowed.indexOf(name) !== -1 && uniqueNames[name] === 1;
  });
  if (!topologyValid) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.schemaMismatch, 'validateTopology');
  }
  FINANCIAL_DOCUMENT_REGISTRY_TABS.forEach(function(tab) {
    let headers;
    try {
      headers = workbook.getHeaders(tab);
    } catch (error) {
      throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.readFailure, 'readHeaders', { tab: tab });
    }
    if (!registryRowsEqual_(headers, FINANCIAL_DOCUMENT_REGISTRY_HEADERS[tab])) {
      throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.schemaMismatch, 'validateHeaders', { tab: tab });
    }
  });
  const metaRows = readRegistryRows_(workbook, '_Meta').filter(function(row) { return !isEmptyRegistryRow_(row); });
  if (metaRows.length !== 1 || metaRows[0].length !== FINANCIAL_DOCUMENT_REGISTRY_HEADERS._Meta.length) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.schemaMismatch, 'validateMeta');
  }
  const meta = metaRows[0];
  if (meta[0] !== FINANCIAL_DOCUMENT_REGISTRY_CONFIG.registrySchemaVersion ||
      meta[1] !== FINANCIAL_DOCUMENT_REGISTRY_CONFIG.evidenceRecordSchemaVersion ||
      meta[2] !== FINANCIAL_DOCUMENT_REGISTRY_CONFIG.processedDocumentSchemaVersion) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.schemaMismatch, 'validateMeta');
  }
  if (meta[3] !== '' && !isCanonicalRegistryTimestamp_(meta[3])) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.schemaMismatch, 'validateMeta');
  }
  const migrationsBlank = meta[4] === '' && meta[5] === '';
  const migrationsValid = typeof meta[4] === 'string' && meta[4].trim() !== '' &&
    isCanonicalRegistryTimestamp_(meta[5]);
  if (!migrationsBlank && !migrationsValid) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.schemaMismatch, 'validateMeta');
  }
  if (requireInitialized && meta[3] === '') {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.schemaMismatch, 'requireInitialized');
  }
  return {
    registrySchemaVersion: meta[0],
    currentEvidenceRecordSchemaVersion: meta[1],
    currentProcessedDocumentSchemaVersion: meta[2],
    initializedAt: meta[3],
    lastMigrationId: meta[4],
    lastMigrationAt: meta[5]
  };
}

function validateInitializedFinancialDocumentRegistry_(workbook, dependencies) {
  return validateFinancialDocumentRegistrySchema_(workbook, dependencies, true);
}

function initializeFinancialDocumentRegistry_(workbook, dependencies) {
  const before = validateFinancialDocumentRegistrySchema_(workbook, dependencies, false);
  validateExistingRegistryAuthority_(workbook, dependencies);
  if (before.initializedAt !== '') return before;
  let timestamp;
  try {
    const value = dependencies.clock ? dependencies.clock() : new Date();
    timestamp = value instanceof Date ? value.toISOString() : '';
  } catch (error) {
    timestamp = '';
  }
  if (!isCanonicalRegistryTimestamp_(timestamp)) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.validation, 'initializationClock');
  }
  let wrote = false;
  try {
    workbook.setCell('_Meta', 0, 3, timestamp);
    wrote = true;
    flushRegistryWorkbook_(workbook);
    const after = validateFinancialDocumentRegistrySchema_(workbook, dependencies, true);
    if (after.initializedAt !== timestamp || after.lastMigrationId !== '' || after.lastMigrationAt !== '') {
      throw new Error('initialization readback mismatch');
    }
    return after;
  } catch (error) {
    let cleanupFailed = false;
    if (wrote) {
      try { workbook.setCell('_Meta', 0, 3, ''); } catch (cleanupError) { cleanupFailed = true; }
    }
    throw createFinancialDocumentRegistryError_(
      FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.writeFailure,
      'initializeRegistry',
      { cleanupFailed: cleanupFailed }
    );
  }
}

function validateExistingRegistryAuthority_(workbook, dependencies) {
  const evidenceById = {};
  readAllEvidenceRecords_(workbook, dependencies).forEach(function(record) {
    evidenceById[record.evidenceId] = record;
  });
  readAllProcessedFinancialDocuments_(workbook, dependencies).forEach(function(processed) {
    const evidence = evidenceById[processed.evidenceId];
    const provenance = processed.canonicalFinancialDocument.sourceProvenance;
    if (!evidence || evidence.sourceFileName !== provenance.sourceFileName ||
        evidence.mimeType !== provenance.mimeType) {
      throw createFinancialDocumentRegistryError_(
        FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.corruptRecord,
        'validateExistingAuthority',
        { evidenceId: processed.evidenceId }
      );
    }
  });
}

function persistEvidenceRecord_(workbook, record, serialization, dependencies) {
  const rows = readRegistryRows_(workbook, 'Evidence');
  const matches = findRegistryRowsByEvidenceId_(rows, record.evidenceId);
  if (matches.length > 1) throwDuplicateRegistryRows_(record.evidenceId, 'Evidence', matches.length);
  if (matches.length === 1) {
    const existing = readEvidenceRegistryRow_(matches[0].row, dependencies, matches[0].index);
    if (serializeEvidenceRecordForRegistry(existing, dependencies).json === serialization.json) return existing;
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.duplicateConflict, 'persistEvidence', { evidenceId: record.evidenceId });
  }
  const row = buildEvidenceRegistryRow_(record, serialization);
  writeAndVerifyAuthoritativeRow_(workbook, 'Evidence', row, function(readBack, index) {
    return readEvidenceRegistryRow_(readBack, dependencies, index);
  }, record.evidenceId);
  return JSON.parse(serialization.json);
}

function persistProcessedFinancialDocument_(workbook, processedDocument, serialization, dependencies) {
  const evidence = findEvidenceRecordById_(workbook, processedDocument.evidenceId, dependencies);
  if (!evidence) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.missingEvidence, 'persistProcessed', { evidenceId: processedDocument.evidenceId });
  }
  const provenance = processedDocument.canonicalFinancialDocument.sourceProvenance;
  if (provenance.sourceFileName !== evidence.sourceFileName || provenance.mimeType !== evidence.mimeType) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.validation, 'crossCheckEvidence', { evidenceId: processedDocument.evidenceId });
  }
  const rows = readRegistryRows_(workbook, '_Canonical');
  const matches = findRegistryRowsByEvidenceId_(rows, processedDocument.evidenceId);
  if (matches.length > 1) throwDuplicateRegistryRows_(processedDocument.evidenceId, '_Canonical', matches.length);
  let persisted;
  if (matches.length === 1) {
    persisted = readProcessedRegistryRow_(matches[0].row, dependencies, matches[0].index);
    if (serializeProcessedFinancialDocumentForRegistry(persisted, dependencies).json !== serialization.json) {
      throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.duplicateConflict, 'persistProcessed', { evidenceId: processedDocument.evidenceId });
    }
  } else {
    const row = buildProcessedRegistryRow_(processedDocument, serialization);
    persisted = writeAndVerifyAuthoritativeRow_(workbook, '_Canonical', row, function(readBack, index) {
      return readProcessedRegistryRow_(readBack, dependencies, index);
    }, processedDocument.evidenceId);
    // Recognition is now committed. Recheck the relationship before projections.
    if (persisted.evidenceId !== evidence.evidenceId) {
      throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.corruptRecord, 'crossCheckEvidence', { evidenceId: processedDocument.evidenceId });
    }
  }
  try {
    try {
      verifyFinancialDocumentProjections_(workbook, persisted);
    } catch (drift) {
      replaceFinancialDocumentProjections_(workbook, persisted);
    }
  } catch (error) {
    throw createFinancialDocumentRegistryError_(
      FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.projectionFailure,
      'persistProjections',
      { evidenceId: processedDocument.evidenceId, recognizedCommitted: true, projectionRepairRequired: true }
    );
  }
  return persisted;
}

function writeAndVerifyAuthoritativeRow_(workbook, tab, row, reader, evidenceId) {
  let rowIndex = null;
  try {
    rowIndex = workbook.appendRow(tab, row.slice());
    flushRegistryWorkbook_(workbook);
    const readBack = workbook.readRow(tab, rowIndex);
    return reader(readBack, rowIndex);
  } catch (error) {
    let cleanupFailed = false;
    if (Number.isSafeInteger(rowIndex)) {
      try { workbook.clearRow(tab, rowIndex); } catch (cleanupError) { cleanupFailed = true; }
    }
    throw createFinancialDocumentRegistryError_(
      FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.writeFailure,
      'authoritativeWrite',
      { evidenceId: evidenceId, tab: tab, rowIndex: rowIndex, cleanupFailed: cleanupFailed }
    );
  }
}

function findEvidenceRecordById_(workbook, evidenceId, dependencies) {
  validateRegistryEvidenceIdInput_(evidenceId);
  const matches = findRegistryRowsByEvidenceId_(readRegistryRows_(workbook, 'Evidence'), evidenceId);
  if (matches.length > 1) throwDuplicateRegistryRows_(evidenceId, 'Evidence', matches.length);
  return matches.length === 0 ? null : readEvidenceRegistryRow_(matches[0].row, dependencies, matches[0].index);
}

function findProcessedFinancialDocumentById_(workbook, evidenceId, dependencies) {
  validateRegistryEvidenceIdInput_(evidenceId);
  const matches = findRegistryRowsByEvidenceId_(readRegistryRows_(workbook, '_Canonical'), evidenceId);
  if (matches.length > 1) throwDuplicateRegistryRows_(evidenceId, '_Canonical', matches.length);
  return matches.length === 0 ? null : readProcessedRegistryRow_(matches[0].row, dependencies, matches[0].index);
}

function requireProcessedFinancialDocument_(workbook, evidenceId, dependencies) {
  const value = findProcessedFinancialDocumentById_(workbook, evidenceId, dependencies);
  if (!value) throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.readFailure, 'readProcessed', { evidenceId: evidenceId });
  return value;
}

function findEvidenceCaptureCandidates_(workbook, originRef, sha256, dependencies) {
  try {
    validateRequiredEvidenceReference_({ originRef: originRef }, 'originRef');
    validateRequiredEvidenceSha256_({ sha256: sha256 });
  } catch (error) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.validation, 'captureCorrelation');
  }
  return readAllEvidenceRecords_(workbook, dependencies).filter(function(record) {
    return record.originRef.type === originRef.type && record.originRef.fileId === originRef.fileId && record.sha256 === sha256;
  }).sort(function(left, right) {
    return left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0;
  });
}

function queryRecognizedDocumentsByDateRange_(workbook, startDate, endDate, dependencies) {
  validateRegistryDateBoundary_(startDate);
  validateRegistryDateBoundary_(endDate);
  if (startDate > endDate) {
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.validation, 'dateRange');
  }
  const rows = readRegistryRows_(workbook, '_Canonical');
  const physicalIds = {};
  rows.forEach(function(row) {
    if (isEmptyRegistryRow_(row)) return;
    if (!Array.isArray(row) || row.length !== FINANCIAL_DOCUMENT_REGISTRY_HEADERS._Canonical.length ||
        typeof row[0] !== 'string' ||
        (row[5] !== '' && (typeof row[5] !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(row[5])))) {
      throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.corruptRecord, 'dateRangeIndex');
    }
    if (row[5] !== '') {
      try {
        validateOptionalCanonicalDate_({ documentDate: row[5] }, 'documentDate');
      } catch (error) {
        throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.corruptRecord, 'dateRangeIndex');
      }
    }
    physicalIds[row[0]] = (physicalIds[row[0]] || 0) + 1;
    if (physicalIds[row[0]] > 1) throwDuplicateRegistryRows_(row[0], '_Canonical', physicalIds[row[0]]);
  });
  const matches = [];
  rows.forEach(function(row, index) {
    if (isEmptyRegistryRow_(row) || row[5] === '' || row[5] < startDate || row[5] > endDate) return;
    matches.push(readProcessedRegistryRow_(row, dependencies, index));
  });
  return matches.sort(function(left, right) {
    const leftDate = left.canonicalFinancialDocument.documentDate;
    const rightDate = right.canonicalFinancialDocument.documentDate;
    if (leftDate !== rightDate) return leftDate < rightDate ? -1 : 1;
    if (left.processedAt !== right.processedAt) return left.processedAt < right.processedAt ? -1 : 1;
    return left.evidenceId < right.evidenceId ? -1 : left.evidenceId > right.evidenceId ? 1 : 0;
  });
}

function validateRegistryDateBoundary_(date) {
  try { validateOptionalCanonicalDate_({ documentDate: date }, 'documentDate'); }
  catch (error) { throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.validation, 'dateRange'); }
}

function readAllEvidenceRecords_(workbook, dependencies) {
  const records = [];
  const ids = {};
  readRegistryRows_(workbook, 'Evidence').forEach(function(row, index) {
    if (isEmptyRegistryRow_(row)) return;
    const record = readEvidenceRegistryRow_(row, dependencies, index);
    if (ids[record.evidenceId]) throwDuplicateRegistryRows_(record.evidenceId, 'Evidence', 2);
    ids[record.evidenceId] = true;
    records.push(record);
  });
  return records;
}

function readAllProcessedFinancialDocuments_(workbook, dependencies) {
  const records = [];
  const ids = {};
  readRegistryRows_(workbook, '_Canonical').forEach(function(row, index) {
    if (isEmptyRegistryRow_(row)) return;
    const record = readProcessedRegistryRow_(row, dependencies, index);
    if (ids[record.evidenceId]) throwDuplicateRegistryRows_(record.evidenceId, '_Canonical', 2);
    ids[record.evidenceId] = true;
    records.push(record);
  });
  return records;
}

function validateRegistryEvidenceIdInput_(evidenceId) {
  try { validateRequiredEvidenceId_({ evidenceId: evidenceId }); }
  catch (error) { throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.validation, 'evidenceId'); }
}

function findRegistryRowsByEvidenceId_(rows, evidenceId) {
  const matches = [];
  rows.forEach(function(row, index) {
    if (!isEmptyRegistryRow_(row) && Array.isArray(row) && row[0] === evidenceId) {
      matches.push({ row: row, index: index });
    }
  });
  return matches;
}

function throwDuplicateRegistryRows_(evidenceId, tab, actualCount) {
  throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.corruptRecord, 'duplicateAuthority', { evidenceId: evidenceId, tab: tab, actualCount: actualCount });
}

function readRegistryRows_(workbook, tab) {
  try {
    const rows = workbook.getRows(tab);
    if (!Array.isArray(rows)) throw new Error('invalid rows');
    return rows.map(function(row) { return Array.isArray(row) ? row.slice() : row; });
  } catch (error) {
    if (error && error.name === 'FinancialDocumentRegistryError') throw error;
    throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.readFailure, 'readRows', { tab: tab });
  }
}

function writeRegistryRows_(workbook, tab, rows) {
  try { workbook.replaceRows(tab, rows.map(function(row) { return row.slice(); })); }
  catch (error) { throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.projectionFailure, 'writeProjectionRows', { tab: tab }); }
}

function flushRegistryWorkbook_(workbook) {
  try { workbook.flush(); }
  catch (error) { throw createFinancialDocumentRegistryError_(FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.writeFailure, 'flushRegistry'); }
}
