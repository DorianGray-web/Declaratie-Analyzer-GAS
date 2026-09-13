// Deterministic v1 serializers/readers for authoritative registry snapshots.

function serializeEvidenceRecordForRegistry(record, dependencies) {
  try {
    validateEvidenceRecord(record);
    const snapshot = {
      evidenceId: record.evidenceId,
      originRef: { type: record.originRef.type, fileId: record.originRef.fileId },
      contentRef: { type: record.contentRef.type, fileId: record.contentRef.fileId },
      sourceFileName: record.sourceFileName,
      mimeType: record.mimeType,
      rawSizeBytes: record.rawSizeBytes,
      sha256: record.sha256,
      capturedAt: record.capturedAt
    };
    return finalizeRegistrySerialization_(
      FINANCIAL_DOCUMENT_REGISTRY_CONFIG.evidenceRecordSchemaVersion,
      JSON.stringify(snapshot),
      dependencies
    );
  } catch (error) {
    if (error && error.name === 'FinancialDocumentRegistryError') {
      throw error;
    }
    throw createFinancialDocumentRegistryError_(
      FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.validation,
      'serializeEvidenceRecord'
    );
  }
}

function serializeProcessedFinancialDocumentForRegistry(processedDocument, dependencies) {
  try {
    validateProcessedFinancialDocument(processedDocument);
    const snapshot = {
      evidenceId: processedDocument.evidenceId,
      canonicalFinancialDocument: buildCanonicalRegistrySnapshot_(
        processedDocument.canonicalFinancialDocument
      ),
      processedAt: processedDocument.processedAt
    };
    return finalizeRegistrySerialization_(
      FINANCIAL_DOCUMENT_REGISTRY_CONFIG.processedDocumentSchemaVersion,
      JSON.stringify(snapshot),
      dependencies
    );
  } catch (error) {
    if (error && error.name === 'FinancialDocumentRegistryError') {
      throw error;
    }
    throw createFinancialDocumentRegistryError_(
      FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.validation,
      'serializeProcessedFinancialDocument'
    );
  }
}

function buildCanonicalRegistrySnapshot_(canonical) {
  const snapshot = {
    sourceProvenance: {
      sourceFileName: canonical.sourceProvenance.sourceFileName,
      mimeType: canonical.sourceProvenance.mimeType
    }
  };
  if (registryHasOwn_(canonical, 'documentDate')) {
    snapshot.documentDate = canonical.documentDate;
  }
  if (registryHasOwn_(canonical, 'sourceDocumentId')) {
    snapshot.sourceDocumentId = canonical.sourceDocumentId;
  }
  snapshot.expenses = canonical.expenses.map(function(expense) {
    const value = { description: expense.description };
    if (registryHasOwn_(expense, 'quantity')) value.quantity = expense.quantity;
    if (registryHasOwn_(expense, 'printedUnitAmount')) {
      value.printedUnitAmount = expense.printedUnitAmount;
    }
    value.printedLineAmount = expense.printedLineAmount;
    return value;
  });
  snapshot.additionalCosts = canonical.additionalCosts.map(function(cost) {
    const value = {};
    if (registryHasOwn_(cost, 'description')) value.description = cost.description;
    value.printedAmount = cost.printedAmount;
    value.category = cost.category;
    return value;
  });
  snapshot.adjustments = canonical.adjustments.map(function(adjustment) {
    return {
      description: adjustment.description,
      printedAmount: adjustment.printedAmount,
      adjustmentType: adjustment.adjustmentType
    };
  });
  snapshot.vat = canonical.vat.map(function(entry) {
    const value = {};
    if (registryHasOwn_(entry, 'printedRate')) value.printedRate = entry.printedRate;
    if (registryHasOwn_(entry, 'printedAmount')) value.printedAmount = entry.printedAmount;
    return value;
  });
  snapshot.printedTotals = {};
  ['exclVAT', 'vatAmount', 'inclVAT'].forEach(function(fieldName) {
    if (registryHasOwn_(canonical.printedTotals, fieldName)) {
      snapshot.printedTotals[fieldName] = canonical.printedTotals[fieldName];
    }
  });
  snapshot.reconciliation = { status: canonical.reconciliation.status };
  if (registryHasOwn_(canonical.reconciliation, 'difference')) {
    snapshot.reconciliation.difference = canonical.reconciliation.difference;
  }
  return snapshot;
}

function finalizeRegistrySerialization_(schemaVersion, json, dependencies) {
  if (json.length >= REGISTRY_JSON_CELL_SAFETY_LIMIT) {
    throw createFinancialDocumentRegistryError_(
      FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.serializationTooLarge,
      'jsonCellSafetyGuard'
    );
  }
  return {
    schemaVersion: schemaVersion,
    json: json,
    payloadSha256: computeRegistryPayloadSha256_(schemaVersion, json, dependencies)
  };
}

function computeRegistryPayloadSha256_(schemaVersion, json, dependencies) {
  try {
    const digestFunction = dependencies && dependencies.digestFunction;
    return computeEvidenceSha256(
      encodeRegistryUtf8_(String(schemaVersion) + '\n' + json),
      digestFunction
    );
  } catch (error) {
    throw createFinancialDocumentRegistryError_(
      FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.serialization,
      'payloadDigest'
    );
  }
}

function encodeRegistryUtf8_(text) {
  const bytes = [];
  for (let index = 0; index < text.length; index += 1) {
    let codePoint = text.charCodeAt(index);
    if (codePoint >= 0xd800 && codePoint <= 0xdbff && index + 1 < text.length) {
      const low = text.charCodeAt(index + 1);
      if (low >= 0xdc00 && low <= 0xdfff) {
        codePoint = 0x10000 + ((codePoint - 0xd800) << 10) + (low - 0xdc00);
        index += 1;
      }
    }
    if (codePoint <= 0x7f) {
      bytes.push(codePoint);
    } else if (codePoint <= 0x7ff) {
      bytes.push(0xc0 | (codePoint >> 6), 0x80 | (codePoint & 0x3f));
    } else if (codePoint <= 0xffff) {
      bytes.push(
        0xe0 | (codePoint >> 12),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    } else {
      bytes.push(
        0xf0 | (codePoint >> 18),
        0x80 | ((codePoint >> 12) & 0x3f),
        0x80 | ((codePoint >> 6) & 0x3f),
        0x80 | (codePoint & 0x3f)
      );
    }
  }
  return bytes;
}

function buildEvidenceRegistryRow_(record, serialization) {
  return [
    record.evidenceId, serialization.schemaVersion, serialization.json,
    serialization.payloadSha256, record.capturedAt, record.mimeType,
    record.rawSizeBytes, record.sha256, record.originRef.type,
    record.originRef.fileId, record.contentRef.type, record.contentRef.fileId,
    record.sourceFileName
  ];
}

function buildProcessedRegistryRow_(processedDocument, serialization) {
  const canonical = processedDocument.canonicalFinancialDocument;
  return [
    processedDocument.evidenceId, serialization.schemaVersion, serialization.json,
    serialization.payloadSha256, processedDocument.processedAt,
    registryHasOwn_(canonical, 'documentDate') ? canonical.documentDate : '',
    registryHasOwn_(canonical, 'sourceDocumentId') ? canonical.sourceDocumentId : ''
  ];
}

function readEvidenceRegistryRow_(row, dependencies, rowIndex) {
  return readAuthoritativeRegistryRow_(
    row,
    FINANCIAL_DOCUMENT_REGISTRY_HEADERS.Evidence.length,
    FINANCIAL_DOCUMENT_REGISTRY_CONFIG.evidenceRecordSchemaVersion,
    function(value) { return validateEvidenceRecord(value); },
    serializeEvidenceRecordForRegistry,
    function(record) { return buildEvidenceRegistryRow_(record, serializeEvidenceRecordForRegistry(record, dependencies)); },
    dependencies,
    'Evidence',
    rowIndex
  );
}

function readProcessedRegistryRow_(row, dependencies, rowIndex) {
  return readAuthoritativeRegistryRow_(
    row,
    FINANCIAL_DOCUMENT_REGISTRY_HEADERS._Canonical.length,
    FINANCIAL_DOCUMENT_REGISTRY_CONFIG.processedDocumentSchemaVersion,
    function(value) { return validateProcessedFinancialDocument(value); },
    serializeProcessedFinancialDocumentForRegistry,
    function(value) { return buildProcessedRegistryRow_(value, serializeProcessedFinancialDocumentForRegistry(value, dependencies)); },
    dependencies,
    '_Canonical',
    rowIndex
  );
}

function readAuthoritativeRegistryRow_(row, expectedWidth, expectedVersion, validator,
    serializer, rowBuilder, dependencies, tab, rowIndex) {
  const context = { tab: tab, rowIndex: rowIndex };
  try {
    if (!Array.isArray(row) || row.length !== expectedWidth || isEmptyRegistryRow_(row)) {
      throw new Error('row shape');
    }
    if (row[1] !== expectedVersion) throw new Error('unsupported version');
    if (typeof row[2] !== 'string' || typeof row[3] !== 'string') throw new Error('framing');
    if (computeRegistryPayloadSha256_(row[1], row[2], dependencies) !== row[3]) {
      throw new Error('digest mismatch');
    }
    const parsed = JSON.parse(row[2]);
    validator(parsed);
    const serialized = serializer(parsed, dependencies);
    if (serialized.json !== row[2] || serialized.payloadSha256 !== row[3]) {
      throw new Error('noncanonical serialization');
    }
    if (!registryRowsEqual_(rowBuilder(parsed), row)) throw new Error('scalar mismatch');
    return JSON.parse(serialized.json);
  } catch (error) {
    if (error && error.name === 'FinancialDocumentRegistryError' &&
        error.code === FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.serializationTooLarge) {
      // An oversized stored value is corrupt even though it was not written by this implementation.
    }
    throw createFinancialDocumentRegistryError_(
      FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES.corruptRecord,
      'readAuthoritativeRow',
      context
    );
  }
}
