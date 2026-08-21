const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET = process.env.R2_BUCKET || 'pabrikenangan-media';

// Domain publik yang dipasang ke bucket R2 (custom domain Cloudflare).
const CDN_BASE_URL = (process.env.CDN_BASE_URL || '').replace(/\/+$/, '');

const isConfigured = Boolean(R2_ACCOUNT_ID && R2_ACCESS_KEY_ID && R2_SECRET_ACCESS_KEY && CDN_BASE_URL);

let s3 = null;
function getClient() {
  if (!isConfigured) throw new Error('R2 belum dikonfigurasi (cek R2_* dan CDN_BASE_URL di .env).');
  if (!s3) {
    s3 = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
    });
  }
  return s3;
}

/** URL publik untuk sebuah object key. Tiap segmen di-encode agar aman untuk nama berspasi. */
function publicUrl(key) {
  return `${CDN_BASE_URL}/${key.split('/').map(encodeURIComponent).join('/')}`;
}

async function putObject({ key, body, contentType, immutable = true }) {
  await getClient().send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    Body: body,
    ContentType: contentType || 'application/octet-stream',
    // Hasil foto tidak pernah berubah setelah diunggah -> aman di-cache selamanya.
    // Frame bisa ditimpa, jadi pakai cache pendek.
    CacheControl: immutable ? 'public, max-age=31536000, immutable' : 'public, max-age=300',
  }));
  return { key, url: publicUrl(key), bucket: R2_BUCKET, provider: 'r2' };
}

async function deleteObject(key) {
  await getClient().send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
}

module.exports = { putObject, deleteObject, publicUrl, isConfigured, R2_BUCKET };
