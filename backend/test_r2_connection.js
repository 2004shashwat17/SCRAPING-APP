#!/usr/bin/env node
require('dotenv').config();
const { isCloudStorageEnabled, saveCookieToCloud, getCookieFromCloud } = require('./src/utils/cookieStorage');

async function test() {
  console.log('🧪 Testing Cloudflare R2 connection...\n');
  console.log('Environment variables:');
  console.log('  USE_CLOUD_STORAGE:', process.env.USE_CLOUD_STORAGE);
  console.log('  R2_ENDPOINT:', process.env.R2_ENDPOINT ? '✅ Set' : '❌ Not set');
  console.log('  R2_ACCESS_KEY_ID:', process.env.R2_ACCESS_KEY_ID ? '✅ Set' : '❌ Not set');
  console.log('  R2_SECRET_ACCESS_KEY:', process.env.R2_SECRET_ACCESS_KEY ? '✅ Set' : '❌ Not set');
  console.log('  R2_BUCKET:', process.env.R2_BUCKET || 'osint-cookies (default)');
  console.log('  SAVE_PLAINTEXT_COOKIES:', process.env.SAVE_PLAINTEXT_COOKIES || 'false');
  console.log('\nCloud storage enabled:', isCloudStorageEnabled() ? '✅ YES' : '❌ NO');
  
  if (!isCloudStorageEnabled()) {
    console.error('\n❌ Cloud storage not enabled.');
    console.error('Please check your .env file has:');
    console.error('  USE_CLOUD_STORAGE=true');
    console.error('  R2_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com');
    console.error('  R2_ACCESS_KEY_ID=<your-key>');
    console.error('  R2_SECRET_ACCESS_KEY=<your-secret>');
    process.exit(1);
  }
  
  // Test save
  const testCookies = [
    { name: 'c_user', value: 'test123456', domain: '.facebook.com', path: '/', expires: Date.now() / 1000 + 86400 },
    { name: 'xs', value: 'test_xs_token_value', domain: '.facebook.com', path: '/', expires: Date.now() / 1000 + 86400 },
    { name: 'datr', value: 'test_datr_value', domain: '.facebook.com', path: '/', expires: Date.now() / 1000 + 86400 * 365 },
  ];
  const filename = `test_${Date.now()}.json`;
  
  console.log('\n📤 Testing upload to R2...');
  console.log('Filename:', filename);
  try {
    const path = await saveCookieToCloud(filename, testCookies);
    console.log('✅ Upload successful!');
    console.log('   Path:', path);
  } catch (err) {
    console.error('❌ Upload failed:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  }
  
  console.log('\n📥 Testing download from R2...');
  try {
    const retrieved = await getCookieFromCloud(filename);
    console.log('✅ Download successful!');
    console.log('   Retrieved', retrieved.length, 'cookies');
    console.log('   First cookie:', retrieved[0]);
    
    // Verify content
    if (retrieved[0].name === 'c_user' && retrieved[0].value === 'test123456') {
      console.log('✅ Content verification passed!');
    } else {
      console.error('❌ Content mismatch!');
      process.exit(1);
    }
  } catch (err) {
    console.error('❌ Download failed:', err.message);
    console.error('Full error:', err);
    process.exit(1);
  }
  
  console.log('\n🎉 All R2 tests passed! ');
  console.log('✅ Your Cloudflare R2 storage is configured correctly.');
  console.log('\nNext steps:');
  console.log('  1. Restart your backend: npm start');
  console.log('  2. Connect Facebook through the dashboard');
  console.log('  3. Check R2 bucket for saved cookie files');
}

test().catch(err => {
  console.error('\n💥 Unexpected error:', err);
  process.exit(1);
});
