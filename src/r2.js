/**
 * R2 Storage Helper
 */

export const R2 = {
  /**
   * Save raw email content
   * @param {R2Bucket} bucket 
   * @param {string} messageId 
   * @param {ReadableStream|ArrayBuffer} content 
   * @returns {string} The key used
   */
  async saveRawEmail(bucket, messageId, content) {
    const key = `raw/${messageId}.eml`;
    await bucket.put(key, content);
    return key;
  },

  /**
   * Save an attachment
   * @param {R2Bucket} bucket 
   * @param {string} messageId 
   * @param {string} attachmentId 
   * @param {string} filename 
   * @param {ReadableStream|ArrayBuffer} content 
   * @returns {string} The key used
   */
  async saveAttachment(bucket, messageId, attachmentId, filename, content) {
    const safeFilename = filename.replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const key = `att/${messageId}/${attachmentId}/${safeFilename}`;
    await bucket.put(key, content);
    return key;
  }
};
