#!/usr/bin/env node
/**
 * Test script to verify plaintext cookie saving (JSON + .pkl)
 * Usage:
 *   SAVE_PLAINTEXT_COOKIES=true node backend/test_plaintext_cookies.js
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const COOKIES_DIR = path.join(__dirname, 'cookies');
if (!fs.existsSync(COOKIES_DIR)) {
  fs.mkdirSync(COOKIES_DIR, { recursive: true, mode: 0o700 });
}

// Mock cookies (realistic Facebook session)
const mockCookies = [
  { name: 'c_user', value: '123456789', domain: '.facebook.com', path: '/', expires: Date.now() / 1000 + 86400 * 30 },
  { name: 'xs', value: '12%3Aabcd1234%3A2%3A1234567890', domain: '.facebook.com', path: '/', expires: Date.now() / 1000 + 86400 * 30 },
  { name: 'datr', value: 'abcdefghijklmnopqrstuvwxyz', domain: '.facebook.com', path: '/', expires: Date.now() / 1000 + 86400 * 365 },
];

const testUserId = 'test_user_' + Date.now();
const timestamp = Date.now();
const filename = `${testUserId}_${timestamp}.json`;
const filepath = path.join(COOKIES_DIR, filename);

console.log('🧪 Testing plaintext cookie save...');
console.log('SAVE_PLAINTEXT_COOKIES=' + process.env.SAVE_PLAINTEXT_COOKIES);

// Step 1: Write JSON
fs.writeFileSync(filepath, JSON.stringify(mockCookies, null, 2), { encoding: 'utf8', mode: 0o600 });
console.log('✅ Wrote JSON:', filepath);

// Step 2: If SAVE_PLAINTEXT_COOKIES is enabled, write .pkl
if (process.env.SAVE_PLAINTEXT_COOKIES === 'true') {
  try {
    const pklFilepath = filepath.replace(/\.json$/, '.pkl');
    const pythonCmd = `python3 -c "import json,pickle,sys; pickle.dump(json.load(open('${filepath}')), open('${pklFilepath}','wb'))"`;
    execSync(pythonCmd, { stdio: 'ignore' });
    fs.chmodSync(pklFilepath, 0o600);
    console.log('✅ Wrote .pkl:', pklFilepath);

    // Verify we can read it back
    const verifyCmd = `python3 -c "import pickle,json; print(json.dumps(pickle.load(open('${pklFilepath}','rb')), indent=2))"`;
    const output = execSync(verifyCmd, { encoding: 'utf8' });
    const parsed = JSON.parse(output);
    if (parsed.length === mockCookies.length && parsed[0].name === 'c_user') {
      console.log('✅ .pkl verified: can be read back and contains c_user');
    } else {
      console.error('❌ .pkl verification failed');
    }
  } catch (pklErr) {
    console.error('❌ Failed to write .pkl (is python3 installed?):', pklErr.message);
  }
} else {
  console.log('⏭️  SAVE_PLAINTEXT_COOKIES not enabled, skipping .pkl');
}

console.log('\n📁 Files created in backend/cookies/:');
console.log('  - ' + filename);
if (process.env.SAVE_PLAINTEXT_COOKIES === 'true') {
  console.log('  - ' + filename.replace(/\.json$/, '.pkl'));
}

console.log('\n✅ Test complete! Run with SAVE_PLAINTEXT_COOKIES=true to enable .pkl');
