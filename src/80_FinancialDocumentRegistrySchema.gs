// Frozen FinancialDocumentRegistry v2 topology, metadata, and bounded errors.

const FINANCIAL_DOCUMENT_REGISTRY_CONFIG = Object.freeze({
  spreadsheetIdProperty: 'REGISTRY_SPREADSHEET_ID',
  registrySchemaVersion: 2,
  evidenceRecordSchemaVersion: 1,
  processedDocumentSchemaVersion: 1,
  jsonCellSafetyLimit: 50000,
  lockTimeoutMilliseconds: 30000
});

const FINANCIAL_DOCUMENT_REGISTRY_ERROR_CODES = Object.freeze({
  configuration: 'REGISTRY_CONFIGURATION',
  schemaMismatch: 'REGISTRY_SCHEMA_MISMATCH',
  lockTimeout: 'REGISTRY_LOCK_TIMEOUT',
  validation: 'REGISTRY_VALIDATION',
  serialization: 'REGISTRY_SERIALIZATION',
  serializationTooLarge: 'REGISTRY_SERIALIZATION_TOO_LARGE',
  duplicateConflict: 'REGISTRY_DUPLICATE_CONFLICT',
  missingEvidence: 'REGISTRY_MISSING_EVIDENCE',
  writeFailure: 'REGISTRY_WRITE_FAILURE',
  readFailure: 'REGISTRY_READ_FAILURE',
  corruptRecord: 'REGISTRY_CORRUPT_RECORD',
  projectionFailure: 'REGISTRY_PROJECTION_FAILURE',
  projectionDrift: 'REGISTRY_PROJECTION_DRIFT'
});

const FINANCIAL_DOCUMENT_REGISTRY_HEADERS = Object.freeze({
  Documenten: Object.freeze([
    'evidenceId', 'documentDate', 'sourceDocumentId', 'sourceFileName', 'mimeType',
    'expenseLineCount', 'additionalCostCount', 'adjustmentCount', 'vatEntryCount',
    'printedTotalExclVatMinorUnits', 'printedVatAmountMinorUnits',
    'printedTotalInclVatMinorUnits', 'reconciliationStatus',
    'reconciliationDifferenceMinorUnits', 'processedAt'
  ]),
  Regels: Object.freeze([
    'evidenceId', 'expenseIndex', 'description', 'quantity',
    'printedUnitAmountMinorUnits', 'printedLineAmountMinorUnits'
  ]),
  ExtraKosten: Object.freeze([
    'evidenceId', 'additionalCostIndex', 'category', 'description',
    'printedAmountMinorUnits'
  ]),
  Correcties: Object.freeze([
    'evidenceId', 'adjustmentIndex', 'adjustmentType', 'description',
    'printedAmountMinorUnits'
  ]),
  BTW: Object.freeze([
    'evidenceId', 'vatIndex', 'printedRate', 'printedAmountMinorUnits'
  ]),
  Evidence: Object.freeze([
    'evidenceId', 'evidenceSchemaVersion', 'evidenceRecordJson',
    'evidencePayloadSha256', 'capturedAt', 'mimeType', 'rawSizeBytes', 'sha256',
    'originRefType', 'originFileId', 'contentRefType', 'contentFileId',
    'sourceFileName'
  ]),
  _Canonical: Object.freeze([
    'evidenceId', 'processedDocumentSchemaVersion', 'processedDocumentJson',
    'processedPayloadSha256', 'processedAt', 'documentDate', 'sourceDocumentId'
  ]),
  _Meta: Object.freeze([
    'registrySchemaVersion', 'currentEvidenceRecordSchemaVersion',
    'currentProcessedDocumentSchemaVersion', 'initializedAt', 'lastMigrationId',
    'lastMigrationAt'
  ])
});

const FINANCIAL_DOCUMENT_REGISTRY_TABS = Object.freeze([
  'Documenten', 'Regels', 'ExtraKosten', 'Correcties', 'BTW', 'Evidence',
  '_Canonical', '_Meta'
]);

const FINANCIAL_DOCUMENT_REGISTRY_ALLOWED_NON_V2_TABS = Object.freeze(['_Legacy_v1']);
const REGISTRY_JSON_CELL_SAFETY_LIMIT = FINANCIAL_DOCUMENT_REGISTRY_CONFIG.jsonCellSafetyLimit;

function createFinancialDocumentRegistryError_(code, stage, context) {
  const safeContext = sanitizeFinancialDocumentRegistryErrorContext_(context);
  const parts = [code, 'stage=' + stage];
  Object.keys(safeContext).forEach(function(key) {
    parts.push(key + '=' + String(safeContext[key]));
  });
  const error = new Error(parts.join(' '));
  error.name = 'FinancialDocumentRegistryError';
  error.code = code;
  error.stage = stage;
  Object.keys(safeContext).forEach(function(key) {
    error[key] = safeContext[key];
  });
  return error;
}

function sanitizeFinancialDocumentRegistryErrorContext_(context) {
  const input = context || {};
  const safe = {};
  const allowed = [
    'evidenceId', 'tab', 'rowIndex', 'expectedCount', 'actualCount',
    'recognizedCommitted', 'projectionRepairRequired', 'cleanupFailed'
  ];
  allowed.forEach(function(key) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) {
      return;
    }
    const value = input[key];
    if (typeof value === 'boolean' || Number.isSafeInteger(value)) {
      safe[key] = value;
      return;
    }
    if (typeof value === 'string' && /^[A-Za-z0-9_.:-]{1,80}$/.test(value)) {
      safe[key] = value;
    }
  });
  return safe;
}

function registryHasOwn_(value, fieldName) {
  return Object.prototype.hasOwnProperty.call(value, fieldName);
}

function isCanonicalRegistryTimestamp_(value) {
  if (typeof value !== 'string' ||
      !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)) {
    return false;
  }
  const parsed = new Date(value);
  return isFinite(parsed.getTime()) && parsed.toISOString() === value;
}

function registryRowsEqual_(left, right) {
  return Array.isArray(left) && Array.isArray(right) &&
    left.length === right.length && left.every(function(value, index) {
      return value === right[index];
    });
}

function registryMatricesEqual_(left, right) {
  return Array.isArray(left) && Array.isArray(right) &&
    left.length === right.length && left.every(function(row, index) {
      return registryRowsEqual_(row, right[index]);
    });
}

function isEmptyRegistryRow_(row) {
  return Array.isArray(row) && row.every(function(value) {
    return value === '' || value === null || value === undefined;
  });
}
