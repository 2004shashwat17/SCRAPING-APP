const { S3Client, PutObjectCommand, GetObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

// Cloudflare R2 configuration
const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT, // e.g., https://<account-id>.r2.cloudflarestorage.com
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

const BUCKET = process.env.R2_BUCKET || 'osint-cookies';
const USE_CLOUD = process.env.USE_CLOUD_STORAGE === 'true';

/**
 * Save cookie JSON to Cloudflare R2
 * @param {string} filename - e.g., "userId_timestamp.json"
 * @param {Array} cookies - cookie array
 * @returns {Promise<string>} - R2 path (s3://bucket/key)
 */
async function saveCookieToCloud(filename, cookies) {
  if (!USE_CLOUD) {
    throw new Error('USE_CLOUD_STORAGE is not enabled');
  }
  
  const key = `cookies/${filename}`;
  
  try {
    // Save JSON
    await s3Client.send(new PutObjectCommand({
      Bucket: BUCKET,
      Key: key,
      Body: JSON.stringify(cookies, null, 2),
      ContentType: 'application/json',
      // Optional: add metadata
      Metadata: {
        'saved-at': new Date().toISOString(),
        'cookie-count': String(cookies.length),
      },
    }));
    
    const cloudPath = `r2://${BUCKET}/${key}`;
    console.log(`✅ Saved cookie to R2: ${cloudPath}`);
    
    // If SAVE_PLAINTEXT_COOKIES is enabled, also save .pkl
    if (process.env.SAVE_PLAINTEXT_COOKIES === 'true') {
      try {
        const { execSync } = require('child_process');
        const tmpJson = `/tmp/${filename}`;
        const tmpPkl = tmpJson.replace(/\.json$/, '.pkl');
        
        // Write temp JSON, convert to pkl, upload pkl
        fs.writeFileSync(tmpJson, JSON.stringify(cookies), 'utf8');
        execSync(`python3 -c "import json,pickle; pickle.dump(json.load(open('${tmpJson}')), open('${tmpPkl}','wb'))"`);
        
        const pklKey = key.replace(/\.json$/, '.pkl');
        await s3Client.send(new PutObjectCommand({
          Bucket: BUCKET,
          Key: pklKey,
          Body: fs.readFileSync(tmpPkl),
          ContentType: 'application/octet-stream',
        }));
        
        // Cleanup temp files
        try { fs.unlinkSync(tmpJson); } catch (e) {}
        try { fs.unlinkSync(tmpPkl); } catch (e) {}
        
        console.log(`✅ Saved .pkl to R2: r2://${BUCKET}/${pklKey}`);
      } catch (pklErr) {
        console.warn('Failed to create/upload .pkl:', pklErr.message);
      }
    }
    
    return cloudPath;
  } catch (error) {
    console.error('Failed to save cookie to R2:', error);
    throw error;
  }
}

/**
 * Get cookie JSON from Cloudflare R2
 * @param {string} filenameOrPath - either "userId_timestamp.json" or full "r2://bucket/cookies/file.json"
 * @returns {Promise<Array>} - cookie array
 */
async function getCookieFromCloud(filenameOrPath) {
  if (!USE_CLOUD) {
    throw new Error('USE_CLOUD_STORAGE is not enabled');
  }
  
  // Parse R2 path if provided
  let key;
  if (filenameOrPath.startsWith('r2://')) {
    // Extract key from r2://bucket/key format
    const parts = filenameOrPath.replace('r2://', '').split('/');
    parts.shift(); // remove bucket name
    key = parts.join('/');
  } else {
    key = `cookies/${filenameOrPath}`;
  }
  
  try {
    const response = await s3Client.send(new GetObjectCommand({
      Bucket: BUCKET,
      Key: key,
    }));
    
    const body = await response.Body.transformToString();
    return JSON.parse(body);
  } catch (error) {
    console.error('Failed to get cookie from R2:', error);
    throw error;
  }
}

/**
 * Check if cloud storage is enabled and configured
 * @returns {boolean}
 */
function isCloudStorageEnabled() {
  return USE_CLOUD && !!process.env.R2_ENDPOINT && !!process.env.R2_ACCESS_KEY_ID;
}

module.exports = {
  saveCookieToCloud,
  getCookieFromCloud,
  isCloudStorageEnabled,
};
