const crypto = require('crypto');

const ALGO = process.env.COOKIE_ENCRYPTION_ALGO || 'aes-256-gcm';
const KEY_B64 = process.env.COOKIE_ENCRYPTION_KEY;
if (!KEY_B64) {
  console.warn('WARNING: COOKIE_ENCRYPTION_KEY is not set. Encryption will fail at runtime.');
}
const KEY = KEY_B64 ? Buffer.from(KEY_B64, 'base64') : null; // 32 bytes expected

function encryptJSON(obj) {
  if (!KEY) throw new Error('COOKIE_ENCRYPTION_KEY not configured');
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, KEY, iv);
  const ct = Buffer.concat([cipher.update(JSON.stringify(obj), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return { ct: ct.toString('base64'), iv: iv.toString('base64'), tag: tag.toString('base64') };
}

function decryptJSON(enc) {
  if (!KEY) throw new Error('COOKIE_ENCRYPTION_KEY not configured');
  const { ct, iv, tag } = enc;
  const decipher = crypto.createDecipheriv(ALGO, KEY, Buffer.from(iv, 'base64'));
  decipher.setAuthTag(Buffer.from(tag, 'base64'));
  const plain = Buffer.concat([decipher.update(Buffer.from(ct, 'base64')), decipher.final()]);
  return JSON.parse(plain.toString('utf8'));
}

module.exports = { encryptJSON, decryptJSON };
