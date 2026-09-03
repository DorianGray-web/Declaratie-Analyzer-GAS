// Source-document ingestion contract and project-local policy.

const SOURCE_INGESTION_POLICY = Object.freeze({
  imageMimeTypePrefix: 'image/',
  pdfMimeType: 'application/pdf',
  maxRawPdfSizeBytes: 5 * 1024 * 1024
});

const SOURCE_INGESTION_ERROR_CODES = Object.freeze({
  invalidSourceFile: 'INVALID_SOURCE_FILE',
  invalidSourceMetadata: 'INVALID_SOURCE_METADATA',
  unsupportedMime: 'UNSUPPORTED_SOURCE_MIME',
  pdfTooLarge: 'PDF_TOO_LARGE',
  encodingFailed: 'SOURCE_ENCODING_FAILED'
});

function createSourceIngestionError_(code, message) {
  const error = new Error(message);
  error.name = 'SourceIngestionError';
  error.code = code;
  return error;
}

function isSupportedSourceMimeType_(mimeType) {
  if (mimeType === SOURCE_INGESTION_POLICY.pdfMimeType) {
    return true;
  }

  return typeof mimeType === 'string' &&
    mimeType.indexOf(SOURCE_INGESTION_POLICY.imageMimeTypePrefix) === 0 &&
    mimeType.length > SOURCE_INGESTION_POLICY.imageMimeTypePrefix.length;
}
