const crypto = require('crypto');

/**
 * DOKU Checkout - Signature Generator (HMAC SHA256)
 * 
 * Ini jauh lebih simpel dari SNAP Adapter.
 * Hanya butuh Client-Id + Secret Key, tanpa RSA / Access Token.
 * 
 * Component Signature:
 *   Client-Id:{clientId}\n
 *   Request-Id:{requestId}\n
 *   Request-Timestamp:{timestamp}\n
 *   Request-Target:{targetPath}\n
 *   Digest:{digest}         <-- hanya untuk POST (ada body)
 *
 * Signature = HMAC-SHA256(componentSignature, secretKey) -> base64
 */

function generateDigest(body) {
  const minifiedBody = JSON.stringify(body);
  const hash = crypto.createHash('sha256').update(minifiedBody).digest();
  return hash.toString('base64');
}

function generateSignature(clientId, secretKey, requestId, timestamp, targetPath, body) {
  const digest = generateDigest(body);

  const componentSignature =
    `Client-Id:${clientId}\n` +
    `Request-Id:${requestId}\n` +
    `Request-Timestamp:${timestamp}\n` +
    `Request-Target:${targetPath}\n` +
    `Digest:${digest}`;

  const hmac = crypto.createHmac('sha256', secretKey).update(componentSignature).digest();
  return `HMACSHA256=${hmac.toString('base64')}`;
}

/**
 * Generate ISO 8601 timestamp dalam format UTC+0
 * DOKU Checkout memerlukan format UTC (bukan WIB!)
 * Format: YYYY-MM-DDTHH:mm:ssZ
 */
function getTimestamp() {
  return new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');
}

module.exports = { generateSignature, generateDigest, getTimestamp };
