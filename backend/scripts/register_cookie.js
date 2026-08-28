#!/usr/bin/env node
/**
 * Simple script to register an existing cookie file into MongoDB
 * Usage: node scripts/register_cookie.js /absolute/path/to/cookie.json
 * Or:    node scripts/register_cookie.js filename.json (will look in COOKIE_DIR)
 */
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');
require('dotenv').config({ path: path.join(__dirname, '..', '..', '.env') });

const Cookie = require('../src/models/Cookie');

async function main() {
  const arg = process.argv[2];
  if (!arg) {
    console.error('Usage: node scripts/register_cookie.js <path-or-filename>');
    process.exit(2);
  }

  let cookiePath = arg;
  if (!path.isAbsolute(arg)) {
    const COOKIE_DIR = process.env.COOKIE_DIR || path.join(__dirname, '..', '..', 'cookies');
    cookiePath = path.join(COOKIE_DIR, arg);
  }

  if (!fs.existsSync(cookiePath)) {
    console.error('Cookie file not found:', cookiePath);
    process.exit(2);
  }

  try {
    await mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log('Connected to MongoDB');

    const filename = path.basename(cookiePath);
    const existing = await Cookie.findOne({ filename });
    if (existing) {
      console.error('Cookie already registered:', existing._id.toString());
      process.exit(0);
    }

    try { fs.chmodSync(cookiePath, 0o600); } catch (e) { }

    const doc = new Cookie({ filename, path: cookiePath, status: 'ready' });
    await doc.save();
    console.log('Registered cookie:', doc._id.toString());
    process.exit(0);
  } catch (e) {
    console.error('Failed to register cookie:', e.message || e);
    process.exit(1);
    process.exit(1);
  }
}

main();
