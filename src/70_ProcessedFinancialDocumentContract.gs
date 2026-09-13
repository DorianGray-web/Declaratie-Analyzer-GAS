// Pure domain envelope linking one captured evidence artifact to one recognized
// canonical financial document snapshot.
//
// Envelope existence represents successful recognition. evidenceId is the sole
// system linkage key; processedAt records when that recognized result was
// created. Storage, extraction, registry, and declaration concerns stay outside.

const PROCESSED_FINANCIAL_DOCUMENT_ERROR_CODES = Object.freeze({
  invalidProcessedDocument: 'INVALID_PROCESSED_FINANCIAL_DOCUMENT'
});

function createProcessedFinancialDocumentError_(message) {
  const error = new Error(message);
  error.name = 'ProcessedFinancialDocumentError';
  error.code = PROCESSED_FINANCIAL_DOCUMENT_ERROR_CODES.invalidProcessedDocument;
  return error;
}

/**
 * Creates a recognized ProcessedFinancialDocument from established domain
 * inputs. The canonical input is defensively copied before it enters the
 * returned envelope so later caller-owned mutations cannot change the snapshot.
 */
function createProcessedFinancialDocument(input, dependencies) {
  assertProcessedFinancialDocumentObject_(input, '$input');
  assertProcessedFinancialDocumentAllowedFields_(
    input,
    ['evidenceId', 'canonicalFinancialDocument'],
    '$input'
  );

  const seams = dependencies === undefined ? {} : dependencies;
  assertProcessedFinancialDocumentObject_(seams, '$dependencies');
  assertProcessedFinancialDocumentAllowedFields_(seams, ['clock'], '$dependencies');

  const clock = hasProcessedFinancialDocumentField_(seams, 'clock')
    ? seams.clock
    : function() { return new Date(); };
  if (typeof clock !== 'function') {
    throwInvalidProcessedFinancialDocument_('$dependencies.clock', 'must be a function when present');
  }

  validateProcessedEvidenceId_(input.evidenceId, '$input.evidenceId');
  validateProcessedCanonicalDocument_(
    input.canonicalFinancialDocument,
    '$input.canonicalFinancialDocument'
  );

  let processedAtValue;
  try {
    processedAtValue = clock();
  } catch (error) {
    throw createProcessedFinancialDocumentError_(
      'ProcessedFinancialDocument processing time could not be generated.'
    );
  }
  if (!(processedAtValue instanceof Date) || !isFinite(processedAtValue.getTime())) {
    throwInvalidProcessedFinancialDocument_('$dependencies.clock', 'must return a valid Date');
  }

  const envelope = {
    evidenceId: input.evidenceId,
    canonicalFinancialDocument: copyCanonicalSnapshot_(input.canonicalFinancialDocument),
    processedAt: processedAtValue.toISOString()
  };

  return validateProcessedFinancialDocument(envelope);
}

function validateProcessedFinancialDocument(processedDocument) {
  assertProcessedFinancialDocumentObject_(processedDocument, '$');
  assertProcessedFinancialDocumentAllowedFields_(
    processedDocument,
    ['evidenceId', 'canonicalFinancialDocument', 'processedAt'],
    '$'
  );

  if (!hasProcessedFinancialDocumentField_(processedDocument, 'evidenceId')) {
    throwInvalidProcessedFinancialDocument_('evidenceId', 'required field is missing');
  }
  validateProcessedEvidenceId_(processedDocument.evidenceId, 'evidenceId');

  if (!hasProcessedFinancialDocumentField_(processedDocument, 'canonicalFinancialDocument')) {
    throwInvalidProcessedFinancialDocument_(
      'canonicalFinancialDocument',
      'required object is missing'
    );
  }
  validateProcessedCanonicalDocument_(
    processedDocument.canonicalFinancialDocument,
    'canonicalFinancialDocument'
  );

  if (!hasProcessedFinancialDocumentField_(processedDocument, 'processedAt')) {
    throwInvalidProcessedFinancialDocument_('processedAt', 'required field is missing');
  }
  validateProcessedAt_(processedDocument.processedAt, 'processedAt');

  return processedDocument;
}

function validateProcessedEvidenceId_(evidenceId, path) {
  try {
    validateRequiredEvidenceId_({ evidenceId: evidenceId });
  } catch (error) {
    throwInvalidProcessedFinancialDocument_(path, 'must be a lowercase version-4 evidence UUID');
  }
}

function validateProcessedCanonicalDocument_(canonicalFinancialDocument, path) {
  try {
    validateCanonicalFinancialDocument(canonicalFinancialDocument);
  } catch (error) {
    throwInvalidProcessedFinancialDocument_(path, 'must be a valid CanonicalFinancialDocument');
  }
}

function validateProcessedAt_(processedAt, path) {
  if (
    typeof processedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(processedAt)
  ) {
    throwInvalidProcessedFinancialDocument_(path, 'must be a canonical UTC timestamp');
  }

  const parsed = new Date(processedAt);
  if (!isFinite(parsed.getTime()) || parsed.toISOString() !== processedAt) {
    throwInvalidProcessedFinancialDocument_(path, 'must be a real canonical UTC timestamp');
  }
}

function copyCanonicalSnapshot_(value) {
  if (Array.isArray(value)) {
    return value.map(function(entry) {
      return copyCanonicalSnapshot_(entry);
    });
  }
  if (value && typeof value === 'object') {
    const copy = {};
    Object.keys(value).forEach(function(fieldName) {
      copy[fieldName] = copyCanonicalSnapshot_(value[fieldName]);
    });
    return copy;
  }
  return value;
}

function assertProcessedFinancialDocumentObject_(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throwInvalidProcessedFinancialDocument_(path, 'must be an object');
  }
}

function assertProcessedFinancialDocumentAllowedFields_(value, allowedFields, path) {
  Object.keys(value).forEach(function(fieldName) {
    if (allowedFields.indexOf(fieldName) === -1) {
      throwInvalidProcessedFinancialDocument_(path + '.' + fieldName, 'unexpected field');
    }
  });
}

function hasProcessedFinancialDocumentField_(value, fieldName) {
  return Object.prototype.hasOwnProperty.call(value, fieldName);
}

function throwInvalidProcessedFinancialDocument_(path, reason) {
  throw createProcessedFinancialDocumentError_(
    'Invalid ProcessedFinancialDocument at ' + path + ': ' + reason + '.'
  );
}
