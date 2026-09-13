// Managed Google Drive storage boundary for immutable evidence byte snapshots.
//
// A capture reads the mutable origin exactly once, derives size and SHA-256 from
// those bytes, and persists those same bytes under a neutral technical name.
// Direct capture is deliberately not idempotent: each successful call creates a
// new evidenceId and managed snapshot, even when the bytes are identical.

const DRIVE_EVIDENCE_STORE_CONFIG = Object.freeze({
  evidenceFolderIdProperty: 'EVIDENCE_FOLDER_ID'
});

const DRIVE_EVIDENCE_STORE_ERROR_CODES = Object.freeze({
  invalidReference: 'INVALID_EVIDENCE_REFERENCE',
  missingConfiguration: 'EVIDENCE_FOLDER_NOT_CONFIGURED',
  folderUnavailable: 'EVIDENCE_FOLDER_UNAVAILABLE',
  sourceUnavailable: 'EVIDENCE_SOURCE_UNAVAILABLE',
  sourceReadFailed: 'EVIDENCE_SOURCE_READ_FAILED',
  managedCreateFailed: 'EVIDENCE_MANAGED_CREATE_FAILED',
  managedContentUnavailable: 'EVIDENCE_MANAGED_CONTENT_UNAVAILABLE',
  managedReadFailed: 'EVIDENCE_MANAGED_READ_FAILED',
  integrityMismatch: 'EVIDENCE_INTEGRITY_MISMATCH'
});

function createDriveEvidenceStoreError_(code, message) {
  const error = new Error(message);
  error.name = 'DriveEvidenceStoreError';
  error.code = code;
  return error;
}

/**
 * Captures one Drive file as separately managed evidence and returns its valid
 * EvidenceRecord. No source mutation, folder scan, deduplication, or registry
 * write occurs here.
 */
function captureDriveEvidence(originFileId, dependencies) {
  const seams = resolveDriveEvidenceStoreDependencies_(dependencies);
  const validOriginFileId = validateDriveFileId_(originFileId);
  const evidenceFolderId = readEvidenceFolderId_(seams.configuration);
  const evidenceFolder = resolveEvidenceFolder_(seams.drive, evidenceFolderId);
  const sourceFile = resolveSourceEvidenceFile_(seams.drive, validOriginFileId);
  const sourceMetadata = readSourceEvidenceMetadata_(sourceFile);

  // Validate declared type before reading restricted content. The second
  // validation applies the PDF limit to authoritative captured byte length.
  validateSourceFile({
    sourceFileName: sourceMetadata.sourceFileName,
    mimeType: sourceMetadata.mimeType,
    rawSizeBytes: 0
  });

  const capturedBytes = readEvidenceBytes_(
    sourceFile,
    DRIVE_EVIDENCE_STORE_ERROR_CODES.sourceReadFailed,
    'Source evidence bytes could not be captured.'
  );
  const capturedDescriptor = validateSourceFile({
    sourceFileName: sourceMetadata.sourceFileName,
    mimeType: sourceMetadata.mimeType,
    rawSizeBytes: capturedBytes.length
  });
  const sha256 = computeEvidenceSha256(capturedBytes, seams.digestFunction);
  const generatedIdentity = generateEvidenceIdentity_(seams);

  // Validate everything known before publishing a managed file. The temporary
  // reference is never returned or persisted; it makes post-create failure the
  // smallest possible window.
  seams.recordFactory({
    originRef: driveEvidenceReference_(validOriginFileId),
    contentRef: driveEvidenceReference_('pending_managed_evidence'),
    sourceFileName: capturedDescriptor.sourceFileName,
    mimeType: capturedDescriptor.mimeType,
    rawSizeBytes: capturedDescriptor.rawSizeBytes,
    sha256: sha256
  }, fixedEvidenceIdentityDependencies_(generatedIdentity));

  const managedFileName = generatedIdentity.evidenceId +
    evidenceFileExtensionForMimeType_(capturedDescriptor.mimeType);
  let managedFile;

  try {
    managedFile = seams.drive.createManagedFile(
      evidenceFolder,
      capturedBytes,
      capturedDescriptor.mimeType,
      managedFileName
    );
  } catch (error) {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.managedCreateFailed,
      'Managed evidence content could not be created.'
    );
  }

  try {
    const managedFileId = readManagedEvidenceFileId_(managedFile);
    return seams.recordFactory({
      originRef: driveEvidenceReference_(validOriginFileId),
      contentRef: driveEvidenceReference_(managedFileId),
      sourceFileName: capturedDescriptor.sourceFileName,
      mimeType: capturedDescriptor.mimeType,
      rawSizeBytes: capturedDescriptor.rawSizeBytes,
      sha256: sha256
    }, fixedEvidenceIdentityDependencies_(generatedIdentity));
  } catch (originalError) {
    try {
      seams.drive.trashManagedFile(managedFile);
    } catch (cleanupError) {
      originalError.cleanupFailed = true;
      originalError.cleanupCode = 'MANAGED_EVIDENCE_CLEANUP_FAILED';
    }
    throw originalError;
  }
}

/** Resolves a typed contentRef to one managed byte snapshot by Drive file ID. */
function retrieveManagedEvidenceBytes(contentRef, dependencies) {
  const seams = resolveDriveEvidenceStoreDependencies_(dependencies);
  const fileId = validateDriveEvidenceReference_(contentRef).fileId;
  let managedFile;

  try {
    managedFile = seams.drive.getFileById(fileId);
  } catch (error) {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.managedContentUnavailable,
      'Managed evidence content is unavailable.'
    );
  }

  return readEvidenceBytes_(
    managedFile,
    DRIVE_EVIDENCE_STORE_ERROR_CODES.managedReadFailed,
    'Managed evidence bytes could not be read.'
  );
}

/** Retrieves and verifies managed bytes against an EvidenceRecord. */
function retrieveVerifiedManagedEvidenceBytes(evidenceRecord, dependencies) {
  const record = validateEvidenceRecord(evidenceRecord);
  const seams = resolveDriveEvidenceStoreDependencies_(dependencies);
  const bytes = retrieveManagedEvidenceBytes(record.contentRef, seams);

  if (bytes.length !== record.rawSizeBytes) {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.integrityMismatch,
      'Managed evidence size does not match its EvidenceRecord.'
    );
  }

  const actualSha256 = computeEvidenceSha256(bytes, seams.digestFunction);
  if (actualSha256 !== record.sha256) {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.integrityMismatch,
      'Managed evidence digest does not match its EvidenceRecord.'
    );
  }

  return bytes;
}

function resolveDriveEvidenceStoreDependencies_(dependencies) {
  const seams = dependencies === undefined ? {} : dependencies;
  if (!seams || typeof seams !== 'object' || Array.isArray(seams)) {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.invalidReference,
      'Evidence Store dependencies are invalid.'
    );
  }

  const configuration = seams.configuration || {
    getEvidenceFolderId: function() {
      return PropertiesService.getScriptProperties().getProperty(
        DRIVE_EVIDENCE_STORE_CONFIG.evidenceFolderIdProperty
      );
    }
  };
  const drive = seams.drive || {
    getFileById: function(fileId) {
      return DriveApp.getFileById(fileId);
    },
    getFolderById: function(folderId) {
      return DriveApp.getFolderById(folderId);
    },
    createManagedFile: function(folder, bytes, mimeType, fileName) {
      return folder.createFile(Utilities.newBlob(bytes, mimeType, fileName));
    },
    trashManagedFile: function(file) {
      file.setTrashed(true);
    }
  };
  const recordFactory = seams.recordFactory || createEvidenceRecord;

  if (
    !configuration || typeof configuration.getEvidenceFolderId !== 'function' ||
    !drive || typeof drive.getFileById !== 'function' ||
    typeof drive.getFolderById !== 'function' ||
    typeof drive.createManagedFile !== 'function' ||
    typeof drive.trashManagedFile !== 'function' ||
    typeof recordFactory !== 'function'
  ) {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.invalidReference,
      'Evidence Store adapters do not provide the required interface.'
    );
  }

  return {
    configuration: configuration,
    drive: drive,
    uuidGenerator: seams.uuidGenerator,
    clock: seams.clock,
    digestFunction: seams.digestFunction,
    recordFactory: recordFactory
  };
}

function readEvidenceFolderId_(configuration) {
  let folderId;
  try {
    folderId = configuration.getEvidenceFolderId();
  } catch (error) {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.missingConfiguration,
      'Evidence folder configuration could not be read.'
    );
  }

  if (typeof folderId !== 'string' || folderId.trim() === '') {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.missingConfiguration,
      'Evidence folder is not configured.'
    );
  }
  return validateDriveFileId_(folderId);
}

function resolveEvidenceFolder_(drive, folderId) {
  try {
    return drive.getFolderById(folderId);
  } catch (error) {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.folderUnavailable,
      'Configured evidence folder is unavailable.'
    );
  }
}

function resolveSourceEvidenceFile_(drive, fileId) {
  try {
    return drive.getFileById(fileId);
  } catch (error) {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.sourceUnavailable,
      'Source evidence file is unavailable.'
    );
  }
}

function readSourceEvidenceMetadata_(file) {
  if (!file || typeof file.getName !== 'function' || typeof file.getMimeType !== 'function') {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.sourceUnavailable,
      'Source evidence file does not provide the required interface.'
    );
  }

  try {
    return {
      sourceFileName: file.getName(),
      mimeType: file.getMimeType()
    };
  } catch (error) {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.sourceUnavailable,
      'Source evidence metadata could not be read.'
    );
  }
}

function readEvidenceBytes_(file, errorCode, errorMessage) {
  try {
    if (!file || typeof file.getBlob !== 'function') {
      throw new Error('Blob access is unavailable.');
    }
    const blob = file.getBlob();
    if (!blob || typeof blob.getBytes !== 'function') {
      throw new Error('Byte access is unavailable.');
    }
    const bytes = blob.getBytes();
    // Validation and a defensive copy keep later adapter mutations from
    // changing the snapshot described by this operation.
    if (!Array.isArray(bytes)) {
      throw new Error('Byte array is unavailable.');
    }
    bytes.forEach(function(value) {
      if (!Number.isInteger(value) || value < -128 || value > 255) {
        throw new Error('Byte array is invalid.');
      }
    });
    return bytes.slice();
  } catch (error) {
    throw createDriveEvidenceStoreError_(errorCode, errorMessage);
  }
}

function generateEvidenceIdentity_(seams) {
  const uuidGenerator = seams.uuidGenerator || function() { return Utilities.getUuid(); };
  const clock = seams.clock || function() { return new Date(); };
  let evidenceId;
  let capturedAt;

  try {
    evidenceId = uuidGenerator();
    capturedAt = clock();
  } catch (error) {
    throw createEvidenceRecordError_(
      EVIDENCE_RECORD_ERROR_CODES.invalidRecord,
      'EvidenceRecord identity or capture time could not be generated.'
    );
  }

  return { evidenceId: evidenceId, capturedAt: capturedAt };
}

function fixedEvidenceIdentityDependencies_(identity) {
  return {
    uuidGenerator: function() { return identity.evidenceId; },
    clock: function() { return identity.capturedAt; }
  };
}

function readManagedEvidenceFileId_(file) {
  if (!file || typeof file.getId !== 'function') {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.managedCreateFailed,
      'Managed evidence did not provide a content reference.'
    );
  }

  let fileId;
  try {
    fileId = file.getId();
  } catch (error) {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.managedCreateFailed,
      'Managed evidence content reference could not be read.'
    );
  }
  return validateDriveFileId_(fileId);
}

function validateDriveEvidenceReference_(reference) {
  if (
    !reference || typeof reference !== 'object' || Array.isArray(reference) ||
    Object.keys(reference).length !== 2 ||
    reference.type !== EVIDENCE_REFERENCE_TYPE.DRIVE_FILE
  ) {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.invalidReference,
      'Managed evidence reference must be a typed Drive file reference.'
    );
  }

  return {
    type: EVIDENCE_REFERENCE_TYPE.DRIVE_FILE,
    fileId: validateDriveFileId_(reference.fileId)
  };
}

function validateDriveFileId_(fileId) {
  if (typeof fileId !== 'string' || !/^[A-Za-z0-9_-]+$/.test(fileId)) {
    throw createDriveEvidenceStoreError_(
      DRIVE_EVIDENCE_STORE_ERROR_CODES.invalidReference,
      'Drive file reference is invalid.'
    );
  }
  return fileId;
}

function driveEvidenceReference_(fileId) {
  return { type: EVIDENCE_REFERENCE_TYPE.DRIVE_FILE, fileId: fileId };
}

function evidenceFileExtensionForMimeType_(mimeType) {
  const extensions = {
    'application/pdf': '.pdf',
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/bmp': '.bmp',
    'image/tiff': '.tiff',
    'image/heic': '.heic',
    'image/heif': '.heif'
  };
  return extensions[mimeType] || '.img';
}
