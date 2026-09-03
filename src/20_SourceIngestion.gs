// Inspection, validation, and Base64 encoding for supported source files.

function inspectSourceFile(file) {
  if (
    !file ||
    typeof file.getName !== 'function' ||
    typeof file.getMimeType !== 'function' ||
    typeof file.getSize !== 'function'
  ) {
    throw createSourceIngestionError_(
      SOURCE_INGESTION_ERROR_CODES.invalidSourceFile,
      'Source file does not provide the required metadata interface.'
    );
  }

  let sourceFileName;
  let mimeType;
  let rawSizeBytes;

  try {
    sourceFileName = file.getName();
    mimeType = file.getMimeType();
    rawSizeBytes = file.getSize();
  } catch (error) {
    throw createSourceIngestionError_(
      SOURCE_INGESTION_ERROR_CODES.invalidSourceMetadata,
      'Source file metadata could not be read.'
    );
  }

  return {
    sourceFileName: sourceFileName,
    mimeType: mimeType,
    rawSizeBytes: rawSizeBytes
  };
}

function validateSourceFile(descriptor) {
  if (!descriptor || typeof descriptor !== 'object' || Array.isArray(descriptor)) {
    throw createSourceIngestionError_(
      SOURCE_INGESTION_ERROR_CODES.invalidSourceMetadata,
      'Source file descriptor is missing or invalid.'
    );
  }

  if (
    typeof descriptor.sourceFileName !== 'string' ||
    descriptor.sourceFileName.trim() === '' ||
    typeof descriptor.mimeType !== 'string' ||
    descriptor.mimeType.trim() === '' ||
    !Number.isFinite(descriptor.rawSizeBytes) ||
    !Number.isInteger(descriptor.rawSizeBytes) ||
    descriptor.rawSizeBytes < 0
  ) {
    throw createSourceIngestionError_(
      SOURCE_INGESTION_ERROR_CODES.invalidSourceMetadata,
      'Source file descriptor requires a filename, MIME type, and non-negative integer byte size.'
    );
  }

  if (!isSupportedSourceMimeType_(descriptor.mimeType)) {
    throw createSourceIngestionError_(
      SOURCE_INGESTION_ERROR_CODES.unsupportedMime,
      'Source file MIME type is not supported.'
    );
  }

  if (
    descriptor.mimeType === SOURCE_INGESTION_POLICY.pdfMimeType &&
    descriptor.rawSizeBytes > SOURCE_INGESTION_POLICY.maxRawPdfSizeBytes
  ) {
    throw createSourceIngestionError_(
      SOURCE_INGESTION_ERROR_CODES.pdfTooLarge,
      'PDF exceeds the Declaratie Analyzer v1 maximum raw size of 5 MiB.'
    );
  }

  return {
    sourceFileName: descriptor.sourceFileName,
    mimeType: descriptor.mimeType,
    rawSizeBytes: descriptor.rawSizeBytes
  };
}

function encodeSourceFile(file, descriptor) {
  const validatedDescriptor = validateSourceFile(descriptor);

  if (!file || typeof file.getBlob !== 'function') {
    throw createSourceIngestionError_(
      SOURCE_INGESTION_ERROR_CODES.invalidSourceFile,
      'Source file does not provide readable blob content.'
    );
  }

  let encodedContent;

  try {
    const blob = file.getBlob();

    if (!blob || typeof blob.getBytes !== 'function') {
      throw new Error('Blob byte access is unavailable.');
    }

    encodedContent = Utilities.base64Encode(blob.getBytes());
  } catch (error) {
    throw createSourceIngestionError_(
      SOURCE_INGESTION_ERROR_CODES.encodingFailed,
      'Source file content could not be Base64 encoded.'
    );
  }

  return {
    sourceFileName: validatedDescriptor.sourceFileName,
    mimeType: validatedDescriptor.mimeType,
    rawSizeBytes: validatedDescriptor.rawSizeBytes,
    base64Content: encodedContent
  };
}

function ingestSourceFile(file) {
  const descriptor = inspectSourceFile(file);
  return encodeSourceFile(file, descriptor);
}
