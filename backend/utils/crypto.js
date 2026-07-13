const crypto = require('crypto');

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;
const TAG_LEN = 16;

function getKey() {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error('TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
  }
  return Buffer.from(hex, 'hex');
}

// Returns "iv:tag:ciphertext" in hex.
function encrypt(plaintext) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LEN);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

// Accepts the "iv:tag:ciphertext" format from encrypt().
// Returns plaintext on success, null if the input isn't in encrypted format
// (handles pre-encryption tokens gracefully during migration).
function decrypt(stored) {
  const parts = stored.split(':');
  if (parts.length !== 3) return stored; // plaintext (pre-migration)

  try {
    const key = getKey();
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const data = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    return decipher.update(data) + decipher.final('utf8');
  } catch (err) {
    // Falling back to the raw stored value keeps a bad decrypt from taking
    // down the whole sync (it'll just fail as an invalid GitHub token
    // downstream), but that failure mode looks identical to "GitHub token
    // expired" unless this is logged - most likely cause is
    // TOKEN_ENCRYPTION_KEY being rotated/wrong for tokens encrypted under
    // the old key.
    console.error('[crypto] decrypt failed, falling back to raw stored value:', err.message);
    return stored;
  }
}

module.exports = { encrypt, decrypt };
