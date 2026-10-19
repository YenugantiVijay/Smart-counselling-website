#!/usr/bin/env node
const crypto = require('node:crypto');

const password = process.argv[2] || 'DemoAdmin2026!';
const salt = crypto.randomBytes(24).toString('hex');
const sessionSecret = crypto.randomBytes(48).toString('hex');

crypto.scrypt(password, salt, 64, (err, derivedKey) => {
  if (err) {
    console.error('Error generating hash:', err);
    process.exit(1);
  }
  const hash = derivedKey.toString('hex');
  console.log('\n=== Smart Counselling Website — Owner Credentials Generator ===\n');
  console.log(`Password used: "${password}"`);
  console.log('\nCopy and paste the following into your .env file:\n');
  console.log(`ADMIN_USERNAME=owner`);
  console.log(`ADMIN_PASSWORD_SALT=${salt}`);
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log(`SESSION_SECRET=${sessionSecret}`);
  console.log(`WHATSAPP_NUMBER=919876543210`);
  console.log('\n=================================================================\n');
});
