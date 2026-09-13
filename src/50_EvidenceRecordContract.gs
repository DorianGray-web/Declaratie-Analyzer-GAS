// Storage-independent EvidenceRecord contract for one captured source artifact.
//
// evidenceId is the sole application-owned identity of the capture. originRef
// identifies the user-controlled input location; contentRef identifies the
// separately managed captured content. Filename, digest, Drive file IDs, and
// any printed sourceDocumentId are not EvidenceRecord identity.
//
// sourceFileName is restricted provenance metadata. sha256 describes captured
// bytes for integrity/duplicate observation. capturedAt is immutable capture
// metadata. This contract performs no lookup, persistence, or retry decision.

const EVIDENCE_RECORD_ERROR_CODES = Object.freeze({
  invalidRecord: 'INVALID_EVIDENCE_RECORD',
  invalidCapturedBytes: 'INVALID_CAPTURED_BYTES',
  digestFailed: 'EVIDENCE_DIGEST_FAILED'
});

const EVIDENCE_REFERENCE_TYPE = Object.freeze({
  DRIVE_FILE: 'DRIVE_FILE'
});

function createEvidenceRecordError_(code, message) {
  const error = new Error(message);
  error.name = 'EvidenceRecordError';
  error.code = code;
  return error;
}

/**
 * Creates an EvidenceRecord from already-captured metadata.
 *
 * Runtime defaults use Apps Script UUID and clock facilities. Tests can inject
 * deterministic uuidGenerator and clock functions without replacing globals.
 */
function createEvidenceRecord(capturedMetadata, dependencies) {
  assertEvidenceRecordObject_(capturedMetadata, '$input');
  assertEvidenceRecordAllowedFields_(
    capturedMetadata,
    ['originRef', 'contentRef', 'sourceFileName', 'mimeType', 'rawSizeBytes', 'sha256'],
    '$input'
  );

  const seams = dependencies === undefined ? {} : dependencies;
  assertEvidenceRecordObject_(seams, '$dependencies');
  assertEvidenceRecordAllowedFields_(seams, ['uuidGenerator', 'clock'], '$dependencies');

  const uuidGenerator = hasEvidenceRecordField_(seams, 'uuidGenerator')
    ? seams.uuidGenerator
    : function() { return Utilities.getUuid(); };
  const clock = hasEvidenceRecordField_(seams, 'clock')
    ? seams.clock
    : function() { return new Date(); };

  if (typeof uuidGenerator !== 'function') {
    throwInvalidEvidenceRecord_('$dependencies.uuidGenerator', 'must be a function when present');
  }
  if (typeof clock !== 'function') {
    throwInvalidEvidenceRecord_('$dependencies.clock', 'must be a function when present');
  }

  let evidenceId;
  let capturedAtValue;
  try {
    evidenceId = uuidGenerator();
    capturedAtValue = clock();
  } catch (error) {
    throw createEvidenceRecordError_(
      EVIDENCE_RECORD_ERROR_CODES.invalidRecord,
      'EvidenceRecord identity or capture time could not be generated.'
    );
  }

  if (!(capturedAtValue instanceof Date) || !isFinite(capturedAtValue.getTime())) {
    throwInvalidEvidenceRecord_('$dependencies.clock', 'must return a valid Date');
  }

  const record = {
    evidenceId: evidenceId,
    originRef: capturedMetadata.originRef,
    contentRef: capturedMetadata.contentRef,
    sourceFileName: capturedMetadata.sourceFileName,
    mimeType: capturedMetadata.mimeType,
    rawSizeBytes: capturedMetadata.rawSizeBytes,
    sha256: capturedMetadata.sha256,
    capturedAt: capturedAtValue.toISOString()
  };

  return validateEvidenceRecord(record);
}

function validateEvidenceRecord(record) {
  assertEvidenceRecordObject_(record, '$');
  assertEvidenceRecordAllowedFields_(
    record,
    [
      'evidenceId',
      'originRef',
      'contentRef',
      'sourceFileName',
      'mimeType',
      'rawSizeBytes',
      'sha256',
      'capturedAt'
    ],
    '$'
  );

  validateRequiredEvidenceId_(record);
  validateRequiredEvidenceReference_(record, 'originRef');
  validateRequiredEvidenceReference_(record, 'contentRef');
  validateRequiredEvidenceString_(record, 'sourceFileName');
  validateRequiredEvidenceMimeType_(record);
  validateRequiredEvidenceSize_(record);
  validateRequiredEvidenceSha256_(record);
  validateRequiredCapturedAt_(record);

  return record;
}

function validateRequiredEvidenceId_(record) {
  if (!hasEvidenceRecordField_(record, 'evidenceId')) {
    throwInvalidEvidenceRecord_('evidenceId', 'required field is missing');
  }
  if (
    typeof record.evidenceId !== 'string' ||
    !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(record.evidenceId)
  ) {
    throwInvalidEvidenceRecord_('evidenceId', 'must be a lowercase version-4 UUID');
  }
}

function validateRequiredEvidenceReference_(record, fieldName) {
  if (!hasEvidenceRecordField_(record, fieldName)) {
    throwInvalidEvidenceRecord_(fieldName, 'required object is missing');
  }

  const reference = record[fieldName];
  assertEvidenceRecordObject_(reference, fieldName);
  assertEvidenceRecordAllowedFields_(reference, ['type', 'fileId'], fieldName);

  if (!hasEvidenceRecordField_(reference, 'type')) {
    throwInvalidEvidenceRecord_(fieldName + '.type', 'required field is missing');
  }
  if (reference.type !== EVIDENCE_REFERENCE_TYPE.DRIVE_FILE) {
    throwInvalidEvidenceRecord_(fieldName + '.type', 'must be DRIVE_FILE');
  }

  if (!hasEvidenceRecordField_(reference, 'fileId')) {
    throwInvalidEvidenceRecord_(fieldName + '.fileId', 'required field is missing');
  }
  if (
    typeof reference.fileId !== 'string' ||
    !/^[A-Za-z0-9_-]+$/.test(reference.fileId)
  ) {
    throwInvalidEvidenceRecord_(fieldName + '.fileId', 'must be a non-empty Drive file ID');
  }
}

function validateRequiredEvidenceString_(record, fieldName) {
  if (!hasEvidenceRecordField_(record, fieldName)) {
    throwInvalidEvidenceRecord_(fieldName, 'required field is missing');
  }
  if (typeof record[fieldName] !== 'string' || record[fieldName].trim() === '') {
    throwInvalidEvidenceRecord_(fieldName, 'must be a non-empty string');
  }
}

function validateRequiredEvidenceMimeType_(record) {
  validateRequiredEvidenceString_(record, 'mimeType');
  if (!isSupportedSourceMimeType_(record.mimeType)) {
    throwInvalidEvidenceRecord_('mimeType', 'must be a supported source MIME type');
  }
}

function validateRequiredEvidenceSize_(record) {
  if (!hasEvidenceRecordField_(record, 'rawSizeBytes')) {
    throwInvalidEvidenceRecord_('rawSizeBytes', 'required field is missing');
  }
  if (!Number.isSafeInteger(record.rawSizeBytes) || record.rawSizeBytes < 0) {
    throwInvalidEvidenceRecord_('rawSizeBytes', 'must be a non-negative safe integer');
  }
}

function validateRequiredEvidenceSha256_(record) {
  if (!hasEvidenceRecordField_(record, 'sha256')) {
    throwInvalidEvidenceRecord_('sha256', 'required field is missing');
  }
  if (typeof record.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(record.sha256)) {
    throwInvalidEvidenceRecord_('sha256', 'must be 64 lowercase hexadecimal characters');
  }
}

function validateRequiredCapturedAt_(record) {
  if (!hasEvidenceRecordField_(record, 'capturedAt')) {
    throwInvalidEvidenceRecord_('capturedAt', 'required field is missing');
  }
  if (
    typeof record.capturedAt !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(record.capturedAt)
  ) {
    throwInvalidEvidenceRecord_('capturedAt', 'must be a canonical UTC timestamp');
  }

  const parsed = new Date(record.capturedAt);
  if (!isFinite(parsed.getTime()) || parsed.toISOString() !== record.capturedAt) {
    throwInvalidEvidenceRecord_('capturedAt', 'must be a real canonical UTC timestamp');
  }
}

/**
 * Computes lowercase hexadecimal SHA-256 for captured bytes.
 * The digest identifies byte content for integrity purposes; it is not evidenceId.
 */
function computeEvidenceSha256(capturedBytes, digestFunction) {
  if (!Array.isArray(capturedBytes)) {
    throw createEvidenceRecordError_(
      EVIDENCE_RECORD_ERROR_CODES.invalidCapturedBytes,
      'Captured evidence bytes must be supplied as an array.'
    );
  }

  capturedBytes.forEach(function(value) {
    if (!Number.isInteger(value) || value < -128 || value > 255) {
      throw createEvidenceRecordError_(
        EVIDENCE_RECORD_ERROR_CODES.invalidCapturedBytes,
        'Captured evidence contains an invalid byte.'
      );
    }
  });

  const computeDigest = digestFunction || function(bytes) {
    return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, bytes);
  };
  if (typeof computeDigest !== 'function') {
    throw createEvidenceRecordError_(
      EVIDENCE_RECORD_ERROR_CODES.digestFailed,
      'Evidence digest function must be callable.'
    );
  }

  let digestBytes;
  try {
    digestBytes = computeDigest(capturedBytes.map(function(value) {
      return value > 127 ? value - 256 : value;
    }));
  } catch (error) {
    throw createEvidenceRecordError_(
      EVIDENCE_RECORD_ERROR_CODES.digestFailed,
      'Evidence SHA-256 digest could not be computed.'
    );
  }

  if (!Array.isArray(digestBytes) || digestBytes.length !== 32) {
    throw createEvidenceRecordError_(
      EVIDENCE_RECORD_ERROR_CODES.digestFailed,
      'Evidence SHA-256 digest did not contain 32 bytes.'
    );
  }

  return digestBytes.map(function(value) {
    if (!Number.isInteger(value) || value < -128 || value > 255) {
      throw createEvidenceRecordError_(
        EVIDENCE_RECORD_ERROR_CODES.digestFailed,
        'Evidence SHA-256 digest contained an invalid byte.'
      );
    }
    return ((value + 256) % 256).toString(16).padStart(2, '0');
  }).join('');
}

function assertEvidenceRecordObject_(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throwInvalidEvidenceRecord_(path, 'must be an object');
  }
}

function assertEvidenceRecordAllowedFields_(value, allowedFields, path) {
  Object.keys(value).forEach(function(fieldName) {
    if (allowedFields.indexOf(fieldName) === -1) {
      throwInvalidEvidenceRecord_(path + '.' + fieldName, 'unexpected field');
    }
  });
}

function hasEvidenceRecordField_(value, fieldName) {
  return Object.prototype.hasOwnProperty.call(value, fieldName);
}

function throwInvalidEvidenceRecord_(path, reason) {
  throw createEvidenceRecordError_(
    EVIDENCE_RECORD_ERROR_CODES.invalidRecord,
    'Invalid EvidenceRecord at ' + path + ': ' + reason + '.'
  );
}
