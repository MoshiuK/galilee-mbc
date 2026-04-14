/**
 * S3-Compatible Storage Service
 *
 * Handles uploading and retrieving recordings, voicemails, and branding
 * assets from S3-compatible storage (AWS S3, DigitalOcean Spaces,
 * Backblaze B2, MinIO, etc.).
 *
 * Falls back to local filesystem if S3 is not configured.
 */

const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');

let s3Client = null;

function getS3Client() {
  if (s3Client) return s3Client;

  if (!process.env.S3_BUCKET) return null;

  const config = {
    region: process.env.AWS_REGION || 'us-east-1',
  };

  // Support custom endpoint for non-AWS S3 (DigitalOcean Spaces, MinIO, etc.)
  if (process.env.S3_ENDPOINT) {
    config.endpoint = process.env.S3_ENDPOINT;
    config.forcePathStyle = true;
  }

  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    config.credentials = {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    };
  }

  s3Client = new S3Client(config);
  return s3Client;
}

/**
 * Check if S3 storage is configured.
 */
function isS3Configured() {
  return !!process.env.S3_BUCKET;
}

/**
 * Upload a file to S3 or local storage.
 * @param {string} key - S3 key / file path (e.g., "recordings/tenant-id/call-123.wav")
 * @param {Buffer|Stream} body - File content
 * @param {string} contentType - MIME type
 * @returns {string} URL to access the file
 */
async function uploadFile(key, body, contentType = 'audio/wav') {
  if (isS3Configured()) {
    const client = getS3Client();
    await client.send(new PutObjectCommand({
      Bucket: process.env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }));

    // Return the S3 URL
    if (process.env.S3_CDN_URL) {
      return `${process.env.S3_CDN_URL}/${key}`;
    }
    return `https://${process.env.S3_BUCKET}.s3.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com/${key}`;
  }

  // Local filesystem fallback
  const localPath = path.join(process.env.STORAGE_PATH || './storage', key);
  const dir = path.dirname(localPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(localPath, body);
  return `/storage/${key}`;
}

/**
 * Get a signed URL for temporary access to an S3 file.
 */
async function getSignedFileUrl(key, expiresIn = 3600) {
  if (!isS3Configured()) {
    return `/storage/${key}`;
  }

  const client = getS3Client();
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: key,
  });

  return getSignedUrl(client, command, { expiresIn });
}

/**
 * Delete a file from S3 or local storage.
 */
async function deleteFile(key) {
  try {
    if (isS3Configured()) {
      const client = getS3Client();
      await client.send(new DeleteObjectCommand({
        Bucket: process.env.S3_BUCKET,
        Key: key,
      }));
    } else {
      const localPath = path.join(process.env.STORAGE_PATH || './storage', key);
      if (fs.existsSync(localPath)) fs.unlinkSync(localPath);
    }
  } catch (err) {
    logger.error(`Failed to delete file: ${key}`, err);
  }
}

/**
 * Generate a storage key for tenant files.
 */
function tenantKey(tenantId, category, filename) {
  return `${category}/${tenantId}/${filename}`;
}

module.exports = {
  isS3Configured,
  uploadFile,
  getSignedFileUrl,
  deleteFile,
  tenantKey,
};
