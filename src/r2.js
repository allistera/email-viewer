/**
 * R2 storage helpers
 */

/**
 * Upload raw email to R2
 */
export async function uploadRawEmail(bucket, messageId, emailStream) {
  const key = `raw/${messageId}.eml`;
  await bucket.put(key, emailStream);
  return key;
}

/**
 * Upload attachment to R2
 */
export async function uploadAttachment(bucket, messageId, attachmentId, filename, data) {
  const key = `att/${messageId}/${attachmentId}/${filename}`;
  await bucket.put(key, data);
  return key;
}

/**
 * Get raw email from R2
 */
export async function getRawEmail(bucket, messageId) {
  const key = `raw/${messageId}.eml`;
  return bucket.get(key);
}

/**
 * Get attachment from R2
 */
export async function getAttachmentData(bucket, r2Key) {
  return bucket.get(r2Key);
}

/**
 * Delete raw email from R2
 */
export async function deleteRawEmail(bucket, messageId) {
  const key = `raw/${messageId}.eml`;
  return bucket.delete(key);
}

/**
 * Delete attachment from R2
 */
export async function deleteAttachment(bucket, r2Key) {
  return bucket.delete(r2Key);
}

/**
 * Stream data from R2 object
 */
export function streamR2Object(r2Object) {
  return r2Object.body;
}

/**
 * Get R2 object metadata
 */
export function getR2Metadata(r2Object) {
  return {
    size: r2Object.size,
    etag: r2Object.etag,
    httpEtag: r2Object.httpEtag,
    uploaded: r2Object.uploaded,
    httpMetadata: r2Object.httpMetadata
  };
}
