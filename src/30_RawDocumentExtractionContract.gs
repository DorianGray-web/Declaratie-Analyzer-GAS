// Parsing and structural validation for model-authored raw document evidence.

const RAW_DOCUMENT_EXTRACTION_ERROR_CODES = Object.freeze({
  invalidJson: 'INVALID_MODEL_JSON',
  invalidStructure: 'INVALID_RAW_DOCUMENT_EXTRACTION'
});

function parseRawDocumentExtraction(modelJsonText, sourceProvenance) {
  if (typeof modelJsonText !== 'string') {
    throw createRawDocumentExtractionError_(
      RAW_DOCUMENT_EXTRACTION_ERROR_CODES.invalidJson,
      'Model output must be supplied as JSON text.'
    );
  }

  let modelOutput;

  try {
    modelOutput = JSON.parse(modelJsonText);
  } catch (error) {
    throw createRawDocumentExtractionError_(
      RAW_DOCUMENT_EXTRACTION_ERROR_CODES.invalidJson,
      'Model output is not valid JSON.'
    );
  }

  validateRawDocumentExtractionModelOutput(modelOutput);
  return attachRawDocumentSourceProvenance_(modelOutput, sourceProvenance);
}

function validateRawDocumentExtractionModelOutput(modelOutput) {
  assertRawExtractionObject_(modelOutput, '$');
  assertRawExtractionAllowedFields_(
    modelOutput,
    ['documentTypeEvidence', 'identityEvidence', 'financialEvidence'],
    '$'
  );

  if (hasRawExtractionField_(modelOutput, 'documentTypeEvidence')) {
    validateRawObservation_(modelOutput.documentTypeEvidence, 'documentTypeEvidence');
  }

  if (!hasRawExtractionField_(modelOutput, 'identityEvidence')) {
    throwInvalidRawExtraction_('identityEvidence', 'required object is missing');
  }
  validateRawIdentityEvidence_(modelOutput.identityEvidence);

  if (!hasRawExtractionField_(modelOutput, 'financialEvidence')) {
    throwInvalidRawExtraction_('financialEvidence', 'required object is missing');
  }
  validateRawFinancialEvidence_(modelOutput.financialEvidence);

  return modelOutput;
}

function validateRawIdentityEvidence_(identityEvidence) {
  assertRawExtractionObject_(identityEvidence, 'identityEvidence');
  assertRawExtractionAllowedFields_(
    identityEvidence,
    ['dates', 'identifiers'],
    'identityEvidence'
  );
  validateRequiredRawObservationArray_(identityEvidence, 'dates', 'identityEvidence.dates');
  validateRequiredRawObservationArray_(
    identityEvidence,
    'identifiers',
    'identityEvidence.identifiers'
  );
}

function validateRawFinancialEvidence_(financialEvidence) {
  assertRawExtractionObject_(financialEvidence, 'financialEvidence');
  assertRawExtractionAllowedFields_(
    financialEvidence,
    ['items', 'additionalCosts', 'adjustments', 'vat', 'totals'],
    'financialEvidence'
  );

  validateRequiredRawCompositeArray_(
    financialEvidence,
    'items',
    'financialEvidence.items',
    validateRawExpenseObservation_
  );
  validateRequiredRawCompositeArray_(
    financialEvidence,
    'additionalCosts',
    'financialEvidence.additionalCosts',
    validateRawAdditionalCostObservation_
  );
  validateRequiredRawCompositeArray_(
    financialEvidence,
    'adjustments',
    'financialEvidence.adjustments',
    validateRawAdjustmentObservation_
  );
  validateRequiredRawCompositeArray_(
    financialEvidence,
    'vat',
    'financialEvidence.vat',
    validateRawVatObservation_
  );
  validateRequiredRawCompositeArray_(
    financialEvidence,
    'totals',
    'financialEvidence.totals',
    validateRawTotalObservation_
  );
}

function validateRawObservation_(observation, path) {
  assertRawExtractionObject_(observation, path);
  assertRawExtractionAllowedFields_(
    observation,
    ['rawValue', 'printedLabel', 'context'],
    path
  );

  if (!hasRawExtractionField_(observation, 'rawValue')) {
    throwInvalidRawExtraction_(path + '.rawValue', 'required field is missing');
  }
  if (typeof observation.rawValue !== 'string' || observation.rawValue.trim().length === 0) {
    throwInvalidRawExtraction_(
      path + '.rawValue',
      'must contain at least one non-whitespace character'
    );
  }

  validateOptionalRawString_(observation, 'printedLabel', path + '.printedLabel');
  validateOptionalRawString_(observation, 'context', path + '.context');
}

function validateRawExpenseObservation_(observation, path) {
  assertRawExtractionObject_(observation, path);
  assertRawExtractionAllowedFields_(
    observation,
    ['description', 'quantity', 'printedUnitAmount', 'printedLineAmount'],
    path
  );

  validateRequiredRawObservationField_(observation, 'description', path + '.description');
  validateOptionalRawObservationField_(observation, 'quantity', path + '.quantity');
  validateOptionalRawObservationField_(
    observation,
    'printedUnitAmount',
    path + '.printedUnitAmount'
  );
  validateOptionalRawObservationField_(
    observation,
    'printedLineAmount',
    path + '.printedLineAmount'
  );
}

function validateRawAdditionalCostObservation_(observation, path) {
  assertRawExtractionObject_(observation, path);
  assertRawExtractionAllowedFields_(
    observation,
    ['description', 'quantity', 'printedUnitAmount', 'printedLineAmount'],
    path
  );

  validateOptionalRawObservationField_(observation, 'description', path + '.description');
  validateOptionalRawObservationField_(observation, 'quantity', path + '.quantity');
  validateOptionalRawObservationField_(
    observation,
    'printedUnitAmount',
    path + '.printedUnitAmount'
  );
  validateOptionalRawObservationField_(
    observation,
    'printedLineAmount',
    path + '.printedLineAmount'
  );

  if (
    !hasRawExtractionField_(observation, 'printedUnitAmount') &&
    !hasRawExtractionField_(observation, 'printedLineAmount')
  ) {
    throwInvalidRawExtraction_(path, 'at least one printed amount is required');
  }
}

function validateRawAdjustmentObservation_(observation, path) {
  assertRawExtractionObject_(observation, path);
  assertRawExtractionAllowedFields_(observation, ['description', 'printedAmount'], path);
  validateOptionalRawObservationField_(observation, 'description', path + '.description');
  validateRequiredRawObservationField_(
    observation,
    'printedAmount',
    path + '.printedAmount'
  );
}

function validateRawVatObservation_(observation, path) {
  assertRawExtractionObject_(observation, path);
  assertRawExtractionAllowedFields_(observation, ['printedRate', 'printedAmount'], path);
  validateOptionalRawObservationField_(observation, 'printedRate', path + '.printedRate');
  validateOptionalRawObservationField_(observation, 'printedAmount', path + '.printedAmount');

  if (
    !hasRawExtractionField_(observation, 'printedRate') &&
    !hasRawExtractionField_(observation, 'printedAmount')
  ) {
    throwInvalidRawExtraction_(path, 'a printed rate or printed amount is required');
  }
}

function validateRawTotalObservation_(observation, path) {
  assertRawExtractionObject_(observation, path);
  assertRawExtractionAllowedFields_(observation, ['printedAmount'], path);
  validateRequiredRawObservationField_(
    observation,
    'printedAmount',
    path + '.printedAmount'
  );
}

function validateRequiredRawObservationArray_(owner, fieldName, path) {
  if (!hasRawExtractionField_(owner, fieldName)) {
    throwInvalidRawExtraction_(path, 'required collection is missing');
  }

  const observations = owner[fieldName];
  assertRawExtractionArray_(observations, path);

  observations.forEach(function(observation, index) {
    validateRawObservation_(observation, path + '[' + index + ']');
  });
}

function validateRequiredRawCompositeArray_(owner, fieldName, path, validator) {
  if (!hasRawExtractionField_(owner, fieldName)) {
    throwInvalidRawExtraction_(path, 'required collection is missing');
  }

  const observations = owner[fieldName];
  assertRawExtractionArray_(observations, path);

  observations.forEach(function(observation, index) {
    validator(observation, path + '[' + index + ']');
  });
}

function validateRequiredRawObservationField_(owner, fieldName, path) {
  if (!hasRawExtractionField_(owner, fieldName)) {
    throwInvalidRawExtraction_(path, 'required observation is missing');
  }
  validateRawObservation_(owner[fieldName], path);
}

function validateOptionalRawObservationField_(owner, fieldName, path) {
  if (hasRawExtractionField_(owner, fieldName)) {
    validateRawObservation_(owner[fieldName], path);
  }
}

function validateOptionalRawString_(owner, fieldName, path) {
  if (hasRawExtractionField_(owner, fieldName) && typeof owner[fieldName] !== 'string') {
    throwInvalidRawExtraction_(path, 'must be a string when present');
  }
}

function attachRawDocumentSourceProvenance_(modelOutput, sourceProvenance) {
  assertRawExtractionObject_(sourceProvenance, 'sourceProvenance');

  if (
    typeof sourceProvenance.sourceFileName !== 'string' ||
    sourceProvenance.sourceFileName.trim() === ''
  ) {
    throwInvalidRawExtraction_('sourceProvenance.sourceFileName', 'must be a non-empty string');
  }
  if (typeof sourceProvenance.mimeType !== 'string' || sourceProvenance.mimeType.trim() === '') {
    throwInvalidRawExtraction_('sourceProvenance.mimeType', 'must be a non-empty string');
  }

  const completed = {
    sourceProvenance: {
      sourceFileName: sourceProvenance.sourceFileName,
      mimeType: sourceProvenance.mimeType
    },
    identityEvidence: modelOutput.identityEvidence,
    financialEvidence: modelOutput.financialEvidence
  };

  if (hasRawExtractionField_(modelOutput, 'documentTypeEvidence')) {
    completed.documentTypeEvidence = modelOutput.documentTypeEvidence;
  }

  return completed;
}

function assertRawExtractionObject_(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throwInvalidRawExtraction_(path, 'must be an object');
  }
}

function assertRawExtractionArray_(value, path) {
  if (!Array.isArray(value)) {
    throwInvalidRawExtraction_(path, 'must be an array');
  }
}

function assertRawExtractionAllowedFields_(value, allowedFields, path) {
  Object.keys(value).forEach(function(fieldName) {
    if (allowedFields.indexOf(fieldName) === -1) {
      throwInvalidRawExtraction_(path + '.' + fieldName, 'unexpected field');
    }
  });
}

function hasRawExtractionField_(value, fieldName) {
  return Object.prototype.hasOwnProperty.call(value, fieldName);
}

function throwInvalidRawExtraction_(path, reason) {
  throw createRawDocumentExtractionError_(
    RAW_DOCUMENT_EXTRACTION_ERROR_CODES.invalidStructure,
    'Invalid raw document extraction at ' + path + ': ' + reason + '.'
  );
}

function createRawDocumentExtractionError_(code, message) {
  const error = new Error(message);
  error.name = 'RawDocumentExtractionError';
  error.code = code;
  return error;
}
